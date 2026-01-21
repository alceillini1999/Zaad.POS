import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import Card from "../components/Card";
import Table from "../components/Table";

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

async function api(p, opts = {}) {
  // Avoid stale data across devices (browser/proxy caching)
  const res = await fetch(url(p), { mode: "cors", credentials: "include", cache: "no-store", ...opts });
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url(p)}\n${body}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}

const K = (n) =>
  `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

// helpers
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

// IMPORTANT:
// Use *local* calendar date (NOT UTC). Using toISOString().slice(0,10) can shift the day depending on timezone.
const toLocalYMD = (d) => {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseYMDLocal = (s) => {
  const [y, m, d] = String(s || "")
    .split("-")
    .map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const fmtD = (d) => toLocalYMD(d);

function getToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

async function fetchJsonWithTimeout(input, init = {}, timeoutMs = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

function normPM(r) {
  const raw = String(r?.paymentMethod ?? r?.payment ?? r?.method ?? "").trim().toLowerCase();
  const s = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (s === "send money" || s === "sendmoney" || s === "send") return "send_money";
  if (s === "withdrawel") return "withdrawal"; // common misspelling
  return s;
}

function srcLabel(src) {
  switch (src) {
    case "cash":
      return "Cash";
    case "till":
      return "Till";
    case "withdrawal":
      return "Withdrawal";
    case "send_money":
      return "Send Money";
    default:
      return String(src || "—");
  }
}

export default function SummeryPage() {
  const today = toLocalYMD(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Cashier opening values (range)
  // Map: { [dateYMD]: { found, row } }
  const [openMap, setOpenMap] = useState({});
  const [openInfoStatus, setOpenInfoStatus] = useState("idle"); // idle | loading | ok | timeout | error

  // Manual withdrawals with details (range)
  const [withdrawals, setWithdrawals] = useState([]);
  const [wAmount, setWAmount] = useState("");
  const [wSource, setWSource] = useState("cash");
  const [wReason, setWReason] = useState("");
  const [wDate, setWDate] = useState(today);
  // Manual withdrawals are stored in Google Sheets (shared across devices)

  const dateKeysInRange = useMemo(() => {
    const keys = [];
    const a = startOfDay(parseYMDLocal(fromDate));
    const b = startOfDay(parseYMDLocal(toDate));
    const from = a <= b ? a : b;
    const to = a <= b ? b : a;
    const cur = new Date(from);
    while (cur <= to) {
      keys.push(fmtD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }, [fromDate, toDate]);

  useEffect(() => {
    (async () => {
      try {
        const s = await (
          await fetch(url("/api/sales?page=1&limit=5000"), { credentials: "include" })
        ).json();
        const sRows = Array.isArray(s) ? s : Array.isArray(s?.rows) ? s.rows : [];
        setSales(sRows);

        const e = await (
          await fetch(url("/api/expenses"), { credentials: "include" })
        ).json();
        setExpenses(Array.isArray(e) ? e : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const dFrom = useMemo(() => startOfDay(parseYMDLocal(fromDate)), [fromDate]);
  const dTo = useMemo(() => endOfDay(parseYMDLocal(toDate)), [toDate]);
  const isSingleDay = useMemo(() => dateKeysInRange.length === 1, [dateKeysInRange]);

  // Load manual withdrawals for selected range (shared via Google Sheets)
  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString();
        const list = await api(`/api/manual-withdrawals?${qs}`);
        setWithdrawals(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load manual withdrawals:', e);
        setWithdrawals([]);
      }
    })();
  }, [fromDate, toDate]);

  // Load opening values from backend sheet for the selected range
  useEffect(() => {
    let cancelled = false;
    const token = getToken();

    (async () => {
      setOpenInfoStatus("loading");
      try {
        // Prevent overly heavy fan-out requests.
        const keys = dateKeysInRange.slice(0, 31);
        const pairs = await Promise.all(
          keys.map(async (k) => {
            try {
              const { res, data } = await fetchJsonWithTimeout(
                url(`/api/cash/today?date=${encodeURIComponent(k)}`),
                {
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  cache: "no-store",
                  credentials: "include",
                },
                2500
              );
              if (res.ok && data?.found && data?.row) {
                return [k, { found: true, row: data.row }];
              }
              return [k, { found: false, row: null }];
            } catch (e) {
              if (e?.name === "AbortError") return [k, { found: false, row: null, timeout: true }];
              return [k, { found: false, row: null, error: true }];
            }
          })
        );

        if (cancelled) return;
        const next = {};
        for (const [k, v] of pairs) next[k] = v;
        setOpenMap(next);
        setOpenInfoStatus("ok");
      } catch (e) {
        if (cancelled) return;
        if (e?.name === "AbortError") {
          setOpenInfoStatus("timeout");
          return;
        }
        setOpenInfoStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateKeysInRange]);

  // Keep withdrawal date aligned with selection
  useEffect(() => {
    setWDate(toDate);
  }, [toDate]);

  const totals = useMemo(() => {
    const inRange = (t) => {
      const d = new Date(t);
      return d >= dFrom && d <= dTo;
    };
    const salesInRange = sales.filter((s) => inRange(s.createdAt));
    const totalSales = salesInRange.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const totalExpenses = expenses.filter((e) => inRange(e.date)).reduce((s, r) => s + Number(r.amount || 0), 0);

    const cashSales = salesInRange.reduce((sum, r) => (normPM(r) === "cash" ? sum + Number(r.total || 0) : sum), 0);
    const tillSales = salesInRange.reduce((sum, r) => (normPM(r) === "till" ? sum + Number(r.total || 0) : sum), 0);
    const withdrawalSales = salesInRange.reduce(
      (sum, r) => (normPM(r) === "withdrawal" ? sum + Number(r.total || 0) : sum),
      0
    );
    const sendMoneySales = salesInRange.reduce(
      (sum, r) => (normPM(r) === "send_money" ? sum + Number(r.total || 0) : sum),
      0
    );

    return {
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      cashSales,
      tillSales,
      withdrawalSales,
      sendMoneySales,
      salesInRange,
    };
  }, [sales, expenses, dFrom, dTo]);

  const withdrawalManual = useMemo(() => {
    const sum = (src) =>
      withdrawals
        .filter((w) => w.source === src)
        .reduce((s, w) => s + Number(w.amount || 0), 0);
    const cash = sum("cash");
    const till = sum("till");
    const withdrawal = sum("withdrawal");
    const sendMoney = sum("send_money");
    return { cash, till, withdrawal, sendMoney, total: cash + till + withdrawal + sendMoney };
  }, [withdrawals]);

  const openings = useMemo(() => {
    // Sum openings across the selected range (best-effort).
    const keys = dateKeysInRange.slice(0, 31);
    let cash = 0;
    let till = 0;
    let withdrawal = 0;
    let sendMoney = 0;
    for (const k of keys) {
      const v = openMap?.[k];
      const row = v?.row;
      if (!v?.found || !row) continue;
      cash += Number(row.openingCashTotal || 0);
      till += Number(row.openingTillTotal || 0);
      withdrawal += Number(row.withdrawalCash ?? row.mpesaWithdrawal ?? 0);
      sendMoney += Number(row.sendMoney || 0);
    }
    return { cash, till, withdrawal, sendMoney };
  }, [dateKeysInRange, openMap]);

  // Expected available (Opening + Sales - Manual Withdrawals)
  const expectedAvailable = useMemo(() => {
    const cash = openings.cash + Number(totals.cashSales || 0) - Number(withdrawalManual.cash || 0);
    const till = openings.till + Number(totals.tillSales || 0) - Number(withdrawalManual.till || 0);
    const withdrawal = openings.withdrawal + Number(totals.withdrawalSales || 0) - Number(withdrawalManual.withdrawal || 0);
    const sendMoney = openings.sendMoney + Number(totals.sendMoneySales || 0) - Number(withdrawalManual.sendMoney || 0);
    return { cash, till, withdrawal, sendMoney, total: cash + till + withdrawal + sendMoney };
  }, [openings, totals, withdrawalManual]);

  const projectedRemaining = useMemo(() => {
    const n = Number(String(wAmount || "").replace(/,/g, ""));
    const dec = Number.isFinite(n) && n > 0 ? n : 0;
    const next = {
      cash: expectedAvailable.cash,
      till: expectedAvailable.till,
      withdrawal: expectedAvailable.withdrawal,
      sendMoney: expectedAvailable.sendMoney,
    };
    if (wSource === "cash") next.cash -= dec;
    if (wSource === "till") next.till -= dec;
    if (wSource === "withdrawal") next.withdrawal -= dec;
    if (wSource === "send_money") next.sendMoney -= dec;

    // avoid showing negative balances
    next.cash = Math.max(0, next.cash);
    next.till = Math.max(0, next.till);
    next.withdrawal = Math.max(0, next.withdrawal);
    next.sendMoney = Math.max(0, next.sendMoney);
    return {
      ...next,
      total: next.cash + next.till + next.withdrawal + next.sendMoney,
    };
  }, [expectedAvailable, wAmount, wSource]);

  const addWithdrawal = async () => {
    const k = String(wDate || today).trim(); // YYYY-MM-DD
    const source = String(wSource || '').trim();
    const amount = Number(wAmount || 0);

    if (!source) return alert('Select source');
    if (!amount || amount <= 0) return alert('Enter amount');

    try {
      await api('/api/manual-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: k,
          source,
          amount,
          note: wReason || '',
          createdBy: localStorage.getItem('user') || ''
        }),
      });
      const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString();
      const list = await api(`/api/manual-withdrawals?${qs}`);
      setWithdrawals(Array.isArray(list) ? list : []);
    } catch (e) {
      alert(e.message || String(e));
    }

    setWAmount('');
    setWReason('');
  };

  const removeWithdrawal = async (id) => {
    try {
      await api(`/api/manual-withdrawals/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
      const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString();
      const list = await api(`/api/manual-withdrawals?${qs}`);
      setWithdrawals(Array.isArray(list) ? list : []);
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  const withdrawalColumns = [
    { key: "date", header: "Date", render: (r) => r.date || "—" },
    {
      key: "createdAt",
      header: "Time",
      render: (r) => new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
    { key: "source", header: "Source", render: (r) => srcLabel(r.source) },
    { key: "amount", header: "Amount", render: (r) => K(r.amount) },
    { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button className="ui-btn ui-btn-ghost !px-3" onClick={() => removeWithdrawal(r.id)} type="button">
          Remove
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">Summary</div>
          <div className="ui-sub mt-1">Totals and manual withdrawals</div>
        </div>
        <div className="ui-badge">
          Range: <b className="ml-1">{fromDate}</b> → <b>{toDate}</b>
        </div>
      </div>

      {/* Date range */}
      <Section title="Date Range" subtitle="Choose From / To">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="ui-label">From</span>
            <input className="ui-input mt-1" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="ui-label">To</span>
            <input className="ui-input mt-1" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <div className="ui-card p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-mute">Mode</div>
            <div className="mt-1 font-extrabold text-ink">{isSingleDay ? "Single Day" : "Range"}</div>
            <div className="ui-sub mt-1">
              Manual withdrawals work for any selected range. When adding a withdrawal, choose its date.
            </div>
          </div>
        </div>
      </Section>

      {/* Totals */}
      <Section title="Totals" subtitle="Sales / Expenses / Net">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card title="Total Sales" value={K(totals.totalSales)} />
          <Card title="Total Expenses" value={K(totals.totalExpenses)} />
          <Card title="Net Profit" value={K(totals.netProfit)} />
        </div>
      </Section>

      {/* Sales by payment method */}
      <Section title="Sales by Payment Method" subtitle="Computed from POS sales within the selected range">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Cash" value={K(totals.cashSales)} />
          <Card title="Till" value={K(totals.tillSales)} />
          <Card title="Withdrawal" value={K(totals.withdrawalSales)} />
          <Card title="Send Money" value={K(totals.sendMoneySales)} />
        </div>
      </Section>

      {/* Manual withdrawals */}
      <Section title="Manual Withdrawals" subtitle="Money taken out during the day (record the source)" >
        {(openInfoStatus === "timeout" || openInfoStatus === "error") && (
          <div className="ui-card p-4 text-sm text-mute">
            <b>Note:</b> Could not load opening values from the server ({openInfoStatus}). Expected balances may show 0 for opening amounts.
          </div>
        )}

        {dateKeysInRange.length > 31 && (
          <div className="ui-card p-4 text-sm text-mute">
            <b>Note:</b> Opening values are loaded for the first <b>31</b> days only to avoid slow requests. Sales and manual withdrawals still cover the full range.
          </div>
        )}

        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Expected Available (Cash)" value={K(expectedAvailable.cash)} subtitle="Openings + Sales - Manual" />
          <Card title="Expected Available (Till)" value={K(expectedAvailable.till)} subtitle="Openings + Sales - Manual" />
          <Card title="Expected Available (Withdrawal)" value={K(expectedAvailable.withdrawal)} subtitle="Openings + Sales - Manual" />
          <Card title="Expected Available (Send Money)" value={K(expectedAvailable.sendMoney)} subtitle="Openings + Sales - Manual" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="ui-badge">Total Expected: <b className="ml-1">{K(expectedAvailable.total)}</b></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="block">
            <span className="ui-label">Date</span>
            <input className="ui-input mt-1" type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="ui-label">Amount</span>
            <input className="ui-input mt-1" value={wAmount} onChange={(e) => setWAmount(e.target.value)} inputMode="numeric" placeholder="0" />
          </label>
          <label className="block">
            <span className="ui-label">Source</span>
            <select className="ui-select mt-1" value={wSource} onChange={(e) => setWSource(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="till">Till</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="send_money">Send Money</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="ui-label">Reason</span>
            <input className="ui-input mt-1" value={wReason} onChange={(e) => setWReason(e.target.value)} placeholder="e.g. supplier payment" />
          </label>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Remaining After Entry (Cash)" value={K(projectedRemaining.cash)} subtitle="If you add this withdrawal" />
          <Card title="Remaining After Entry (Till)" value={K(projectedRemaining.till)} subtitle="If you add this withdrawal" />
          <Card title="Remaining After Entry (Withdrawal)" value={K(projectedRemaining.withdrawal)} subtitle="If you add this withdrawal" />
          <Card title="Remaining After Entry (Send Money)" value={K(projectedRemaining.sendMoney)} subtitle="If you add this withdrawal" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="ui-badge">Total Remaining: <b className="ml-1">{K(projectedRemaining.total)}</b></div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="ui-btn ui-btn-primary" onClick={addWithdrawal} type="button">
            Add Withdrawal
          </button>
          <div className="ui-badge">Total: <b className="ml-1">{K(withdrawalManual.total)}</b></div>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Withdrawals (Cash)" value={K(withdrawalManual.cash)} />
          <Card title="Withdrawals (Till)" value={K(withdrawalManual.till)} />
          <Card title="Withdrawals (Withdrawal)" value={K(withdrawalManual.withdrawal)} />
          <Card title="Withdrawals (Send Money)" value={K(withdrawalManual.sendMoney)} />
        </div>

        <div className="mt-4">
          <Table columns={withdrawalColumns} data={withdrawals} keyField="id" emptyText="No manual withdrawals" />
        </div>
      </Section>

    </div>
  );
}