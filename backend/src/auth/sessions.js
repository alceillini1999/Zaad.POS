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

// Google Sheets may auto-coerce ISO strings into date/time serials depending on
// sheet formatting. When reading back, values can be:
// - ISO strings
// - locale strings (e.g., "1/22/2026 11:51:08")
// - numeric serials (e.g., 45500.5)
function parseSheetDateToMs(v) {
  if (v === null || v === undefined || v === "") return 0;

  // Numeric serial (Google Sheets/Excel): days since 1899-12-30
  if (typeof v === "number") {
    return Math.round((v - 25569) * 86400 * 1000);
  }

  const s = String(v).trim();
  if (!s) return 0;

  // Numeric string serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return Math.round((n - 25569) * 86400 * 1000);
  }

  // Try Date.parse for ISO/locale formats
  const t = Date.parse(s);
  if (Number.isFinite(t)) return t;

  // Try to fix a truncated ISO like "01-22T11:51:08.219Z" by prefixing current year
  // (best-effort fallback; avoids breaking login).
  if (/^\d{2}-\d{2}T/.test(s)) {
    const y = new Date().getFullYear();
    const t2 = Date.parse(`${y}-${s}`);
    if (Number.isFinite(t2)) return t2;
  }

  return 0;
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
  // Prefix with apostrophe to force Google Sheets to keep the value as plain text.
  // (Prevents date auto-coercion that can break auth validation later.)
  const createdAt = `'${nowISO()}`;
  const expiresAt = `'${addHoursISO(ttlHours)}`;

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

  return {
    token,
    createdAt: String(createdAt).replace(/^'+/, ""),
    expiresAt: String(expiresAt).replace(/^'+/, ""),
  };
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
  // Remove any leading apostrophe if we stored as plain text
  const exp = parseSheetDateToMs(String(expRaw ?? "").replace(/^'+/, ""));
  if (!exp) return false;

  return Date.now() < exp;
}

module.exports = {
  generateToken,
  createSession,
  getSessionByToken,
  isSessionValid,
};
