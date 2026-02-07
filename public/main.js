(() => {

  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const previewStage = document.getElementById("previewStage");
  const topbar = document.getElementById("topbar");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  const setStatus = html => result.innerHTML = html || "";

  /* NAVBAR SCROLL */
  const onScroll = () => {
    const scrolled = window.scrollY > 60;
    topbar.classList.toggle("scrolled", scrolled);
  };

  window.addEventListener("scroll", onScroll);
  onScroll();

  /* IMAGE PREVIEW */
  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (!file) {
      preview.style.display = "none";
      previewHint.style.display = "block";
      return;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    previewHint.style.display = "none";
  });

  /* ANALYZE */
  sendBtn.addEventListener("click", async () => {

    const file = input.files?.[0];
    if (!file) return alert("Sube una imagen primero.");

    sendBtn.disabled = true;
    sendBtn.textContent = "Analizando...";
    previewStage.classList.add("scanning");

    const formData = new FormData();
    formData.append("image", file);

    try {

      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const data = await resp.json();

      setStatus(
        data.detected
          ? "🟢 Casco detectado"
          : "🔴 No se detectó casco"
      );

    } catch (e) {
      setStatus("🔴 Error conectando con el backend");
    }

    previewStage.classList.remove("scanning");
    sendBtn.disabled = false;
    sendBtn.textContent = "Detectar cascos";

  });

})();
