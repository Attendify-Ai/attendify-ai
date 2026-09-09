from sqlalchemy import Column, Integer, String, Float, Boolean, Date, Time, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base

class House(Base):
    __tablename__ = "houses"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    current_points = Column(Integer, default=1000)
    colour = Column(String)
    created_at = Column(DateTime, default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    last_login_at = Column(DateTime)
    assigned_house_id = Column(Integer, ForeignKey("houses.id"))
    assigned_class = Column(String)
    created_at = Column(DateTime, default=func.now())

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    student_code = Column(String, unique=True, nullable=False)
    class_ = Column("class", String, nullable=False)  # denormalized "<standard><section>", e.g. "7B" -- kept in sync for existing consumers (late entries, analytics, reports)
    standard = Column(Integer)
    section = Column(String)
    house_id = Column(Integer, ForeignKey("houses.id"))
    face_embeddings = Column(JSONB)
    photo_paths = Column(JSONB)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class LateEntry(Base):
    __tablename__ = "late_entries"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    house_id = Column(Integer, ForeignKey("houses.id"))
    date = Column(Date, nullable=False)
    arrival_time = Column(Time, nullable=False)
    minutes_late = Column(Integer, nullable=False)
    points_deducted = Column(Integer, nullable=False)
    confidence_score = Column(Float)
    status = Column(String, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    captured_image = Column(Text)
    created_at = Column(DateTime, default=func.now())

class PointAdjustment(Base):
    __tablename__ = "point_adjustments"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"))
    points = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    awarded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())

class SchoolCalendar(Base):
    __tablename__ = "school_calendar"
    id = Column(Integer, primary_key=True)
    date = Column(Date, unique=True, nullable=False)
    label = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String, nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, default=func.now())
