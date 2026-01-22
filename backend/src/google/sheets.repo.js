// backend/src/google/sheets.repo.js
const { getSheets } = require('./sheets');

// ==============================
// Simple in-memory caching layer
// ==============================
// Google Sheets API enforces per-minute read quotas for a given service account/project.
// This app tends to read the same ranges repeatedly (e.g., Summary page fans out calls
// that all read the same A1 ranges). Without caching, it is easy to hit
// "Read requests per minute per user".
//
// This cache reduces identical reads within a short TTL.
// - Safe because the UI does not require millisecond-level freshness.
// - We invalidate on writes (append/update/delete) for correctness.

const RANGE_CACHE_TTL_MS = Number(process.env.SHEETS_RANGE_CACHE_TTL_MS || 8000);

/** @type {Map<string, {ts:number, values:any[][]}>} */
const rangeCache = new Map();

/** @type {Map<string, {ts:number, sheetIdNum:number}>} */
const tabIdCache = new Map();
const TAB_ID_CACHE_TTL_MS = Number(process.env.SHEETS_TABID_CACHE_TTL_MS || 60 * 60 * 1000);

function cacheKey(sheetId, tab, a1Range) {
  return `${sheetId}::${tab}::${a1Range}`;
}

function invalidateSheetTab(sheetId, tab) {
  const prefix = `${sheetId}::${tab}::`;
  for (const k of rangeCache.keys()) {
    if (k.startsWith(prefix)) rangeCache.delete(k);
  }
}

function invalidateSheet(sheetId) {
  const prefix = `${sheetId}::`;
  for (const k of rangeCache.keys()) {
    if (k.startsWith(prefix)) rangeCache.delete(k);
  }
  // also clear tab id cache for this sheet
  for (const k of tabIdCache.keys()) {
    if (k.startsWith(prefix)) tabIdCache.delete(k);
  }
}

async function readRows(sheetId, tab, a1Range) {
  const key = cacheKey(sheetId, tab, a1Range);
  const hit = rangeCache.get(key);
  const now = Date.now();
  if (hit && (now - hit.ts) < RANGE_CACHE_TTL_MS) {
    return hit.values;
  }

  const sheets = getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!${a1Range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const values = resp.data.values || [];
  rangeCache.set(key, { ts: now, values });
  return values;
}

async function appendRow(sheetId, tab, values) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tab}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  invalidateSheetTab(sheetId, tab);
  return true;
}

async function updateRow(sheetId, tab, rowIndex1Based, values) {
  const sheets = getSheets();
  const range = `${tab}!A${rowIndex1Based}:Z${rowIndex1Based}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  invalidateSheetTab(sheetId, tab);
  return true;
}

async function deleteRow(sheetId, tab, rowIndex1Based) {
  const sheets = getSheets();
  // Need sheetId (gid) numeric for batchUpdate.
  // Cache tabId lookups to avoid repeated spreadsheets.get reads.
  const tabKey = `${sheetId}::${tab}`;
  const now = Date.now();
  const cached = tabIdCache.get(tabKey);
  let sheetIdNum = cached && (now - cached.ts) < TAB_ID_CACHE_TTL_MS ? cached.sheetIdNum : null;

  if (sheetIdNum == null) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheet = (meta.data.sheets || []).find(s => s.properties.title === tab);
    if (!sheet) throw new Error(`Tab "${tab}" not found`);
    sheetIdNum = sheet.properties.sheetId;
    tabIdCache.set(tabKey, { ts: now, sheetIdNum });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetIdNum,
            dimension: 'ROWS',
            startIndex: rowIndex1Based - 1, // inclusive, 0-based
            endIndex: rowIndex1Based,       // exclusive
          }
        }
      }]
    }
  });
  invalidateSheetTab(sheetId, tab);
  return true;
}

function findRowIndexByKey(rows, colIndex, key) {
  // rows include data starting from row 2 (if you read A2:Z), so
  // the 1-based sheet row = index + 2
  const idx = rows.findIndex(r => String(r[colIndex] || '').trim() === String(key).trim());
  return idx >= 0 ? idx + 2 : -1;
}

module.exports = {
  readRows,
  appendRow,
  updateRow,
  deleteRow,
  findRowIndexByKey,
  invalidateSheetTab,
  invalidateSheet,
};