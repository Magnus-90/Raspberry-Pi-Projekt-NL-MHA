import os
import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "raspi-projekt-mha-nl-firebase-adminsdk-fbsvc-8c6d294ced.json")

SETTINGS_COLLECTION = "settings"
SETTINGS_DOC = "general"
SETTINGS_KEYS = ("weatherlocation", "publictransportlocation")

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
