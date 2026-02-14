import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function normalizePhone(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/\s+/g, "");
  // Common KE formats: 07XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
  if (/^0\d{9}$/.test(s)) return `+254${s.slice(1)}`;
  if (/^254\d{9}$/.test(s)) return `+${s}`;
  if (/^\+254\d{9}$/.test(s)) return s;
  if (s.startsWith("+")) return s;
  return s;
}

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

function QtyControl({ value, onChange, onInc, onDec }) {
  return (
    <div className="flex items-center gap-2">
      <button className="ui-btn ui-btn-ghost !px-3" onClick={onDec} type="button">
        -
      </button>
      <input
        className="ui-input !w-[70px] text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button className="ui-btn ui-btn-ghost !px-3" onClick={onInc} type="button">
        +
      </button>
    </div>
  );
}

export default function POSPage() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [cart, setCart] = useState([]);
  const [clientPhone, setClientPhone] = useState("");

  // Sale type: pay now OR delivery (pay later)
  const [saleType, setSaleType] = useState("now"); // 'now' | 'delivery'
  const [deliveryNote, setDeliveryNote] = useState("");

  // طرق الدفع: cash / till / withdrawal
  const [payment, setPayment] = useState("cash");

  // خصم + مستلم/باقي
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

  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + Number(i.salePrice || 0) * Number(i.qty || 0), 0),
    [cart]
  );
  const total = useMemo(() => Math.max(0, subtotal - Number(discount || 0)), [subtotal, discount]);
  const change = useMemo(
    () => (payment === "cash" ? Math.max(0, Number(received || 0) - total) : 0),
    [payment, received, total]
  );

  function addToCart(p) {
    setCart((prev) => {
      const ex = prev.find((x) => String(x.barcode) === String(p.barcode));
      if (ex) return prev.map((x) => (x === ex ? { ...x, qty: (x.qty || 0) + 1 } : x));
      return [...prev, { ...p, qty: 1 }];
    });
  }
  function inc(it) {
    setCart((c) => c.map((x) => (x === it ? { ...x, qty: (x.qty || 0) + 1 } : x)));
  }
  function dec(it) {
    setCart((c) => c.map((x) => (x === it ? { ...x, qty: Math.max(1, (x.qty || 0) - 1) } : x)));
  }
  function remove(it) {
    setCart((c) => c.filter((x) => x !== it));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openInvoiceWindow() {
    // Open immediately on the user gesture to avoid popup blockers.
    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) return null;

    // Show a lightweight loading state so the user isn't left with a blank window.
    try {
      w.document.open();
      w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Invoice</title></head><body style="font-family:Arial,sans-serif;padding:14px;">Preparing invoice…</body></html>`);
      w.document.close();
    } catch (e) {
      // ignore
    }
    return w;
  }

  function renderAndPrintInvoice(w, inv) {
    if (!w) {
      alert("Popup blocked. Please allow popups to print the invoice.");
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleString();

    const itemsRows = (inv.items || [])
      .map((it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const line = qty * price;
        return `
          <tr>
            <td class="name">${escapeHtml(it.name)}</td>
            <td class="qty">${qty}</td>
            <td class="price">${price.toFixed(0)}</td>
            <td class="line">${line.toFixed(0)}</td>
          </tr>
        `;
      })
      .join("");

    const subtotalV = Number(inv.subtotal || 0);
    const discountV = Number(inv.discount || 0);
    const totalV = Number(inv.total || 0);
    const receivedV = Number(inv.received || 0);
    const changeV = Number(inv.change || 0);
    const paymentMethod = String(inv.paymentMethod || "");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invoice ${escapeHtml(inv.invoiceNo)}</title>
          <style>
            :root { --ink:#111; --mute:#666; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--ink); }
            .wrap { padding: 14px; }
            .center { text-align: center; }
            .brand { font-weight: 800; font-size: 18px; letter-spacing: .2px; }
            .sub { color: var(--mute); font-size: 12px; margin-top: 2px; }
            .meta { margin-top: 10px; font-size: 12px; }
            .meta div { display:flex; justify-content:space-between; gap: 10px; margin: 2px 0; }
            .hr { border-top: 1px dashed #bbb; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { text-align: left; color: var(--mute); font-weight: 700; padding: 6px 0; border-bottom: 1px solid #eee; }
            td { padding: 6px 0; border-bottom: 1px solid #f2f2f2; vertical-align: top; }
            td.qty, td.price, td.line { text-align: right; white-space: nowrap; }
            .totals { margin-top: 10px; font-size: 12px; }
            .totals div { display:flex; justify-content:space-between; gap: 10px; margin: 3px 0; }
            .totals .grand { font-size: 14px; font-weight: 800; }
            .footer { margin-top: 12px; color: var(--mute); font-size: 12px; text-align: center; }

            @media print {
              @page { margin: 8mm; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="center">
              <div class="brand">Zaad Bakery</div>
              <div class="sub">POS Invoice</div>
            </div>

            <div class="meta">
              <div><span>Invoice</span><span>${escapeHtml(inv.invoiceNo)}</span></div>
              <div><span>Date</span><span>${escapeHtml(dateStr)}</span></div>
              <div><span>Client</span><span>${escapeHtml(inv.clientPhone || "—")}</span></div>
              <div><span>Payment</span><span>${escapeHtml(paymentMethod)}</span></div>
            </div>

            <div class="hr"></div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows || "<tr><td colspan='4'>No items</td></tr>"}
              </tbody>
            </table>

            <div class="hr"></div>

            <div class="totals">
              <div><span>Subtotal</span><span>KSh ${subtotalV.toFixed(0)}</span></div>
              <div><span>Discount</span><span>- KSh ${discountV.toFixed(0)}</span></div>
              <div class="grand"><span>Total</span><span>KSh ${totalV.toFixed(0)}</span></div>
              ${paymentMethod === "cash" ? `<div><span>Received</span><span>KSh ${receivedV.toFixed(0)}</span></div>` : ""}
              ${paymentMethod === "cash" ? `<div><span>Change</span><span>KSh ${changeV.toFixed(0)}</span></div>` : ""}
            </div>

            <div class="footer">Thank you!</div>
            <div class="no-print" style="margin-top:10px; text-align:center;">
              <button onclick="window.print()" style="padding:8px 14px;">Print</button>
            </div>
          </div>

          <script>
            // Auto-print then close
            window.onload = () => {
              try { window.focus(); } catch (e) {}
              setTimeout(() => {
                try { window.print(); } catch (e) {}
                setTimeout(() => {
                  try { window.close(); } catch (e) {}
                }, 350);
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    try {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      // If anything goes wrong, at least show the error in the popup.
      try {
        w.document.open();
        w.document.write(
          `<!doctype html><html><head><meta charset="utf-8" /><title>Invoice Error</title></head><body style="font-family:Arial,sans-serif;padding:14px;">Failed to render invoice.<br/><pre>${escapeHtml(
            e?.message || String(e)
          )}</pre></body></html>`
        );
        w.document.close();
      } catch (_) {
        // ignore
      }
    }
  }

  async function confirmPurchase() {
    // Open invoice window immediately on click so it won't be blocked.
    const invoiceWin = openInvoiceWindow();

    if (!cart.length) {
      alert("Cart is empty");
      try { invoiceWin?.close(); } catch (e) {}
      return;
    }
    if (saleType === "now" && payment === "cash" && Number(received || 0) < total) {
      alert("Received is less than total");
      try { invoiceWin?.close(); } catch (e) {}
      return;
    }

    const items = cart.map((i) => ({
      barcode: i.barcode,
      name: i.name,
      qty: Number(i.qty || 0),
      price: Number(i.salePrice || 0),
      cost: Number(i.cost || 0),
    }));

    const normalizedPhone = normalizePhone(clientPhone);
    const pointsEarned = normalizedPhone ? Math.floor(Number(total || 0) / 100) : 0;

    const payload = {
      invoiceNo: `${Date.now()}`,
      clientName: "",
      clientPhone: normalizedPhone,
      paymentMethod: payment,
      items,
      subtotal,
      discount: Number(discount || 0),
      total,
      profit: items.reduce((s, i) => s + (Number(i.price) - Number(i.cost)) * Number(i.qty), 0),
      pointsEarned,
      received: saleType === "now" && payment === "cash" ? Number(received || 0) : 0,
      change: saleType === "now" && payment === "cash" ? change : 0,
    };

    try {
      if (saleType === "delivery") {
        // Create unpaid delivery order
        const res = await fetch(url("/api/delivery"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNo: payload.invoiceNo,
            clientName: payload.clientName,
            clientPhone: payload.clientPhone,
            items: payload.items,
            total: payload.total,
            profit: payload.profit,
            note: String(deliveryNote || ""),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        alert(["Delivery order created ✅", `Phone: ${normalizedPhone || "—"}`, `Items: ${items.length}`, `Total: ${K(total)}`].join("\n"));
        setCart([]);
        setDiscount(0);
        setReceived(0);
        setClientPhone("");
        setDeliveryNote("");
        nav("/delivery");
        try { invoiceWin?.close(); } catch (e) {}
        return;
      }

      // Normal sale (pay now)
      const res = await fetch(url("/api/sales/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      // Print invoice immediately after successful payment.
      renderAndPrintInvoice(invoiceWin, payload);

      alert(["Sale completed ✅", `Phone: ${normalizedPhone || "—"}`, `Points: ${pointsEarned}`, `Items: ${items.length}`, `Total: ${K(total)}`].join("\n"));
      setCart([]);
      setDiscount(0);
      setReceived(0);
      setClientPhone("");
    } catch (e) {
      alert("Failed to confirm purchase:\n" + (e?.message || e));
      try { invoiceWin?.close(); } catch (err) {}
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">POS</div>
          <div className="ui-sub mt-1">Search products, build cart, and complete sale.</div>
        </div>
        <div className="ui-badge">
          Type: <b className="ml-1">{saleType === "delivery" ? "Delivery" : "Pay now"}</b>
        </div>
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
                      onInc={() => inc(it)}
                      onDec={() => dec(it)}
                      onChange={(raw) => {
                        const v = Math.max(1, Number(raw || 1));
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
                <div className="ui-card p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-mute">Sale Type</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={
                        "ui-btn flex-1 " +
                        (saleType === "now" ? "ui-btn-primary" : "ui-btn-ghost")
                      }
                      onClick={() => setSaleType("now")}
                    >
                      Pay Now
                    </button>
                    <button
                      type="button"
                      className={
                        "ui-btn flex-1 " +
                        (saleType === "delivery" ? "ui-btn-primary" : "ui-btn-ghost")
                      }
                      onClick={() => setSaleType("delivery")}
                    >
                      Delivery
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-mute">
                    Delivery orders are unpaid. Mark as paid later in <b>Delivery</b> page.
                  </div>
                </div>

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
              </div>

              {saleType === "now" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="ui-label">Payment</span>
                    <select className="ui-select mt-1" value={payment} onChange={(e) => setPayment(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="till">Till</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="send_money">Send Money</option>
                    </select>
                  </label>

                  {payment === "cash" ? (
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
                  ) : (
                    <div className="ui-card p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-mute">Received</div>
                      <div className="mt-2 text-sm text-mute">Not required for non-cash methods</div>
                    </div>
                  )}
                </div>
              )}

              {saleType === "delivery" && (
                <label className="block">
                  <span className="ui-label">Delivery Note (optional)</span>
                  <input
                    className="ui-input mt-1"
                    placeholder="Address / rider / phone details…"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                  />
                </label>
              )}

              {saleType === "now" && payment === "cash" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card title="Change" value={K(change)} subtitle="Cash only" />
                </div>
              )}

              {/* Loyalty: phone input (no client selection) */}
              <div className="ui-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="ui-h2">Client Phone</div>
                    <div className="ui-sub mt-0.5">Enter phone to auto-add points (1 point per 100 KSh)</div>
                  </div>
                  <button
                    className="ui-btn ui-btn-ghost"
                    type="button"
                    onClick={() => {
                      const p = normalizePhone(clientPhone);
                      nav(p ? `/clients?phone=${encodeURIComponent(p)}` : "/clients");
                    }}
                  >
                    Open Clients
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="ui-label">Phone</span>
                    <input
                      className="ui-input mt-1"
                      placeholder="07XXXXXXXX or +2547XXXXXXXX"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const p = normalizePhone(clientPhone);
                          nav(p ? `/clients?phone=${encodeURIComponent(p)}` : "/clients");
                        }
                      }}
                    />
                    <div className="mt-1 text-xs text-mute">Tip: press Enter to jump to Clients.</div>
                  </label>

                  <div className="ui-card p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-mute">Points Earned</div>
                    <div className="mt-2 text-lg font-extrabold text-ink">
                      {normalizePhone(clientPhone) ? Math.floor(Number(total || 0) / 100) : 0}
                    </div>
                    <div className="mt-1 text-xs text-mute">Added on payment confirmation (and accumulated).</div>
                  </div>
                </div>
              </div>

              <button className="ui-btn ui-btn-primary w-full" onClick={confirmPurchase} type="button">
                {saleType === "delivery" ? "Send to Delivery" : "Complete Sale"}
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
