(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");

  // URL del backend en Render (PRODUCCIÓN)
  const API_BASE = "https://helmet-ai-backend.onrender.com";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
  });

  sendBtn.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) {
      alert("Sube una imagen primero.");
      return;
    }

    result.innerHTML = "Analizando imagen con IA...";

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const data = await resp.json();

      if (!resp.ok) {
        result.innerHTML = `🔴 Error: ${data.error || "falló el análisis"}`;
        return;
      }

      result.innerHTML = data.detected
        ? "🟢 Backend: Casco detectado."
        : "🔴 Backend: No se detectó casco.";

    } catch (e) {
      result.innerHTML = "🔴 No se pudo conectar con el backend (¿está corriendo?).";
      console.error(e);
    }
  });
})();
