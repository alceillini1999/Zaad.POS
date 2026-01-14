import express from "express";
import { getSheetsClient, spreadsheetId } from "../sheets.js";
import { createSession } from "../auth/sessions.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: "Missing username/pin" });

    const sheets = await getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "employees!A1:Z",
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) return res.status(401).json({ error: "No employees" });

    const headers = rows[0];
    const list = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });

    const emp = list.find(e =>
      String(e.username).trim() === String(username).trim() &&
      String(e.pin).trim() === String(pin).trim() &&
      String(e.isActive).toLowerCase() !== "false"
    );

    if (!emp) return res.status(401).json({ error: "Invalid credentials" });

    // ✅ أنشئ Session Token واحفظه في Google Sheets
    const ip = req.headers["x-forwarded-for"]?.toString()?.split(",")[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "";

    const session = await createSession({
      employeeId: emp.id || emp.employeeId || emp.username,
      employeeName: emp.name || emp.username,
      ip,
      userAgent,
      ttlHours: 12,
    });

    return res.json({
      token: session.token,
      employee: {
        id: emp.id || emp.employeeId || emp.username,
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
