// backend/src/routes/manualWithdrawals.js
const express = require('express');
const router = express.Router();
const { getSheets } = require('../google/sheets');
const { readRows, appendRow, deleteRow, findRowIndexByKey } = require('../google/sheets.repo');

const DEFAULT_TAB = process.env.SHEET_WITHDRAWALS_TAB || 'ManualWithdrawals';
const DEFAULT_SHEET_ID = process.env.SHEET_WITHDRAWALS_ID || process.env.SHEET_SALES_ID;

function ymd(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  // accept ISO
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // accept common Google Sheets date formats like 22/01/2026 or 1/22/2026
  const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const a = parseInt(m2[1], 10);
    const b = parseInt(m2[2], 10);
    const y = parseInt(m2[3], 10);
    // Disambiguate DD/MM vs MM/DD.
    // If one side is > 12, it's the day.
    let day = a;
    let mon = b;
    if (a <= 12 && b > 12) {
      // MM/DD
      mon = a;
      day = b;
    } else if (a > 12 && b <= 12) {
      // DD/MM (already default)
      day = a;
      mon = b;
    } else {
      // both <= 12 (ambiguous) — default to DD/MM (common in KE/EG)
      day = a;
      mon = b;
    }
    const mm = String(mon).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    if (y && mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return `${y}-${mm}-${dd}`;
  }

  return '';
}

// Cache tab existence checks to reduce Google Sheets "spreadsheets.get" reads.
const TAB_EXISTS_TTL_MS = Number(process.env.SHEETS_TAB_EXISTS_TTL_MS || 60 * 60 * 1000);
/** @type {Map<string, {ts:number, tabs:Set<string>}>} */
const tabsCache = new Map();

async function ensureTabExists(sheetId, tabName) {
  if (!sheetId) throw new Error('Missing sheet id (SHEET_WITHDRAWALS_ID or SHEET_SALES_ID)');
  const sheets = getSheets();

  const now = Date.now();
  const cached = tabsCache.get(sheetId);
  if (cached && (now - cached.ts) < TAB_EXISTS_TTL_MS && cached.tabs.has(tabName)) {
    return;
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tabs = new Set(
    (meta.data.sheets || [])
      .map(s => s.properties && s.properties.title)
      .filter(Boolean)
  );
  tabsCache.set(sheetId, { ts: now, tabs });
  if (tabs.has(tabName)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        { addSheet: { properties: { title: tabName } } }
      ]
    }
  });

  // Update cache optimistically to avoid immediate re-reads.
  const c2 = tabsCache.get(sheetId);
  if (c2) {
    c2.tabs.add(tabName);
    c2.ts = Date.now();
  } else {
    tabsCache.set(sheetId, { ts: Date.now(), tabs: new Set([tabName]) });
  }

  // add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'id', 'date', 'createdAt', 'source', 'amount', 'note', 'createdBy'
      ]]
    }
  });

  // Update cache
  const after = tabsCache.get(sheetId);
  if (after) after.tabs.add(tabName);
}

function safeJson(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

function rowToWithdrawal(row) {
  let source = String(row[3] || '').trim().toLowerCase();
  source = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (source === 'send money' || source === 'sendmoney' || source === 'send') source = 'send_money';
  if (source === 'withdrawel') source = 'withdrawal';
  if (source === 'mpesa withdrawal' || source === 'mpesa') source = 'withdrawal';
  return {
    id: row[0] || '',
    date: row[1] || '',
    createdAt: row[2] || '',
    source,
    amount: Number(row[4] || 0),
    note: row[5] || '',
    // alias for older frontend column naming
    reason: row[5] || '',
    createdBy: row[6] || '',
  };
}

// GET /api/manual-withdrawals?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    // Avoid stale data across devices (browser/proxy caching)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const sheetId = DEFAULT_SHEET_ID;
    const tab = DEFAULT_TAB;
    await ensureTabExists(sheetId, tab);

    const from = ymd(req.query.from) || '';
    const to = ymd(req.query.to) || '';
    // Read all (typically small) and filter in node
    const rows = await readRows(sheetId, tab, 'A1:G');
    const data = (rows || []).slice(1).filter(r => r && r.length); // skip header

    const list = data.map(rowToWithdrawal).filter(w => w.id);

    const filtered = list.filter(w => {
      const d = ymd(w.date || w.createdAt) || '';
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    // newest first
    filtered.sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /api/manual-withdrawals
router.post('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const sheetId = DEFAULT_SHEET_ID;
    const tab = DEFAULT_TAB;
    await ensureTabExists(sheetId, tab);

    const body = req.body || {};
    const date = ymd(body.date) || ymd(new Date().toISOString());
    // Normalize source values to match frontend expectations.
    let source = String(body.source || '').trim().toLowerCase();
    source = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (source === 'send money' || source === 'sendmoney' || source === 'send') source = 'send_money';
    if (source === 'withdrawel') source = 'withdrawal';
    if (source === 'mpesa withdrawal' || source === 'mpesa') source = 'withdrawal';
    const amount = Number(body.amount || 0);
    const note = String(body.note || '').trim();
    const createdBy = String(body.createdBy || body.user || '').trim();
    if (!source) return res.status(400).json({ error: 'source is required' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });

    const createdAt = new Date().toISOString();
    const id = `${createdAt}-${Math.random().toString(16).slice(2,8)}`;

    await appendRow(sheetId, tab, [id, date, createdAt, source, amount, note, createdBy]);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// DELETE /api/manual-withdrawals/:id
router.delete('/:id', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const sheetId = DEFAULT_SHEET_ID;
    const tab = DEFAULT_TAB;
    await ensureTabExists(sheetId, tab);

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const rows = await readRows(sheetId, tab, 'A2:A');
    // rows is list of [id]
    const flat = (rows || []).map(r => (r && r[0]) ? String(r[0]) : '');
    const idx0 = flat.findIndex(v => v === id);
    if (idx0 < 0) return res.status(404).json({ error: 'not found' });

    const sheetRow = idx0 + 2; // because A2 is row 2
    await deleteRow(sheetId, tab, sheetRow);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
