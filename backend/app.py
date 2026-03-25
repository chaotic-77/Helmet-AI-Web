import os
import uuid
import pathlib
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

MAX_FILE_SIZE_MB = 8
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "best.pt")

UPLOAD_DIR = os.path.join("/tmp", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID")
TARGET_CLASS = os.getenv("TARGET_CLASS", "helmet").lower()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024

if FRONTEND_ORIGIN == "*":
    CORS(app)
else:
    CORS(app, resources={r"/*": {"origins": [FRONTEND_ORIGIN]}})

def is_allowed(filename: str) -> bool:
    return pathlib.Path(filename.lower()).suffix in ALLOWED_EXT

model = None
model_ready = False
model_error = None

if YOLO is not None and os.path.exists(MODEL_PATH):
    try:
        model = YOLO(MODEL_PATH)
        model_ready = True
    except Exception as e:
        model_error = str(e)
elif YOLO is None:
    model_error = "ultralytics no instalado en el entorno."
else:
    model_error = f"Modelo no encontrado en {MODEL_PATH}"

roboflow_ready = bool(ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID)

@app.get("/")
def home():
    return jsonify({
        "message": "Helmet AI backend running",
        "health": "/health",
        "predict": "/predict",
        "model_ready": model_ready,
        "roboflow_ready": roboflow_ready
    }), 200

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": model_ready,
        "roboflow_ready": roboflow_ready,
        "model_error": model_error if not model_ready else None
    }), 200

@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No se envió imagen (campo 'image')."}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "Nombre de archivo vacío."}), 400

    filename = secure_filename(file.filename)
    if not is_allowed(filename):
        return jsonify({"error": "Formato no permitido. Usa jpg/jpeg/png/webp."}), 415

    ext = pathlib.Path(filename).suffix.lower()
    temp_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_DIR, temp_name)
    file.save(temp_path)

    try:
        # --- YOLO local ---
        if model_ready and model is not None:
            results = model(temp_path)
            r = results[0]
            names = r.names

            detections = []
            if r.boxes is not None and len(r.boxes) > 0:
                for b in r.boxes:
                    cls_id = int(b.cls[0])
                    conf = float(b.conf[0])
                    x1, y1, x2, y2 = [float(v) for v in b.xyxy[0]]

                    detections.append({
                        "class_id": cls_id,
                        "class_name": names.get(cls_id, str(cls_id)),
                        "confidence": conf,
                        "xyxy": [x1, y1, x2, y2],
                    })

            detected = any(d["class_name"].lower() == TARGET_CLASS for d in detections)

            return jsonify({
                "ok": True,
                "mode": "yolo",
                "model_ready": True,
                "roboflow_ready": roboflow_ready,
                "detected": detected,
                "detections": detections
            }), 200

        # --- Roboflow Hosted API ---
        if roboflow_ready:
            with open(temp_path, "rb") as img_file:
                response = requests.post(
                    f"https://serverless.roboflow.com/{ROBOFLOW_MODEL_ID}",
                    params={"api_key": ROBOFLOW_API_KEY},
                    files={"file": img_file},
                    timeout=60
                )

            if response.status_code != 200:
                return jsonify({
                    "ok": False,
                    "mode": "roboflow",
                    "error": "Roboflow respondió con error",
                    "status_code": response.status_code,
                    "details": response.text
                }), 502

            data = response.json()
            predictions = data.get("predictions", [])

            detections = []
            for p in predictions:
                class_name = str(p.get("class", ""))
                confidence = float(p.get("confidence", 0))

                x = float(p.get("x", 0))
                y = float(p.get("y", 0))
                w = float(p.get("width", 0))
                h = float(p.get("height", 0))

                x1 = x - (w / 2)
                y1 = y - (h / 2)
                x2 = x + (w / 2)
                y2 = y + (h / 2)

                detections.append({
                    "class_name": class_name,
                    "confidence": confidence,
                    "xyxy": [x1, y1, x2, y2]
                })

            detected = any(d["class_name"].lower() == TARGET_CLASS for d in detections)

            return jsonify({
                "ok": True,
                "mode": "roboflow",
                "model_ready": False,
                "roboflow_ready": True,
                "detected": detected,
                "detections": detections,
                "raw": data
            }), 200

        # --- Demo ---
        return jsonify({
            "ok": True,
            "mode": "demo",
            "model_ready": False,
            "roboflow_ready": False,
            "detected": False,
            "message": "DEMO: no hay best.pt local ni variables de Roboflow configuradas."
        }), 200

    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)