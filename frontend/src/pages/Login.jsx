import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ username, pin }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Login failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("employee", JSON.stringify(data.employee || {}));
      nav("/overview");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-lg text-[#111]">
        <h1 className="text-xl font-bold mb-2">تسجيل دخول الموظفين</h1>
        <p className="text-sm text-[#555] mb-6">قم بتسجيل الدخول لبدء اليوم</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: ahmed"
              autoComplete="username"
              className="w-full px-4 py-2 border rounded-lg bg-white text-[#111] caret-[#111] focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="مثال: 1234"
              autoComplete="current-password"
              className="w-full px-4 py-2 border rounded-lg bg-white text-[#111] caret-[#111] focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded-lg shadow disabled:opacity-60"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
