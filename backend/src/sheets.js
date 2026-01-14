import { google } from "googleapis";

/**
 * Optional default spreadsheet ID for backward compatibility.
 * You can set it, but the app can also work without it because each route can use its own SHEET_*_ID.
 */
export const spreadsheetId =
  process.env.SHEETS_SPREADSHEET_ID ||
  process.env.SHEET_EMPLOYEES_ID ||
  process.env.SHEET_CLIENTS_ID ||
  process.env.SHEET_PRODUCTS_ID ||
  process.env.SHEET_SALES_ID ||
  process.env.SHEET_EXPENSES_ID ||
  process.env.SHEET_SESSIONS_ID ||
  "";

// Create Google auth using service account
function getAuth() {
  // Support both names just in case
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKeyRaw =
    process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || "";

  // Render stores it with \n as text, convert to real newlines
  const privateKey = String(privateKeyRaw).replace(/\\n/g, "\n").trim();

  // ✅ Do NOT require spreadsheetId here
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Sheets env vars: GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function getSheetsClient() {
  const auth = getAuth();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}
