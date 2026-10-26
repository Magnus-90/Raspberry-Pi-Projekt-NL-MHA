import os
import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "serviceAccountKey.json")

EXAMPLE_COLLECTION = "example"

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

def create_example(data):
    _, doc_ref = get_db().collection(EXAMPLE_COLLECTION).add(data)
    return doc_ref.id

def get_example(doc_id):
    doc = get_db().collection(EXAMPLE_COLLECTION).document(doc_id).get()
    if not doc.exists:
        return None
    return {"id": doc.id, **doc.to_dict()}

def get_all_examples():
    docs = get_db().collection(EXAMPLE_COLLECTION).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]
