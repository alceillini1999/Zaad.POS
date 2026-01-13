const express = require('express');
const router = express.Router();
const wa = require('../services/whatsappService');
const Client = require('../models/Client');
const axios = require('axios');
const csvtojson = require('csvtojson');

const canon = s => String(s||'').toLowerCase().trim();
const onlyDigits = s => String(s||'').replace(/[^0-9]/g,'');

// === existing endpoints (keep) ===
router.get('/', (_req, res) => res.json({ ok: true, service: 'whatsapp-web' }));
router.post('/init', async (_req, res) => { try { await wa.start(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: String(e) }); } });
router.get('/init',  async (_req, res) => { try { await wa.start(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: String(e) }); } });
router.get('/status', async (_req, res) => { try { res.json(await wa.getStatus()); } catch (e) { res.status(500).json({ error: String(e) }); } });
router.get('/qr', async (_req, res) => {
  try {
    const qr = wa.getQrString();
    const dataUrl = await wa.getQrDataUrl();
    if (!qr && !dataUrl) return res.status(204).end();
    res.json({ qr, dataUrl });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
router.post('/send', async (req, res) => {
  try { const { to, message, mediaUrl } = req.body || {}; const out = await wa.sendText(to, message, mediaUrl); res.json(out); }
  catch (e) { res.status(400).json({ ok:false, error: String(e.message || e) }); }
});
router.post('/send-bulk', async (req, res) => {
  try {
    const { to = [], message, mediaUrl } = req.body || {};
    if (!Array.isArray(to) || !to.length) throw new Error("No recipients");
    const results = [];
    for (const phone of to) {
      try { const r = await wa.sendText(phone, message, mediaUrl); results.push({ phone, ok: true, id: r.id || null }); }
      catch (err) { results.push({ phone, ok: false, error: String(err.message || err) }); }
    }
    res.json({ ok: true, count: results.length, results });
  } catch (e) { res.status(400).json({ ok:false, error: String(e.message || e) }); }
});

// === NEW: Sync WhatsApp list into Clients (tagged "wa-import")
router.post('/sync/google-csv', async (req, res) => {
  try {
    const url = process.env.GSHEET_WHATSAPP_CSV_URL;
    if (!url) return res.status(400).json({ error: 'Missing GSHEET_WHATSAPP_CSV_URL' });
    const mode = String(req.query.mode || 'mirror').toLowerCase();

    const { data: csv } = await axios.get(url);
    const rows = await csvtojson().fromString(csv);

    const normalized = rows.map(r => {
      const m = {}; for (const k of Object.keys(r)) m[canon(k)] = r[k];
      const name = (m['name'] || m['client'] || '').toString().trim();
      const phone = onlyDigits(m['phone'] || m['msisdn'] || m['tel'] || '');
      const area = (m['area'] || '').toString().trim();
      return { key: phone || name, name, phone, area };
    }).filter(x => x.key);

    // Upsert into Clients and tag them
    for (const n of normalized) {
      const { key, ...doc } = n;
      const where = doc.phone ? { phone: doc.phone } : { name: doc.name };
      await Client.updateOne(
        where,
        { $set: { ...doc }, $addToSet: { tags: 'wa-import' } },
        { upsert: true }
      );
    }

    // Mirror delete ONLY those previously imported via wa-import
    let deleted = 0;
    if (mode === 'mirror') {
      const keys = new Set(normalized.map(n => n.key));
      const all = await Client.find({ tags: 'wa-import' }, { _id:1, name:1, phone:1, tags:1 }).lean();
      const toDel = all.filter(c => {
        const k = onlyDigits(c.phone) || (c.name||'').trim();
        return k && !keys.has(k);
      });
      if (toDel.length) {
        await Client.deleteMany({ _id: { $in: toDel.map(x=>x._id) } });
        deleted = toDel.length;
      }
    }

    const total = await Client.countDocuments();
    res.json({ ok:true, mode, imported: normalized.length, deleted, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
