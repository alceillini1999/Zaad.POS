import crypto from "crypto";
import { getSheetsClient, spreadsheetId } from "../sheets.js";

const SESSIONS_SHEET = "sessions";

function nowISO() {
  return new Date().toISOString();
}

function addHoursISO(hours) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export function generateToken() {
  return crypto.randomBytes(32).toString("hex"); // 64 chars
}

export async function createSession({ employeeId, employeeName, ip, userAgent, ttlHours = 12 }) {
  const sheets = await getSheetsClient();

  const token = generateToken();
  const createdAt = nowISO();
  const expiresAt = addHoursISO(ttlHours);

  const values = [[
    token,
    String(employeeId || ""),
    String(employeeName || ""),
    createdAt,
    expiresAt,
    "true",
    String(ip || ""),
    String(userAgent || ""),
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SESSIONS_SHEET}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { token, createdAt, expiresAt };
}

export async function getSessionByToken(token) {
  const sheets = await getSheetsClient();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SESSIONS_SHEET}!A1:Z`,
  });

  const rows = resp.data.values || [];
  if (rows.length < 2) return null;

  const headers = rows[0];
  const tokenIdx = headers.indexOf("token");
  if (tokenIdx === -1) return null;

  const record = rows.slice(1).find(r => (r[tokenIdx] || "") === token);
  if (!record) return null;

  const obj = {};
  headers.forEach((h, i) => (obj[h] = record[i] ?? ""));
  return obj;
}

export function isSessionValid(session) {
  if (!session) return false;
  if (String(session.isActive).toLowerCase() !== "true") return false;

  const exp = new Date(session.expiresAt || 0).getTime();
  if (!exp) return false;

  return Date.now() < exp;
}
