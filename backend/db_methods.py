import os
import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "raspi-projekt-mha-nl-firebase-adminsdk-fbsvc-8c6d294ced.json")

SETTINGS_COLLECTION = "settings"
SETTINGS_DOC = "general"
SETTINGS_KEYS = ("weatherlocation", "publictransportlocation")

EVENTS_COLLECTION = "events"

_db = None

def get_db():
    # Lazy init so the backend still starts without the key file
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.Certificate(KEY_PATH)
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db

def get_settings():
    doc = get_db().collection(SETTINGS_COLLECTION).document(SETTINGS_DOC).get()
    stored = doc.to_dict() or {}
    return {key: stored.get(key, "") for key in SETTINGS_KEYS}

def update_settings(settings):
    get_db().collection(SETTINGS_COLLECTION).document(SETTINGS_DOC).set(settings, merge=True)

def get_events():
    docs = get_db().collection(EVENTS_COLLECTION).order_by("time").stream()
    events = []
    for doc in docs:
        data = doc.to_dict()
        time = data.get("time")
        if not data.get("name") or time is None:
            continue
        events.append({
            "id": doc.id,
            "name": data.get("name"),
            "time": time.isoformat() if hasattr(time, "isoformat") else str(time),
            "series": bool(data.get("series", False)),
            "repeat": data.get("repeat", "none"),
        })
    return events

def add_event(name, time, series=False, repeat="none"):
    get_db().collection(EVENTS_COLLECTION).add({
        "name": name,
        "time": time,
        "series": series,
        "repeat": repeat if series else "none",
    })