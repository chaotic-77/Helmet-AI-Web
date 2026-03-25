(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const previewStage = document.getElementById("previewStage");
  const topbar = document.getElementById("topbar");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  /* NAVBAR SCROLL (con init) */
  const onScroll = () => {
    topbar.classList.toggle("scrolled", window.scrollY > 80);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* MODALES */
  document.querySelectorAll("[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = document.getElementById(btn.dataset.modal);
      if (modal) modal.classList.add("active");
    });
  });

  document.querySelectorAll(".close").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.closest(".modal");
      if (m) m.classList.remove("active");
    });
  });

  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    }
  });

  /* PREVIEW */
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    if (previewHint) previewHint.style.display = "none";
  });

  /* DETECTOR */
  sendBtn?.addEventListener("click", async () => {
    const file = input.files?.[0];
    if (!file) {
      alert("Sube una imagen primero");
      return;
    }

    sendBtn.disabled = true;
    const oldText = sendBtn.textContent;
    sendBtn.textContent = "Analizando...";

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        result.innerHTML = "🔴 Respuesta inválida del servicio";
        return;
      }

     const data = await resp.json();
console.log("Respuesta /predict:", data);

if (data.detections && data.detections.length > 0) {
  console.log("Detecciones:", data.detections);
}

result.innerHTML = data.detected
  ? `🟢 Casco detectado (${data.mode || "sin mode"})`
  : `🔴 No se detectó casco (${data.mode || "sin mode"})`;

    } catch {
      result.innerHTML = "🔴 Error de conexión";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Detectar cascos";
    }
  });
})();
