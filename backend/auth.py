import os
import hmac
import time
import secrets
from functools import wraps

from flask import jsonify, request

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
TOKEN_MAX_AGE = 3600

_tokens = {}

def login(password):
    if not ADMIN_PASSWORD or not isinstance(password, str):
        return None
    if not hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode()):
        return None
    token = secrets.token_urlsafe(32)
    _tokens[token] = time.time() + TOKEN_MAX_AGE
    return token

def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if _tokens.get(token, 0) < time.time():
            return jsonify({"error": "Nicht autorisiert"}), 401
        return f(*args, **kwargs)
    return wrapper