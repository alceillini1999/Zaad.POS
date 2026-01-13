const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // مفاتيح أساسية
  name: { type: String, required: true, trim: true },
  barcode: { type: String, index: true, sparse: true, trim: true },

  // أسعار وكميات
  salePrice: { type: Number, default: 0 },   // سعر البيع
  costPrice: { type: Number, default: 0 },   // تكلفة الشراء
  quantity:  { type: Number, default: 0 },   // المخزون

  // بيانات إضافية
  category: { type: String, default: '', trim: true },
  expiry:   { type: Date, default: null },
  active:   { type: Boolean, default: true },

  // تتبع
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ProductSchema.index({ barcode: 1 }, { unique: false, sparse: true });
ProductSchema.index({ name: 1 });

ProductSchema.pre('save', function(next){
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
