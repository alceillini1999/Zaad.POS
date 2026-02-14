import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import Modal from "../components/Modal";

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
  const [paymentDate, setPaymentDate] = useState(() => toLocalYMD(new Date()));

  const [payModal, setPayModal] = useState({
    open: false,
    order: null,
    method: "cash",
  });

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

  async function markPaid(id, paymentMethod) {
    if (!id) return;
    setPayingId(id);
    try {
      const res = await fetch(url(`/api/delivery/${id}/pay`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, paymentDate }),
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

  const normStatus = (s) => {
    const x = String(s || "").trim().toUpperCase();
    if (x === "READY" || x === "DELIVERED" || x === "ORDERED" || x === "PAY") return x;
    // Legacy values like UNPAID
    return "ORDERED";
  };

  const primaryLabel = (r) => {
    const st = normStatus(r?.status);
    if (st === "ORDERED") return "Ordered";
    if (st === "READY") return "Ready";
    if (st === "DELIVERED") return "Delivered";
    if (st === "PAY") return "Mark as Paid";
    return "Ordered";
  };

  const nextStatus = (st) => {
    if (st === "ORDERED") return "READY";
    if (st === "READY") return "DELIVERED";
    if (st === "DELIVERED") return "PAY";
    return st;
  };

  const openPayModal = (order) => {
    setPayModal({ open: true, order, method: "cash" });
  };

  const closePayModal = () => {
    setPayModal({ open: false, order: null, method: "cash" });
  };

  const confirmPay = async () => {
    const order = payModal.order;
    if (!order?.id) return;
    const method = String(payModal.method || "cash");
    closePayModal();
    await markPaid(order.id, method);
  };

  async function updateStatus(id, status) {
    if (!id || !status) return;
    setPayingId(id);
    try {
      const res = await fetch(url(`/api/delivery/${id}/status`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows((prev) =>
        prev.map((r) => (String(r.id) === String(id) ? { ...r, status: data?.status || status } : r))
      );
    } catch (e) {
      alert("Failed to update status:\n" + (e?.message || e));
    } finally {
      setPayingId(null);
    }
  }

  async function onPrimaryAction(r) {
    if (!r?.id) return;
    const st = normStatus(r.status);
    if (st === "PAY") {
      openPayModal(r);
      return;
    }
    const nxt = nextStatus(st);
    if (nxt !== st) await updateStatus(r.id, nxt);
  }

  return (
    <div className="space-y-6">
      <Modal
        open={payModal.open}
        onClose={closePayModal}
        title={"Mark as Paid"}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 text-sm text-ink/80">
            كيف استلمت المال؟
          </div>

          <label className="text-sm col-span-2">
            <span className="block text-mute mb-1">Payment Method</span>
            <select
              className="border border-line rounded-xl px-3 py-2 w-full"
              value={payModal.method}
              onChange={(e) => setPayModal((m) => ({ ...m, method: e.target.value }))}
            >
              <option value="cash">cash</option>
              <option value="till">till</option>
              <option value="withdrawal">withdrawal</option>
              <option value="sendmoney">sendmoney</option>
            </select>
          </label>

          <div className="col-span-2 flex gap-2 justify-end">
            <button className="ui-btn ui-btn-ghost" onClick={closePayModal} type="button">
              Cancel
            </button>
            <button
              className="ui-btn ui-btn-primary"
              onClick={confirmPay}
              disabled={!payModal.order?.id || String(payingId) === String(payModal.order?.id)}
              type="button"
            >
              {String(payingId) === String(payModal.order?.id) ? "Processing…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

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
                    onClick={() => onPrimaryAction(r)}
                    disabled={String(payingId) === String(r.id)}
                    type="button"
                  >
                    {String(payingId) === String(r.id)
                      ? "Processing…"
                      : primaryLabel(r)}
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
