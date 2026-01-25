// backend/src/google/sheets.repo.js
const { getSheets } = require('./sheets');

async function readRows(sheetId, tab, a1Range, opts = {}) {
  const sheets = getSheets();
  const valueRenderOption = opts.valueRenderOption || 'UNFORMATTED_VALUE';
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!${a1Range}`,
    valueRenderOption,
  });
  return resp.data.values || [];
}

async function appendRow(sheetId, tab, values) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tab}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
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
  return true;
}

async function deleteRow(sheetId, tab, rowIndex1Based) {
  const sheets = getSheets();
  // Need sheetId (gid) numeric for batchUpdate. We can infer via get metadata.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = (meta.data.sheets || []).find(s => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found`);
  const sheetIdNum = sheet.properties.sheetId;

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
  return true;
}

function findRowIndexByKey(rows, colIndex, key) {
  // rows include data starting from row 2 (if you read A2:Z), so
  // the 1-based sheet row = index + 2
  const idx = rows.findIndex(r => String(r[colIndex] || '').trim() === String(key).trim());
  return idx >= 0 ? idx + 2 : -1;
}

module.exports = {
  readRows, appendRow, updateRow, deleteRow, findRowIndexByKey,
};