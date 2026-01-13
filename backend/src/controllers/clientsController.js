// backend/src/controllers/clientsController.js
const Client = require('../models/Client');
const WhatsContact = require('../models/WhatsContact');

function digitsOnly(s){ return String(s || '').replace(/[^0-9]/g, ''); }
function toE164(cc, phone){
  const ccDigits = digitsOnly(cc);
  const pDigits = digitsOnly(phone);
  return `${ccDigits}${pDigits}` || pDigits;
}
function toJid(e164){ return `${e164}@s.whatsapp.net`; }

// CRUD kept minimal (list simplified to return all)
async function listClients(req, res){
  const q = {};
  const items = await Client.find(q).sort({ createdAt: -1 }).lean();
  res.json({ data: items, total: items.length });
}

async function createClient(req, res){
  try {
    const body = req.body || {};
    const c = new Client({
      name: body.name || "",
      phone: body.phone || "",
      countryCode: digitsOnly(body.countryCode || body.cc || ""),
      area: body.area || "",
      notes: body.notes || "",
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(/[|,]/).filter(Boolean),
      lastMessageAt: body.lastMessageAt ? new Date(body.lastMessageAt) : undefined,
      lastPurchaseAt: body.lastPurchaseAt ? new Date(body.lastPurchaseAt) : undefined,
    });
    await c.save();
    await WhatsContact.updateOne(
      { e164: c.e164 },
      { $set: { e164: c.e164, name: c.name, jid: toJid(c.e164) } },
      { upsert: true }
    );
    res.status(201).json(c);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: 'Create client failed', error: e.message });
  }
}

async function updateClient(req, res){
  try {
    const body = req.body || {};
    const cc = digitsOnly(body.countryCode || body.cc || "");
    const update = {
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.phone != null ? { phone: body.phone } : {}),
      ...(cc !== "" ? { countryCode: cc } : {}),
      ...(body.area != null ? { area: body.area } : {}),
      ...(body.notes != null ? { notes: body.notes } : {}),
      ...(body.tags != null ? { tags: Array.isArray(body.tags) ? body.tags : String(body.tags).split(/[|,]/).filter(Boolean) } : {}),
      ...(body.lastMessageAt != null ? { lastMessageAt: new Date(body.lastMessageAt) } : {}),
      ...(body.lastPurchaseAt != null ? { lastPurchaseAt: new Date(body.lastPurchaseAt) } : {}),
    };
    const c = await Client.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    // re-read to get e164 after pre-save
    const fresh = await Client.findById(c._id);
    await WhatsContact.updateOne(
      { e164: fresh.e164 },
      { $set: { e164: fresh.e164, name: fresh.name, jid: toJid(fresh.e164) } },
      { upsert: true }
    );
    res.json(fresh);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: 'Update failed', error: e.message });
  }
}

async function deleteClient(req, res){
  try {
    const c = await Client.findByIdAndDelete(req.params.id);
    if (c) {
      await WhatsContact.deleteOne({ e164: c.e164 });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'Delete failed' });
  }
}

// Bulk upsert used by Excel import (JSON) and file import path
async function bulkUpsert(req, res){
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.json({ matched: 0, upserted: 0 });

    const clientOps = [];
    const whatsappOps = [];

    for (const it of items) {
      const cc = digitsOnly(it.countryCode || it.cc || "");
      const phone = String(it.phone || "");
      const e164 = toE164(cc, phone);

      if (it._delete) {
        if (!e164) continue;
        clientOps.push({ deleteOne: { filter: { e164 } } });
        whatsappOps.push({ deleteOne: { filter: { e164 } } });
        continue;
      }

      if (!e164) continue;
      const doc = {
        name: it.name || "",
        phone,
        countryCode: cc,
        area: it.area || "",
        notes: it.notes || "",
        tags: Array.isArray(it.tags) ? it.tags : String(it.tags || "").split(/[|,]/).filter(Boolean),
        lastMessageAt: it.lastMessageAt ? new Date(it.lastMessageAt) : undefined,
        lastPurchaseAt: it.lastPurchaseAt ? new Date(it.lastPurchaseAt) : undefined,
        e164,
      };

      clientOps.push({ updateOne: { filter: { e164 }, update: { $set: doc }, upsert: true } });
      whatsappOps.push({ updateOne: { filter: { e164 }, update: { $set: { e164, name: doc.name, jid: toJid(e164) } }, upsert: true } });
    }

    if (clientOps.length) await Client.bulkWrite(clientOps, { ordered: false });
    if (whatsappOps.length) await WhatsContact.bulkWrite(whatsappOps, { ordered: false });

    res.json({ ok: true, upserted: clientOps.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'bulk upsert failed', error: e.message });
  }
}

module.exports = { listClients, createClient, updateClient, deleteClient, bulkUpsert };
