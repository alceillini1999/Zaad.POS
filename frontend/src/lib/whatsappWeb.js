// API client for WhatsApp Web backend (Baileys)
const API_BASE =
  import.meta.env.VITE_WA_WEB_BASE || "https://zaad-bakery.onrender.com";

export async function getWAStatus() {
  const r = await fetch(`${API_BASE}/api/whatsapp/status`, { credentials: "omit" });
  return r.json();
}

export async function getWAQr() {
  const r = await fetch(`${API_BASE}/api/whatsapp/qr`, { credentials: "omit" });
  return r.json(); // { dataUrl }
}

export async function initWA() {
  const r = await fetch(`${API_BASE}/api/whatsapp/init`, {
    method: "GET"
  });
  return r.json();
}

export async function resetWASession() {
  const r = await fetch(`${API_BASE}/api/whatsapp/reset-session`, {
    method: "GET"
  });
  return r.json();
}

export async function sendBulk(toArray, message, mediaUrl) {
  const r = await fetch(`${API_BASE}/api/whatsapp/send-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: toArray, message, mediaUrl })
  });
  return r.json();
}
