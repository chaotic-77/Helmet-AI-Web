(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const fileNameEl = document.getElementById("fileName");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  const setStatus = (html) => {
    result.innerHTML = html;
  };

  const setFileName = (name) => {
    const safe = name || "Ningún archivo seleccionado";
    fileNameEl.textContent = safe;
    fileNameEl.title = safe;
  };

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      setFileName("");
      preview.style.display = "none";
      preview.removeAttribute("src");
      setStatus("");
      return;
    }

    setFileName(file.name);

    // Preview local (antes de enviar)
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.alt = "Imagen seleccionada";
    preview.style.display = "block";

    // limpia status anterior
    setStatus("");
  });

  sendBtn.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) {
      alert("Sube una imagen primero.");
      return;
    }

    sendBtn.disabled = true;
    const oldText = sendBtn.textContent;
    sendBtn.textContent = "Analizando...";

    setStatus("Analizando imagen con IA...");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

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
        result.innerHTML += `<small>${data.message}</small>`;
      }

    } catch (e) {
      console.error(e);
      setStatus("🔴 No se pudo conectar con el backend o hubo un error de respuesta.");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Analizar Imagen";
    }
  });

  // init
  setFileName("");
  setStatus("");
})();
