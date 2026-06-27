from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine
import models
import os

models.Base.metadata.create_all(bind=engine)

from routers import auth, houses, students, late_entries, analytics, calendar

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
