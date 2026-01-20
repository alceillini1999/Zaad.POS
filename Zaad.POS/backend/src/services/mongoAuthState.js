// backend/src/services/mongoAuthState.js
const { MongoClient } = require('mongodb');
const { useSingleFileAuthState } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGO_URI;
const WA_SESSION_SECRET = process.env.WA_SESSION_SECRET || 'default_secret';

const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
let db, col;

async function connect() {
  if (!db) {
    await client.connect();
    db = client.db(); // يستخدم قاعدة البيانات الافتراضية من رابط URI
    col = db.collection('wa_sessions');
  }
  return col;
}

// دالة لتشفير البيانات
function encrypt(data) {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    crypto.createHash('sha256').update(WA_SESSION_SECRET).digest(),
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// دالة لفك التشفير
function decrypt(str) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(WA_SESSION_SECRET).digest(),
      Buffer.alloc(16, 0)
    );
    let decrypted = decipher.update(str, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// حفظ الجلسة في MongoDB
async function useMongoAuthState() {
  const col = await connect();
  let creds = (await col.findOne({ _id: 'auth' }))?.data;

  if (creds) creds = decrypt(creds);

  const state = creds ? creds.state : {};
  const saveCreds = async () => {
    await col.updateOne(
      { _id: 'auth' },
      { $set: { data: encrypt({ state }) } },
      { upsert: true }
    );
  };

  return { state, saveCreds, _replaceCredsRef: (newState) => Object.assign(state, newState) };
}

// مسح الجلسة القديمة
async function clearAuth() {
  const col = await connect();
  await col.deleteMany({});
}

module.exports = {
  useMongoAuthState,
  clearAuth,
};
