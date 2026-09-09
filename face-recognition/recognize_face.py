import math
import os
import time
from collections import deque
from datetime import datetime, time as dt_time

import face_recognition
import cv2
import requests

import face_store

# Plain Euclidean distance (face_store.find_matches converts ChromaDB's raw
# squared-l2 output back to this), matching dlib's own documented ~0.6
# "same person" threshold convention. Measured on this project's real
# enrolled photos: same person/different angle sits at ~0.24-0.43, and a
# same-photo JPEG-roundtrip re-detection sits at ~0.09 -- both comfortably
# under CONFIDENT_DISTANCE below.
CONFIDENT_DISTANCE = 0.45
MATCH_DISTANCE = 0.6

# A "confident" best match is downgraded to uncertain if some OTHER person's
# closest vector is within this margin of it -- catches the case where two
# different people are both plausibly close, not just "is the top hit good
# enough on its own."
RIVAL_MARGIN_MIN = 0.08

# How many nearest vectors to pull from ChromaDB per query. This needs to be
# comfortably more than "top 3": each person has 5 enrolled angle-vectors
# that cluster tightly (~0.25-0.43 apart, per the measurements above), so a
# small top-k can be entirely dominated by one person's own other angles,
# leaving no rival identity at all to run the margin check against.
QUERY_TOP_K = 10


def classify_match(matches):
    """matches: [(name, distance), ...] nearest-first from face_store.find_matches.
    Returns (name_or_None, decision, best_distance, rival_name_or_None, rival_distance_or_None).
    decision is one of "confident", "uncertain", "unknown"."""
    if not matches:
        return None, "unknown", None, None, None

    best_name, best_distance = matches[0]
    # the closest vector belonging to a DIFFERENT person than the top pick --
    # not just the literal 2nd-nearest vector, which is usually the same
    # person's other angle and would make the margin meaningless.
    rival = next(((n, d) for n, d in matches[1:] if n != best_name), None)
    rival_name, rival_distance = rival if rival else (None, None)

    if best_distance > MATCH_DISTANCE:
        return None, "unknown", best_distance, rival_name, rival_distance

    if rival is not None and (rival_distance - best_distance) < RIVAL_MARGIN_MIN:
        return best_name, "uncertain", best_distance, rival_name, rival_distance

    if best_distance <= CONFIDENT_DISTANCE:
        return best_name, "confident", best_distance, rival_name, rival_distance

    return best_name, "uncertain", best_distance, rival_name, rival_distance

# --- Motion-based liveness thresholds (tune these) ---
# Passive image-texture liveness (Laplacian/glare/color) was removed: it's
# unreliable with a plain RGB webcam. This instead tracks each face's
# bounding-box position across frames -- a real person is never perfectly
# static frame to frame, while a photo/screen held rigidly in place is.
# A face with no movement for STATIC_SECONDS suppresses recognition (shows
# "STATIC?" instead of a name) below, regardless of how good the ChromaDB
# match is. Note this only catches a photo held/propped rigidly still -- a
# hand-held photo with natural tremor can still read as "live".
MOTION_HISTORY_FRAMES = 10       # frames of position history required before judging LIVE vs STATIC
MOVEMENT_PIXEL_THRESHOLD = 10    # min net drift (px, full-res frame, averaged -- see below) counted as real movement
STATIC_SECONDS = 3.0             # no movement for this long -> STATIC?
TRACK_MATCH_MAX_DISTANCE = 100   # max center-to-center distance (px) to match a detection to an existing track
TRACK_EXPIRE_SECONDS = 1.0       # drop a track if unmatched for this long (face left the frame)


class FaceTrack:
    """Tracks one face's position across frames to estimate motion-based liveness."""

    def __init__(self, track_id, center, box):
        self.id = track_id
        self.center = center
        self.box = box
        self.history = deque(maxlen=MOTION_HISTORY_FRAMES)
        self.history.append(center)
        self.last_seen = time.time()
        self.last_moved_at = time.time()

    def update(self, center, box):
        self.history.append(center)
        self.center = center
        self.box = box
        self.last_seen = time.time()

        # Compare the AVERAGE position over the first half of the window to
        # the average over the second half, rather than raw single-frame
        # deltas. Face detection has real quantization jitter (it runs on a
        # 4x-downscaled frame internally, so even 1-2px of detector noise
        # there becomes 4-8px once scaled back up) -- a single-frame delta
        # threshold gets tripped by that noise alone, so a genuinely
        # motionless face (a rigidly held photo) could never accumulate
        # enough uninterrupted stillness to ever read as static. Averaging
        # a few frames on each side cancels random jitter (zero mean) while
        # still catching real, sustained drift.
        if len(self.history) >= MOTION_HISTORY_FRAMES:
            half = MOTION_HISTORY_FRAMES // 2
            positions = list(self.history)
            first_half, second_half = positions[:half], positions[half:]
            avg_first = (sum(p[0] for p in first_half) / half, sum(p[1] for p in first_half) / half)
            avg_second = (sum(p[0] for p in second_half) / len(second_half),
                          sum(p[1] for p in second_half) / len(second_half))
            drift = math.hypot(avg_second[0] - avg_first[0], avg_second[1] - avg_first[1])
            if drift >= MOVEMENT_PIXEL_THRESHOLD:
                self.last_moved_at = time.time()

    def motion_status(self):
        """Returns 'live', 'static', or None if not enough history yet (face just appeared)."""
        if len(self.history) < MOTION_HISTORY_FRAMES:
            return None
        if time.time() - self.last_moved_at >= STATIC_SECONDS:
            return "static"
        return "live"


class FaceTracker:
    """Matches each frame's detections to persistent per-face tracks by nearest
    center, so motion history survives across frames. Each face is tracked
    independently, and a detection with no nearby existing track starts a
    brand new one (fresh motion history)."""

    def __init__(self):
        self._tracks = {}
        self._next_id = 1

    def update(self, detections):
        """detections: list of (center, box). Returns a list of FaceTrack, one per detection, same order."""
        now = time.time()
        for track_id in [tid for tid, tr in self._tracks.items() if now - tr.last_seen > TRACK_EXPIRE_SECONDS]:
            del self._tracks[track_id]

        available_ids = set(self._tracks.keys())
        assigned = []
        for center, box in detections:
            best_id, best_dist = None, TRACK_MATCH_MAX_DISTANCE
            for track_id in available_ids:
                dist = math.hypot(*(a - b for a, b in zip(self._tracks[track_id].center, center)))
                if dist < best_dist:
                    best_id, best_dist = track_id, dist

            if best_id is not None:
                track = self._tracks[best_id]
                track.update(center, box)
                available_ids.discard(best_id)
            else:
                track = FaceTrack(self._next_id, center, box)
                self._tracks[self._next_id] = track
                self._next_id += 1

            assigned.append(track)
        return assigned


def draw_motion_indicator(frame, box, status):
    if status is None:
        return
    top, right, bottom, left = box
    if status == "live":
        text, color = "LIVE", (0, 255, 0)
    else:
        text, color = "STATIC?", (0, 255, 255)
    (text_w, _), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    x = max(left, right - text_w - 4)
    y = bottom - 6
    cv2.putText(frame, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)


BACKEND_URL = os.environ.get("ATTENDIFY_BACKEND_URL", "http://localhost:8000/api/v1")
SCHOOL_START = dt_time(8, 30)

# Names we've already sent to the backend this run (any response, including
# "duplicate" or "holiday") -- avoids re-POSTing for the same person on every
# single frame while they're in view. The backend is still the source of
# truth for cross-run/cross-camera duplicates; this is purely a local
# chatter-reduction cache.
_already_attempted = set()
_printed_not_started = False


def decision_to_confidence(decision, distance):
    """Map classify_match's 3-way decision (+ raw distance) to a 0.0-1.0
    confidence_score for the backend, which buckets on >0.6 / 0.4-0.6 / <0.4."""
    if decision == "confident":
        if distance is None:
            return 0.9
        ratio = min(max(distance / CONFIDENT_DISTANCE, 0.0), 1.0)
        return round(1.0 - ratio * 0.39, 3)  # CONFIDENT_DISTANCE=0 -> 1.0, at threshold -> 0.61
    if decision == "uncertain":
        return 0.5
    return 0.2


def log_attendance(student_name, confidence_score, arrival_dt):
    payload = {
        "student_name": student_name,
        "confidence_score": confidence_score,
        "arrival_time": arrival_dt.isoformat(),
        "date": arrival_dt.date().isoformat(),
    }
    try:
        r = requests.post(f"{BACKEND_URL}/recognition/process-frame", json=payload, timeout=5)
        r.raise_for_status()
        result = r.json()
    except Exception as e:
        print(f"Failed to log {student_name}: {e}")
        return

    status = result.get("status")
    if status == "duplicate":
        print(f"Already logged today: {student_name}")
    elif status == "holiday":
        print("Holiday today — recognition paused")
    elif status == "student_not_found":
        print(f"No matching student record for {student_name} — skipping")
    elif status == "not_late":
        pass
    else:
        time_str = arrival_dt.strftime("%H:%M:%S")
        print(f"Logged: {student_name} at {time_str} — {status}")


def maybe_log_attendance(student_name, confidence_score):
    """Gate on school start time, then hand off to log_attendance (which
    itself gates on holiday/duplicate via the backend)."""
    global _printed_not_started
    now = datetime.now()

    if now.time() < SCHOOL_START:
        if not _printed_not_started:
            print("School not started yet")
            _printed_not_started = True
        return
    _printed_not_started = False

    if student_name in _already_attempted:
        return
    _already_attempted.add(student_name)
    log_attendance(student_name, confidence_score, now)


def main():
    total = face_store.total_encodings_count()
    if total == 0:
        print("No enrolled faces found! Run enroll_face.py first.")
        return

    print(f"Loaded {total} encoding(s) for {face_store.enrolled_people_count()} enrolled person(s). Press Q to quit.")

    cap = cv2.VideoCapture(0)
    tracker = FaceTracker()

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)

        # Downscale for faster detection, then scale results back up
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        scaled_boxes = []
        for (top, right, bottom, left) in face_locations:
            # Scale face location back up to the original frame size
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4
            scaled_boxes.append((top, right, bottom, left))

        detections = [(((l + r) / 2, (t + b) / 2), (t, r, b, l)) for (t, r, b, l) in scaled_boxes]
        tracks = tracker.update(detections)

        for (top, right, bottom, left), face_encoding, track in zip(scaled_boxes, face_encodings, tracks):
            matches = face_store.find_matches(face_encoding, n=QUERY_TOP_K)
            match_name, decision, distance, rival_name, rival_distance = classify_match(matches)
            motion_status = track.motion_status()

            if motion_status != "static" and decision in ("confident", "uncertain") and match_name:
                confidence_score = decision_to_confidence(decision, distance)
                maybe_log_attendance(match_name, confidence_score)

            if motion_status == "static":
                # A face that hasn't moved at all for STATIC_SECONDS is treated
                # as unverified regardless of how good the ChromaDB match is --
                # this is what actually suppresses recognition for a rigidly
                # held/propped photo. A hand-held photo with natural tremor may
                # still read as "live" (motion tracking alone can't tell the
                # difference); MOVEMENT_PIXEL_THRESHOLD/STATIC_SECONDS above are
                # the knobs to make that harder to get away with.
                name = "STATIC?"
                color = (0, 255, 255)  # yellow: unverified, not a confirmed spoof
            elif decision == "confident":
                name = match_name
                color = (0, 255, 0)  # green: confident match
            elif decision == "uncertain":
                name = f"? {match_name}"
                color = (0, 255, 255)  # yellow: uncertain
            else:
                name = "Unknown"
                color = (0, 0, 255)  # red

            dist_str = f"{distance:.3f}" if distance is not None else "n/a"
            rival_str = f"{rival_name}({rival_distance:.3f})" if rival_name is not None else "none"
            blocked_note = " -> BLOCKED (static)" if motion_status == "static" else ""
            print(f"[track {track.id}] chromadb_name={match_name!r} distance={dist_str} "
                  f"rival={rival_str} decision={decision.upper()} motion={motion_status}{blocked_note}")

            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            label_y = top - 10 if top - 10 > 10 else top + 20
            cv2.rectangle(frame, (left, label_y - 22), (right, label_y + 4), color, cv2.FILLED)
            cv2.putText(frame, name, (left + 4, label_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

            draw_motion_indicator(frame, (top, right, bottom, left), motion_status)

        cv2.imshow("Recognize Face", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
