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

      // ✅ حفظ التوكن محليًا لاستخدامه في كل الطلبات
      localStorage.setItem("token", data.token);
      localStorage.setItem("employee", JSON.stringify(data.employee || {}));

      // بعد الدخول
      nav("/overview"); // غيّرها لصفحتك الرئيسية بعد الدخول
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-xl font-bold text-[#111] mb-2">تسجيل دخول الموظفين</h1>
        <p className="text-sm text-[#555] mb-6">قم بتسجيل الدخول لبدء اليوم</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#111] mb-1">اسم المستخدم</label>
            <input
              className="w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: ahmed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#111] mb-1">PIN</label>
            <input
              className="w-full"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="مثال: 1234"
            />
          </div>

          {err && <div className="text-sm text-red-600">
