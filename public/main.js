(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const previewStage = document.getElementById("previewStage");
  const topbar = document.getElementById("topbar");

  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  const setStatus = (html) => {
    result.innerHTML = html || "";
  };

  // Navbar: shrink + logos a esquinas
  const onScroll = () => {
    const scrolled = window.scrollY > 70;
    topbar.classList.toggle("scrolled", scrolled);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Menú móvil
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Cierra menú al hacer click en un link
    navLinks.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      preview.style.display = "none";
      preview.removeAttribute("src");
      previewHint.style.display = "block";
      setStatus("");
      return;
    }

    // Preview local (antes de enviar)
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.alt = "Imagen seleccionada";
    preview.style.display = "block";
    previewHint.style.display = "none";

    setStatus(""); // limpia status anterior
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

    // Animación scanner
    previewStage.classList.add("scanning");
    setStatus("Analizando imagen…");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await resp.text();
        throw new Error(`Respuesta no-JSON: ${text.slice(0, 250)}`);
      }

      const data = await resp.json();

      if (!resp.ok) {
        setStatus(`🔴 Error: ${data?.error || "falló el análisis"}`);
        return;
      }

      // Mensaje simple y limpio (sin “backend” ni “demo”)
      setStatus(
        data.detected
          ? `🟢 Casco detectado.`
          : `🔴 No se detectó casco.`
      );

      if (data.message) {
        result.innerHTML += `<small>${data.message}</small>`;
      }

    } catch (e) {
      console.error(e);
      setStatus("🔴 No se pudo conectar con el servicio o hubo un error.");
    } finally {
      previewStage.classList.remove("scanning");
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Detectar cascos";
    }
  });

  // init
  setStatus("");
})();
(() => {
  const input = document.getElementById("imageUpload");
  const preview = document.getElementById("preview");
  const sendBtn = document.getElementById("sendBtn");
  const result = document.getElementById("result");
  const previewHint = document.getElementById("previewHint");
  const previewStage = document.getElementById("previewStage");
  const topbar = document.getElementById("topbar");

  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  const API_BASE = "https://helmet-ai-web-backend.onrender.com";

  const setStatus = (html) => {
    result.innerHTML = html || "";
  };

  // Navbar: shrink + logos a esquinas
  const onScroll = () => {
    const scrolled = window.scrollY > 70;
    topbar.classList.toggle("scrolled", scrolled);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Menú móvil
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Cierra menú al hacer click en un link
    navLinks.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      preview.style.display = "none";
      preview.removeAttribute("src");
      previewHint.style.display = "block";
      setStatus("");
      return;
    }

    // Preview local (antes de enviar)
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.alt = "Imagen seleccionada";
    preview.style.display = "block";
    previewHint.style.display = "none";

    setStatus(""); // limpia status anterior
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

    // Animación scanner
    previewStage.classList.add("scanning");
    setStatus("Analizando imagen…");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const resp = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        body: formData
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await resp.text();
        throw new Error(`Respuesta no-JSON: ${text.slice(0, 250)}`);
      }

      const data = await resp.json();

      if (!resp.ok) {
        setStatus(`🔴 Error: ${data?.error || "falló el análisis"}`);
        return;
      }

      // Mensaje simple y limpio (sin “backend” ni “demo”)
      setStatus(
        data.detected
          ? `🟢 Casco detectado.`
          : `🔴 No se detectó casco.`
      );

      if (data.message) {
        result.innerHTML += `<small>${data.message}</small>`;
      }

    } catch (e) {
      console.error(e);
      setStatus("🔴 No se pudo conectar con el servicio o hubo un error.");
    } finally {
      previewStage.classList.remove("scanning");
      sendBtn.disabled = false;
      sendBtn.textContent = oldText || "Detectar cascos";
    }
  });

  // init
  setStatus("");
})();
