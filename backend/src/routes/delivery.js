// backend/src/routes/delivery.js
// Google Sheets backed "Delivery" orders (unpaid). When paid -> append to Sales sheet and remove from Delivery tab.

const express = require('express');
const router = express.Router();
const { getSheets } = require('../google/sheets');
<<<<<<< HEAD
const { readRows, appendRow, updateRow, findRowIndexByKey } = require('../google/sheets.repo');
=======
<<<<<<< HEAD
const { readRows, appendRow, updateRow, findRowIndexByKey } = require('../google/sheets.repo');
=======
>>>>>>> 9e405ddecbb6b923c4c0bd4d12234d22cb897e4a
>>>>>>> e1442e61be618bc7ab7c57b080e67c4ee3fc8450

const SALES_SHEET_ID = process.env.SHEET_SALES_ID;
const SALES_TAB = process.env.SHEET_SALES_TAB || 'Sales';
const DELIVERY_TAB = process.env.SHEET_DELIVERY_TAB || 'Delivery';

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> e1442e61be618bc7ab7c57b080e67c4ee3fc8450
const CLIENTS_SHEET_ID = process.env.SHEET_CLIENTS_ID;
const CLIENTS_TAB = process.env.SHEET_CLIENTS_TAB || 'Clients';

async function upsertLoyaltyPoints({ phone, nameHint, pointsDelta }) {
  try {
    if (!phone || !pointsDelta) return;
    if (!CLIENTS_SHEET_ID) return;
    const rows = await readRows(CLIENTS_SHEET_ID, CLIENTS_TAB, 'A2:E');
    const idx1 = findRowIndexByKey(rows, 0, String(phone));
    if (idx1 >= 0) {
      const cur = rows[idx1 - 2] || [];
      const curName = cur[1] || '';
      const curAddress = cur[2] || '';
      const curPoints = Number(cur[3] || 0);
      const curNotes = cur[4] || '';
      const newPoints = Math.max(0, curPoints + Number(pointsDelta || 0));
      await updateRow(CLIENTS_SHEET_ID, CLIENTS_TAB, idx1, [String(phone), curName || String(nameHint || phone), curAddress, newPoints, curNotes]);
    } else {
      await appendRow(CLIENTS_SHEET_ID, CLIENTS_TAB, [String(phone), String(nameHint || phone), '', Number(pointsDelta || 0), '']);
    }
  } catch (e) {
    console.error('Loyalty points update failed:', e?.message || e);
  }
}

<<<<<<< HEAD
=======
=======
>>>>>>> 9e405ddecbb6b923c4c0bd4d12234d22cb897e4a
>>>>>>> e1442e61be618bc7ab7c57b080e67c4ee3fc8450
function safeJson(s) {
  try { return JSON.parse(s); } catch { return []; }
}

async function ensureDeliveryTab() {
  if (!SALES_SHEET_ID) throw new Error('Missing SHEET_SALES_ID');
  const sheets = getSheets();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SALES_SHEET_ID });
  const existing = (meta.data.sheets || []).map(s => s.properties?.title).filter(Boolean);
  const hasTab = existing.includes(DELIVERY_TAB);

  if (!hasTab) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SALES_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: DELIVERY_TAB } } }] },
    });
  }

  // Ensure header row
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SALES_SHEET_ID,
    range: `${DELIVERY_TAB}!A1:J1`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const row = (head.data.values || [])[0] || [];
  const empty = row.length === 0 || row.every(v => String(v || '').trim() === '');
  if (empty) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SALES_SHEET_ID,
      range: `${DELIVERY_TAB}!A1:J1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          'CreatedAt',
          'OrderNo',
          'ClientName',
          'ClientPhone',
          'ItemsCount',
          'Total',
          'Profit',
          'ItemsJSON',
          'Note',
          'Status',
        ]],
      },
    });
  }
}

// A: CreatedAt, B: OrderNo, C: ClientName, D: ClientPhone
// E: ItemsCount, F: Total, G: Profit, H: ItemsJSON, I: Note, J: Status
function rowToDelivery(row, rowIndex1Based) {
  return {
    id: String(rowIndex1Based), // sheet row number (1-based)
    createdAt: row[0] || '',
    orderNo: row[1] || '',
    clientName: row[2] || '',
    clientPhone: row[3] || '',
    itemsCount: Number(row[4] || 0),
    total: Number(row[5] || 0),
    profit: Number(row[6] || 0),
    items: row[7] ? safeJson(row[7]) : [],
    note: row[8] || '',
    status: row[9] || 'UNPAID',
  };
}

router.get('/', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    await ensureDeliveryTab();
    const sheets = getSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SALES_SHEET_ID,
      range: `${DELIVERY_TAB}!A2:J`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const values = resp.data.values || [];
    // rowIndex in sheet: start from 2 because we read from A2
    const rows = values.map((r, idx) => rowToDelivery(r, idx + 2));
    res.json({ rows, total: rows.length });
  } catch (e) {
    console.error('GET /api/delivery error:', e?.message || e);
    res.status(500).json({ error: 'Failed to read delivery orders' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    await ensureDeliveryTab();

    const {
      orderNo,
      clientName = '',
      clientPhone = '',
      items = [],
      total = 0,
      profit = 0,
      note = '',
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    const nowIso = new Date().toISOString();
    const itemsCount = items.reduce((s, it) => s + Number(it.qty || 0), 0);
    const payload = [
      nowIso,
      String(orderNo || `${Date.now()}`),
      String(clientName || ''),
      String(clientPhone || ''),
      Number(itemsCount || 0),
      Number(total || 0),
      Number(profit || 0),
      JSON.stringify(items),
      String(note || ''),
      'UNPAID',
    ];

    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SALES_SHEET_ID,
      range: `${DELIVERY_TAB}!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/delivery error:', e?.message || e);
    res.status(500).json({ error: 'Failed to create delivery order' });
  }
});

// Mark delivery as paid: append to Sales then delete delivery row
router.post('/:id/pay', async (req, res) => {
  try {
    if (!SALES_SHEET_ID) return res.status(400).json({ error: 'Missing SHEET_SALES_ID' });
    await ensureDeliveryTab();

    const rowId = Number(req.params.id);
    if (!Number.isFinite(rowId) || rowId < 2) return res.status(400).json({ error: 'Invalid id' });

    const { paymentMethod = 'cash', paymentDate } = req.body || {};
    const payMethod = String(paymentMethod || 'cash');

    const sheets = getSheets();
    // Read row
    const got = await sheets.spreadsheets.values.get({
      spreadsheetId: SALES_SHEET_ID,
      range: `${DELIVERY_TAB}!A${rowId}:J${rowId}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const row = (got.data.values || [])[0];
    if (!row || row.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = rowToDelivery(row, rowId);
    // IMPORTANT:
    // We want the sale to be recorded on the *PAYMENT* day (not the order day)
    // so daily reports and cash balances are not affected until the customer actually pays.
    //
    // The frontend sends paymentDate as YYYY-MM-DD (local calendar date).
    // We store an ISO timestamp at 12:00Z to avoid timezone day-shifts when the UI converts it to local time.
    const nowIso = (String(paymentDate || '').match(/^\d{4}-\d{2}-\d{2}$/))
      ? `${paymentDate}T12:00:00.000Z`
      : new Date().toISOString();

    // Append to Sales sheet (Sales columns: A..I)
    const salePayload = [
      nowIso,
      String(order.orderNo || ''),
      String(order.clientName || ''),
      String(order.clientPhone || ''),
      String(payMethod),
      Number(order.itemsCount || 0),
      Number(order.total || 0),
      Number(order.profit || 0),
      JSON.stringify(order.items || []),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SALES_SHEET_ID,
      range: `${SALES_TAB}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [salePayload] },
    });

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> e1442e61be618bc7ab7c57b080e67c4ee3fc8450
    // Loyalty points: 1 point per 100 KSh of TOTAL, added when the customer actually pays.
    const phone = String(order.clientPhone || '').trim();
    const pts = phone ? Math.floor(Number(order.total || 0) / 100) : 0;
    await upsertLoyaltyPoints({ phone, nameHint: order.clientName || phone, pointsDelta: pts });

<<<<<<< HEAD
=======
=======
>>>>>>> 9e405ddecbb6b923c4c0bd4d12234d22cb897e4a
>>>>>>> e1442e61be618bc7ab7c57b080e67c4ee3fc8450
    // Delete row from Delivery tab
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SALES_SHEET_ID });
    const sheet = (meta.data.sheets || []).find(s => s.properties?.title === DELIVERY_TAB);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId == null) throw new Error('Delivery tab missing');

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SALES_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowId - 1, // 0-based inclusive
                endIndex: rowId, // 0-based exclusive
              },
            },
          },
        ],
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/delivery/:id/pay error:', e?.message || e);
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
});

module.exports = router;
