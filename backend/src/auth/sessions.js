const crypto = require("crypto");
const { getSheets } = require("../google/sheets.js");

const SESSIONS_TAB = process.env.SHEET_SESSIONS_TAB || "sessions";

function nowISO() {
  return new Date().toISOString();
}

function addHoursISO(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function getSessionsSpreadsheetId() {
  return (
    process.env.SHEET_SESSIONS_ID ||
    process.env.SHEETS_SPREADSHEET_ID ||
    ""
  );
}

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

function requiredHeaders() {
  return [
    "token",
    "employeeId",
    "employeeName",
    "createdAt",
    "expiresAt",
    "isActive",
    "ip",
    "userAgent",
  ];
}

async function getSheetIdNum(sheets, spreadsheetId, tabTitle) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(
    (s) => s.properties?.title === tabTitle
  );
  if (!sheet) throw new Error(`Tab "${tabTitle}" not found in sessions sheet`);
  return sheet.properties.sheetId;
}

async function ensureSessionsHeader(sheets, spreadsheetId) {
  // Read first row
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SESSIONS_TAB}!A1:H1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const row1 = (resp.data.values && resp.data.values[0]) || [];
  const norm = row1.map(normalizeHeader);

  const needs = requiredHeaders().map(normalizeHeader);

  const hasToken = norm.includes("token");

  // Empty sheet: write header to row 1
  if (row1.length === 0 || norm.every((x) => x === "")) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SESSIONS_TAB}!A1:H1`,
      valueInputOption: "RAW",
      requestBody: { values: [needs] },
    });
    return;
  }

  // Header exists (token column present): good
  if (hasToken) return;

  // Row 1 seems to be data (no token header) -> insert a new row at top then write header
  const sheetIdNum = await getSheetIdNum(sheets, spreadsheetId, SESSIONS_TAB);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: sheetIdNum,
              dimension: "ROWS",
              startIndex: 0,
              endIndex: 1,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SESSIONS_TAB}!A1:H1`,
    valueInputOption: "RAW",
    requestBody: { values: [needs] },
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createSession({
  employeeId,
  employeeName,
  ip,
  userAgent,
  ttlHours = 12,
}) {
  const spreadsheetId = getSessionsSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "Missing sessions spreadsheet id: set SHEET_SESSIONS_ID or SHEETS_SPREADSHEET_ID"
    );
  }

  const sheets = getSheets();
  await ensureSessionsHeader(sheets, spreadsheetId);

  const token = generateToken();
  const createdAt = nowISO();
  const expiresAt = addHoursISO(ttlHours);

  const values = [
    [
      token,
      String(employeeId || ""),
      String(employeeName || ""),
      createdAt,
      expiresAt,
      "true",
      String(ip || ""),
      String(userAgent || ""),
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SESSIONS_TAB}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { token, createdAt, expiresAt };
}

async function getSessionByToken(token) {
  const spreadsheetId = getSessionsSpreadsheetId();
  if (!spreadsheetId) return null;

  const sheets = getSheets();
  await ensureSessionsHeader(sheets, spreadsheetId);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SESSIONS_TAB}!A1:H`,
  });

  const rows = resp.data.values || [];
  if (rows.length < 2) return null;

  const headers = rows[0].map(normalizeHeader);
  const tokenIdx = headers.indexOf("token");
  if (tokenIdx === -1) return null;

  const record = rows.slice(1).find((r) => String(r[tokenIdx] || "") === String(token || ""));
  if (!record) return null;

  const obj = {};
  rows[0].forEach((h, i) => {
    // keep original header key if provided; fallback to normalized
    const key = String(h || "").trim() || headers[i] || `col${i}`;
    obj[key] = record[i] ?? "";
  });

  // Provide normalized convenience fields too
  headers.forEach((h, i) => {
    if (h) obj[h] = record[i] ?? "";
  });

  return obj;
}

function isSessionValid(session) {
  if (!session) return false;

  const isActive =
    session.isActive ?? session.isactive ?? session["isActive"] ?? session["isactive"];
  if (String(isActive).toLowerCase() !== "true") return false;

  const expRaw =
    session.expiresAt ?? session.expiresat ?? session["expiresAt"] ?? session["expiresat"];
  const exp = new Date(expRaw || 0).getTime();
  if (!exp) return false;

  return Date.now() < exp;
}

module.exports = {
  generateToken,
  createSession,
  getSessionByToken,
  isSessionValid,
};
