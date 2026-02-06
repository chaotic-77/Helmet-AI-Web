(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  const setStatus = (html) => {
    result.innerHTML = html;
  };

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    // Preview local
    preview.src = URL.createObjectURL(file);
    preview.alt = "Imagen seleccionada";
  });

  sendBtn.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) {
      alert("Sube una imagen primero.");
      return;
    }

    // UI: bloquea botón mientras procesa
    sendBtn.disabled = true;
    sendBtn.textContent = "Analizando...";

    setStatus("Analizando imagen con IA...");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      // Intentar leer JSON; si falla, mostrar texto crudo
      let data = null;
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await resp.json();
      } else {
        const text = await resp.text();
        throw new Error(`Respuesta no-JSON del backend: ${text.slice(0, 300)}`);
      }

      if (!resp.ok) {
        setStatus(`🔴 Error: ${data?.error || "falló el análisis"}`);
        return;
      }

      const mode = data.mode ? String(data.mode).toUpperCase() : "BACKEND";

      setStatus(
        data.detected
          ? `🟢 ${mode}: Casco detectado.`
          : `🔴 ${mode}: No se detectó casco.`
      );

      if (data.message) {
        result.innerHTML += `<br><small>${data.message}</small>`;
      }

    } catch (e) {
      console.error(e);
      setStatus("🔴 No se pudo conectar con el backend o hubo un error de respuesta.");
    } finally {
      // UI: reactivar botón
      sendBtn.disabled = false;
      sendBtn.textContent = "Analizar Imagen";
    }
  });
})();
