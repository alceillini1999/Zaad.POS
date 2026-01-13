const router = require('express').Router();
const auth = require('../middlewares/auth');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Sale = require('../models/Sale');

router.post('/checkout', auth, async (req, res) => {
  try {
    const { clientId, clientName, paymentMethod, cart } = req.body;
    if (!Array.isArray(cart) || cart.length === 0)
      return res.status(400).json({ message: 'Cart is empty' });

    const ids = cart.map(c => c.productId);
    const products = await Product.find({ _id: { $in: ids } });

    const items = cart.map(c => {
      const p = products.find(x => String(x._id) === String(c.productId));
      if (!p) throw new Error('Product not found: ' + c.productId);
      const qty = Number(c.qty || 0);
      const price = Number(c.price ?? p.salePrice ?? 0);
      const cost  = Number(p.costPrice ?? 0);
      if (qty <= 0) throw new Error('Invalid qty for product: ' + p.name);
      return { product: p._id, name: p.name, qty, price, cost, subtotal: qty * price };
    });

    const total  = items.reduce((s,i)=> s + i.subtotal, 0);
    const profit = items.reduce((s,i)=> s + ((i.price - i.cost) * i.qty), 0);

    let client = null;
    if (clientId) client = await Client.findById(clientId).catch(()=>null);

    const sale = await Sale.create({
      client: client?._id || null,
      clientName: client?.name || clientName || '',
      items, total,
      paymentMethod: String(paymentMethod || 'CASH').toUpperCase(),
      profit
    });

    await Promise.all(items.map(i =>
      Product.findByIdAndUpdate(i.product, { $inc: { quantity: -i.qty } })
    ));

    res.json({ ok: true, sale });
  } catch (e) {
    res.status(400).json({ message: String(e.message || e) });
  }
});

module.exports = router;
