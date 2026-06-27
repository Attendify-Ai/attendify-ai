"""
Attendify.ai Camera Service
============================
Runs continuously:
  1. On start: processes any students pending face enrollment (photos uploaded but no embeddings).
  2. After school start time: opens camera, scans for late students, posts detections to API.
  3. Reloads face database every 5 minutes to pick up new enrollments.

Usage:
    source venv/bin/activate
    python main.py

    # Enrollment-only mode (no camera):
    python main.py --enroll-only
"""

import cv2
import time
import logging
import argparse
import sys
from datetime import datetime, date

import config
from detector import FaceEnroller, FaceRecognizer
import api_client
from api_client import (
    get_students_pending_enrollment,
    post_embeddings,
    get_all_enrolled_students,
    check_school_day,
    post_late_entry,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("camera_service")

RELOAD_INTERVAL_SECONDS = 300  # Reload face DB every 5 minutes


def run_enrollment():
    """Process students with photos but no face embeddings."""
    logger.info("Checking for students pending face enrollment...")
    pending = get_students_pending_enrollment()

    if not pending:
        logger.info("No students pending enrollment.")
        return

    enroller = FaceEnroller()
    for student in pending:
        name = student.get("name", f"ID {student['id']}")
        paths = student.get("photo_paths", [])
        logger.info(f"Enrolling {name} with {len(paths)} photos...")

        encodings = enroller.enroll(paths)
        if not encodings:
            logger.warning(f"  No faces found in any photo for {name}. Skipping.")
            continue

        post_embeddings(student["id"], encodings)
        logger.info(f"  Enrolled {name}: {len(encodings)} face vectors stored.")


def run_camera(recognizer: FaceRecognizer):
    """Open camera and scan for late students."""
    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    if not cap.isOpened():
        logger.error(f"Cannot open camera at index {config.CAMERA_INDEX}")
        return False

    logger.info(f"Camera opened (index={config.CAMERA_INDEX}). Scanning for late students...")
    logger.info(f"School start time: {config.SCHOOL_START_TIME}")
    logger.info(f"Confidence threshold: {config.CONFIDENCE_THRESHOLD}")

    logged_today: set = set()  # student_ids already logged today
    last_reload = time.time()
    last_date = date.today()

    try:
        while True:
            today = date.today()

            # Reset logged set at midnight
            if today != last_date:
                logged_today.clear()
                last_date = today
                logger.info("New day — cleared today's log set")

            # Calendar check
            if not check_school_day(today):
                logger.info("Non-school day — sleeping 60 seconds")
                time.sleep(60)
                continue

            now = datetime.now().time()

            # Only scan after school start time
            if now < config.SCHOOL_START_TIME:
                wait = (
                    (config.SCHOOL_START_TIME.hour * 60 + config.SCHOOL_START_TIME.minute)
                    - (now.hour * 60 + now.minute)
                )
                logger.info(f"School hasn't started yet. Waiting {wait} minutes.")
                time.sleep(min(wait * 60, 300))
                continue

            # Reload face database periodically
            if time.time() - last_reload > RELOAD_INTERVAL_SECONDS:
                logger.info("Reloading face database from API...")
                students = get_all_enrolled_students()
                recognizer.load_students(students)
                last_reload = time.time()

            ret, frame_bgr = cap.read()
            if not ret:
                logger.warning("Failed to read frame from camera")
                time.sleep(1)
                continue

            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

            student_id, house_id, confidence = recognizer.recognize(frame_rgb)

            if student_id is not None and student_id not in logged_today:
                logger.info(
                    f"Detected student {student_id} (confidence={confidence:.2f}) at {now.strftime('%H:%M:%S')}"
                )

                image_bytes = recognizer.get_face_image_bytes(frame_rgb)
                result = post_late_entry(
                    student_id=student_id,
                    house_id=house_id,
                    arrival_time=now,
                    entry_date=today,
                    confidence=confidence,
                    image_bytes=image_bytes,
                )

                if result and result.get("id"):
                    logged_today.add(student_id)
                    logger.info(f"Logged late entry id={result['id']} for student {student_id}")

            elif student_id is None and confidence == 0.0:
                # Face detected but didn't match anyone
                faces_present = len(cv2.CascadeClassifier(
                    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                ).detectMultiScale(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY), 1.1, 4))
                if faces_present:
                    logger.info("Unknown face detected — posting for review")
                    image_bytes = recognizer.get_face_image_bytes(frame_rgb)
                    post_late_entry(
                        student_id=None,
                        house_id=None,
                        arrival_time=now,
                        entry_date=today,
                        confidence=0.0,
                        image_bytes=image_bytes,
                    )

            time.sleep(config.SCAN_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        cap.release()
        logger.info("Camera released")
    return True


def main():
    parser = argparse.ArgumentParser(description="Attendify Camera Service")
    parser.add_argument("--enroll-only", action="store_true", help="Run enrollment then exit")
    args = parser.parse_args()

    # Authenticate with backend API
    if not api_client.login():
        logger.error("Cannot authenticate with backend — check credentials in .env")
        sys.exit(1)

    # Always run enrollment on start
    run_enrollment()

    if args.enroll_only:
        logger.info("Enrollment-only mode — exiting.")
        return

    # Load all students for recognition
    logger.info("Loading enrolled students from API...")
    students = get_all_enrolled_students()
    recognizer = FaceRecognizer(confidence_threshold=config.CONFIDENCE_THRESHOLD)
    recognizer.load_students(students)

    if not recognizer.known_encodings:
        logger.warning("No enrolled students found. Recognition will post all faces as 'needs_review'.")

    run_camera(recognizer)


if __name__ == "__main__":
    main()
