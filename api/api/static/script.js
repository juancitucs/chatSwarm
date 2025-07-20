const API = window.location.origin;
const { storage: STORAGE } = await(await fetch("/api/config")).json();
let token = "",
  user = "",
  room = "";
let pollRooms,
  pollMsgs,
  participantCount = 0;
const $ = (id) => document.getElementById(id);
// obtener nombre de archivo desde URL
const getFileName = (url) => decodeURIComponent(url.split("/").pop());

// Panel toggles
$("link-register").onclick = () => {
  $("login-card").classList.add("hidden");
  $("register-card").classList.remove("hidden");
};
$("link-login").onclick = () => {
  $("register-card").classList.add("hidden");
  $("login-card").classList.remove("hidden");
};

// Register
$("btn-register").onclick = async () => {
  const u = $("reg-user").value.trim(),
    p = $("reg-pass").value.trim();
  if (!u || !p) return;
  let r = await fetch(API + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
  if (r.ok) {
    $("login-user").value = u;
    $("login-pass").value = p;
    $("link-login").click();
  } else $("reg-error").textContent = "Usuario ya existe";
};

// Login
$("btn-login").onclick = async () => {
  const u = $("login-user").value.trim(),
    p = $("login-pass").value.trim();
  if (!u || !p) return;
  let r = await fetch(API + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });
  if (!r.ok) {
    $("login-error").textContent = "Credenciales inválidas";
    return;
  }
  token = (await r.json()).token;
  user = u;
  localStorage.setItem("chat_jwt", token);
  enterApp();
};

// Auto-login
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("chat_jwt");
  if (saved) {
    token = saved;
    try {
      user = JSON.parse(atob(saved.split(".")[1])).sub;
    } catch { }
    enterApp();
  }
});

function enterApp() {
  $("login-card").classList.add("hidden");
  $("register-card").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("btn-logout").classList.remove("hidden");
  loadRooms();
  pollRooms = setInterval(loadRooms, 3000);
}
$("btn-logout").onclick = () => {
  localStorage.removeItem("chat_jwt");
  location.reload();
};

async function loadRooms() {
  let r = await fetch(API + "/api/rooms", {
    headers: { Authorization: "Bearer " + token },
  });
  let rooms = await r.json();
  $("rooms").innerHTML = "";
  rooms.forEach((s) => {
    let li = document.createElement("li");
    let label = s.id
      .split("-")
      .filter((n) => n !== user)
      .join(",");
    li.textContent = label || s.id;
    li.onclick = () => openRoom(s.id, label);
    $("rooms").appendChild(li);
  });
}

$("btn-new-room").onclick = () => {
  const names = prompt("Participantes separados por coma");
  if (!names) return;
  let parts = [
    ...new Set(
      names
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (!parts.includes(user)) parts.push(user);
  const id = parts.sort().join("-");
  fetch(API + "/api/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ id, participants: parts }),
  })
    .then(loadRooms)
    .catch(() => alert("No se pudo crear"));
};

function openRoom(id, label) {
  room = id;
  participantCount = id.split("-").length;
  $("room-title").textContent = label;
  $("chat").classList.remove("hidden");
  fetchMsgs();
  clearInterval(pollMsgs);
  pollMsgs = setInterval(fetchMsgs, 800);
}

async function fetchMsgs() {
  if (!room) return;
  let r = await fetch(`${API}/api/history/${room}?limit=200`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!r.ok) return;
  let arr = await r.json();
  $("messages").innerHTML = "";
  arr.reverse().forEach(renderMsg);
}

function renderMsg(m) {
  const wrap = document.createElement("div");
  wrap.classList.add("msg-wrap", m.from === user ? "mine" : "other");
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  if (
    m.content.startsWith(STORAGE) &&
    /\.(png|jpe?g|gif)$/i.test(m.content)
  ) {
    const img = new Image();
    img.src = m.content;
    bubble.appendChild(img);
  } else if (m.content.startsWith(STORAGE)) {
    const a = document.createElement("a");
    a.href = m.content;
    a.textContent = getFileName(m.content);
    a.target = "_blank";
    bubble.appendChild(a);
  } else {
    bubble.textContent = m.content;
  }
  wrap.appendChild(bubble);
  if (participantCount > 2) {
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = m.from === user ? "Tú" : m.from;
    wrap.appendChild(name);
  }
  $("messages").appendChild(wrap);
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("btn-send").onclick = async () => {
  const txt = $("msg-input").value.trim();
  if (!txt) return;
  $("msg-input").value = "";
  await postMsg(txt);
};
$("msg-input").addEventListener("keyup", (e) => {
  if (e.key === "Enter") $("btn-send").click();
});

$("btn-upload").onclick = () => $("file-input").click();
$("file-input").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append("f", f);
  let up = await fetch(API + "/api/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd,
  });
  if (!up.ok) return alert("Error al subir");
  const { url } = await up.json();
  await postMsg(url);
};

async function postMsg(content) {
  await fetch(API + "/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({ room, content }),
  });
  fetchMsgs();
}
