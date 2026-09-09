from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
from database import engine, run_migrations
import models
import os

models.Base.metadata.create_all(bind=engine)
run_migrations(engine)

from routers import auth, houses, students, late_entries, analytics, calendar, recognition, house_manager
from services.scheduler_service import generate_weekly_reports_job

app = FastAPI(title="Attendify.ai API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://0.0.0.0:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(houses.router, prefix=PREFIX)
app.include_router(students.router, prefix=PREFIX)
app.include_router(late_entries.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(calendar.router, prefix=PREFIX)
app.include_router(recognition.router, prefix=PREFIX)
app.include_router(house_manager.router, prefix=PREFIX)

scheduler = BackgroundScheduler()
scheduler.add_job(generate_weekly_reports_job, "cron", day_of_week="mon", hour=6, minute=0)
scheduler.start()

# Serve uploaded files (captured images, student photos)
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/")
def root():
    return {"message": "Attendify.ai Backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
