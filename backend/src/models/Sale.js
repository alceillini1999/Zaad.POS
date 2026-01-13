const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String },
  qty:      { type: Number, required: true },
  price:    { type: Number, required: true },
  cost:     { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, index: true },
  client:        { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  clientName:    { type: String },
  items:         { type: [saleItemSchema], default: [] },
  total:         { type: Number, required: true },
  paymentMethod: { type: String, enum: ['CASH','MPESA','BANK','OTHER'], required: true },
  profit:        { type: Number, default: 0 },
}, { timestamps: true });

saleSchema.pre('save', function(next){
  if (!this.invoiceNumber) {
    const d = new Date();
    const ymd = d.toISOString().slice(0,10).replace(/-/g,'');
    this.invoiceNumber = `INV-${ymd}-${Math.floor(100000 + Math.random()*900000)}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
