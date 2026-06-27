import os
from dotenv import load_dotenv
from datetime import time

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", 0))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", 0.6))
SCAN_INTERVAL_SECONDS = float(os.getenv("SCAN_INTERVAL_SECONDS", 2))
CAMERA_SERVICE_EMAIL = os.getenv("CAMERA_SERVICE_EMAIL", "admin@attendify.ai")
CAMERA_SERVICE_PASSWORD = os.getenv("CAMERA_SERVICE_PASSWORD", "admin123")

# Base directory of the backend — photo paths in DB are relative to this
_default_backend = os.path.join(os.path.dirname(__file__), "..", "backend")
BACKEND_BASE = os.path.abspath(os.getenv("BACKEND_BASE", _default_backend))

_start = os.getenv("SCHOOL_START_TIME", "08:30").split(":")
SCHOOL_START_TIME = time(int(_start[0]), int(_start[1]))
