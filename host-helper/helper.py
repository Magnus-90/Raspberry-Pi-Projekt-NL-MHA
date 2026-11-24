from flask import Flask, jsonify, request
import subprocess
import glob
import os

app = Flask(__name__)

PROJECT_DIR = os.environ.get("PROJECT_DIR", os.path.expanduser("~/Raspberry-Pi-Projekt-NL-MHA"))

# Helligkeit je Zustand als Anteil von max_brightness, 0 schaltet die Hintergrundbeleuchtung aus
BACKLIGHT_LEVELS = {"on": 1.0, "dim": 0.4, "sleep": 0.0}

@app.route("/health")
def healthCheck():
    return jsonify({"status": "ok"}), 200

@app.route("/update", methods=["POST"])
def updatePi():
    try:
        subprocess.run(["git", "pull"], cwd=PROJECT_DIR, check=True, capture_output=True, text=True)
        subprocess.Popen(["docker", "compose", "up", "-d", "--build"], cwd=PROJECT_DIR)
    except subprocess.CalledProcessError as error:
        return jsonify({"error": "git pull fehlgeschlagen", "details": error.stderr}), 500
    except OSError as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"status": "update started"}), 202

@app.route("/restart", methods=["POST"])
def restartPi():
    try:
        subprocess.Popen(["sh", "-c", "sleep 2 && sudo -n /usr/bin/systemctl reboot"])

    except OSError as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"status": "restart started"}), 202

@app.route("/display", methods=["POST"])
def setDisplay():
    data = request.get_json(silent=True)
    state = data.get("state") if isinstance(data, dict) else None
    if state not in BACKLIGHT_LEVELS:
        return jsonify({"error": "Unbekannter Zustand"}), 400

    # Das offizielle Touch-Display erscheint hier, z. B. als /sys/class/backlight/10-0045
    devices = glob.glob("/sys/class/backlight/*")
    if not devices:
        return jsonify({"error": "Kein Display mit regelbarer Hintergrundbeleuchtung gefunden"}), 501
    try:
        for device in devices:
            with open(f"{device}/max_brightness") as file:
                maximum = int(file.read())
            with open(f"{device}/brightness", "w") as file:
                file.write(str(round(maximum * BACKLIGHT_LEVELS[state])))
    except OSError as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"status": f"display {state}"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
