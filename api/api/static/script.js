
// chatSwarm – enhanced client (multimedia preview, smooth scroll, reconnect)
// Re‑escrito 100 %: inserta <img>, <video> y <audio> según extensión
// Assumes endpoint /api/config devuelve {storage:"URL_BASE"}

(() => {
  /* ===== Config ===== */
  const API = "/api";
  let STORAGE = ""; // se obtendrá en startup

  /* ===== Helpers ===== */
  const qs = (sel, el = document) => el.querySelector(sel);
  const ce = (tag, cls = "") => Object.assign(document.createElement(tag), { className: cls });

  const ext = filename => filename.split(".").pop().toLowerCase();

  function makePreview(filename) {
    const url = STORAGE + filename;
    const e = ext(filename);
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(e)) {
      const img = ce("img", "max-w-full rounded-lg");
      img.src = url;
      return img;
    }
    if (["mp4", "webm"].includes(e)) {
      const vid = ce("video", "rounded-lg");
      vid.src = url;
      vid.controls = true;
      vid.preload = "metadata";
      vid.style.maxWidth = "220px";
      return vid;
    }
    if (["mp3", "ogg", "wav"].includes(e)) {
      const aud = ce("audio");
      aud.src = url;
      aud.controls = true;
      return aud;
    }
    // default link
    const a = ce("a", "underline");
    a.href = url;
    a.target = "_blank";
    a.textContent = filename;
    return a;
  }

  function scrollIfAtBottom(container) {
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
    if (atBottom) container.scrollTop = container.scrollHeight;
  }

  /* ===== State ===== */
  const messagesEl = qs("#messages");
  const inputEl = qs("#msg");
  const fileEl = qs("#file");
  const toastEl = qs("#toast");

  function showToast(txt, ms = 2000) {
    toastEl.textContent = txt;
    toastEl.classList.remove("opacity-0");
    setTimeout(() => toastEl.classList.add("opacity-0"), ms);
  }

  /* ===== WebSocket ===== */
  let ws;
  function connectWS(room) {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${room}`);
    ws.onmessage = ev => {
      const { type, content } = JSON.parse(ev.data);
      if (type === "text") renderMessage(content);
      if (type === "file") renderFile(content);
    };
    ws.onclose = () => setTimeout(() => connectWS(room), 2000);
  }

  /* ===== Rendering ===== */
  function renderMessage(text) {
    const wrap = ce("div", "bg-blue-600 text-white p-2 rounded-lg mb-2 self-end max-w-xs break-words animate-fadeInSlideUp");
    wrap.textContent = text;
    messagesEl.appendChild(wrap);
    scrollIfAtBottom(messagesEl);
  }

  function renderFile(filename) {
    const wrap = ce("div", "bg-blue-600 p-2 rounded-lg mb-2 self-end max-w-xs animate-fadeInSlideUp flex justify-center");
    wrap.appendChild(makePreview(filename));
    messagesEl.appendChild(wrap);
    scrollIfAtBottom(messagesEl);
  }

  /* ===== Sending ===== */
  qs("#send").onclick = () => {
    const txt = inputEl.value.trim();
    if (!txt) return;
    ws.send(JSON.stringify({ type: "text", content: txt }));
    inputEl.value = "";
  };

  fileEl.onchange = async () => {
    if (!fileEl.files[0]) return;
    const form = new FormData();
    form.append("file", fileEl.files[0]);
    showToast("Subiendo…");
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const { filename } = await res.json();
      ws.send(JSON.stringify({ type: "file", content: filename }));
      showToast("¡Enviado!");
    } catch (e) {
      console.error(e);
      showToast("Error al subir", 3000);
    }
    fileEl.value = "";
  };

  /* ===== Startup ===== */
  (async () => {
    const cfg = await (await fetch(`${API}/config`)).json();
    STORAGE = cfg.storage.endsWith("/") ? cfg.storage : cfg.storage + "/";
    connectWS("general");
  })();
})();

