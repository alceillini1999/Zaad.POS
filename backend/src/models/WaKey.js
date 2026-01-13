const mongoose = require('mongoose');

const WaKeySchema = new mongoose.Schema({
  type: { type: String, required: true }, // مثل: 'pre-key', 'session', 'sender-key', ...
  id:   { type: String, required: true },
  data: { type: Buffer, required: true }, // قيمة المفتاح بصيغة Buffer
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'wa_keys' });

WaKeySchema.index({ type: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('WaKey', WaKeySchema);
