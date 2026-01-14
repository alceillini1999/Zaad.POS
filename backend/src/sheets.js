import { google } from "googleapis";

export const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || "";

  // مهم جدًا في Render: المفتاح يكون فيه \n كنص، نحوله لأسطر جديدة فعلية
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Sheets env vars: SHEETS_SPREADSHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY"
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
