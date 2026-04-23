(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const topbar = document.getElementById("topbar");
  const canvas = document.getElementById("overlay");
  const ctx = canvas?.getContext("2d");

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

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.naturalWidth || img.width;
    tempCanvas.height = img.naturalHeight || img.height;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      throw new Error("No se pudo inicializar canvas.");
    }

    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(img, 0, 0);

    const blob = await new Promise((resolve) => {
      tempCanvas.toBlob(resolve, "image/jpeg", quality);
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
    let cls = (d.class_name || d.class || "sin_clase").toLowerCase();
    if (cls === "head") cls = "no_hardhat";

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

  function clearBoxes() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function syncCanvasToImage() {
    if (!canvas || !preview) return;
    canvas.width = preview.clientWidth || preview.width || 0;
    canvas.height = preview.clientHeight || preview.height || 0;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = `${preview.clientWidth}px`;
    canvas.style.height = `${preview.clientHeight}px`;
  }

  function drawBoxes(detections) {
    if (!canvas || !ctx || !preview) return;
    if (!preview.naturalWidth || !preview.naturalHeight) return;

    syncCanvasToImage();
    clearBoxes();

    const scaleX = preview.clientWidth / preview.naturalWidth;
    const scaleY = preview.clientHeight / preview.naturalHeight;

    detections.forEach((d) => {
      const x = Number(d.x ?? 0);
      const y = Number(d.y ?? 0);
      const w = Number(d.width ?? 0);
      const h = Number(d.height ?? 0);

      if (!w || !h) return;

      const x1 = (x - w / 2) * scaleX;
      const y1 = (y - h / 2) * scaleY;
      const boxW = w * scaleX;
      const boxH = h * scaleY;

    let label = (d.class_name || d.class || "objeto").toLowerCase();
if (label === "head") label = "no_hardhat";

const confidence = Number(d.confidence ?? 0);
const color = label === "hardhat" ? "#7c3aed" : "#ef4444";
const text = `${label} ${(confidence * 100).toFixed(1)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, boxW, boxH);

      ctx.font = "bold 14px Arial, sans-serif";
      const textWidth = ctx.measureText(text).width;
      const textHeight = 22;
      const textX = x1;
      const textY = Math.max(0, y1 - textHeight);

      ctx.fillStyle = color;
      ctx.fillRect(textX, textY, textWidth + 12, textHeight);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, textX + 6, textY + 15);
    });
  }

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    preview.onload = () => {
      syncCanvasToImage();
      clearBoxes();
    };

    preview.src = objectUrl;
    preview.style.display = "block";

    if (previewHint) previewHint.style.display = "none";
    result.innerHTML = "";
    clearBoxes();
  });

  window.addEventListener("resize", () => {
    syncCanvasToImage();
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
        clearBoxes();
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
        clearBoxes();
        return;
      }

      const mode = data.mode ?? "roboflow";
      const debugInfo = buildDebugInfo(data);
      const acceptedHardhats = getAcceptedHardhats(data);
      const acceptedCount = acceptedHardhats.length;
      const finalDetected = acceptedCount > 0;

      const allDetections =
        Array.isArray(data.all_detections) && data.all_detections.length > 0
          ? data.all_detections
          : Array.isArray(data.detections)
            ? data.detections
            : [];

      drawBoxes(allDetections);

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
      clearBoxes();
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Detectar cascos";
    }
  });

// =======================
// SLIDER PROYECTO (MODAL)
// =======================

let currentProjectSlide = 0;

const projectSlides = document.querySelectorAll(".project-slide");
const projectDots = document.querySelectorAll(".slider-dot");

function updateProjectSlides(index) {
  if (!projectSlides.length) return;

  if (index < 0) index = projectSlides.length - 1;
  if (index >= projectSlides.length) index = 0;

  projectSlides.forEach((slide) => slide.classList.remove("active"));
  projectDots.forEach((dot) => dot.classList.remove("active"));

  projectSlides[index].classList.add("active");
  if (projectDots[index]) projectDots[index].classList.add("active");

  currentProjectSlide = index;
}

// Botones flechas
window.changeProjectSlide = function (direction) {
  updateProjectSlides(currentProjectSlide + direction);
};

// Dots
window.goToProjectSlide = function (index) {
  updateProjectSlides(index);
};

// Reiniciar cuando se abre el modal
document.querySelectorAll('[data-modal="modalProyecto"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    setTimeout(() => updateProjectSlides(0), 100);
  });
});
})();