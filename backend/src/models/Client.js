// backend/src/models/Client.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

function digitsOnly(s){ return String(s || '').replace(/[^0-9]/g, ''); }

const ClientSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },      // local or international
  countryCode: { type: String, default: "" },   // e.g. "254" (without +)
  area: String,
  notes: String,
  tags: [{ type: String, enum: ['Active', 'Inactive', 'VIP'] }],
  lastMessageAt: Date,
  lastPurchaseAt: Date,
  e164: { type: String, index: true, unique: true }, // normalized "254700000001"
  createdAt: { type: Date, default: Date.now }
});

ClientSchema.pre('save', function(next){
  const cc = digitsOnly(this.countryCode);
  const pn = digitsOnly(this.phone);
  this.e164 = `${cc}${pn}` || pn;
  next();
});

module.exports = mongoose.model('Client', ClientSchema);
