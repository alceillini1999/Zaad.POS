// backend/src/routes/cash.js
const express = require('express');
const router = express.Router();
const { readRows, appendRow } = require('../google/sheets.repo');

const SHEET_ID = process.env.SHEET_CASH_ID;
const OPEN_TAB = process.env.SHEET_CASH_OPEN_TAB || 'CashOpen';
const CLOSE_TAB = process.env.SHEET_CASH_CLOSE_TAB || 'CashClose';

// Sales sheet (used to compute automatic cash)
const SALES_SHEET_ID = process.env.SHEET_SALES_ID;
const SALES_TAB = process.env.SHEET_SALES_TAB || 'Sales';

// Optional defaults
const DEFAULT_TILL_NO = process.env.DEFAULT_TILL_NO || 'TILL-1';

// Accept YYYY-MM-DD, or any parseable date -> YYYY-MM-DD
function normalizeDate(v) {
  if (v == null) return '';
  // When reading with valueRenderOption=UNFORMATTED_VALUE, Google Sheets may return
  // DATE/DATETIME cells as serial numbers. Convert those to YYYY-MM-DD.
  // Excel/Sheets serial day 25569 == 1970-01-01.
  const n = Number(v);
  if (!Number.isNaN(n) && String(v).trim() !== '' && /^[0-9]+(\.[0-9]+)?$/.test(String(v))) {
    const ms = Math.round((n - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return '';

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/M/D or YYYY-M-D
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isFinite(dt.getTime())) return dt.toISOString().slice(0, 10);
  }

  // D/M/YYYY or M/D/YYYY (also supports D-M-YYYY / M-D-YYYY)
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    let day, month;
    // If one side is >12, we can disambiguate
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Ambiguous: default to D/M/YYYY (common locale for many non-US sheets)
      day = a;
      month = b;
    }

    const dt = new Date(Date.UTC(y, month - 1, day));
    if (Number.isFinite(dt.getTime())) return dt.toISOString().slice(0, 10);
  }

  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toNum(v, def = 0) {
  const n = Number(String(v ?? def).replace(/,/g, ''));
  return Number.isFinite(n) ? n : def;
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

function pmKey(v) {
  return String(v || '').trim().toLowerCase();
}

// Read last closing cash before given date (YYYY-MM-DD)
async function getYesterdayClosing(date) {
  const rows = await readRows(SHEET_ID, CLOSE_TAB, 'A2:J', { valueRenderOption: 'FORMATTED_VALUE' });
  let bestDate = '';
  let bestClosing = 0;

  for (const r of (rows || [])) {
    const d = normalizeDate(r[0]);
    if (!d) continue;
    if (d >= date) continue;

    if (!bestDate || d > bestDate) {
      bestDate = d;
      bestClosing = toNum(r[7], 0); // H: ClosingCashTotal
    }
  }
  return bestClosing;
}

// Find open row for date
async function findOpenRow(date) {
  const rows = await readRows(SHEET_ID, OPEN_TAB, 'A2:K', { valueRenderOption: 'FORMATTED_VALUE' });
  const found = (rows || []).find(r => normalizeDate(r[0]) === date);
  return { rows, found };
}

// Sum today's totals from sales sheet
// Sales sheet structure (from your sales route):
// A: DateTime, E: PaymentMethod, G: Total
async function sumTodayFromSales(date) {
  if (!SALES_SHEET_ID) {
    return { cashSales: 0, tillSales: 0, withdrawals: 0 };
  }

  const rows = await readRows(SALES_SHEET_ID, SALES_TAB, 'A2:I');

  let cashSales = 0;
  let tillSales = 0;
  let withdrawals = 0;

  for (const r of (rows || [])) {
    const createdAt = r[0];          // A
    const d = normalizeDate(createdAt);
    if (d !== date) continue;

    const method = pmKey(r[4]);      // E
    const total = toNum(r[6], 0);    // G

    if (method === 'cash') {
      cashSales += total;
    } else if (method === 'till') {
      tillSales += total;
    } else if (method === 'withdrawal') {
      // treat as cash out (withdrawal)
      withdrawals += Math.abs(total);
    }
  }

  return { cashSales, tillSales, withdrawals };
}

// ============ Existing endpoint: read today's open ============
router.get('/today', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const date = normalizeDate(req.query.date) || normalizeDate(new Date().toISOString());
    const rows = await readRows(SHEET_ID, OPEN_TAB, 'A2:K', { valueRenderOption: 'FORMATTED_VALUE' });

    const found = (rows || []).find(r => normalizeDate(r[0]) === date);
    if (!found) return res.json({ ok: true, found: false });

    return res.json({
      ok: true,
      found: true,
      row: {
        date: normalizeDate(found[0]) || '',
        openId: found[1] || '',
        openedAt: found[2] || '',
        employeeId: found[3] || '',
        employeeName: found[4] || '',
        tillNo: found[5] || '',
        mpesaWithdrawal: Number(found[6] || 0),
        openingCashTotal: Number(found[7] || 0),
        cashBreakdown: safeArr(found[8]),
        sendMoney: Number(found[9] || 0),
        openingTillTotal: Number(found[10] || 0),
      }
    });
  } catch (e) {
    console.error('GET /api/cash/today:', e?.message || e);
    res.status(500).json({ error: 'Failed to read cash open' });
  }
});

// ============ NEW: Summary (Auto Open + Auto Compute) ============
// GET /api/cash/summary?date=YYYY-MM-DD
router.get('/summary', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const date = normalizeDate(req.query.date) || normalizeDate(new Date().toISOString());

    // 1) Ensure day is opened (auto-open)
    let { found } = await findOpenRow(date);

    let openingCashTotal = 0;
    let openId = '';
    let openedAt = '';

    if (found) {
      openId = String(found[1] || '');
      openedAt = String(found[2] || '');
      openingCashTotal = toNum(found[7], 0);
    } else {
      openingCashTotal = await getYesterdayClosing(date);
      openId = `${date}-${Date.now()}`;
      openedAt = new Date().toISOString();

      // Create CashOpen row automatically
      await appendRow(SHEET_ID, OPEN_TAB, [
        date,                    // A
        openId,                  // B
        openedAt,                // C
        '',                      // D employeeId
        '',                      // E employeeName
        DEFAULT_TILL_NO,         // F tillNo
        0,                       // G mpesaWithdrawal (legacy)
        Number(openingCashTotal),// H openingCashTotal
        JSON.stringify([]),      // I cashBreakdown
        0,                       // J sendMoney
        0,                       // K openingTillTotal
      ]);
    }

    // 2) Compute today's totals from Sales sheet
    const totals = await sumTodayFromSales(date);

    // 3) Expected cash in drawer (what you want “مساءً” بدون إدخال يدوي)
    const expectedDrawerCash = openingCashTotal + totals.cashSales - totals.withdrawals;

    // Optional reporting:
    const totalReceivedAllMethods = totals.cashSales + totals.tillSales;

    return res.json({
      ok: true,
      date,
      openId,
      openedAt,
      openingCashTotal,
      totals,
      expectedDrawerCash,
      totalReceivedAllMethods
    });
  } catch (e) {
    console.error('GET /api/cash/summary:', e?.message || e);
    res.status(500).json({ error: 'Failed to compute cash summary' });
  }
});

// ============ POST /api/cash/open (kept, but now supports AUTO openingCashTotal) ============
router.post('/open', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const body = req.body || {};
    const date = normalizeDate(body.date);
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const tillNo = String(body.tillNo || DEFAULT_TILL_NO).trim();
    if (!tillNo) return res.status(400).json({ error: 'tillNo is required' });

    // If openingCashTotal not provided -> auto from yesterday close
    let openingCashTotal = body.openingCashTotal;
    if (openingCashTotal === undefined || openingCashTotal === null || openingCashTotal === '') {
      openingCashTotal = await getYesterdayClosing(date);
    }
    openingCashTotal = toNum(openingCashTotal, 0);
    if (openingCashTotal < 0) {
      return res.status(400).json({ error: 'openingCashTotal must be a non-negative number' });
    }

    // Back-compat: allow both mpesaWithdrawal and withdrawalCash
    const mpesaWithdrawal = toNum(body.mpesaWithdrawal ?? body.withdrawalCash, 0);
    if (mpesaWithdrawal < 0) {
      return res.status(400).json({ error: 'mpesaWithdrawal must be a non-negative number' });
    }

    const sendMoney = toNum(body.sendMoney, 0);
    if (sendMoney < 0) {
      return res.status(400).json({ error: 'sendMoney must be a non-negative number' });
    }

    const employee = safeObj(body.employee);
    const employeeId = String(employee.id || employee.employeeId || employee.employeeid || employee.username || '').trim();
    const employeeName = String(employee.name || employee.employeeName || employee.username || '').trim();

    const cashBreakdown = safeArr(body.cashBreakdown);

    // prevent duplicate open for same date
    const existing = await readRows(SHEET_ID, OPEN_TAB, 'A2:B', { valueRenderOption: 'FORMATTED_VALUE' });
    const already = (existing || []).find(r => normalizeDate(r[0]) === date);
    if (already) {
      return res.status(409).json({ error: 'Day already opened for this date', openId: already[1] || '' });
    }

    const openId = String(body.openId || `${date}-${Date.now()}`);
    const openedAt = String(body.openedAt || new Date().toISOString());

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
      Number(sendMoney),
    ]);

    res.json({ ok: true, openId, openingCashTotal, sendMoney });
  } catch (e) {
    console.error('POST /api/cash/open:', e?.message || e);
    res.status(500).json({ error: 'Failed to save Start Day' });
  }
});

// ============ POST /api/cash/close (kept, but now supports AUTO closingCashTotal) ============
router.post('/close', async (req, res) => {
  try {
    if (!SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_CASH_ID' });

    const body = req.body || {};
    const date = normalizeDate(body.date);
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const tillNo = String(body.tillNo || DEFAULT_TILL_NO).trim();
    if (!tillNo) return res.status(400).json({ error: 'tillNo is required' });

    // Back-compat: allow both mpesaWithdrawal and withdrawalCash
    const mpesaWithdrawal = toNum(body.mpesaWithdrawal ?? body.withdrawalCash, 0);
    if (mpesaWithdrawal < 0) {
      return res.status(400).json({ error: 'mpesaWithdrawal must be a non-negative number' });
    }

    const sendMoney = toNum(body.sendMoney, 0);
    if (sendMoney < 0) {
      return res.status(400).json({ error: 'sendMoney must be a non-negative number' });
    }

    const employee = safeObj(body.employee);
    const employeeId = String(employee.id || employee.employeeId || employee.employeeid || employee.username || '').trim();
    const employeeName = String(employee.name || employee.employeeName || employee.username || '').trim();

    const cashBreakdown = safeArr(body.cashBreakdown);
    const openId = String(body.openId || '');
    const closedAt = String(body.closedAt || new Date().toISOString());

    // If closingCashTotal not provided -> compute expected automatically
    let closingCashTotal = body.closingCashTotal;
    if (closingCashTotal === undefined || closingCashTotal === null || closingCashTotal === '') {
      // get opening of day (auto-open if missing)
      let { found } = await findOpenRow(date);
      let openingCashTotal = 0;

      if (!found) {
        // auto open
        openingCashTotal = await getYesterdayClosing(date);
        const newOpenId = `${date}-${Date.now()}`;
        const openedAt = new Date().toISOString();
        await appendRow(SHEET_ID, OPEN_TAB, [
          date, newOpenId, openedAt, '', '', DEFAULT_TILL_NO, 0, Number(openingCashTotal), JSON.stringify([]),
          0,
          0,
        ]);
      } else {
        openingCashTotal = toNum(found[7], 0);
      }

      const totals = await sumTodayFromSales(date);
      closingCashTotal = openingCashTotal + totals.cashSales - totals.withdrawals;
    }

    closingCashTotal = toNum(closingCashTotal, 0);
    if (closingCashTotal < 0) {
      return res.status(400).json({ error: 'closingCashTotal must be a non-negative number' });
    }

    await appendRow(SHEET_ID, CLOSE_TAB, [
      date,
      openId,
      closedAt,
      employeeId,
      employeeName,
      tillNo,
      Number(mpesaWithdrawal),
      Number(closingCashTotal),
      JSON.stringify(cashBreakdown),
      Number(sendMoney),
    ]);

    res.json({ ok: true, closingCashTotal, sendMoney });
  } catch (e) {
    console.error('POST /api/cash/close:', e?.message || e);
    res.status(500).json({ error: 'Failed to save End Day' });
  }
});

module.exports = router;
