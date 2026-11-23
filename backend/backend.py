from flask import Flask, jsonify, request
from flask_cors import CORS
import psutil
import requests
import db_methods
import auth
from datetime import datetime, timezone
import re

app = Flask(__name__)
CORS(app)

# The helper runs on the Pi (not in the container), reachable via host.docker.internal
HELPER_URL = "http://host.docker.internal:5001"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")

def call_helper(path, started_message):
    try:
        response = requests.post(f"{HELPER_URL}/{path}", timeout=60)
    except requests.exceptions.RequestException:
        return jsonify({"status": "Helfer nicht erreichbar"}), 502
    if response.ok:
        return jsonify({"status": started_message}), 202
    return jsonify({"status": "Helfer meldet einen Fehler", "details": response.text}), 502

@app.route("/update", methods=["POST"])
@auth.require_admin
def updateRaspberryPi():
    return call_helper("update", "update gestartet")

@app.route("/restart", methods=["POST"])
@auth.require_admin
def restartRaspberryPi():
    return call_helper("restart", "neustart gestartet")

SETTINGS_MAX_LENGTH = 100

@app.route("/settings", methods=["GET"])
def getSettingsRaspberryPi():
    try:
        return jsonify(db_methods.get_settings())
    except Exception as e:
        return jsonify({"error": "Firestore-Fehler", "details": str(e)}), 500

@app.route("/settings", methods=["POST"])
@auth.require_admin
def updateSettingsRaspberryPi():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "Kein gültiges JSON"}), 400

    unknown_keys = set(data) - set(db_methods.ALL_KEYS)
    if unknown_keys:
        return jsonify({"error": "Unbekannte Parameter", "details": sorted(unknown_keys)}), 400

    settings = {}
    for key, value in data.items():
        if not isinstance(value, str) or len(value.strip()) > SETTINGS_MAX_LENGTH:
            return jsonify({"error": f"Ungültiger Wert für {key}"}), 400
        # Leer ist nur bei optionalen Einstellungen erlaubt
        if not value.strip() and key not in db_methods.OPTIONAL_KEYS:
            return jsonify({"error": f"Ungültiger Wert für {key}"}), 400
        if key in db_methods.COLOR_KEYS and not HEX_COLOR.match(value.strip()):
            return jsonify({"error": f"Ungültige Farbe für {key}"}), 400
        if key == "darkmode" and value.strip() not in db_methods.DARKMODE_VALUES:
            return jsonify({"error": "Ungültiger Wert für darkmode"}), 400
        settings[key] = value.strip()

    try:
        db_methods.update_settings(settings)
    except Exception as e:
        return jsonify({"error": "Firestore-Fehler", "details": str(e)}), 500

    return jsonify({"status": "ok"})

@app.route("/health")
def get_health_data():

    temp = "N/A"
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as temp_file:
            temp = round(float(temp_file.read()) / 1000, 2)
    except FileNotFoundError:
        pass

    cpu_percentage = 0.0
    try:
        cpu_percentage = psutil.cpu_percent(interval=1)
    except FileNotFoundError:
        pass

    ram_percentage = 0.0
    ram_used_gb = 0.0
    ram_total_gb = 0.0
    try:
        ram_info = psutil.virtual_memory()
        ram_percentage = ram_info.percent
        ram_used_gb = round(ram_info.used / (1024 ** 3), 2)
        ram_total_gb = round(ram_info.total / (1024 ** 3), 2)
    except Exception:
        pass

    json_values = {
        "Temperature": temp,
        "CPU_Percent": cpu_percentage,
        "RAM_Percent": ram_percentage,
        "RAM_Used_GB": ram_used_gb,
        "RAM_Total_GB": ram_total_gb
    }

    json_payload = jsonify(json_values)

    return json_payload

@app.route("/login", methods=["POST"])
def login_route():
    data = request.get_json(silent=True)
    token = auth.login(data.get("password") if isinstance(data, dict) else None)
    if token is None:
        return jsonify({"error": "Falsches Passwort"}), 401
    return jsonify({"token": token})

@app.route("/events", methods=["GET"])
def getEvents():
    try:
        return jsonify(db_methods.get_events())
    except Exception as e:
        return jsonify({"error": "Firestore-Fehler", "details": str(e)}), 500

EVENT_NAME_MAX_LENGTH = 100
EVENT_REPEATS = ("daily", "weekly", "monthly", "yearly")

@app.route("/events", methods=["POST"])
def addEvent():
    data = request.get_json(silent=True)
    if (not isinstance(data, dict)
            or not {"name", "time"} <= set(data)
            or set(data) - {"name", "time", "series", "repeat"}):
        return jsonify({"error": "Erwartet name, time sowie optional series und repeat"}), 400

    series = data.get("series", False)
    if not isinstance(series, bool):
        return jsonify({"error": "Ungültiger Wert für series"}), 400
    repeat = data.get("repeat", "none")
    if series and repeat not in EVENT_REPEATS:
        return jsonify({"error": "Ungültiger Wert für repeat"}), 400

    name = data["name"]
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > EVENT_NAME_MAX_LENGTH:
        return jsonify({"error": "Ungültiger Name"}), 400

    try:
        time = datetime.fromisoformat(data["time"])
    except (TypeError, ValueError):
        return jsonify({"error": "Ungültige Zeit"}), 400
    if time.tzinfo is None:
        return jsonify({"error": "Die Zeit braucht eine Zeitzone"}), 400
    if not series and time <= datetime.now(timezone.utc):
        return jsonify({"error": "Die Zeit liegt in der Vergangenheit"}), 400

    try:
        db_methods.add_event(name.strip(), time, series, repeat)
    except Exception as e:
        return jsonify({"error": "Firestore-Fehler", "details": str(e)}), 500
    return jsonify({"status": "ok"}), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)