// backend/src/routes/clients.google.js
const express = require('express');
const router = express.Router();
const { readRows, appendRow, updateRow, deleteRow, findRowIndexByKey } = require('../google/sheets.repo');

const SHEET_ID = process.env.SHEET_CLIENTS_ID;
const TAB = process.env.SHEET_CLIENTS_TAB || 'Clients';
// Columns: A:Phone | B:Name | C:Address | D:LoyaltyPoints | E:Notes

function rowToClient(r) {
  return {
    phone: String(r[0] || ''),
    name: r[1] || '',
    address: r[2] || '',
    loyaltyPoints: Number(r[3] || 0),
    notes: r[4] || '',
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await readRows(SHEET_ID, TAB, 'A2:E');
    const list = rows.map(rowToClient);
    // بعض الواجهات لديك تتوقع {data:[]} لذا نرجع الشكلين
    res.json({ data: list, rows: list, total: list.length });
  } catch (e) {
    console.error('GET clients:', e?.message || e);
    res.status(500).json({ error: 'Failed to read clients' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { phone, name, address='', loyaltyPoints=0, notes='' } = req.body || {};
    if (!phone || !name) return res.status(400).json({ error: 'phone and name are required' });
    await appendRow(SHEET_ID, TAB, [String(phone), name, address, Number(loyaltyPoints), notes]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST client:', e?.message || e);
    res.status(500).json({ error: 'Failed to add client' });
  }
});

router.put('/google/:phone', async (req, res) => {
  try {
    const key = req.params.phone;
    const rows = await readRows(SHEET_ID, TAB, 'A2:E');
    const rowIdx1 = findRowIndexByKey(rows, 0, key);
    if (rowIdx1 < 0) return res.status(404).json({ error: 'Client not found' });

    const { phone=key, name, address='', loyaltyPoints=0, notes='' } = req.body || {};
    await updateRow(SHEET_ID, TAB, rowIdx1, [String(phone), name, address, Number(loyaltyPoints), notes]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT client:', e?.message || e);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/google/:phone', async (req, res) => {
  try {
    const key = req.params.phone;
    const rows = await readRows(SHEET_ID, TAB, 'A2:E');
    const rowIdx1 = findRowIndexByKey(rows, 0, key);
    if (rowIdx1 < 0) return res.status(404).json({ error: 'Client not found' });
    await deleteRow(SHEET_ID, TAB, rowIdx1);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE client:', e?.message || e);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;