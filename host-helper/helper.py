from flask import Flask, jsonify
import subprocess
import os

app = Flask(__name__)

PROJECT_DIR = os.environ.get("PROJECT_DIR", os.path.expanduser("~/Raspberry-Pi-Projekt-NL-MHA"))

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
        subprocess.Popen(["sh", "-c", "sleep 2 && systemctl reboot"])
    except OSError as error:
        return jsonify({"error": str(error)}), 500
    return jsonify({"status": "restart started"}), 202

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
