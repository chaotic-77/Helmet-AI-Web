import io
import os
import uuid
import pathlib
import tempfile
import requests

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

try:
    from PIL import Image, ImageOps
except Exception:
    Image = None
    ImageOps = None

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


MAX_FILE_SIZE_MB = 8

ALLOWED_EXT = {
    ".jpg", ".jpeg", ".png", ".webp", ".jfif",
    ".bmp", ".tif", ".tiff", ".gif", ".avif"
}

ALLOWED_MIMES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "image/pjpeg",
    "image/bmp",
    "image/tiff",
    "image/gif",
    "image/avif",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "best.pt")

UPLOAD_DIR = os.path.join("/tmp", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID")

# Clase objetivo correcta
TARGET_CLASSES = {
    c.strip().lower()
    for c in os.getenv("TARGET_CLASS", "hardhat").split(",")
    if c.strip()
}

# Umbral configurable; por defecto 0.85
MIN_HARDHAT_CONFIDENCE = float(os.getenv("MIN_HARDHAT_CONFIDENCE", "0.85"))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024

if FRONTEND_ORIGIN == "*":
    CORS(app)
else:
    CORS(app, resources={r"/*": {"origins": [FRONTEND_ORIGIN]}})


def is_allowed(filename: str, mimetype: str | None = None) -> bool:
    ext = pathlib.Path(filename).suffix.lower()
    if ext in ALLOWED_EXT:
        return True

    if mimetype and mimetype.lower() in ALLOWED_MIMES:
        return True

    return False


def save_uploaded_image_as_jpg(file_storage) -> tuple[str, str]:
    """
    Convierte cualquier imagen soportada a JPG para inferencia consistente.
    Retorna: (temp_path_jpg, original_filename)
    """
    original_name = file_storage.filename or "upload"
    original_name = secure_filename(original_name) or f"upload_{uuid.uuid4().hex}"

    # Leemos bytes una sola vez
    raw_bytes = file_storage.read()
    if not raw_bytes:
        raise ValueError("El archivo está vacío.")

    temp_name = f"{uuid.uuid4().hex}.jpg"
    temp_path = os.path.join(UPLOAD_DIR, temp_name)

    # Intentar convertir con Pillow
    if Image is None:
        raise RuntimeError("Pillow no está instalado. Instálalo con: pip install pillow")

    try:
        img = Image.open(io.BytesIO(raw_bytes))

        # Corrige orientación EXIF si existe
        if ImageOps is not None:
            img = ImageOps.exif_transpose(img)

        # Convierte transparencias o modos extraños a RGB
        if img.mode not in ("RGB",):
            img = img.convert("RGB")

        # Guardar como JPG estandarizado
        img.save(temp_path, format="JPEG", quality=95)
        return temp_path, original_name

    except Exception as e:
        raise ValueError(f"No se pudo convertir la imagen a JPG: {e}")


def normalize_yolo_detections(result) -> list[dict]:
    detections = []
    names = result.names or {}

    if result.boxes is None or len(result.boxes) == 0:
        return detections

    for b in result.boxes:
        cls_id = int(b.cls[0])
        conf = float(b.conf[0])
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0]]

        class_name = str(names.get(cls_id, str(cls_id))).lower().strip()

        detections.append({
            "class_id": cls_id,
            "class_name": class_name,
            "confidence": conf,
            "xyxy": [x1, y1, x2, y2],
        })

    return detections


def normalize_roboflow_detections(predictions: list[dict]) -> list[dict]:
    detections = []

    for p in predictions:
        class_name = str(p.get("class", "")).lower().strip()
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

    return detections


def filter_accepted_hardhats(detections: list[dict]) -> list[dict]:
    return [
        d for d in detections
        if str(d.get("class_name", "")).lower() in TARGET_CLASSES
        and float(d.get("confidence", 0)) >= MIN_HARDHAT_CONFIDENCE
    ]


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
        "roboflow_ready": roboflow_ready,
        "target_classes": sorted(TARGET_CLASSES),
        "min_hardhat_confidence": MIN_HARDHAT_CONFIDENCE
    }), 200


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": model_ready,
        "roboflow_ready": roboflow_ready,
        "target_classes": sorted(TARGET_CLASSES),
        "min_hardhat_confidence": MIN_HARDHAT_CONFIDENCE,
        "model_error": model_error if not model_ready else None
    }), 200


@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No se envió imagen (campo 'image')."}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "Nombre de archivo vacío."}), 400

    original_name = file.filename

    if not is_allowed(original_name, getattr(file, "mimetype", None)):
        return jsonify({
            "error": "Formato no permitido.",
            "filename": original_name,
            "mimetype": getattr(file, "mimetype", None),
            "allowed_note": "El backend intenta convertir imágenes soportadas a JPG antes de inferencia."
        }), 415

    temp_path = None

    try:
        # Convertir SIEMPRE a JPG antes de inferencia
        temp_path, safe_original_name = save_uploaded_image_as_jpg(file)

        # --- YOLO local ---
        if model_ready and model is not None:
            results = model(temp_path)
            r = results[0]

            detections = normalize_yolo_detections(r)
            accepted_hardhats = filter_accepted_hardhats(detections)
            helmet_detected = len(accepted_hardhats) > 0

            return jsonify({
                "ok": True,
                "mode": "yolo",
                "model_ready": True,
                "roboflow_ready": roboflow_ready,
                "target_classes": sorted(TARGET_CLASSES),
                "min_hardhat_confidence": MIN_HARDHAT_CONFIDENCE,
                "filename": safe_original_name,
                "normalized_input_format": "jpg",
                "detected": helmet_detected,
                "helmet_count": len(accepted_hardhats),
                "detections": accepted_hardhats,
                "all_detections": detections
            }), 200

        # --- Roboflow Hosted API ---
        if roboflow_ready:
            with open(temp_path, "rb") as img_file:
                response = requests.post(
                    f"https://serverless.roboflow.com/{ROBOFLOW_MODEL_ID}",
                    params={"api_key": ROBOFLOW_API_KEY},
                    files={"file": ("image.jpg", img_file, "image/jpeg")},
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

            detections = normalize_roboflow_detections(predictions)
            accepted_hardhats = filter_accepted_hardhats(detections)
            helmet_detected = len(accepted_hardhats) > 0

            return jsonify({
                "ok": True,
                "mode": "roboflow",
                "model_ready": False,
                "roboflow_ready": True,
                "target_classes": sorted(TARGET_CLASSES),
                "min_hardhat_confidence": MIN_HARDHAT_CONFIDENCE,
                "filename": safe_original_name,
                "normalized_input_format": "jpg",
                "detected": helmet_detected,
                "helmet_count": len(accepted_hardhats),
                "detections": accepted_hardhats,
                "all_detections": detections,
                "raw": data
            }), 200

        # --- Demo ---
        return jsonify({
            "ok": True,
            "mode": "demo",
            "model_ready": False,
            "roboflow_ready": False,
            "target_classes": sorted(TARGET_CLASSES),
            "min_hardhat_confidence": MIN_HARDHAT_CONFIDENCE,
            "detected": False,
            "helmet_count": 0,
            "message": "DEMO: no hay best.pt local ni variables de Roboflow configuradas."
        }), 200

    except ValueError as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 400

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": f"Error interno en predict: {str(e)}"
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)