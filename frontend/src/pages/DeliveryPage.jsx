import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";

const API_ORIG = import.meta.env.VITE_API_URL || "";
const API_BASE = (() => {
  let s = String(API_ORIG || "");
  while (s.endsWith("/")) s = s.slice(0, -1);
  if (s.endsWith("/api")) s = s.slice(0, -4);
  return s;
})();
const url = (p) => {
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${API_BASE}${path}`;
};

const K = (n) =>
  `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-KE");
}

// Use local calendar date (NOT UTC) to avoid day shifting in +03 timezone.
const toLocalYMD = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function DeliveryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(() => toLocalYMD(new Date()));

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(url("/api/delivery"), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e) {
      setErr(e?.message || "Failed to load delivery orders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const totalAmount = useMemo(
    () => rows.reduce((s, r) => s + Number(r.total || 0), 0),
    [rows]
  );

  async function markPaid(id) {
    if (!id) return;
    const ok = confirm("Mark this delivery order as PAID?\nIt will move to Sales.");
    if (!ok) return;
    setPayingId(id);
    try {
      const res = await fetch(url(`/api/delivery/${id}/pay`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: payMethod, paymentDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Remove locally
      setRows((prev) => prev.filter((r) => String(r.id) !== String(id)));
    } catch (e) {
      alert("Failed to mark as paid:\n" + (e?.message || e));
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">Delivery Orders</div>
          <div className="ui-sub mt-1">Unpaid delivery orders — mark paid when the customer pays.</div>
        </div>
        <div className="ui-badge">
          Total Unpaid: <b className="ml-1">{K(totalAmount)}</b>
        </div>
      </div>

      <Section
        title="Orders"
        subtitle={loading ? "Loading…" : `${rows.length} unpaid`}
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="ui-input"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              title="Payment date (the sale will be recorded on this day)"
            />
            <select
              className="ui-select"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              title="Default payment method when marking paid"
            >
              <option value="cash">Cash</option>
              <option value="till">Till</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="sendmoney">Send Money</option>
            </select>
            <button className="ui-btn ui-btn-ghost" onClick={load} type="button">
              Refresh
            </button>
          </div>
        }
      >
        {err && <div className="ui-card p-4 text-red-600">{err}</div>}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="ui-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-extrabold text-ink">Order #{r.orderNo || r.id}</div>
                    <span className="ui-badge">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-sm text-mute">
                    Client: <b className="text-ink/90">{r.clientName || "—"}</b>
                    {r.clientPhone ? <span className="ml-2">(+{r.clientPhone})</span> : null}
                    <span className="mx-2">•</span>
                    Items: <b className="text-ink/90">{Number(r.itemsCount || 0)}</b>
                  </div>
                  {r.note ? <div className="mt-2 text-sm text-ink/80">Note: {r.note}</div> : null}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xl font-extrabold text-ink">{K(r.total)}</div>
                  <button
                    className="ui-btn ui-btn-primary mt-2"
                    onClick={() => markPaid(r.id)}
                    disabled={String(payingId) === String(r.id)}
                    type="button"
                  >
                    {String(payingId) === String(r.id) ? "Processing…" : "Mark as Paid"}
                  </button>
                </div>
              </div>

              {!!(r.items || []).length && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(r.items || []).slice(0, 6).map((it, idx) => (
                    <div key={idx} className="ui-card p-3 bg-white/60">
                      <div className="font-bold text-ink truncate">{it.name}</div>
                      <div className="text-xs text-mute">
                        Qty: {Number(it.qty || 0)} • Price: {K(it.price)}
                      </div>
                    </div>
                  ))}
                  {(r.items || []).length > 6 && (
                    <div className="text-sm text-mute">+{(r.items || []).length - 6} more…</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {!loading && !rows.length && (
            <div className="ui-card p-4 text-sm text-mute">No unpaid delivery orders.</div>
          )}
        </div>
      </Section>
    </div>
  );
}
