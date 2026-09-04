from flask import Flask, jsonify
import json
import psutil

app = Flask(__name__)

@app.route("/")
def hello_world():
    x =  '{ "name":"John", "age":30, "city":"New York"}'
    y = json.loads(x)
    return y

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

if __name__ == "__main__":
    app.run(debug=True)