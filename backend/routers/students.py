import os
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models
from services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/students", tags=["Students"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "students")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def student_to_dict(student: models.Student, house_name: str = None) -> dict:
    photo_paths = student.photo_paths or []
    embeddings = student.face_embeddings or []
    return {
        "id": student.id,
        "name": student.name,
        "student_code": student.student_code,
        "class": student.class_,
        "house_id": student.house_id,
        "house_name": house_name,
        "photo_paths": photo_paths,
        "photo_count": len(photo_paths),
        "has_face_data": bool(embeddings),
        "enrollment_status": _enrollment_status(photo_paths, embeddings),
        "created_at": student.created_at,
        "updated_at": student.updated_at,
    }


def _enrollment_status(photo_paths, embeddings) -> str:
    if embeddings:
        return "enrolled"
    if photo_paths and len(photo_paths) >= 3:
        return "photos_ready"
    if photo_paths:
        return "insufficient_photos"
    return "no_photos"


@router.get("/pending-enrollment")
def get_pending_enrollment(db: Session = Depends(get_db)):
    """Camera service polls this to find students needing embedding computation."""
    students = db.query(models.Student).filter(
        models.Student.face_embeddings == None,
        models.Student.photo_paths != None,
    ).all()
    return [
        {"id": s.id, "name": s.name, "photo_paths": s.photo_paths}
        for s in students
        if s.photo_paths and len(s.photo_paths) >= 3
    ]


@router.get("/")
def list_students(
    search: Optional[str] = None,
    house_id: Optional[int] = None,
    class_: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Student, models.House.name.label("house_name")).join(
        models.House, models.Student.house_id == models.House.id, isouter=True
    )

    if search:
        query = query.filter(
            or_(
                models.Student.name.ilike(f"%{search}%"),
                models.Student.student_code.ilike(f"%{search}%"),
            )
        )
    if house_id:
        query = query.filter(models.Student.house_id == house_id)
    if class_:
        query = query.filter(models.Student.class_ == class_)

    rows = query.order_by(models.Student.name).all()
    return [student_to_dict(s, house_name) for s, house_name in rows]


@router.post("/")
def create_student(
    name: str = Form(...),
    student_code: str = Form(...),
    class_: str = Form(...),
    house_id: int = Form(...),
    photos: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    existing = db.query(models.Student).filter(models.Student.student_code == student_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student code already exists")

    student = models.Student(
        name=name,
        student_code=student_code,
        class_=class_,
        house_id=house_id,
        photo_paths=[],
    )
    db.add(student)
    db.flush()

    if photos:
        saved_paths = _save_photos(student.id, photos)
        student.photo_paths = saved_paths

    db.commit()
    db.refresh(student)

    house = db.query(models.House).filter(models.House.id == student.house_id).first()
    return student_to_dict(student, house.name if house else None)


@router.get("/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.Student, models.House.name.label("house_name"))
        .join(models.House, models.Student.house_id == models.House.id, isouter=True)
        .filter(models.Student.id == student_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    student, house_name = row
    return student_to_dict(student, house_name)


@router.put("/{student_id}")
def update_student(
    student_id: int,
    name: str = Form(...),
    student_code: str = Form(...),
    class_: str = Form(...),
    house_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    conflict = (
        db.query(models.Student)
        .filter(models.Student.student_code == student_code, models.Student.id != student_id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=400, detail="Student code already in use")

    student.name = name
    student.student_code = student_code
    student.class_ = class_
    student.house_id = house_id
    db.commit()
    db.refresh(student)

    house = db.query(models.House).filter(models.House.id == student.house_id).first()
    return student_to_dict(student, house.name if house else None)


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": "Student deleted"}


@router.post("/{student_id}/photos")
def add_photos(
    student_id: int,
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    new_paths = _save_photos(student_id, photos)
    existing = student.photo_paths or []
    student.photo_paths = existing + new_paths
    # Clear embeddings so camera service re-enrolls on next run
    student.face_embeddings = None
    db.commit()
    db.refresh(student)

    house = db.query(models.House).filter(models.House.id == student.house_id).first()
    return student_to_dict(student, house.name if house else None)


@router.delete("/{student_id}/photos")
def clear_photos(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.photo_paths = []
    student.face_embeddings = None
    db.commit()
    return {"message": "Photos and embeddings cleared"}


@router.post("/{student_id}/embeddings")
def store_embeddings(
    student_id: int,
    embeddings: list = Body(...),
    db: Session = Depends(get_db),
):
    """Called by the camera service after computing face embeddings."""
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.face_embeddings = embeddings
    db.commit()
    return {"message": "Embeddings stored", "count": len(embeddings)}


# NOTE: all /camera/* routes must be defined BEFORE /{student_id} to avoid path collision

@router.get("/camera/pending-enrollment")
def get_pending_enrollment_camera(db: Session = Depends(get_db)):
    """Camera service polls this to find students needing embedding computation."""
    students = db.query(models.Student).filter(
        models.Student.face_embeddings == None,
        models.Student.photo_paths != None,
    ).all()
    return [
        {"id": s.id, "name": s.name, "photo_paths": s.photo_paths}
        for s in students
        if s.photo_paths and len(s.photo_paths) >= 3
    ]


@router.get("/camera/enrolled")
def get_enrolled_with_embeddings(db: Session = Depends(get_db)):
    """
    Camera service uses this to load face vectors into memory.
    Returns enrolled students WITH face_embeddings (intentionally excluded from the UI list).
    """
    rows = (
        db.query(models.Student, models.House.name.label("house_name"))
        .join(models.House, models.Student.house_id == models.House.id, isouter=True)
        .filter(models.Student.face_embeddings != None)
        .all()
    )
    return [
        {
            "id": s.id,
            "name": s.name,
            "student_code": s.student_code,
            "house_id": s.house_id,
            "house_name": house_name,
            "face_embeddings": s.face_embeddings,
        }
        for s, house_name in rows
        if s.face_embeddings
    ]


def _save_photos(student_id: int, photos: List[UploadFile]) -> List[str]:
    student_dir = os.path.join(UPLOAD_DIR, str(student_id))
    os.makedirs(student_dir, exist_ok=True)
    paths = []
    for photo in photos:
        if not photo.filename:
            continue
        ext = os.path.splitext(photo.filename)[1] or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(student_dir, filename)
        with open(dest, "wb") as f:
            f.write(photo.file.read())
        # Store relative path for portability
        rel = os.path.relpath(dest, os.path.join(os.path.dirname(__file__), ".."))
        paths.append(rel)
    return paths
