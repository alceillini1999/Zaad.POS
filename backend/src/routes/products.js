// backend/src/routes/products.google.js
const express = require('express');
const router = express.Router();
const { readRows, appendRow, updateRow, deleteRow, findRowIndexByKey } = require('../google/sheets.repo');

const SHEET_ID = process.env.SHEET_PRODUCTS_ID;
const TAB = process.env.SHEET_PRODUCTS_TAB || 'Products';
// Columns: A:Barcode | B:Name | C:Category | D:Cost | E:SalePrice | F:Stock | G:Unit | H:Notes

function rowToProduct(r) {
  return {
    barcode: String(r[0] || ''),
    name: r[1] || '',
    category: r[2] || '',
    cost: Number(r[3] || 0),
    salePrice: Number(r[4] || 0),
    stock: Number(r[5] || 0),
    unit: r[6] || '',
    notes: r[7] || '',
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await readRows(SHEET_ID, TAB, 'A2:H');
    const list = rows.map(rowToProduct);
    res.json(list);
  } catch (e) {
    console.error('GET products:', e?.message || e);
    res.status(500).json({ error: 'Failed to read products' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { barcode, name, category='', cost=0, salePrice=0, stock=0, unit='', notes='' } = req.body || {};
    if (!barcode || !name) return res.status(400).json({ error: 'barcode and name are required' });
    await appendRow(SHEET_ID, TAB, [barcode, name, category, Number(cost), Number(salePrice), Number(stock), unit, notes]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST product:', e?.message || e);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

router.put('/google/:barcode', async (req, res) => {
  try {
    const key = req.params.barcode;
    const rows = await readRows(SHEET_ID, TAB, 'A2:H');
    const rowIdx1 = findRowIndexByKey(rows, 0, key);
    if (rowIdx1 < 0) return res.status(404).json({ error: 'Product not found' });

    const { barcode=key, name, category='', cost=0, salePrice=0, stock=0, unit='', notes='' } = req.body || {};
    await updateRow(SHEET_ID, TAB, rowIdx1, [barcode, name, category, Number(cost), Number(salePrice), Number(stock), unit, notes]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT product:', e?.message || e);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/google/:barcode', async (req, res) => {
  try {
    const key = req.params.barcode;
    const rows = await readRows(SHEET_ID, TAB, 'A2:H');
    const rowIdx1 = findRowIndexByKey(rows, 0, key);
    if (rowIdx1 < 0) return res.status(404).json({ error: 'Product not found' });
    await deleteRow(SHEET_ID, TAB, rowIdx1);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE product:', e?.message || e);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;