from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Helmet AI backend running", "health": "/health", "predict": "/predict"})

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No se envió imagen"}), 400

    image = request.files["image"]

    filepath = os.path.join(UPLOAD_FOLDER, image.filename)
    image.save(filepath)

    # Simulación IA (luego aquí va YOLO real)
    import secrets
    detected = bool(secrets.randbelow(2))
    print("DEBUG detected =", detected)

    return jsonify({
        "detected": detected,
        "message": "Backend funcionando"
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)
