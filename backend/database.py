from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations(engine):
    """Idempotent ALTER TABLE steps for columns added after the initial create_all."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_house_id INTEGER REFERENCES houses(id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_class VARCHAR",
        "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check",
        "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'house_manager'::text]))",
        "ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey",
        "ALTER TABLE activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS standard INTEGER",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR",
        # Backfill standard/section for existing rows from the "<standard><section>" class string
        # (e.g. "7B" -> standard=7, section="B") -- only touches rows that don't have them yet.
        """
        UPDATE students
        SET standard = substring(class from '^[0-9]{1,2}')::integer,
            section = upper(substring(class from '[A-Za-z]$'))
        WHERE standard IS NULL AND class ~ '^[0-9]{1,2}[A-Za-z]$'
        """,
    ]
    with engine.connect() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
        conn.commit()
