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
const fmtD = (d) => new Date(d).toISOString().slice(0, 10);

function getToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
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

export default function SummeryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Manual withdrawals with details (single day)
  const [withdrawals, setWithdrawals] = useState([]);
  const [wAmount, setWAmount] = useState("");
  const [wSource, setWSource] = useState("cash");
  const [wReason, setWReason] = useState("");

  const [openInfo, setOpenInfo] = useState(null);
  const [openInfoStatus, setOpenInfoStatus] = useState("idle"); // idle | loading | ok | timeout | error

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

  const dFrom = useMemo(() => startOfDay(new Date(fromDate)), [fromDate]);
  const dTo = useMemo(() => endOfDay(new Date(toDate)), [toDate]);
  const isSingleDay = useMemo(() => sameDay(dFrom, dTo), [dFrom, dTo]);
  const dayKey = useMemo(() => fmtD(dFrom), [dFrom]);

  // Load manual withdrawals for selected single day (local only)
  const lsKey = (prefix, dateKey) => `${prefix}:${dateKey}`;
  useEffect(() => {
    if (!isSingleDay) {
      setWithdrawals([]);
      return;
    }
    try {
      const raw = localStorage.getItem(lsKey("withdrawals", dayKey));
      const list = raw ? JSON.parse(raw) : [];
      setWithdrawals(Array.isArray(list) ? list : []);
    } catch {
      setWithdrawals([]);
    }
  }, [isSingleDay, dayKey]);

  useEffect(() => {
    if (!isSingleDay) return;
    try {
      localStorage.setItem(lsKey("withdrawals", dayKey), JSON.stringify(withdrawals || []));
    } catch {}
  }, [withdrawals, isSingleDay, dayKey]);

  // Load opening values from Cash page / backend sheet (single day)
  useEffect(() => {
    if (!isSingleDay) {
      setOpenInfo(null);
      setOpenInfoStatus("idle");
      return;
    }

    let cancelled = false;
    const token = getToken();

    // Immediate best-effort from localStorage dayOpen (often today)
    try {
      const raw = localStorage.getItem("dayOpen");
      const d = raw ? JSON.parse(raw) : null;
      if (d && String(d.date) === String(dayKey)) {
        setOpenInfo({
          found: true,
          date: dayKey,
          openId: d.openId || "",
          openedAt: d.openedAt || "",
          tillNo: d.tillNo || "",
          openingCashTotal: Number(d.openingCashTotal || 0),
          openingTillTotal: Number(d.openingTillTotal || 0),
          withdrawalCash: Number(d.withdrawalCash ?? d.mpesaWithdrawal ?? 0),
          sendMoney: Number(d.sendMoney || 0),
        });
      }
    } catch {}

    (async () => {
      setOpenInfoStatus("loading");
      try {
        const { res, data } = await fetchJsonWithTimeout(
          `/api/cash/today?date=${encodeURIComponent(dayKey)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: "no-store",
          },
          2500
        );

        if (cancelled) return;

        if (res.ok && data?.found && data?.row) {
          const row = data.row;
          setOpenInfo({
            found: true,
            date: dayKey,
            openId: row.openId || row.openID || "",
            openedAt: row.openedAt || "",
            tillNo: String(row.tillNo || ""),
            openingCashTotal: Number(row.openingCashTotal || 0),
            openingTillTotal: Number(row.openingTillTotal || 0),
            withdrawalCash: Number(row.withdrawalCash ?? row.mpesaWithdrawal ?? 0),
            sendMoney: Number(row.sendMoney || 0),
          });
          setOpenInfoStatus("ok");
          return;
        }

        setOpenInfo(null);
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
  }, [isSingleDay, dayKey]);

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
    if (!isSingleDay || !openInfo?.found) {
      return { cash: 0, till: 0, withdrawal: 0, sendMoney: 0 };
    }
    return {
      cash: Number(openInfo.openingCashTotal || 0),
      till: Number(openInfo.openingTillTotal || 0),
      withdrawal: Number(openInfo.withdrawalCash || 0),
      sendMoney: Number(openInfo.sendMoney || 0),
    };
  }, [isSingleDay, openInfo]);

  const cashierBalances = useMemo(() => {
    if (!isSingleDay) {
      return { cash: 0, till: 0, withdrawal: 0, sendMoney: 0, total: 0 };
    }

    const cash = openings.cash + Number(totals.cashSales || 0) - Number(withdrawalManual.cash || 0);
    const till = openings.till + Number(totals.tillSales || 0) - Number(withdrawalManual.till || 0);
    const withdrawal = openings.withdrawal + Number(totals.withdrawalSales || 0) - Number(withdrawalManual.withdrawal || 0);
    const sendMoney = openings.sendMoney + Number(totals.sendMoneySales || 0) - Number(withdrawalManual.sendMoney || 0);

    return { cash, till, withdrawal, sendMoney, total: cash + till + withdrawal + sendMoney };
  }, [isSingleDay, openings, totals, withdrawalManual]);

  // POS withdrawals details (paymentMethod=withdrawal)
  const posWithdrawals = useMemo(
    () => totals.salesInRange.filter((r) => normPM(r) === "withdrawal"),
    [totals.salesInRange]
  );

  const addWithdrawal = () => {
    const n = Number(String(wAmount || "").replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      amount: n,
      source: wSource,
      reason: wReason || "",
    };
    setWithdrawals((prev) => [entry, ...(prev || [])]);
    setWAmount("");
    setWReason("");
  };

  const removeWithdrawal = (id) => {
    setWithdrawals((prev) => (prev || []).filter((w) => w.id !== id));
  };

  const withdrawalColumns = [
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

  const posWithdrawalColumns = [
    { key: "createdAt", header: "Date", render: (r) => fmtD(r.createdAt) },
    { key: "invoiceNo", header: "Invoice" },
    { key: "clientName", header: "Client" },
    { key: "total", header: "Total", render: (r) => K(r.total) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">Summary</div>
          <div className="ui-sub mt-1">Cashier + totals + withdrawals with details</div>
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
              To manage cashier (opening + expected + manual withdrawals), set <b>From = To</b>.
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

      {/* Cashier */}
      <Section title="Cashier" subtitle="Opening values are read from Cash page. Expected = Opening + Sales - Manual Withdrawals">
        {!isSingleDay && (
          <div className="ui-card p-4 text-sm text-mute">Set From = To to manage cashier balances.</div>
        )}

        {isSingleDay && (
          <>
            {(openInfoStatus === "timeout" || openInfoStatus === "error") && (
              <div className="ui-card p-4 text-sm">
                <b>Note:</b> Could not load opening values from the server ({openInfoStatus}). If your backend is on a free plan it may be sleeping.
              </div>
            )}

            {!openInfo?.found && openInfoStatus === "ok" && (
              <div className="ui-card p-4 text-sm">
                <b>No Start Day found</b> for {dayKey}. Open the day from the <b>Cash</b> page first.
              </div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
              <Card title="Opening Cash" value={K(openings.cash)} subtitle={openInfo?.found ? "From Cash page" : "—"} />
              <Card title="Opening Till" value={K(openings.till)} subtitle={openInfo?.found ? "From Cash page" : "—"} />
              <Card title="Opening Withdrawal" value={K(openings.withdrawal)} subtitle={openInfo?.found ? "From Cash page" : "—"} />
              <Card title="Opening Send Money" value={K(openings.sendMoney)} subtitle={openInfo?.found ? "From Cash page" : "—"} />
            </div>

            <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-5">
              <Card title="Expected Cash" value={K(cashierBalances.cash)} subtitle={`- Withdrawals: ${K(withdrawalManual.cash)}`} />
              <Card title="Expected Till" value={K(cashierBalances.till)} subtitle={`- Withdrawals: ${K(withdrawalManual.till)}`} />
              <Card title="Expected Withdrawal" value={K(cashierBalances.withdrawal)} subtitle={`- Withdrawals: ${K(withdrawalManual.withdrawal)}`} />
              <Card title="Expected Send Money" value={K(cashierBalances.sendMoney)} subtitle={`- Withdrawals: ${K(withdrawalManual.sendMoney)}`} />
              <Card title="Expected Total" value={K(cashierBalances.total)} subtitle="All methods" />
            </div>
          </>
        )}
      </Section>

      {/* Manual withdrawals */}
      <Section title="Manual Withdrawals" subtitle="Money taken out during the day (record the source)" >
        {!isSingleDay && (
          <div className="ui-card p-4 text-sm text-mute">Manual withdrawals are available for single day only (set From = To).</div>
        )}

        {isSingleDay && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          </>
        )}
      </Section>

      {/* POS payment-method: Withdrawal */}
      <Section title="Withdrawals" subtitle="Sales recorded with paymentMethod = withdrawal (this is a payment method)">
        <Table columns={posWithdrawalColumns} data={posWithdrawals} keyField="invoiceNo" emptyText="No withdrawals" />
      </Section>
    </div>
  );
}
