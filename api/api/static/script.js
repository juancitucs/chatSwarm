// Enhanced chat front‑end – multimedia preview, smooth scroll, toasts
// Assumes back‑end API remains the same as original script.js

(() => {
  /* ========== Config ========= */
  const API = "/api"; // relative – Caddy proxies to FastAPI
  const STORAGE_PROMISE = fetch("/api/config") // returns {storage: "http://IP:9000/chat/"}
    .then((r) => (r.ok ? r.json() : { storage: "" }))
    .then((j) => j.storage || "");

  /* ========== DOM refs ========= */
  const $loginCard = qs("#login-card");
  const $registerCard = qs("#register-card");
  const $app = qs("#app");
  const $rooms = qs("#rooms");
  const $chat = qs("#chat");
  const $msgs = qs("#messages");
  const $msgInput = qs("#msg-input");
  const $fileInput = qs("#file-input");
  const $sendBtn = qs("#btn-send");
  const $uploadBtn = qs("#btn-upload");

  /* ========== State ========= */
  let token = localStorage.getItem("jwt") || "";
  let me = localStorage.getItem("user") || "";
  let currentRoom = "";
  let ws; // active WebSocket
  let STORAGE = "";

  /* ========== Helpers ========= */
  function qs(sel) {
    return document.querySelector(sel);
  }
  function show(el) {
    el.classList.remove("hidden");
  }
  function hide(el) {
    el.classList.add("hidden");
  }
  function toast(msg, ok = true) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:" +
      (ok ? "#0066cc" : "#b33") +
      ";color:#fff;padding:8px 12px;border-radius:6px;opacity:0;transition:.3s";
    document.body.appendChild(t);
    requestAnimationFrame(() => (t.style.opacity = "1"));
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }
  async function authFetch(url, opts = {}) {
    opts.headers = {
      ...(opts.headers || {}),
      Authorization: "Bearer " + token,
      "Content-Type": opts.body ? "application/json" : undefined,
    };
    const r = await fetch(url, opts);
    if (r.status === 401) logout();
    return r;
  }
  function scrollIfNeeded() {
    // keep scroll if user near bottom; else preserve position
    const nearBottom =
      $msgs.scrollTop + $msgs.clientHeight >= $msgs.scrollHeight - 80;
    if (nearBottom) {
      $msgs.scrollTop = $msgs.scrollHeight;
    }
  }
  function createMediaElem(url) {
    const ext = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) {
      const img = document.createElement("img");
      img.src = url;
      img.loading = "lazy";
      return img;
    }
    if (["mp4", "webm", "ogg"].includes(ext)) {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.preload = "metadata";
      return video;
    }
    if (["mp3", "wav", "ogg"].includes(ext)) {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.controls = true;
      return audio;
    }
    // fall back link
    const a = document.createElement("a");
    a.href = url;
    a.textContent = "Descargar archivo";
    a.target = "_blank";
    return a;
  }
  function renderMsg({ sender, content, ts }) {
    const wrap = document.createElement("div");
    wrap.className = "msg-wrap " + (sender === me ? "mine" : "other");

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // decide if content is a STORAGE url
    if (STORAGE && content.startsWith(STORAGE)) {
      bubble.appendChild(createMediaElem(content));
    } else if (/^https?:\/\//.test(content)) {
      const a = document.createElement("a");
      a.href = content;
      a.textContent = content;
      a.target = "_blank";
      bubble.appendChild(a);
    } else {
      bubble.textContent = content;
    }

    const name = document.createElement("div");
    name.className = "name";
    name.textContent =
      sender +
      " · " +
      new Date(ts).toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      });

    wrap.append(bubble, name);
    $msgs.appendChild(wrap);
    scrollIfNeeded();
  }

  /* ========== Auth flow ========= */
  async function login(user, pass) {
    const r = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (r.ok) {
      const j = await r.json();
      token = j.token;
      me = user;
      localStorage.setItem("jwt", token);
      localStorage.setItem("user", me);
      startApp();
    } else {
      toast("Credenciales inválidas", false);
    }
  }
  async function register(user, pass) {
    const r = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (r.ok) {
      toast("Cuenta creada, inicia sesión");
      hide($registerCard);
      show($loginCard);
    } else {
      const j = await r.json();
      toast(j.detail || "Error", false);
    }
  }
  function logout() {
    token = me = "";
    localStorage.clear();
    hide($app);
    hide($chat);
    show($loginCard);
    if (ws) ws.close();
  }

  /* ========== Rooms ========= */
  async function loadRooms() {
    const r = await authFetch(`${API}/rooms`);
    if (!r.ok) return;
    const rooms = await r.json();
    $rooms.innerHTML = "";
    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = room.id;
      li.onclick = () => openRoom(room.id);
      $rooms.appendChild(li);
    });
  }

  /* ========== Messaging ========= */
  async function openRoom(roomId) {
    if (ws) ws.close();
    currentRoom = roomId;
    qs("#room-title").textContent = roomId;
    show($chat);
    $msgs.innerHTML = ""; // keep scroll at top for new room
    await loadHistory(roomId);
    ws = new WebSocket(
      `ws://${location.host}${API.replace("/api", "")}/ws/${roomId}?token=${token}`,
    );
    ws.onmessage = (e) => renderMsg(JSON.parse(e.data));
  }
  async function loadHistory(roomId) {
    const r = await authFetch(`${API}/history/${roomId}?limit=50`);
    if (!r.ok) return;
    const arr = (await r.json()).reverse();
    arr.forEach(renderMsg);
    // scroll to bottom directly for history
    $msgs.scrollTop = $msgs.scrollHeight;
  }
  async function sendMsg(text, fileUrl = "") {
    if (!currentRoom) return;
    $sendBtn.disabled = true;
    const body = {
      room: currentRoom,
      content: fileUrl || text,
    };
    const r = await authFetch(`${API}/send`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    $sendBtn.disabled = false;
    if (!r.ok) {
      toast("Error al enviar", false);
    } else {
      $msgInput.value = "";
    }
  }

  /* ========== File upload ========= */
  $uploadBtn.onclick = () => $fileInput.click();
  $fileInput.onchange = async () => {
    const file = $fileInput.files[0];
    if (!file) return;
    $uploadBtn.disabled = true;
    const fd = new FormData();
    fd.append("file", file);
    const r = await authFetch(`${API}/upload`, {
      method: "POST",
      body: fd,
      headers: {},
    });
    $uploadBtn.disabled = false;
    if (r.ok) {
      const { url } = await r.json();
      sendMsg("", url);
    } else {
      toast("Error al subir archivo", false);
    }
  };

  /* ========== UI bindings ========= */
  qs("#btn-login").onclick = () =>
    login(qs("#login-user").value, qs("#login-pass").value);
  qs("#btn-register").onclick = () =>
    register(qs("#reg-user").value, qs("#reg-pass").value);
  qs("#link-register").onclick = () => {
    hide($loginCard);
    show($registerCard);
  };
  qs("#link-login").onclick = () => {
    hide($registerCard);
    show($loginCard);
  };
  qs("#btn-logout").onclick = logout;
  qs("#btn-new-room").onclick = async () => {
    const n = prompt("Nombre de la sala");
    if (!n) return;
    const r = await authFetch(`${API}/rooms`, {
      method: "POST",
      body: JSON.stringify({ id: n }),
    });
    if (r.ok) {
      toast("Sala creada");
      loadRooms();
    } else {
      toast("No se pudo crear", false);
    }
  };
  $sendBtn.onclick = () => {
    const txt = $msgInput.value.trim();
    if (txt) sendMsg(txt);
  };
  $msgInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") $sendBtn.click();
  });

  /* ========== App init ========= */
  async function startApp() {
    STORAGE = await STORAGE_PROMISE;
    hide($loginCard);
    hide($registerCard);
    show($app);
    show(qs("#btn-logout"));
    loadRooms();
  }
  if (token && me) startApp();
})();
