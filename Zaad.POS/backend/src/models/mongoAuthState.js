// تخزين جلسة Baileys على MongoDB مع تشفير اختياري للـ creds
const crypto  = require('crypto');
const { initAuthCreds } = require('@whiskeysockets/baileys');
const WaCreds = require('../models/WaCreds');
const WaKey   = require('../models/WaKey');

const ENC_SECRET = process.env.WA_SESSION_SECRET || '';

function encKey() {
  // اشتقاق مفتاح 32 بايت من السر
  return crypto.createHash('sha256').update(ENC_SECRET).digest();
}

function maybeEncrypt(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  if (!ENC_SECRET) return json; // بدون تشفير
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('v1'), iv, tag, enc]); // [v1|iv|tag|payload]
}

function maybeDecrypt(buf) {
  if (!ENC_SECRET) return JSON.parse(buf.toString('utf8'));
  const header = buf.subarray(0, 2).toString('utf8');
  if (header !== 'v1') throw new Error('Invalid session blob');
  const iv  = buf.subarray(2, 14);
  const tag = buf.subarray(14, 30);
  const enc = buf.subarray(30);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

async function loadCreds() {
  const row = await WaCreds.findById('singleton').lean();
  if (!row) return initAuthCreds();
  return maybeDecrypt(Buffer.from(row.data));
}

async function saveCreds(creds) {
  const blob = maybeEncrypt(creds);
  await WaCreds.findByIdAndUpdate(
    'singleton',
    { _id: 'singleton', data: blob, updatedAt: new Date() },
    { upsert: true }
  );
}

async function getKey(type, id) {
  const row = await WaKey.findOne({ type, id }).lean();
  return row ? row.data : null;
}

async function setKey(type, id, data) {
  await WaKey.updateOne(
    { type, id },
    { $set: { data, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function delKey(type, id) {
  await WaKey.deleteOne({ type, id });
}

function makeKeyStore() {
  return {
    get: async (type, ids) => {
      const out = {};
      for (const id of ids) {
        const v = await getKey(type, id);
        if (v) out[id] = v;
      }
      return out;
    },
    set: async (type, data) => {
      const ops = [];
      for (const [id, val] of Object.entries(data)) {
        if (!val) ops.push(delKey(type, id));
        else ops.push(setKey(type, id, val));
      }
      await Promise.all(ops);
    }
  };
}

async function useMongoAuthState() {
  let creds = await loadCreds();
  const keys = makeKeyStore();
  return {
    state: { creds, keys },
    saveCreds: async () => { await saveCreds(creds); },
    _replaceCredsRef: (next) => { creds = next; } // نحافظ على نفس المرجع
  };
}

async function clearAuth() {
  await WaCreds.deleteMany({});
  await WaKey.deleteMany({});
}

module.exports = { useMongoAuthState, clearAuth };
