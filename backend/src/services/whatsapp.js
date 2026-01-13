// backend/src/routes/whatsapp.js
const express = require('express');
const router = express.Router();
const wa = require('../services/whatsappService');

// --------- Health ----------
router.get('/', (_req, res) => res.json({ ok: true, service: 'whatsapp-web' }));

// --------- Init (POST + GET) ----------
router.post('/init', async (_req, res) => {
  try { await wa.start(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
router.get('/init', async (_req, res) => {
  try { await wa.start(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// --------- Status ----------
router.get('/status', async (_req, res) => {
  try { res.json(await wa.getStatus()); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

// --------- QR (data URL JSON) ----------
router.get('/qr', async (_req, res) => {
  try { res.json({ dataUrl: await wa.getQrDataUrl() }); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

// --------- QR Image (PNG مباشرة) ----------
router.get('/qr-image', async (_req, res) => {
  try {
    const dataUrl = await wa.getQrDataUrl();
    if (!dataUrl) return res.status(404).send('No QR yet');
    const base64 = String(dataUrl).split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

// --------- Send bulk ----------
router.post('/send-bulk', async (req, res) => {
  try {
    const { to, message, mediaUrl } = req.body;
    const results = await wa.sendBulk({ to, message, mediaUrl });
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --------- Pairing Code (POST + GET) ----------
router.post('/pairing-code', async (req, res) => {
  try {
    const { phone } = req.body; // E.164 without '+', e.g., 2547xxxxxxx
    const code = await wa.requestPairingCode(phone);
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
router.get('/pairing-code', async (req, res) => {
  try {
    const phone = (req.query.phone || '').toString(); // allow GET ?phone=2547...
    const code = await wa.requestPairingCode(phone);
    res.json({ ok: true, code });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --------- Reset session (POST + GET) ----------
router.post('/reset-session', async (_req, res) => {
  try { await wa.resetSession(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
router.get('/reset-session', async (_req, res) => {
  try { await wa.resetSession(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

// --------- Debug path ----------
router.get('/debug-session-path', (_req, res) => {
  res.json({ path: wa.SESSION_DIR });
});

module.exports = router;
