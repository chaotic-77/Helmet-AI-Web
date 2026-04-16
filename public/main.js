(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const topbar = document.getElementById("topbar");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";
  const HARDHAT_THRESHOLD = 0.85;

  const onScroll = () => {
    topbar?.classList.toggle("scrolled", window.scrollY > 80);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.querySelectorAll("[data-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById(btn.dataset.modal);
      if (modal) modal.classList.add("active");
    });
  });

  document.querySelectorAll(".close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) modal.classList.remove("active");
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach((m) => m.classList.remove("active"));
    }
  });

  function fileToObjectURL(file) {
    return URL.createObjectURL(file);
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = fileToObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen."));
      };

      img.src = url;
    });
  }

  async function convertImageToJpeg(file, quality = 0.92) {
    const img = await loadImageFromFile(file);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo inicializar canvas.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) {
      throw new Error("No se pudo convertir la imagen a JPG.");
    }

    const baseName = (file.name || "imagen")
      .replace(/\.[^.]+$/, "")
      .replace(/\s+/g, "_");

    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg"
    });
  }

  function buildDebugInfo(data) {
    const debugSource =
      Array.isArray(data.all_detections) && data.all_detections.length > 0
        ? data.all_detections
        : Array.isArray(data.detections)
          ? data.detections
          : [];

    if (debugSource.length === 0) {
      return "sin detecciones";
    }

    return debugSource
      .map((d) => {
        const cls = d.class_name || d.class || "sin_clase";
        const conf = Number(d.confidence ?? 0).toFixed(2);
        return `${cls} (${conf})`;
      })
      .join(" | ");
  }

  function getAcceptedHardhats(data) {
    return (Array.isArray(data.detections) ? data.detections : []).filter((d) => {
      const cls = (d.class_name || d.class || "").toLowerCase();
      const conf = Number(d.confidence ?? 0);
      return cls === "hardhat" && conf >= HARDHAT_THRESHOLD;
    });
  }

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";

    if (previewHint) previewHint.style.display = "none";
    result.innerHTML = "";
  });

  sendBtn?.addEventListener("click", async () => {
    const file = input.files?.[0];

    if (!file) {
      alert("Sube una imagen primero");
      return;
    }

    sendBtn.disabled = true;
    const oldText = sendBtn.textContent;
    sendBtn.textContent = "Analizando...";

    try {
      const normalizedFile = await convertImageToJpeg(file);

      const formData = new FormData();
      formData.append("image", normalizedFile, normalizedFile.name);

      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const rawText = await resp.text();
      console.log("Status /predict:", resp.status);
      console.log("Raw /predict:", rawText);

      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        result.innerHTML = `🔴 Respuesta no JSON (${resp.status})`;
        return;
      }

      console.log("Respuesta /predict:", data);

      if (data.detections && data.detections.length > 0) {
        console.log("Detecciones aceptadas:", data.detections);
      }

      if (data.all_detections && data.all_detections.length > 0) {
        console.log("Todas las detecciones:", data.all_detections);
      }

      if (!resp.ok) {
        const msg =
          data?.error ||
          data?.message ||
          data?.details ||
          `Error ${resp.status}`;

        result.innerHTML = `🔴 ${msg}`;
        return;
      }

      const mode = data.mode ?? "roboflow";
      const debugInfo = buildDebugInfo(data);
      const acceptedHardhats = getAcceptedHardhats(data);
      const acceptedCount = acceptedHardhats.length;
      const finalDetected = acceptedCount > 0;

      if (finalDetected) {
        result.innerHTML = `
          🟢 Casco detectado (${mode})<br>
          Cantidad: ${acceptedCount}<br>
          <small>DEBUG: ${debugInfo}</small>
        `;
      } else {
        result.innerHTML = `
          🔴 No se detectó casco (${mode})<br>
          Cantidad: 0<br>
          <small>DEBUG: ${debugInfo}</small>
        `;
      }
    } catch (error) {
      console.error("Error:", error);
      result.innerHTML = "🔴 No se pudo procesar la imagen";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Detectar cascos";
    }
  });
})();