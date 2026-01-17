import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Flexible API base
  const API_URL = useMemo(() => {
    const orig = (import.meta?.env?.VITE_API_URL || "").replace(/\/+$/, "");
    const host = orig.replace(/\/api$/, "");
    return host ? `${host}/api` : "/api";
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          username: String(username || "").trim(),
          pin: String(pin || "").trim(),
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || data?.message || "Login failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("employee", JSON.stringify(data.employee || {}));
      nav("/overview");
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "radial-gradient(900px 360px at 12% 0%, rgba(197,122,42,0.20), transparent 60%), radial-gradient(900px 360px at 92% 10%, rgba(31,157,138,0.14), transparent 55%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="ui-panel">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-base border border-line flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png?v=5"
                alt="Zaad Bakery"
                className="h-9 w-9 object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
                draggable="false"
              />
            </div>
            <div>
              <div className="ui-h2">Sign in</div>
              <div className="ui-sub">Enter your username and PIN to continue.</div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="ui-label">Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ahmed"
                autoComplete="username"
                className="ui-input mt-1"
              />
            </label>

            <label className="block">
              <span className="ui-label">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 1999"
                autoComplete="current-password"
                className="ui-input mt-1"
              />
            </label>

            {err && (
              <div className="ui-card p-3 border border-[rgba(220,38,38,0.25)] bg-[rgba(220,38,38,0.06)]">
                <div className="text-sm font-semibold text-red-700">{err}</div>
              </div>
            )}

            <button type="submit" disabled={loading} className="ui-btn ui-btn-primary w-full">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
