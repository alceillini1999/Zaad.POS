// backend/src/routes/transfers.js
const express = require('express');
const router = express.Router();
const { getSheets } = require('../google/sheets');
const { readRows, appendRow, deleteRow } = require('../google/sheets.repo');

const DEFAULT_TAB = process.env.SHEET_TRANSFERS_TAB || 'Transfers';
const DEFAULT_SHEET_ID = process.env.SHEET_TRANSFERS_ID || process.env.SHEET_SALES_ID;

function ymd(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const m2 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) {
    const a = parseInt(m2[1], 10);
    const b = parseInt(m2[2], 10);
    const y = parseInt(m2[3], 10);
    let day = a;
    let mon = b;
    if (a <= 12 && b > 12) { mon = a; day = b; }
    else if (a > 12 && b <= 12) { day = a; mon = b; }
    const mm = String(mon).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    if (y && mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return `${y}-${mm}-${dd}`;
  }
  return '';
}

const TAB_EXISTS_TTL_MS = Number(process.env.SHEETS_TAB_EXISTS_TTL_MS || 60 * 60 * 1000);
const tabsCache = new Map();

async function ensureTabExists(sheetId, tabName) {
  if (!sheetId) throw new Error('Missing sheet id (SHEET_TRANSFERS_ID or SHEET_SALES_ID)');
  const sheets = getSheets();

  const now = Date.now();
  const cached = tabsCache.get(sheetId);
  if (cached && (now - cached.ts) < TAB_EXISTS_TTL_MS && cached.tabs.has(tabName)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tabs = new Set((meta.data.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean));
  tabsCache.set(sheetId, { ts: now, tabs });
  if (tabs.has(tabName)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
  });

  const c2 = tabsCache.get(sheetId);
  if (c2) { c2.tabs.add(tabName); c2.ts = Date.now(); }
  else tabsCache.set(sheetId, { ts: Date.now(), tabs: new Set([tabName]) });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1:H1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[ 'id', 'date', 'createdAt', 'from', 'to', 'amount', 'note', 'createdBy' ]] }
  });
}

function normMethod(v) {
  let s = String(v || '').trim().toLowerCase();
  s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === 'send money' || s === 'sendmoney' || s === 'send') return 'send_money';
  if (s === 'withdrawel' || s === 'withdrawel cash' || s.startsWith('withdrawel ')) return 'withdrawal';
  if (s === 'withdrawal' || s === 'withdrawal cash' || s.startsWith('withdrawal ')) return 'withdrawal';
  return s;
}

function rowToTransfer(row) {
  return {
    id: row[0] || '',
    date: row[1] || '',
    createdAt: row[2] || '',
    from: normMethod(row[3] || ''),
    to: normMethod(row[4] || ''),
    amount: Number(row[5] || 0),
    note: row[6] || '',
    createdBy: row[7] || '',
  };
}

// GET /api/transfers?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const sheetId = DEFAULT_SHEET_ID;
    const tab = DEFAULT_TAB;
    await ensureTabExists(sheetId, tab);

    const from = ymd(req.query.from) || '';
    const to = ymd(req.query.to) || '';

    const rows = await readRows(sheetId, tab, 'A1:H', { valueRenderOption: 'FORMATTED_VALUE' });
    const data = (rows || []).slice(1).filter(r => r && r.length);
    const list = data.map(rowToTransfer).filter(t => t.id);

    const filtered = list.filter(t => {
      const d = ymd(t.date || t.createdAt) || '';
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    filtered.sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// POST /api/transfers
router.post('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const sheetId = DEFAULT_SHEET_ID;
    const tab = DEFAULT_TAB;
    await ensureTabExists(sheetId, tab);

    const body = req.body || {};
    const date = ymd(body.date) || ymd(new Date().toISOString());
    const from = normMethod(body.from || body.sourceFrom || '');
    const to = normMethod(body.to || body.destTo || '');
    const amount = Number(body.amount || 0);
    const note = String(body.note || '').trim();
    const createdBy = String(body.createdBy || body.user || '').trim();

    if (!from) return res.status(400).json({ error: 'from is required' });
    if (!to) return res.status(400).json({ error: 'to is required' });
    if (from === to) return res.status(400).json({ error: 'from and to must be different' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });

    const createdAt = new Date().toISOString();
    const id = `${createdAt}-${Math.random().toString(16).slice(2,8)}`;

    await appendRow(sheetId, tab, [id, date, createdAt, from, to, amount, note, createdBy]);
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// DELETE /api/transfers/:id
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
    const flat = (rows || []).map(r => (r && r[0]) ? String(r[0]) : '');
    const idx0 = flat.findIndex(v => v === id);
    if (idx0 < 0) return res.status(404).json({ error: 'not found' });

    const sheetRow = idx0 + 2;
    await deleteRow(sheetId, tab, sheetRow);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

module.exports = router;
