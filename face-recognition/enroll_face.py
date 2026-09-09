import face_recognition
import cv2
import os
import sys
import time
import math
import random
import numpy as np

import face_store
from face_store import KNOWN_FACES_DIR, sanitize

HOLD_SECONDS = 2.0        # how long the face must stay in position before auto-capture
HOLD_GRACE_SECONDS = 0.6  # a brief dip out of position (pose-estimation jitter) doesn't reset the hold timer
STUCK_HINT_SECONDS = 5.0  # how long on one step before we show the "press SPACE" hint
CHECKMARK_SECONDS = 1.1   # how long the post-capture checkmark stays on screen
FLASH_SECONDS = 0.1       # how long the camera-flash effect lasts

FRONT_MAX_ANGLE = 30   # degrees of yaw/pitch still loosely accepted as "facing forward"
TURN_MIN_ANGLE = 10    # degrees of yaw *change from the calibrated front pose* for left/right

# Webcams typically sit at or above eye level, so tilting the head DOWN
# foreshortens the chin/mouth landmarks and produces a noticeably smaller
# pitch swing per degree of actual movement than tilting UP does -- UP and
# DOWN are not symmetric here, so they get separate (tuned) thresholds
# instead of sharing one TILT_MIN_ANGLE.
TILT_MIN_ANGLE_UP = 8
TILT_MIN_ANGLE_DOWN = 4

# The generic 3D face model used below is only a rough proxy for any given
# person's real face geometry, so the absolute pitch/yaw solvePnP reports at
# "front" is rarely exactly 0/0 -- it carries a per-person/per-camera offset.
# Rather than fight that, every "front"-posed step is validated with a loose
# absolute check, and the very first one's measured pose is used as the
# baseline that left/right/up/down are measured *relative to*. This cancels
# out the offset entirely.

# Head-pose sign conventions vary slightly by camera/lens. If LEFT/RIGHT or
# UP/DOWN end up triggering on the opposite physical movement, flip the
# matching constant to -1. The live yaw/pitch readout in the bottom-left
# corner of the window shows which way the numbers move as you turn your
# head, which makes it easy to tell which sign to flip.
YAW_SIGN = -1
PITCH_SIGN = 1

# Each step has a "key" (its identity for storage/filenames -- must be
# unique) and a "pose" (which pose check applies -- several steps reuse the
# "front" check since we have no expression/accessory classifier, only head
# pose estimation).
STEPS = [
    {"key": "front",   "pose": "front", "instruction": "Look STRAIGHT at the camera"},
    {"key": "left",    "pose": "left",  "instruction": "Turn slightly LEFT"},
    {"key": "right",   "pose": "right", "instruction": "Turn slightly RIGHT"},
    {"key": "up",      "pose": "up",    "instruction": "Tilt slightly UP"},
    {"key": "down",    "pose": "down",  "instruction": "Tilt slightly DOWN"},
    {"key": "smile",   "pose": "front", "instruction": "SMILE naturally"},
    {"key": "glasses", "pose": "front", "instruction": "Look STRAIGHT (glasses on, if you wear them)"},
    {"key": "confirm", "pose": "front", "instruction": "Look STRAIGHT (final confirmation)"},
]

# ----- Palette (BGR, since that's what OpenCV draws in) -----
CYAN = (255, 255, 0)
GREEN = (70, 220, 90)
YELLOW = (0, 220, 255)
RED = (50, 50, 230)
GREY = (110, 110, 110)
WHITE = (255, 255, 255)

# Generic 3D face model (arbitrary units, nose tip at the origin) used with
# solvePnP to estimate head pose from 2D landmarks.
MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),          # Nose tip
    (0.0, -330.0, -65.0),     # Chin
    (-225.0, 170.0, -135.0),  # Left eye, left corner
    (225.0, 170.0, -135.0),   # Right eye, right corner
    (-150.0, -150.0, -125.0), # Left mouth corner
    (150.0, -150.0, -125.0),  # Right mouth corner
], dtype="double")


def get_head_pose(landmarks, frame_shape):
    """Estimate (pitch, yaw) in degrees from 68-point face landmarks via solvePnP."""
    image_points = np.array([
        landmarks["nose_bridge"][3],
        landmarks["chin"][8],
        landmarks["left_eye"][0],
        landmarks["right_eye"][3],
        landmarks["top_lip"][0],
        landmarks["top_lip"][6],
    ], dtype="double")

    h, w = frame_shape[:2]
    focal_length = w
    camera_matrix = np.array([
        [focal_length, 0, w / 2],
        [0, focal_length, h / 2],
        [0, 0, 1],
    ], dtype="double")
    dist_coeffs = np.zeros((4, 1))

    ok, rotation_vector, translation_vector = cv2.solvePnP(
        MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not ok:
        return None

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    projection_matrix = cv2.hconcat((rotation_matrix, translation_vector))
    euler_angles = cv2.decomposeProjectionMatrix(projection_matrix)[6].flatten()
    pitch, yaw, _roll = (float(a) for a in euler_angles)

    # decomposeProjectionMatrix can wrap pitch around +/-90 degrees.
    if pitch < -90:
        pitch = -(180 + pitch)
    elif pitch > 90:
        pitch = 180 - pitch

    return pitch * PITCH_SIGN, yaw * YAW_SIGN


def largest_face(face_locations):
    return max(face_locations, key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]))


def in_position(pose, pitch, yaw, baseline=None):
    if pose == "front" or baseline is None:
        return abs(yaw) <= FRONT_MAX_ANGLE and abs(pitch) <= FRONT_MAX_ANGLE

    base_pitch, base_yaw = baseline
    d_yaw = yaw - base_yaw
    d_pitch = pitch - base_pitch

    if pose == "left":
        return d_yaw <= -TURN_MIN_ANGLE
    if pose == "right":
        return d_yaw >= TURN_MIN_ANGLE
    if pose == "up":
        return d_pitch >= TILT_MIN_ANGLE_UP
    if pose == "down":
        return d_pitch <= -TILT_MIN_ANGLE_DOWN
    return False


def distance_to_target(pose, pitch, yaw, baseline):
    """How many more degrees of d_yaw/d_pitch are needed to satisfy this step, for the debug readout."""
    if baseline is None:
        return None
    base_pitch, base_yaw = baseline
    d_yaw = yaw - base_yaw
    d_pitch = pitch - base_pitch
    if pose == "left":
        return f"need d_yaw<=-{TURN_MIN_ANGLE} (at {d_yaw:+.0f})"
    if pose == "right":
        return f"need d_yaw>=+{TURN_MIN_ANGLE} (at {d_yaw:+.0f})"
    if pose == "up":
        return f"need d_pitch>=+{TILT_MIN_ANGLE_UP} (at {d_pitch:+.0f})"
    if pose == "down":
        return f"need d_pitch<=-{TILT_MIN_ANGLE_DOWN} (at {d_pitch:+.0f})"
    return None


# ---------------------------------------------------------------------------
# Cinematic look: a dark, gently vignetted grade applied to the frame *after*
# detection/capture have already used the pristine frame, so recognition
# accuracy and saved reference photos are unaffected -- this only touches
# what's shown on screen.
# ---------------------------------------------------------------------------

_VIGNETTE_CACHE = {}


def get_vignette(h, w):
    key = (h, w)
    cached = _VIGNETTE_CACHE.get(key)
    if cached is None:
        y, x = np.ogrid[:h, :w]
        cx, cy = w / 2.0, h / 2.0
        max_dist = math.hypot(cx, cy)
        dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / max_dist
        mask = 1.0 - 0.5 * np.clip(dist, 0, 1) ** 2
        cached = mask.astype(np.float32)[..., None]
        _VIGNETTE_CACHE[key] = cached
    return cached


def apply_cinematic_grade(frame):
    h, w = frame.shape[:2]
    vignette = get_vignette(h, w)
    graded = frame.astype(np.float32) * 0.87 * vignette
    return np.clip(graded, 0, 255).astype(np.uint8)


def draw_frame_brackets(frame, length=34, thickness=2, margin=14):
    """Thin corner brackets around the whole frame -- a viewfinder/scanner touch."""
    h, w = frame.shape[:2]
    corners = [(margin, margin, 1, 1), (w - margin, margin, -1, 1),
               (margin, h - margin, 1, -1), (w - margin, h - margin, -1, -1)]
    for x, y, sx, sy in corners:
        cv2.line(frame, (x, y), (x + sx * length, y), CYAN, thickness, cv2.LINE_AA)
        cv2.line(frame, (x, y), (x, y + sy * length), CYAN, thickness, cv2.LINE_AA)


def composite_glow(frame, glow_layer, roi, blur_ksize=23, strength=0.85):
    """Soft-blooms whatever was drawn onto glow_layer within roi, additively,
    onto frame. Blurring is restricted to roi (not the full frame) so this
    stays cheap enough for real-time video."""
    h, w = frame.shape[:2]
    x0, y0, x1, y1 = roi
    x0, y0 = max(int(x0), 0), max(int(y0), 0)
    x1, y1 = min(int(x1), w), min(int(y1), h)
    if x1 - x0 < 3 or y1 - y0 < 3:
        return
    crop = glow_layer[y0:y1, x0:x1]
    if not np.any(crop):
        return
    k = blur_ksize | 1  # GaussianBlur requires an odd kernel size
    blurred = cv2.GaussianBlur(crop, (k, k), 0)
    region = frame[y0:y1, x0:x1]
    boosted = np.clip(blurred.astype(np.float32) * strength, 0, 255).astype(np.uint8)
    cv2.add(region, boosted, dst=region)


# ---------------------------------------------------------------------------
# Face HUD: a scan line, a filling dot matrix, and an 8-segment progress
# ring, all centred on the tracked face. Each is drawn twice per frame --
# once onto a glow layer (later blurred and bloomed onto the frame) and once
# crisp on top -- via composite_glow() in the main loop.
# ---------------------------------------------------------------------------

SCAN_PERIOD = 1.6  # seconds for one full up-down sweep

_DOT_RINGS = [  # (radius fraction of face radius, point count, angle offset degrees)
    (0.20, 5, 0),
    (0.40, 8, 15),
    (0.58, 10, 5),
    (0.75, 12, 20),
    (0.92, 14, 10),
]


def _dot_base_positions():
    pts = []
    for radius_frac, count, offset_deg in _DOT_RINGS:
        for i in range(count):
            angle = math.radians(offset_deg + 360.0 * i / count)
            pts.append((radius_frac * math.cos(angle), radius_frac * math.sin(angle)))
    return pts


_DOT_BASE = _dot_base_positions()
_DOT_TOTAL = len(_DOT_BASE)
_DOT_ORDER = list(range(_DOT_TOTAL))
random.Random(7).shuffle(_DOT_ORDER)  # fixed seed: a stable, scattered reveal order


def draw_scan_line(canvas, center, radius, color, thickness=2):
    t = (time.time() % SCAN_PERIOD) / SCAN_PERIOD
    tri = 1 - abs(2 * t - 1)  # 0 -> 1 -> 0, smooth continuous sweep
    y_top = center[1] - radius * 1.05
    y_bot = center[1] + radius * 1.05
    y = int(y_top + tri * (y_bot - y_top))
    x0 = int(center[0] - radius * 0.92)
    x1 = int(center[0] + radius * 0.92)
    cv2.line(canvas, (x0, y), (x1, y), color, thickness, cv2.LINE_AA)


def draw_dot_matrix(canvas, center, radius, revealed_count, color):
    if revealed_count <= 0:
        return
    cx, cy = center
    for idx in _DOT_ORDER[:revealed_count]:
        dx, dy = _DOT_BASE[idx]
        x = int(cx + dx * radius)
        y = int(cy + dy * radius)
        cv2.circle(canvas, (x, y), 2, color, -1, cv2.LINE_AA)


RING_GAP_DEG = 6


def draw_segmented_ring(canvas, center, radius, total, completed, current_progress, dim_color, bright_color):
    """Apple-Watch-style activity ring: `total` segments around the face,
    filling clockwise from the top as steps complete. The in-progress
    segment fills proportionally to current_progress (the hold timer)."""
    cx, cy = int(center[0]), int(center[1])
    seg_span = 360.0 / total
    for i in range(total):
        start = -90 + i * seg_span + RING_GAP_DEG / 2
        end = -90 + (i + 1) * seg_span - RING_GAP_DEG / 2
        if i < completed:
            cv2.ellipse(canvas, (cx, cy), (radius, radius), 0, start, end, bright_color, 4, cv2.LINE_AA)
        elif i == completed and current_progress > 0:
            partial_end = start + (end - start) * current_progress
            cv2.ellipse(canvas, (cx, cy), (radius, radius), 0, start, partial_end, bright_color, 4, cv2.LINE_AA)
            cv2.ellipse(canvas, (cx, cy), (radius, radius), 0, partial_end, end, dim_color, 2, cv2.LINE_AA)
        else:
            cv2.ellipse(canvas, (cx, cy), (radius, radius), 0, start, end, dim_color, 2, cv2.LINE_AA)


def draw_status_ring(frame, center, radius, color):
    """Thin inner ring: red (no face) / yellow (wrong pose) / green (in position)."""
    cv2.circle(frame, (int(center[0]), int(center[1])), int(radius), color, 2, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Text / chrome
# ---------------------------------------------------------------------------

def draw_centered_text(frame, text, center_x, y, font, scale, color, thickness):
    # Black outline underneath gives the text a bold, always-readable look
    # regardless of what's behind it in the camera feed. The outline is
    # measured and centered separately from the fill (rather than reusing
    # the fill's x position) since a much thicker stroke renders at a
    # different width in OpenCV's Hershey fonts -- reusing one x for both
    # left the heavier outline drifting past the fill on longer strings.
    outline_thickness = thickness + 3
    (outline_w, _), _ = cv2.getTextSize(text, font, scale, outline_thickness)
    outline_x = int(center_x - outline_w / 2)
    cv2.putText(frame, text, (outline_x, y), font, scale, (0, 0, 0), outline_thickness, cv2.LINE_AA)

    (fill_w, _), _ = cv2.getTextSize(text, font, scale, thickness)
    fill_x = int(center_x - fill_w / 2)
    cv2.putText(frame, text, (fill_x, y), font, scale, color, thickness, cv2.LINE_AA)


def draw_top_banner(frame, instruction, step_no, total):
    w = frame.shape[1]
    banner_h = 118
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, banner_h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.62, frame, 0.38, 0, dst=frame)
    cv2.line(frame, (0, banner_h), (w, banner_h), CYAN, 2, cv2.LINE_AA)

    draw_centered_text(frame, "FACE ENROLLMENT", w // 2, 26,
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 220, 230), 1)
    draw_centered_text(frame, instruction, w // 2, 70,
                        cv2.FONT_HERSHEY_DUPLEX, 1.05, WHITE, 2)
    draw_centered_text(frame, f"Step {step_no} of {total}", w // 2, 102,
                        cv2.FONT_HERSHEY_SIMPLEX, 0.62, (200, 200, 200), 1)


def draw_progress_dots(frame, done, total):
    h, w = frame.shape[:2]
    dot_radius = 8
    gap = 30
    start_x = w // 2 - (total - 1) * gap // 2
    y = h - 34
    pulse = 1.0 + 0.3 * abs(math.sin(time.time() * 4.0))
    for i in range(total):
        cx = start_x + i * gap
        if i < done:
            cv2.circle(frame, (cx, y), dot_radius, CYAN, -1, cv2.LINE_AA)
        elif i == done:
            r = int(dot_radius * pulse) + 2
            cv2.circle(frame, (cx, y), r, WHITE, 2, cv2.LINE_AA)
        else:
            cv2.circle(frame, (cx, y), dot_radius, GREY, 2, cv2.LINE_AA)


def draw_hold_still(frame, center):
    draw_centered_text(frame, "HOLD STILL", center[0], center[1] - 100,
                        cv2.FONT_HERSHEY_DUPLEX, 1.3, YELLOW, 3)


def draw_checkmark(frame, center, radius=55):
    cx, cy = int(center[0]), int(center[1])
    overlay = frame.copy()
    cv2.circle(overlay, (cx, cy), radius, GREEN, -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, dst=frame)
    cv2.circle(frame, (cx, cy), radius, WHITE, 3, cv2.LINE_AA)
    cv2.line(frame, (cx - 25, cy), (cx - 6, cy + 20), WHITE, 8, cv2.LINE_AA)
    cv2.line(frame, (cx - 6, cy + 20), (cx + 28, cy - 22), WHITE, 8, cv2.LINE_AA)


def draw_manual_hint(frame, frame_center):
    h = frame.shape[0]
    draw_centered_text(frame, "Press SPACE to capture manually", frame_center[0], h - 64,
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, (170, 170, 170), 1)


def apply_flash(frame, flash_started_at):
    if flash_started_at is None:
        return frame
    elapsed = time.time() - flash_started_at
    if elapsed >= FLASH_SECONDS:
        return frame
    alpha = 1.0 - (elapsed / FLASH_SECONDS)
    white = np.full_like(frame, 255)
    return cv2.addWeighted(white, alpha, frame, 1 - alpha, 0)


def draw_debug_readout(frame, pitch, yaw, target_info=None):
    if pitch is None:
        return
    h = frame.shape[0]
    text = f"yaw {yaw:.0f}  pitch {pitch:.0f}"
    if target_info:
        text += f"   {target_info}"
    cv2.putText(frame, text, (15, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1, cv2.LINE_AA)


def show_completion_screen(cap, window, name, num_photos, duration=3.0):
    start_time = time.time()
    end_time = start_time + duration
    ring_grow_seconds = 0.6
    target_radius = 78

    while time.time() < end_time:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 0), -1)
        frame = cv2.addWeighted(overlay, 0.8, frame, 0.2, 0)

        elapsed = time.time() - start_time
        grow = min(elapsed / ring_grow_seconds, 1.0)
        eased = 1 - (1 - grow) ** 3  # ease-out: snaps out then settles
        radius = max(int(target_radius * eased), 2)

        ring_center = (w // 2, h // 2 - 60)
        cx, cy = ring_center

        glow = np.zeros_like(frame)
        cv2.circle(glow, ring_center, radius, GREEN, 6, cv2.LINE_AA)
        pad = radius + 40
        composite_glow(frame, glow, (cx - pad, cy - pad, cx + pad, cy + pad), blur_ksize=27, strength=0.9)

        cv2.circle(frame, ring_center, radius, GREEN, 5, cv2.LINE_AA)
        if grow >= 1.0:
            cv2.line(frame, (cx - 30, cy), (cx - 8, cy + 26), WHITE, 8, cv2.LINE_AA)
            cv2.line(frame, (cx - 8, cy + 26), (cx + 34, cy - 26), WHITE, 8, cv2.LINE_AA)

        draw_centered_text(frame, "IDENTITY CAPTURED", w // 2, ring_center[1] + 130,
                            cv2.FONT_HERSHEY_DUPLEX, 1.25, WHITE, 3)
        draw_centered_text(frame, name, w // 2, ring_center[1] + 172,
                            cv2.FONT_HERSHEY_SIMPLEX, 0.95, CYAN, 2)
        draw_centered_text(frame, f"{num_photos} photos captured", w // 2, ring_center[1] + 206,
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (190, 190, 190), 1)

        cv2.imshow(window, frame)
        cv2.waitKey(1)


def main():
    os.makedirs(KNOWN_FACES_DIR, exist_ok=True)

    name = input("Enter your name: ").strip()
    if not name:
        print("Name cannot be empty.")
        sys.exit(1)

    person_dir = os.path.join(KNOWN_FACES_DIR, sanitize(name))
    os.makedirs(person_dir, exist_ok=True)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Could not open the camera.")
        sys.exit(1)

    print(f"Hi {name}! Follow the on-screen instructions across {len(STEPS)} steps.")
    print("Press Q to cancel, or SPACE at any time to capture the current pose manually.")

    window = "Enroll Face"
    captured = []  # {"angle": step_key, "encoding": ..., "photo_path": ...} per captured step
    step_index = 0
    hold_start = None
    last_ready_at = 0.0
    baseline = None  # (pitch, yaw) captured at the first "front" step
    step_started_at = time.time()

    checkmark_until = 0.0
    flash_started_at = None
    space_requested = False

    # tracked_center/tracked_radius follow the detected face with light
    # smoothing so the HUD glides rather than jumping frame to frame.
    tracked_center = None
    tracked_radius = None

    def perform_capture(step, face_loc, rgb_full, pitch, yaw):
        nonlocal step_index, baseline, hold_start, last_ready_at, checkmark_until, flash_started_at, step_started_at
        encoding = face_recognition.face_encodings(rgb_full, [face_loc])[0]
        photo_path = os.path.join(person_dir, f"{step['key']}.jpg")
        cv2.imwrite(photo_path, frame)
        captured.append({"angle": step["key"], "encoding": encoding, "photo_path": photo_path})
        if step["pose"] == "front" and baseline is None and pitch is not None:
            baseline = (pitch, yaw)
        checkmark_until = time.time() + CHECKMARK_SECONDS
        flash_started_at = time.time()
        step_index += 1
        hold_start = None
        last_ready_at = 0.0
        step_started_at = time.time()

    # Keep rendering (and reading frames) past the final capture until the
    # checkmark for it has fully played -- otherwise the loop exits the
    # instant the last step completes and its confirmation is never shown.
    while step_index < len(STEPS) or time.time() < checkmark_until:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        frame_center = (w // 2, h // 2)

        do_manual_capture, space_requested = space_requested, False

        if tracked_center is None:
            tracked_center = frame_center
            tracked_radius = min(w, h) * 0.22

        finished = step_index >= len(STEPS)
        circle_color = RED  # no face detected
        hold_progress = 0.0
        pitch = yaw = None
        target_info = None
        show_hint = False

        if not finished:
            step = STEPS[step_index]

            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            locations = [(t * 2, r * 2, b * 2, l * 2) for (t, r, b, l) in face_recognition.face_locations(rgb_small)]

            if locations:
                face_loc = largest_face(locations)
                top, right, bottom, left = face_loc

                target_center = ((left + right) / 2, (top + bottom) / 2)
                target_radius = max(right - left, bottom - top) * 0.65
                tracked_center = (
                    tracked_center[0] + (target_center[0] - tracked_center[0]) * 0.35,
                    tracked_center[1] + (target_center[1] - tracked_center[1]) * 0.35,
                )
                tracked_radius = tracked_radius + (target_radius - tracked_radius) * 0.35

                rgb_full = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                landmarks_list = face_recognition.face_landmarks(rgb_full, [face_loc])

                if landmarks_list:
                    pose = get_head_pose(landmarks_list[0], frame.shape)
                    if pose:
                        pitch, yaw = pose
                        ready = in_position(step["pose"], pitch, yaw, baseline)
                        circle_color = GREEN if ready else YELLOW
                        target_info = distance_to_target(step["pose"], pitch, yaw, baseline)

                        if do_manual_capture:
                            perform_capture(step, face_loc, rgb_full, pitch, yaw)
                            finished = step_index >= len(STEPS)
                        elif ready:
                            last_ready_at = time.time()
                            if hold_start is None:
                                hold_start = time.time()
                            elapsed = time.time() - hold_start
                            hold_progress = min(elapsed / HOLD_SECONDS, 1.0)

                            if elapsed >= HOLD_SECONDS:
                                perform_capture(step, face_loc, rgb_full, pitch, yaw)
                                finished = step_index >= len(STEPS)
                        elif hold_start is not None:
                            # A brief dip out of position (pose-estimation jitter) is
                            # tolerated for a short grace window instead of nuking the
                            # whole hold countdown back to zero on a single bad frame.
                            if time.time() - last_ready_at > HOLD_GRACE_SECONDS:
                                hold_start = None
                            else:
                                elapsed = time.time() - hold_start
                                hold_progress = min(elapsed / HOLD_SECONDS, 1.0)
            else:
                hold_start = None

            if not finished:
                banner_text = step["instruction"]
                banner_step_no = step_index + 1
                show_hint = (time.time() - step_started_at) > STUCK_HINT_SECONDS
            else:
                banner_text = "Identity scan complete"
                banner_step_no = len(STEPS)
        else:
            banner_text = "Identity scan complete"
            banner_step_no = len(STEPS)

        # ---- Cinematic display pass (everything below is display-only; all
        # detection/capture above already ran against the pristine frame) ----
        frame = apply_cinematic_grade(frame)
        draw_frame_brackets(frame)

        face_visible = pitch is not None
        outer_radius = int(tracked_radius + 34)

        if face_visible:
            dots_revealed = int(round(_DOT_TOTAL * len(captured) / len(STEPS)))
            roi_pad = outer_radius + 24
            roi = (tracked_center[0] - roi_pad, tracked_center[1] - roi_pad,
                   tracked_center[0] + roi_pad, tracked_center[1] + roi_pad)

            glow = np.zeros_like(frame)
            draw_scan_line(glow, tracked_center, tracked_radius, CYAN)
            draw_dot_matrix(glow, tracked_center, tracked_radius * 0.85, dots_revealed, CYAN)
            draw_segmented_ring(glow, tracked_center, outer_radius, len(STEPS), len(captured), hold_progress, GREY, CYAN)
            composite_glow(frame, glow, roi)

            draw_scan_line(frame, tracked_center, tracked_radius, CYAN)
            draw_dot_matrix(frame, tracked_center, tracked_radius * 0.85, dots_revealed, CYAN)
            draw_segmented_ring(frame, tracked_center, outer_radius, len(STEPS), len(captured), hold_progress, GREY, CYAN)

        draw_status_ring(frame, tracked_center, tracked_radius, circle_color)
        draw_progress_dots(frame, len(captured), len(STEPS))
        draw_top_banner(frame, banner_text, banner_step_no, len(STEPS))

        if show_hint:
            draw_manual_hint(frame, frame_center)

        if 0 < hold_progress < 1.0:
            draw_hold_still(frame, frame_center)

        if time.time() < checkmark_until:
            draw_checkmark(frame, frame_center)

        draw_debug_readout(frame, pitch, yaw, target_info)

        frame = apply_flash(frame, flash_started_at)

        cv2.imshow(window, frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("Enrollment cancelled.")
            cap.release()
            cv2.destroyAllWindows()
            sys.exit(0)
        elif key == ord(' '):
            space_requested = True

    show_completion_screen(cap, window, name, len(captured))

    cap.release()
    cv2.destroyAllWindows()

    for item in captured:
        face_store.save_encoding(name, item["angle"], item["encoding"], item["photo_path"])
    print(f"Enrollment Complete! {len(captured)} photos captured for {name}")


if __name__ == "__main__":
    main()
