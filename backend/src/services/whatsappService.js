const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");

let sock = null;
let qrString = null;
let connected = false;
let starting = false;

function normalizeMsisdn(msisdn) {
  // يقبل: "0712...", "+254712...", "254712..."
  let s = String(msisdn || "").trim();
  if (!s) return null;
  s = s.replace(/[^\d+]/g, "");       // أزل أي شيء غير أرقام أو +
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = "254" + s.slice(1); // افتراضي كينيا
  return /^\d{7,15}$/.test(s) ? s : null;
}

async function start() {
  if (starting) return;
  starting = true;

  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, qr }) => {
    if (qr) {
      qrString = qr;
      try { console.log(await QRCode.toString(qr, { type: "terminal", small: true })); } catch {}
    }
    if (connection === "open") { connected = true; qrString = null; }
    if (connection === "close") { connected = false; qrString = null; setTimeout(() => start(), 5000); }
  });

  starting = false;
}

async function getStatus() {
  return { connected, hasQR: !!qrString };
}

async function getQrDataUrl() {
  if (!qrString) return null;
  return await QRCode.toDataURL(qrString);
}
function getQrString(){ return qrString || null; }

async function sendText(to, message, mediaUrl) {
  if (!sock) await start();
  if (!connected) throw new Error("WhatsApp not connected yet");

  const msisdn = normalizeMsisdn(to);
  if (!msisdn) throw new Error("Invalid phone number");

  const jid = `${msisdn}@s.whatsapp.net`;

  const content = {};
  if (mediaUrl) content.image = { url: mediaUrl };
  if (message)  content.caption = message;
  // لو لا صورة، أرسل نصًا فقط:
  if (!mediaUrl) { content.text = message || ""; }

  const r = await sock.sendMessage(jid, content);
  return { ok: true, id: r?.key?.id || null };
}

module.exports = { start, getStatus, getQrDataUrl, getQrString, sendText };
