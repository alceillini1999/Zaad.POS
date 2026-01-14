import express from "express";
import { getSheetsClient } from "../sheets.js";
import { createSession } from "../auth/sessions.js";

const router = express.Router();

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

function isTruthy(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

router.post("/login", async (req, res) => {
  try {
    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return res.status(400).json({ error: "Missing username/pin" });
    }

    // ✅ استخدم الـ ENV الخاصة بالموظفين
    const spreadsheetId = process.env.SHEET_EMPLOYEES_ID;
    const tab = process.env.SHEET_EMPLOYEES_TAB || "employees";

    if (!spreadsheetId) {
      return res.status(500).json({ error: "Missing SHEET_EMPLOYEES_ID" });
    }

    const u = String(username).trim().toLowerCase();
    const p = String(pin).trim();

    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) {
      return res.status(401).json({ error: "No employees" });
    }

    // ✅ تحويل headers إلى lowercase لتفادي اختلافات الكتابة
    const headers = rows[0].map(normalizeHeader);

    const list = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });

    // ✅ العمود الصحيح هو active (وليس isActive)
    const emp = list.find((e) => {
      const eu = String(e.username ?? "").trim().toLowerCase();
      const ep = String(e.pin ?? "").trim();

      // active لو TRUE فقط، وإلا مرفوض
      const activeVal = e.active ?? e.isactive ?? e.isActive;
      const okActive = activeVal === "" ? true : isTruthy(activeVal);

      return eu === u && ep === p && okActive;
    });

    if (!emp) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ إنشاء Session Token وحفظه في Google Sheets
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
    // أثناء التشخيص خلي الرسالة واضحة بدل Login failed فقط
    return res.status(500).json({
      error: "Login failed",
      details: e?.message || String(e),
    });
  }
});

export default router;
