import express from "express";
import { getSheetsClient, spreadsheetId as defaultSpreadsheetId } from "../sheets.js";
import { createSession } from "../auth/sessions.js";

const router = express.Router();

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

function isActiveValue(v) {
  const s = String(v ?? "").trim().toLowerCase();
  // اعتبر الموظف Active لو TRUE/1/yes أو الخانة فاضية (اختياري)
  // وإذا تريد الإلزام بـ TRUE فقط احذف شرط (!s)
  if (!s) return true;
  return s === "true" || s === "1" || s === "yes";
}

router.post("/login", async (req, res) => {
  try {
    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return res.status(400).json({ error: "Missing username/pin" });
    }

    // ✅ خذ الـ ID واسم التاب من Environment Variables
    const EMP_SHEET_ID = process.env.SHEET_EMPLOYEES_ID || defaultSpreadsheetId;
    const EMP_SHEET_TAB = process.env.SHEET_EMPLOYEES_TAB || "employees";

    const u = String(username).trim().toLowerCase();
    const p = String(pin).trim();

    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: EMP_SHEET_ID,
      range: `${EMP_SHEET_TAB}!A1:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) {
      return res.status(401).json({ error: "No employees" });
    }

    // ✅ طبع headers إلى lowercase لتجنب أي اختلافات في الكتابة
    const headers = rows[0].map(normalizeHeader);

    const list = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });

    // ✅ استخدم active (وأيضًا isactive إن وُجد)
    const emp = list.find((e) => {
      const eu = String(e.username ?? "").trim().toLowerCase();
      const ep = String(e.pin ?? "").trim();

      const active = e.active ?? e.isactive ?? e.isActive; // تغطية كل الاحتمالات
      const okActive = isActiveValue(active);

      return eu === u && ep === p && okActive;
    });

    if (!emp) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ أنشئ Session Token واحفظه في Google Sheets
    const ip =
      req.headers["x-forwarded-for"]?.toString()?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "";

    const session = await createSession({
      employeeId: emp.id || emp.employeeid || emp.employeeId || emp.username,
      employeeName: emp.name || emp.username,
      ip,
      userAgent,
      ttlHours: 12,
    });

    return res.json({
      token: session.token,
      employee: {
        id: emp.id || emp.employeeid || emp.employeeId || emp.username,
        name: emp.name || emp.username,
        role: emp.role || "staff",
      },
      expiresAt: session.expiresAt,
    });
  } catch (e) {
    console.error("auth login error:", e);
    return res.status(500).json({ error: "Login failed", details: e.message });
  }
});

export default router;
