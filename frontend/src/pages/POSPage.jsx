import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import Card from "../components/Card";

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

function ProductCard({ p, onAdd }) {
  return (
    <button
      onClick={onAdd}
      className="group ui-card p-4 text-left hover:-translate-y-[1px] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold tracking-tight text-ink truncate">
            {p.name}
          </div>
          <div className="mt-1 text-xs text-mute truncate">#{p.barcode || "—"}</div>
        </div>
        <div className="ui-badge-gold shrink-0">{K(p.salePrice)}</div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-mute">Tap to add</span>
        <span className="ui-btn ui-btn-primary !px-3 !py-1.5 !text-xs">+ Add</span>
      </div>
    </button>
  );
}

function QtyControl({ value, onChange }) {
  return (
    <input
      className="ui-input !w-[90px] text-center"
      type="number"
      min="0"
      step="1"
      value={value}
      // السماح بالقيمة الفارغة حتى لا يظهر رقم 1 تلقائياً
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cart, setCart] = useState([]);
  const [client, setClient] = useState(null);

  // طرق الدفع: cash / till / withdrawal
  const [payment, setPayment] = useState("cash");

  // خصم + نقاط + مستلم/باقي
  const [discount, setDiscount] = useState(0);
  const [received, setReceived] = useState(0);

  const [q, setQ] = useState("");

  async function load() {
    const p = await (await fetch(url("/api/products"))).json();
    setProducts(Array.isArray(p) ? p : []);
    const c = await (await fetch(url("/api/clients"))).json();
    const list = Array.isArray(c) ? c : Array.isArray(c?.rows) ? c.rows : Array.isArray(c?.data) ? c.data : [];
    setClients(list);
  }
  useEffect(() => {
    load().catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(s) ||
        String(p.barcode || "").includes(s)
    );
  }, [products, q]);

  const subtotal = useMemo(() => {
    return cart.reduce((s, i) => {
      const qty = Number(i.qty);
      const qn = Number.isFinite(qty) ? qty : 0;
      return s + Number(i.salePrice || 0) * qn;
    }, 0);
  }, [cart]);
  const total = useMemo(() => Math.max(0, subtotal - Number(discount || 0)), [subtotal, discount]);
  const change = useMemo(
    () => (payment === "cash" ? Math.max(0, Number(received || 0) - total) : 0),
    [payment, received, total]
  );

  const autoPoints = useMemo(() => {
    if (!client) return 0;
    return Math.floor(Number(total || 0) / 100);
  }, [client, total]);

  function addToCart(p) {
    setCart((prev) => {
      const ex = prev.find((x) => String(x.barcode) === String(p.barcode));
      // إذا المنتج موجود بالفعل، نزيد الكمية (لو كانت فارغة تعتبر 0)
      if (ex) {
        const cur = Number(ex.qty);
        const curN = Number.isFinite(cur) ? cur : 0;
        return prev.map((x) => (x === ex ? { ...x, qty: String(curN + 1) } : x));
      }
      // أول مرة: لا نضع 1 افتراضياً (المستخدم هو من يكتب الكمية)
      return [...prev, { ...p, qty: "" }];
    });
  }
  function remove(it) {
    setCart((c) => c.filter((x) => x !== it));
  }

  async function confirmPurchase() {
    if (!cart.length) {
      alert("Cart is empty");
      return;
    }

    // ✅ لا يسمح بإتمام البيع لو الكميات غير مُدخلة / غير صحيحة
    const invalid = cart.find((i) => {
      const qn = Number(i.qty);
      return !Number.isFinite(qn) || qn <= 0;
    });
    if (invalid) {
      alert("Please enter a valid quantity for all items");
      return;
    }

    if (payment === "cash" && Number(received || 0) < total) {
      alert("Received is less than total");
      return;
    }

    const items = cart.map((i) => ({
      barcode: i.barcode,
      name: i.name,
      qty: Number(i.qty),
      price: Number(i.salePrice || 0),
      cost: Number(i.cost || 0),
    }));

    const payload = {
      // سيتم توليد رقم الفاتورة تلقائياً في الـ Backend
      clientName: client?.name || "",
      clientPhone: client?.phone || "",
      paymentMethod: payment,
      items,
      subtotal,
      discount: Number(discount || 0),
      total,
      profit: items.reduce((s, i) => s + (Number(i.price) - Number(i.cost)) * Number(i.qty), 0),
      addPoints: Number(autoPoints || 0),
      received: payment === "cash" ? Number(received || 0) : 0,
      change: payment === "cash" ? change : 0,
    };

    try {
      const res = await fetch(url("/api/sales/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const out = await res.json().catch(() => ({}));
      const inv = out?.invoiceNo || out?.invoiceNumber || out?.invoice || "";
      alert([
        "Sale completed ✅",
        inv ? `Invoice: ${inv}` : null,
        `Client: ${payload.clientName || "—"}`,
        `Items: ${items.length}`,
        `Total: ${K(total)}`,
        client ? `Points added: ${autoPoints}` : null,
      ].filter(Boolean).join("\n"));
      setCart([]);
      setDiscount(0);
      setReceived(0);
      setClient(null);
    } catch (e) {
      alert("Failed to confirm purchase:\n" + e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">POS</div>
          <div className="ui-sub mt-1">Search products, build cart, and complete sale.</div>
        </div>
        <div className="ui-badge">Payment: <b className="ml-1">{payment}</b></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products */}
        <div className="lg:col-span-7 space-y-4">
          <Section
            title="Products"
            subtitle={`${filtered.length} items`}
            actions={
              <input
                className="ui-input !w-[320px]"
                placeholder="Search by name or barcode..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            }
          >
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {filtered.map((p) => (
                <ProductCard key={p.barcode} p={p} onAdd={() => addToCart(p)} />
              ))}
              {!filtered.length && <div className="text-sm text-mute">No products</div>}
            </div>
          </Section>
        </div>

        {/* Cart + Checkout */}
        <div className="lg:col-span-5 space-y-4">
          <Section title="Cart" subtitle={`${cart.length} lines`}
            actions={cart.length ? (
              <button className="ui-btn ui-btn-ghost" onClick={() => setCart([])} type="button">
                Clear
              </button>
            ) : null}
          >
            <div className="space-y-3">
              {cart.map((it, idx) => (
                <div key={idx} className="ui-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate">{it.name}</div>
                      <div className="text-xs text-mute">#{it.barcode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-ink">{K(Number(it.salePrice || 0) * Number(it.qty || 0))}</div>
                      <button className="ui-btn ui-btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => remove(it)} type="button">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <QtyControl
                      value={it.qty}
                      onChange={(raw) => {
                        // raw قد تكون "" (فارغة) — نحتفظ بها كما هي
                        const v = raw;
                        setCart((list) => list.map((x) => (x === it ? { ...x, qty: v } : x)));
                      }}
                    />
                    <div className="ui-badge">Unit: {K(it.salePrice)}</div>
                  </div>
                </div>
              ))}
              {!cart.length && <div className="text-sm text-mute">Cart is empty</div>}
            </div>
          </Section>

          <Section title="Checkout" subtitle="Discount, payment, client, and final total">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="ui-card p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-mute">Subtotal</div>
                  <div className="mt-1 text-xl font-extrabold text-ink">{K(subtotal)}</div>
                </div>
                <div className="ui-card p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-mute">Total</div>
                  <div className="mt-1 text-xl font-extrabold text-ink">{K(total)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="ui-label">Discount (amount)</span>
                  <input
                    type="number"
                    min="0"
                    className="ui-input mt-1"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value || 0))}
                  />
                </label>
                <label className="block">
                  <span className="ui-label">Payment</span>
                  <select className="ui-select mt-1" value={payment} onChange={(e) => setPayment(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="till">Till</option>
                    <option value="withdrawal">Withdrawal</option>
                  </select>
                </label>
              </div>

              {payment === "cash" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="ui-label">Received</span>
                    <input
                      type="number"
                      min="0"
                      className="ui-input mt-1"
                      value={received}
                      onChange={(e) => setReceived(Number(e.target.value || 0))}
                    />
                  </label>
                  <Card title="Change" value={K(change)} subtitle="Cash only" />
                </div>
              )}

              <div className="ui-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-mute">Loyalty Points</div>
                    <div className="mt-1 text-sm text-mute">
                      {client ? "Auto: 1 point لكل 100" : "Select client for points"}
                    </div>
                  </div>
                  <div className="ui-badge-gold !text-base">{client ? autoPoints : 0}</div>
                </div>
              </div>

              {/* Client pick */}
              <div className="ui-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="ui-h2">Client</div>
                    <div className="ui-sub mt-0.5">Optional — select client for points</div>
                  </div>
                  <button className="ui-btn ui-btn-ghost" type="button" onClick={() => setClient(null)}>
                    Clear
                  </button>
                </div>

                <div className="mt-3 max-h-56 overflow-auto space-y-2">
                  {clients.map((c) => (
                    <button
                      key={c.phone}
                      type="button"
                      className={`w-full ui-card p-3 text-left hover:bg-slate-50/60 transition ${
                        client?.phone === c.phone ? "ring-4 ring-[rgba(197,122,42,0.16)] border-[rgba(197,122,42,0.35)]" : ""
                      }`}
                      onClick={() => setClient(c)}
                    >
                      <div className="font-bold text-ink">{c.name}</div>
                      <div className="text-xs text-mute">+{c.phone}</div>
                    </button>
                  ))}
                  {!clients.length && <div className="text-sm text-mute">No clients</div>}
                </div>
              </div>

              <button className="ui-btn ui-btn-primary w-full" onClick={confirmPurchase} type="button">
                Complete Sale
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
