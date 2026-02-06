import os
import uuid
import pathlib

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# YOLO es opcional hasta que tengas best.pt
try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

# -----------------------
# Config
# -----------------------
MAX_FILE_SIZE_MB = 8
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "best.pt")

# En Render es mejor usar /tmp para archivos temporales
UPLOAD_DIR = os.path.join("/tmp", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024

# Por ahora abierto para pruebas. Luego lo cerramos al dominio de Vercel.
CORS(app)

def is_allowed(filename: str) -> bool:
    return pathlib.Path(filename.lower()).suffix in ALLOWED_EXT

# Cargar modelo si existe
model = None
model_ready = False
if YOLO is not None and os.path.exists(MODEL_PATH):
    try:
        model = YOLO(MODEL_PATH)
        model_ready = True
    except Exception:
        model = None
        model_ready = False

@app.get("/")
def home():
    return jsonify({
        "message": "Helmet AI backend running",
        "health": "/health",
        "predict": "/predict",
        "model_ready": model_ready
    }), 200

@app.get("/health")
def health():
    return jsonify({"status": "ok", "model_ready": model_ready}), 200

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
        # --------- YOLO REAL (cuando exista best.pt) ----------
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

            # Ajusta esto al nombre de tu clase real del dataset
            TARGET_CLASS = "helmet"
            detected = any(d["class_name"].lower() == TARGET_CLASS for d in detections)

            return jsonify({
                "ok": True,
                "mode": "yolo",
                "model_ready": True,
                "detected": detected,
                "detections": detections
            }), 200

        # --------- MOCK (mientras no exista best.pt) ----------
        # Mock consistente: si el nombre del archivo contiene "helmet/casco/hardhat" => True
        fname = (file.filename or "").lower()
        detected = ("helmet" in fname) or ("casco" in fname) or ("hardhat" in fname)

        return jsonify({
            "ok": True,
            "mode": "mock",
            "model_ready": False,
            "detected": detected,
            "message": "Modelo aún no cargado; respuesta mock consistente por nombre de archivo."
        }), 200

    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
