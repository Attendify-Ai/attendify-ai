"""Shared ChromaDB-backed face encoding store, used by both enroll_face.py
and recognize_face.py so they agree on one schema instead of each rolling
its own pickle/DB logic.

Each enrolled angle (front/left/right/up/down) is stored as its own vector,
keyed by "<person_key>::<angle>" so re-enrolling the same person naturally
overwrites their old 5 vectors via upsert rather than accumulating stale
duplicates.

Distance metric: the collection is configured for "l2" (Euclidean) space,
not cosine. dlib's face_recognition encodings -- and its widely-documented
"same person" threshold of ~0.6 -- are calibrated for plain Euclidean
distance. Measured on this project's own real enrolled photos, the same
person's own different-angle encodings sit at cosine distance ~0.02-0.05,
which is far too compressed a scale for any reasonable threshold to
discriminate between people on (this was the root cause of a "matches
everyone" bug). ChromaDB's "l2" space returns *squared* Euclidean distance
(confirmed empirically), so find_matches() takes the square root before
returning, keeping every distance callers see directly comparable to
dlib's standard 0.6 convention.
"""

import math
import os
import chromadb
from chromadb.config import Settings

KNOWN_FACES_DIR = "known_faces"
DB_DIR = os.path.join(KNOWN_FACES_DIR, "chroma_db")
COLLECTION_NAME = "faces"

_collection = None


def _get_collection():
    global _collection
    if _collection is None:
        os.makedirs(DB_DIR, exist_ok=True)
        # anonymized_telemetry=False: this runs fully offline, no phone-home.
        client = chromadb.PersistentClient(path=DB_DIR, settings=Settings(anonymized_telemetry=False))
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "l2"},
        )
    return _collection


def sanitize(name):
    cleaned = "".join(c for c in name if c.isalnum() or c in " _-").strip()
    return cleaned or "user"


def person_key(name):
    """Filesystem/ID-safe, case-insensitive key used to identify a person's vectors."""
    return sanitize(name).lower().replace(" ", "_")


def save_encoding(name, angle, encoding, photo_path):
    """Upsert one angle's face encoding for a person (replaces that angle's
    previous vector if this person/angle was already enrolled)."""
    collection = _get_collection()
    entry_id = f"{person_key(name)}::{angle}"
    collection.upsert(
        ids=[entry_id],
        embeddings=[list(map(float, encoding))],
        metadatas=[{"name": name, "angle": angle, "photo_path": photo_path}],
    )


def find_matches(encoding, n=10):
    """Return up to n nearest (name, distance) pairs, nearest first, as plain
    Euclidean distance. n defaults higher than "just the top few" because
    each person has 5 enrolled angle-vectors that tend to cluster tightly
    together (~0.25-0.43 apart in this project's own measurements) -- a
    small top-k can easily be dominated entirely by one person's own other
    angles, leaving no genuine rival identity to compare against for a
    confidence-margin check."""
    collection = _get_collection()
    count = collection.count()
    if count == 0:
        return []
    result = collection.query(query_embeddings=[list(map(float, encoding))], n_results=min(n, count))
    ids = result.get("ids") or []
    if not ids or not ids[0]:
        return []
    matches = []
    for metadata, sq_distance in zip(result["metadatas"][0], result["distances"][0]):
        matches.append((metadata["name"], math.sqrt(max(sq_distance, 0.0))))
    return matches


def total_encodings_count():
    return _get_collection().count()


def enrolled_people_count():
    collection = _get_collection()
    if collection.count() == 0:
        return 0
    metadatas = collection.get()["metadatas"]
    return len({m["name"] for m in metadatas})
