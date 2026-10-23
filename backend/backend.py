from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import psutil
import sqlite3
import os

app = Flask(__name__)
CORS(app)

@app.route("/")
def start():
    x =  '{ "name":"John", "age":30, "city":"New York"}'
    y = json.loads(x)
    return y

@app.route("/update", methods=["POST"])
def updateRaspberryPi():
    return jsonify({"status": "not implemented"}), 501

@app.route("/restart", methods=["POST"])
def restartRaspberryPi():
    return jsonify({"status": "not implemented"}), 501

@app.route("/settings", methods=["POST"])
def updateSettingsRaspberryPi():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Kein gültiges JSON"}), 400

    allowed_keys = ("weatherlocation", "publictransportlocation")
    connection = sqlite3.connect(Database)
    try:
        for key in allowed_keys:
            if key in data:
                connection.execute(
                    """INSERT INTO settings (key, value) VALUES (?, ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
                    (key, data[key]),
                )
        connection.commit()
    finally:
        connection.close()

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

Database = "/app/data/database.db"

def init_db():
    os.makedirs("/app/data", exist_ok=True)
    connection = sqlite3.connect(Database)
    connection.execute(
        """ CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT)"""
    )
    connection.commit()
    connection.close()

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)