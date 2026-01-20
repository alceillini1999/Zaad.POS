// backend/src/models/WhatsContact.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WhatsContactSchema = new Schema({
  e164: { type: String, unique: true }, // "254700000001"
  name: String,
  jid: String, // WhatsApp JID, e.g., "254700000001@s.whatsapp.net"
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsContact', WhatsContactSchema);
