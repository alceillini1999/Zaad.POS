const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const WhatsAppLogSchema = new Schema({
  client: { type: Schema.Types.ObjectId, ref: 'Client' },
  phone: String,
  messageText: String,
  attachments: [String],
  status: { type: String, enum: ['pending','sent','failed'], default: 'pending' },
  sentAt: Date,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('WhatsAppLog', WhatsAppLogSchema);
