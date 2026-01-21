const { getSessionByToken, isSessionValid } = require("../auth/sessions.js");

module.exports = async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cookieToken = req.cookies?.zaad_token || req.cookies?.token || "";
    const token = bearer || cookieToken;

    if (!token) return res.status(401).json({ error: "Missing token" });

    const session = await getSessionByToken(token);
    if (!isSessionValid(session)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // مرّر بيانات الجلسة للراوت
    req.session = session;
    return next();
  } catch (e) {
    console.error("requireAuth error:", e);
    return res.status(500).json({ error: "Auth check failed" });
  }
};
