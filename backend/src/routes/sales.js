// backend/src/routes/sales.google.js
const express = require('express');
const router = express.Router();
const { getSheets } = require('../google/sheets');
const { readRows, updateRow, findRowIndexByKey } = require('../google/sheets.repo');

const SALES_SHEET_ID = process.env.SHEET_SALES_ID;
const SALES_TAB = process.env.SHEET_SALES_TAB || 'Sales';

const CLIENTS_SHEET_ID = process.env.SHEET_CLIENTS_ID;
const CLIENTS_TAB = process.env.SHEET_CLIENTS_TAB || 'Clients';

const APP_TZ = process.env.APP_TIMEZONE || 'Africa/Nairobi';

function ymdKey(date) {
  // YYYY-MM-DD في المنطقة الزمنية المطلوبة
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dmy2Parts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TZ,
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find(p => p.type === t)?.value;
  const day = String(get('day') || '').replace(/^0+/, '') || '0';
  const month = String(get('month') || '').replace(/^0+/, '') || '0';
  const year2 = String(get('year') || '00');
  return { day, month, year2 };
}

function safeJson(s) { try { return JSON.parse(s); } catch { return []; } }
// A: DateTime, B: InvoiceNo, C: ClientName, D: ClientPhone
// E: PaymentMethod, F: ItemsCount, G: Total, H: Profit, I: ItemsJSON
function rowToSale(row) {
  return {
    createdAt: row[0] || '',
    invoiceNo: row[1] || '',
    // alias للتوافق مع الواجهة القديمة
    invoiceNumber: row[1] || '',
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
    const raw = (resp.data.values || []);

    // ✅ إن كانت Invoice فارغة في بعض الصفوف، نولّدها للعرض فقط (بدون كتابة للشيت)
    const perDay = new Map();
    let all = raw.map((row, idx) => {
      const sale = rowToSale(row);
      let dt = null;
      try { dt = sale.createdAt ? new Date(sale.createdAt) : null; } catch { dt = null; }
      const key = dt ? ymdKey(dt) : '';
      const n = (perDay.get(key) || 0) + 1;
      perDay.set(key, n);
      if (!sale.invoiceNo && dt) {
        const { day, month, year2 } = dmy2Parts(dt);
        const inv = `${day} ${month} ${year2} ${n}`;
        sale.invoiceNo = inv;
        sale.invoiceNumber = inv;
        sale._generatedInvoiceNo = true;
      }
      return { id: String(idx + 2), ...sale };
    });

    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) {
      all = all.filter(r =>
        String(r.invoiceNo || '').toLowerCase().includes(q) ||
        String(r.clientName || '').toLowerCase().includes(q) ||
        String(r.clientPhone || '').toLowerCase().includes(q)
      );
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const start = (page - 1) * limit;
    const end = start + limit;
    res.json({ rows: all.slice(start, end), count: all.length, total: all.length });
  } catch (e) {
    console.error('GET /api/sales error:', e?.message || e);
    res.status(500).json({ error: 'Failed to read sales from Google Sheet' });
  }
});

router.post('/google', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    const {
      clientName, clientPhone,
      paymentMethod = 'Cash', items = [], total = 0, profit = 0, addPoints = 0
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    const now = new Date();
    const nowIso = now.toISOString();

    // ✅ توليد رقم الفاتورة تلقائياً: (day month yy seqInDay)
    const todayKey = ymdKey(now);
    const { day, month, year2 } = dmy2Parts(now);
    let seq = 1;
    try {
      const sheets = getSheets();
      const prev = await sheets.spreadsheets.values.get({
        spreadsheetId: SALES_SHEET_ID,
        range: `${SALES_TAB}!A2:A`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const times = (prev.data.values || []).map(r => r?.[0]).filter(Boolean);
      const countToday = times.reduce((acc, t) => {
        try {
          const dk = ymdKey(new Date(t));
          return acc + (dk === todayKey ? 1 : 0);
        } catch { return acc; }
      }, 0);
      seq = countToday + 1;
    } catch (e) {
      // في حال فشل العدّ، نترك seq = 1
      console.warn('Invoice seq count failed:', e?.message || e);
    }
    const invoiceNo = `${day} ${month} ${year2} ${seq}`;
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

    // ✅ تحديث نقاط العميل (إذا تم اختيار عميل)
    const pts = Number(addPoints || 0);
    if (CLIENTS_SHEET_ID && clientPhone && pts > 0) {
      try {
        const rows = await readRows(CLIENTS_SHEET_ID, CLIENTS_TAB, 'A2:E');
        const rowIdx1 = findRowIndexByKey(rows, 0, String(clientPhone));
        if (rowIdx1 > 0) {
          const r = rows[rowIdx1 - 2] || [];
          const phone = String(r[0] || clientPhone);
          const name = r[1] || clientName || '';
          const address = r[2] || '';
          const current = Number(r[3] || 0);
          const notes = r[4] || '';
          await updateRow(CLIENTS_SHEET_ID, CLIENTS_TAB, rowIdx1, [phone, name, address, current + pts, notes]);
        }
      } catch (e) {
        console.warn('Client points update failed:', e?.message || e);
      }
    }

    res.json({ ok: true, invoiceNo, invoiceNumber: invoiceNo });
  } catch (e) {
    console.error('POST /api/sales/google error:', e?.message || e);
    res.status(500).json({ error: 'Failed to append sale to Google Sheet' });
  }
});

module.exports = router;