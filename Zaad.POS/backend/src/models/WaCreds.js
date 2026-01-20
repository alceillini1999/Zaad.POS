const mongoose = require('mongoose');

const WaCredsSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' }, // مستند واحد للجلسة
  data: { type: Buffer, required: true },      // نخزن blob (وقد يكون مشفّر)
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'wa_creds' });

module.exports = mongoose.model('WaCreds', WaCredsSchema);
