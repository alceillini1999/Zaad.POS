const mongoose = require('mongoose');

const WhatsAppSessionSchema = new mongoose.Schema({
  name: { type: String, default: 'default' }, // لو احتجت أكثر من جلسة
  data: { type: mongoose.Schema.Types.Mixed }, // يخزن JSON الجلسة
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsAppSession', WhatsAppSessionSchema);
