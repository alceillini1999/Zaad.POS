// backend/src/routes/sales.google.js
const express = require('express');
const router = express.Router();
const { getSheets } = require('../google/sheets');

const SALES_SHEET_ID = process.env.SHEET_SALES_ID;
const SALES_TAB = process.env.SHEET_SALES_TAB || 'Sales';

function safeJson(s) { try { return JSON.parse(s); } catch { return []; } }
// A: DateTime, B: InvoiceNo, C: ClientName, D: ClientPhone
// E: PaymentMethod, F: ItemsCount, G: Total, H: Profit, I: ItemsJSON
function rowToSale(row) {
  return {
    createdAt: row[0] || '',
    invoiceNo: row[1] || '',
    clientName: row[2] || '',
    clientPhone: row[3] || '',
    paymentMethod: row[4] || 'Cash',
    itemsCount: Number(row[5] || 0),
    total: Number(row[6] || 0),
    profit: Number(row[7] || 0),
    items: row[8] ? safeJson(row[8]) : [],
  };
}

router.get('/', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    const sheets = getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SALES_SHEET_ID,
      range: `${SALES_TAB}!A2:I`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const all = (resp.data.values || []).map(rowToSale);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 1000);
    const start = (page - 1) * limit;
    const end = start + limit;
    res.json({ rows: all.slice(start, end), total: all.length });
  } catch (e) {
    console.error('GET /api/sales error:', e?.message || e);
    res.status(500).json({ error: 'Failed to read sales from Google Sheet' });
  }
});

router.post('/google', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    const {
      invoiceNo, clientName, clientPhone,
      paymentMethod = 'Cash', items = [], total = 0, profit = 0
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    const nowIso = new Date().toISOString();
    const itemsCount = items.reduce((s, it) => s + Number(it.qty || 0), 0);
    const payload = [
      nowIso,
      String(invoiceNo || ''),
      String(clientName || ''),
      String(clientPhone || ''),
      String(paymentMethod || 'Cash'),
      Number(itemsCount || 0),
      Number(total || 0),
      Number(profit || 0),
      JSON.stringify(items),
    ];
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SALES_SHEET_ID,
      range: `${SALES_TAB}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/sales/google error:', e?.message || e);
    res.status(500).json({ error: 'Failed to append sale to Google Sheet' });
  }
});

module.exports = router;