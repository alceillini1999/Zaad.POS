// backend/src/routes/expenses.js
const express = require('express');
const router = express.Router();
const { readRows, appendRow, updateRow, deleteRow } = require('../google/sheets.repo');

const SHEET_ID = process.env.SHEET_EXPENSES_ID;
const TAB = process.env.SHEET_EXPENSES_TAB || 'Expenses';
// Columns: A:Date | B:Description | C:Amount | D:Category | E:Notes | F:PaymentMethod

const ALLOWED_PAYMENT_METHODS = new Set([
  'send money',
  'cash',
  'till',
  'withdrawel cash',
]);

function normalizePaymentMethod(v) {
  return String(v || '').trim().toLowerCase();
}

// ── Date normalization ──────────────────────────────────────────────
// - Excel/Sheets serial (e.g., 45991)  -> "YYYY-MM-DD"
// - "DD-MM-YYYY"                       -> "YYYY-MM-DD"
// - ISO "YYYY-MM-DD" stays as-is
function normalizeDate(v) {
  if (v == null) return '';
  // numeric (Excel serial)
  const n = Number(v);
  if (!Number.isNaN(n) && String(v).trim() !== '' && /^[0-9]+(\.[0-9]+)?$/.test(String(v))) {
    const ms = Math.round((n - 25569) * 86400 * 1000); // 25569 = offset to 1970-01-01
    return new Date(ms).toISOString().slice(0,10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.slice(0,10); // ISO or anything similar
}

function rowToExpense(r){
  return {
    date: normalizeDate(r[0]),
    description: r[1] || '',
    amount: Number(r[2] || 0),
    category: r[3] || '',
    notes: r[4] || '',
    paymentMethod: r[5] || '',
  };
}

router.get('/', async (_req, res) => {
  try {
    const rows = await readRows(SHEET_ID, TAB, 'A2:F'); // raw values
    res.json((rows || []).map(rowToExpense));
  } catch (e) {
    console.error('GET expenses:', e?.message || e);
    res.status(500).json({ error: 'Failed to read expenses' });
  }
});

router.post('/google', async (req, res) => {
  try {
    let { date, description, amount = 0, category = '', notes = '', paymentMethod = '' } = req.body || {};
    const iso = normalizeDate(date);

    const pm = normalizePaymentMethod(paymentMethod);
    if (!iso || !description) return res.status(400).json({ error: 'date and description are required' });
    if (!ALLOWED_PAYMENT_METHODS.has(pm)) {
      return res.status(400).json({
        error: 'paymentMethod is required and must be one of: send money, cash, till, withdrawel cash'
      });
    }

    await appendRow(SHEET_ID, TAB, [iso, description, Number(amount), category, notes, pm]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST expense:', e?.message || e);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// optional update/remove (لو كنت تستخدمهما)
router.put('/google/:date/:desc', async (req, res) => {
  try {
    const keyDate = normalizeDate(req.params.date);
    const keyDesc = req.params.desc;

    const rows = await readRows(SHEET_ID, TAB, 'A2:F');
    const idx = rows.findIndex(r => normalizeDate(r[0]) === keyDate && String(r[1]||'') === String(keyDesc));
    const rowIndex1 = idx >= 0 ? idx + 2 : -1;
    if (rowIndex1 < 0) return res.status(404).json({ error: 'Expense not found' });

    let { date = keyDate, description = keyDesc, amount = 0, category = '', notes = '', paymentMethod = '' } = req.body || {};
    const iso = normalizeDate(date);

    const pm = normalizePaymentMethod(paymentMethod);
    if (!ALLOWED_PAYMENT_METHODS.has(pm)) {
      return res.status(400).json({
        error: 'paymentMethod is required and must be one of: send money, cash, till, withdrawel cash'
      });
    }

    await updateRow(SHEET_ID, TAB, rowIndex1, [iso, description, Number(amount), category, notes, pm]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT expense:', e?.message || e);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/google/:date/:desc', async (req, res) => {
  try {
    const keyDate = normalizeDate(req.params.date);
    const keyDesc = req.params.desc;

    const rows = await readRows(SHEET_ID, TAB, 'A2:F');
    const idx = rows.findIndex(r => normalizeDate(r[0]) === keyDate && String(r[1]||'') === String(keyDesc));
    const rowIndex1 = idx >= 0 ? idx + 2 : -1;
    if (rowIndex1 < 0) return res.status(404).json({ error: 'Expense not found' });

    await deleteRow(SHEET_ID, TAB, rowIndex1);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE expense:', e?.message || e);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
