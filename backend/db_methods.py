import os
import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "raspi-projekt-mha-nl-firebase-adminsdk-fbsvc-8c6d294ced.json")

SETTINGS_COLLECTION = "settings"
SETTINGS_DOCS = {
    "general":         ("primarycolor", "secondarycolor", "darkmode"),
    "weather":         ("weatherlocation",),
    "publictransport": ("publictransportlocation", "publictransportlocation2"),
}
ALL_KEYS = tuple(key for keys in SETTINGS_DOCS.values() for key in keys)
OPTIONAL_KEYS = ("publictransportlocation2",)
COLOR_KEYS = ("primarycolor", "secondarycolor")
DARKMODE_VALUES = ("true", "false")

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
    db = get_db()
    refs = [db.collection(SETTINGS_COLLECTION).document(name) for name in SETTINGS_DOCS]
    stored = {snap.id: (snap.to_dict() or {}) for snap in db.get_all(refs)}
    return {
        key: stored.get(name, {}).get(key, "")
        for name, keys in SETTINGS_DOCS.items()
        for key in keys
    }


def update_settings(settings):
    db = get_db()
    batch = db.batch()
    for name, keys in SETTINGS_DOCS.items():
        part = {key: value for key, value in settings.items() if key in keys}
        if part:
            doc = db.collection(SETTINGS_COLLECTION).document(name)
            batch.set(doc, part, merge=True)
    batch.commit()

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