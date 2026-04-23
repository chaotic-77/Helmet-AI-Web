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

  // Cerrar con ESC
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
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(img, 0, 0);

    const blob = await new Promise((resolve) => {
      tempCanvas.toBlob(resolve, "image/jpeg", quality);
    });

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

    if (debugSource.length === 0) return "sin detecciones";

    return debugSource.map((d) => {
      let cls = (d.class_name || d.class || "sin_clase").toLowerCase();
      if (cls === "head") cls = "no_hardhat";
      const conf = Number(d.confidence ?? 0).toFixed(2);
      return `${cls} (${conf})`;
    }).join(" | ");
  }

  function getAcceptedHardhats(data) {
    return (Array.isArray(data.detections) ? data.detections : []).filter((d) => {
      const cls = (d.class_name || d.class || "").toLowerCase();
      const conf = Number(d.confidence ?? 0);
      return cls === "hardhat" && conf >= HARDHAT_THRESHOLD;
    });
  }

  function clearBoxes() {
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function syncCanvasToImage() {
    if (!canvas || !preview) return;
    canvas.width = preview.clientWidth;
    canvas.height = preview.clientHeight;
  }

  function drawBoxes(detections) {
    if (!canvas || !ctx || !preview.naturalWidth) return;

    syncCanvasToImage();
    clearBoxes();

    const scaleX = preview.clientWidth / preview.naturalWidth;
    const scaleY = preview.clientHeight / preview.naturalHeight;

    detections.forEach((d) => {
      const x = (d.x - d.width / 2) * scaleX;
      const y = (d.y - d.height / 2) * scaleY;
      const w = d.width * scaleX;
      const h = d.height * scaleY;

      let label = (d.class_name || d.class || "").toLowerCase();
      if (label === "head") label = "no_hardhat";

      const color = label === "hardhat" ? "#7c3aed" : "#ef4444";
      const text = `${label} ${(d.confidence * 100).toFixed(1)}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = color;
      ctx.fillRect(x, y - 22, 100, 22);

      ctx.fillStyle = "#fff";
      ctx.fillText(text, x + 5, y - 6);
    });
  }

  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    previewHint.style.display = "none";
    clearBoxes();
  });

  sendBtn?.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) return alert("Sube una imagen");

    sendBtn.disabled = true;

    try {
      const fileJpg = await convertImageToJpeg(file);
      const formData = new FormData();
      formData.append("image", fileJpg);

      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const data = await resp.json();

      const detections = data.all_detections || data.detections || [];
      drawBoxes(detections);

      const accepted = getAcceptedHardhats(data);

      result.innerHTML = accepted.length
        ? `🟢 Casco detectado (${accepted.length})`
        : `🔴 No se detectó casco`;

    } catch {
      result.innerHTML = "🔴 Error";
    }

    sendBtn.disabled = false;
  });

  // =======================
  // SLIDER PROYECTO
  // =======================

  let currentSlide = 0;
  const slides = document.querySelectorAll(".project-slide");
  const dots = document.querySelectorAll(".slider-dot");

  function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach(s => s.classList.remove("active"));
    dots.forEach(d => d.classList.remove("active"));

    slides[index].classList.add("active");
    dots[index]?.classList.add("active");

    currentSlide = index;
  }

  window.changeProjectSlide = (dir) => showSlide(currentSlide + dir);
  window.goToProjectSlide = (i) => showSlide(i);

  // TECLADO ← →
  window.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modalProyecto");
    if (!modal.classList.contains("active")) return;

    if (e.key === "ArrowLeft") showSlide(currentSlide - 1);
    if (e.key === "ArrowRight") showSlide(currentSlide + 1);
  });

  // Reset al abrir
  document.querySelectorAll('[data-modal="modalProyecto"]').forEach(btn => {
    btn.addEventListener("click", () => setTimeout(() => showSlide(0), 100));
  });

})();