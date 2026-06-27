import face_recognition
import numpy as np
import logging
from typing import Optional

logger = logging.getLogger("detector")


class FaceEnroller:
    """
    Builds face embeddings from a list of image file paths.
    Called once per student during enrollment.
    """

    def enroll(self, photo_paths: list) -> list:
        """
        Compute and return face encodings from a list of file paths.
        Returns a list of encoding lists (one per photo where a face was found).
        """
        encodings = []
        for path in photo_paths:
            try:
                img = face_recognition.load_image_file(path)
                found = face_recognition.face_encodings(img)
                if found:
                    encodings.append(found[0].tolist())
                    logger.debug(f"Encoded face from {path}")
                else:
                    logger.warning(f"No face detected in {path}")
            except Exception as e:
                logger.error(f"Error loading {path}: {e}")
        return encodings


class FaceRecognizer:
    """
    Holds known face encodings in memory and matches new faces.
    Reload from DB on start and whenever students are re-enrolled.
    """

    def __init__(self, confidence_threshold: float = 0.6):
        self.threshold = confidence_threshold
        self.known_encodings: list = []  # list of np arrays
        self.known_student_ids: list = []
        self.known_house_ids: list = []
        self._info: dict = {}  # student_id -> {name, house_name, student_code}

    def load_students(self, students: list):
        """Load enrolled students' face embeddings into memory."""
        self.known_encodings = []
        self.known_student_ids = []
        self.known_house_ids = []
        self._info: dict = {}  # student_id -> {name, house_name, student_code}

        enrolled = 0
        for student in students:
            embeddings = student.get("face_embeddings") or []
            if not embeddings:
                continue
            sid = student["id"]
            self._info[sid] = {
                "name": student.get("name", ""),
                "house_name": student.get("house_name", ""),
                "student_code": student.get("student_code", ""),
            }
            for emb in embeddings:
                self.known_encodings.append(np.array(emb, dtype=float))
                self.known_student_ids.append(sid)
                self.known_house_ids.append(student["house_id"])
            enrolled += 1

        logger.info(f"Loaded {enrolled} enrolled students ({len(self.known_encodings)} face vectors)")

    def recognize_all(self, frame_rgb) -> list:
        """
        Detect ALL faces in the frame and return a match result for each.
        Returns a list of dicts — one per detected face.
        """
        face_locations = face_recognition.face_locations(frame_rgb)
        if not face_locations:
            return []

        face_encodings = face_recognition.face_encodings(frame_rgb, face_locations)
        results = []

        for face_enc in face_encodings:
            if not self.known_encodings:
                results.append({"student_id": None, "house_id": None, "confidence": 0.0,
                                 "above_threshold": False, "name": None, "house_name": None, "student_code": None})
                continue

            distances = face_recognition.face_distance(self.known_encodings, face_enc)
            idx = int(np.argmin(distances))
            confidence = max(0.0, 1.0 - float(distances[idx]))
            above = confidence >= self.threshold

            student_id = self.known_student_ids[idx] if above else None
            house_id   = self.known_house_ids[idx]   if above else None
            info = self._info.get(student_id, {}) if student_id else {}

            results.append({
                "student_id":    student_id,
                "house_id":      house_id,
                "confidence":    round(confidence, 4),
                "above_threshold": above,
                "name":          info.get("name"),
                "house_name":    info.get("house_name"),
                "student_code":  info.get("student_code"),
            })

        return results

    def recognize(self, frame_rgb) -> tuple[Optional[int], Optional[int], float]:
        """Single-face convenience wrapper used by the gate camera service."""
        if not self.known_encodings:
            return None, None, 0.0

        face_locations = face_recognition.face_locations(frame_rgb)
        if not face_locations:
            return None, None, 0.0

        face_encodings = face_recognition.face_encodings(frame_rgb, face_locations)

        best_student_id = None
        best_house_id = None
        best_confidence = 0.0

        for face_enc in face_encodings:
            distances = face_recognition.face_distance(self.known_encodings, face_enc)
            if len(distances) == 0:
                continue

            idx = int(np.argmin(distances))
            distance = float(distances[idx])
            confidence = max(0.0, 1.0 - distance)

            if confidence > best_confidence:
                best_confidence = confidence
                best_student_id = self.known_student_ids[idx]
                best_house_id = self.known_house_ids[idx]

        return best_student_id, best_house_id, best_confidence

    def get_face_image_bytes(self, frame_rgb) -> Optional[bytes]:
        """Crop the first detected face from the frame and return as JPEG bytes."""
        import cv2

        face_locations = face_recognition.face_locations(frame_rgb)
        if not face_locations:
            return None

        top, right, bottom, left = face_locations[0]
        # Add padding
        pad = 30
        h, w = frame_rgb.shape[:2]
        top = max(0, top - pad)
        bottom = min(h, bottom + pad)
        left = max(0, left - pad)
        right = min(w, right + pad)

        face_crop = frame_rgb[top:bottom, left:right]
        face_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)
        ok, buf = cv2.imencode(".jpg", face_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ok:
            return buf.tobytes()
        return None
