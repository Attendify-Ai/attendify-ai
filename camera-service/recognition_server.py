"""
Attendify.ai Recognition Server
================================
Lightweight HTTP server that the browser scan page POSTs images to.
Runs the face_recognition pipeline and returns match results.

Usage (in a second terminal, inside camera-service/):
    source venv/bin/activate
    python recognition_server.py

Listens on http://localhost:8001
"""

import base64
import io
import os
import logging
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import face_recognition
from PIL import Image

import config
import api_client
from detector import FaceEnroller, FaceRecognizer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("recognition_server")

app = Flask(__name__)
CORS(app)

recognizer = FaceRecognizer(confidence_threshold=config.CONFIDENCE_THRESHOLD)


def resolve_photo_path(db_path: str) -> str:
    """Convert a DB-relative path to an absolute path on disk."""
    # If already absolute and exists, use as-is
    if os.path.isabs(db_path) and os.path.exists(db_path):
        return db_path
    # Resolve relative to the backend base directory
    full = os.path.join(config.BACKEND_BASE, db_path)
    return full


def run_enrollment() -> list:
    """Process students with photos but no face embeddings. Returns list of results."""
    pending = api_client.get_students_pending_enrollment()
    if not pending:
        return []

    enroller = FaceEnroller()
    results = []

    for student in pending:
        sid = student["id"]
        name = student.get("name", f"ID {sid}")
        raw_paths = student.get("photo_paths") or []
        paths = [resolve_photo_path(p) for p in raw_paths]

        missing = [p for p in paths if not os.path.exists(p)]
        if missing:
            logger.warning(f"  {name}: {len(missing)} photo(s) not found on disk: {missing[:2]}")

        paths = [p for p in paths if os.path.exists(p)]
        if not paths:
            logger.warning(f"  {name}: no readable photos — skipping")
            results.append({"id": sid, "name": name, "vectors": 0, "error": "photos not found on disk"})
            continue

        encodings = enroller.enroll(paths)
        if not encodings:
            logger.warning(f"  {name}: no faces detected in any photo")
            results.append({"id": sid, "name": name, "vectors": 0, "error": "no face detected"})
            continue

        api_client.post_embeddings(sid, encodings)
        logger.info(f"  Enrolled {name}: {len(encodings)} face vector(s)")
        results.append({"id": sid, "name": name, "vectors": len(encodings)})

    return results


def reload_students():
    students = api_client.get_all_enrolled_students()
    recognizer.load_students(students)
    logger.info(
        f"Reloaded: {len(recognizer.known_encodings)} face vectors "
        f"across {len(recognizer._info)} students"
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "enrolled_students": len(recognizer._info),
        "face_vectors": len(recognizer.known_encodings),
        "backend_base": config.BACKEND_BASE,
    })


@app.route("/enroll", methods=["POST"])
def enroll():
    """Process all pending-enrollment students and reload recognizer."""
    logger.info("Enrollment triggered via API")
    try:
        results = run_enrollment()
        if results:
            reload_students()
        enrolled = [r for r in results if r.get("vectors", 0) > 0]
        failed = [r for r in results if r.get("vectors", 0) == 0]
        return jsonify({
            "status": "ok",
            "processed": len(results),
            "enrolled": len(enrolled),
            "failed": len(failed),
            "results": results,
        })
    except Exception as e:
        logger.error(f"Enrollment error: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/reload", methods=["POST"])
def reload():
    reload_students()
    return jsonify({
        "status": "ok",
        "enrolled_students": len(recognizer._info),
        "face_vectors": len(recognizer.known_encodings),
    })


@app.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json(silent=True)
    if not data or "image_b64" not in data:
        return jsonify({"error": "Missing image_b64 field"}), 400

    try:
        img_bytes = base64.b64decode(data["image_b64"])
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        frame = np.array(img)
    except Exception as e:
        return jsonify({"error": f"Invalid image: {e}"}), 400

    try:
        detections = recognizer.recognize_all(frame)
        return jsonify({
            "face_count": len(detections),
            "detections": detections,
        })
    except Exception as e:
        logger.error(f"Recognition failed: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    logger.info("Starting recognition server on port 8001...")
    logger.info(f"Backend base: {config.BACKEND_BASE}")
    api_client.login()
    logger.info("Processing any pending enrollments on startup...")
    results = run_enrollment()
    if results:
        logger.info(f"Startup enrollment: {len([r for r in results if r.get('vectors',0)>0])} enrolled")
    reload_students()
    app.run(host="0.0.0.0", port=8001, debug=False, use_reloader=False)
