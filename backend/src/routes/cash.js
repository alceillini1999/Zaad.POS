// backend/src/routes/cash.js
const express = require('express');
const router = express.Router();
const { readRows, appendRow } = require('../google/sheets.repo');

const SHEET_ID = process.env.SHEET_CASH_ID;
const OPEN_TAB = process.env.SHEET_CASH_OPEN_TAB || 'CashOpen';
const CLOSE_TAB = process.env.SHEET_CASH_CLOSE_TAB || 'CashClose';

// Accept YYYY-MM-DD, or any parseable date -> YYYY-MM-DD
function normalizeDate(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function mustNumber(v, def = 0) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n)) return null;
  return n;
}

function safeObj(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
}

function safeArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const x = JSON.parse(v);
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

// Optional: read today's open (by date)
router.get('/today', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const date = normalizeDate(req.query.date) || normalizeDate(new Date().toISOString());
    const rows = await readRows(SHEET_ID, OPEN_TAB, 'A2:I');

    const found = (rows || []).find(r => String(r[0] || '') === date);
    if (!found) return res.json({ ok: true, found: false });

    return res.json({
      ok: true,
      found: true,
      row: {
        date: found[0] || '',
        openId: found[1] || '',
        openedAt: found[2] || '',
        employeeId: found[3] || '',
        employeeName: found[4] || '',
        tillNo: found[5] || '',
        mpesaWithdrawal: Number(found[6] || 0),
        openingCashTotal: Number(found[7] || 0),
        cashBreakdown: safeArr(found[8]),
      }
    });
  } catch (e) {
    console.error('GET /api/cash/today:', e?.message || e);
    res.status(500).json({ error: 'Failed to read cash open' });
  }
});

// POST /api/cash/open
router.post('/open', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const body = req.body || {};
    const date = normalizeDate(body.date);
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const openingCashTotal = mustNumber(body.openingCashTotal, null);
    if (openingCashTotal === null || openingCashTotal < 0) {
      return res.status(400).json({ error: 'openingCashTotal must be a non-negative number' });
    }

    const tillNo = String(body.tillNo || '').trim();
    if (!tillNo) return res.status(400).json({ error: 'tillNo is required' });

    const mpesaWithdrawal = mustNumber(body.mpesaWithdrawal, 0);
    if (mpesaWithdrawal === null || mpesaWithdrawal < 0) {
      return res.status(400).json({ error: 'mpesaWithdrawal must be a non-negative number' });
    }

    const employee = safeObj(body.employee);
    const employeeId = String(employee.id || employee.employeeId || employee.employeeid || employee.username || '').trim();
    const employeeName = String(employee.name || employee.employeeName || employee.username || '').trim();

    const cashBreakdown = safeArr(body.cashBreakdown);

    // prevent duplicate open for same date
    const existing = await readRows(SHEET_ID, OPEN_TAB, 'A2:B');
    const already = (existing || []).find(r => String(r[0] || '') === date);
    if (already) {
      return res.status(409).json({ error: 'Day already opened for this date', openId: already[1] || '' });
    }

    const openId = String(body.openId || `${date}-${Date.now()}`);
    const openedAt = String(body.openedAt || new Date().toISOString());

    // CashOpen columns:
    // A: Date | B: OpenId | C: OpenedAt | D: EmployeeId | E: EmployeeName
    // F: TillNo | G: MpesaWithdrawal | H: OpeningCashTotal | I: CashBreakdownJSON
    await appendRow(SHEET_ID, OPEN_TAB, [
      date,
      openId,
      openedAt,
      employeeId,
      employeeName,
      tillNo,
      Number(mpesaWithdrawal),
      Number(openingCashTotal),
      JSON.stringify(cashBreakdown),
    ]);

    res.json({ ok: true, openId });
  } catch (e) {
    console.error('POST /api/cash/open:', e?.message || e);
    res.status(500).json({ error: 'Failed to save Start Day' });
  }
});

// POST /api/cash/close
router.post('/close', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const body = req.body || {};
    const date = normalizeDate(body.date);
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const closingCashTotal = mustNumber(body.closingCashTotal, null);
    if (closingCashTotal === null || closingCashTotal < 0) {
      return res.status(400).json({ error: 'closingCashTotal must be a non-negative number' });
    }

    const employee = safeObj(body.employee);
    const employeeId = String(employee.id || employee.employeeId || employee.employeeid || employee.username || '').trim();
    const employeeName = String(employee.name || employee.employeeName || employee.username || '').trim();

    const cashBreakdown = safeArr(body.cashBreakdown);
    const openId = String(body.openId || '');
    const closedAt = String(body.closedAt || new Date().toISOString());

    // CashClose columns:
    // A: Date | B: OpenId | C: ClosedAt | D: EmployeeId | E: EmployeeName
    // F: ClosingCashTotal | G: CashBreakdownJSON
    await appendRow(SHEET_ID, CLOSE_TAB, [
      date,
      openId,
      closedAt,
      employeeId,
      employeeName,
      Number(closingCashTotal),
      JSON.stringify(cashBreakdown),
    ]);

    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/cash/close:', e?.message || e);
    res.status(500).json({ error: 'Failed to save End Day' });
  }
});

module.exports = router;
