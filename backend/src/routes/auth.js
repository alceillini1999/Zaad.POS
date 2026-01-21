const express = require("express");
const { readRows } = require("../google/sheets.repo.js");
const { createSession } = require("../auth/sessions.js");
const requireAuth = require("../middlewares/requireAuth.js");

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

    const spreadsheetId = process.env.SHEET_EMPLOYEES_ID || process.env.SHEETS_SPREADSHEET_ID;
    const tab = process.env.SHEET_EMPLOYEES_TAB || "employees";

    if (!spreadsheetId) {
      return res.status(500).json({ error: "Missing SHEET_EMPLOYEES_ID or SHEETS_SPREADSHEET_ID" });
    }

    const u = String(username).trim().toLowerCase();
    const p = String(pin).trim();

    // Read employees from Google Sheets via the shared repo helper
    const rows = await readRows(spreadsheetId, tab, "A1:Z");
    if (rows.length < 2) {
      return res.status(401).json({ error: "No employees" });
    }

    const headers = (rows[0] || []).map(normalizeHeader);
    const list = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      return obj;
    });

    const emp = list.find((e) => {
      const eu = String(e.username ?? "").trim().toLowerCase();
      const ep = String(e.pin ?? "").trim();

      // If active column exists, require it to be truthy. If missing, allow.
      const activeVal = e.active ?? e.isactive ?? e.isActive ?? "";
      const okActive = activeVal === "" ? true : isTruthy(activeVal);

      return eu === u && ep === p && okActive;
    });

    if (!emp) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create a session token (stored in Google Sheets)
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

    // Store token in an httpOnly cookie so the client doesn't need browser storage
    const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    res.cookie("zaad_token", session.token, {
      httpOnly: true,
      secure: isProd, // set true on HTTPS (Render)
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });

    return res.json({
      employee: {
        id: emp.id || emp.employeeid || emp.employeeId || emp.username,
        name: emp.name || emp.username,
        role: emp.role || "staff",
      },
      expiresAt: session.expiresAt,
    });
  } catch (e) {
    console.error("auth login error:", e);
    return res.status(500).json({
      error: "Login failed",
      details: e?.message || String(e),
    });
  }
});

// Read current session (via cookie or Authorization header)
router.get("/me", requireAuth, async (req, res) => {
  const s = req.session || {};
  return res.json({
    ok: true,
    employee: {
      id: s.employeeId || s.employeeid || "",
      name: s.employeeName || s.employeename || "",
      role: s.role || "staff",
    },
    session: {
      createdAt: s.createdAt || s.createdat || "",
      expiresAt: s.expiresAt || s.expiresat || "",
    },
  });
});

router.post("/logout", async (_req, res) => {
  res.clearCookie("zaad_token", { path: "/" });
  res.clearCookie("token", { path: "/" });
  return res.json({ ok: true });
});

module.exports = router;
