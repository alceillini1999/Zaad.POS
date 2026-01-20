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
const fmtT = (d) =>
  new Date(d).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

const normPM = (r) =>
  String(r?.paymentMethod ?? r?.payment ?? r?.method ?? "").trim().toLowerCase();

function lsKey(prefix, day) {
  return `zaad_${prefix}_${day}`;
}

function readDayOpen() {
  try {
    return JSON.parse(localStorage.getItem("dayOpen") || "null");
  } catch {
    return null;
  }
}

export default function SummeryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Cashier controls (single day)
  const [openingCash, setOpeningCash] = useState(0);
  const [openingTill, setOpeningTill] = useState(0);

  // Manual withdrawals with details (single day)
  const [withdrawals, setWithdrawals] = useState([]);
  const [wSource, setWSource] = useState("cash");
  const [wAmount, setWAmount] = useState(0);
  const [wNote, setWNote] = useState("");

  // Load sales/expenses
  useEffect(() => {
    (async () => {
      try {
        const s = await (
          await fetch(url("/api/sales?page=1&limit=4000"), { credentials: "include" })
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

  // Load cashier config for selected day (single day only)
  useEffect(() => {
    if (!isSingleDay) return;

    const dayOpen = readDayOpen();
    const dayOpenMatches = dayOpen?.date === dayKey;

    const oc = dayOpenMatches
      ? Number(dayOpen?.openingCashTotal || 0)
      : Number(localStorage.getItem(lsKey("opening_cash", dayKey)) || 0);

    const ot = dayOpenMatches
      ? Number(dayOpen?.openingTillTotal ?? dayOpen?.mpesaWithdrawal ?? 0)
      : Number(localStorage.getItem(lsKey("opening_till", dayKey)) || 0);

    setOpeningCash(oc);
    setOpeningTill(ot);

    const raw = localStorage.getItem(lsKey("withdrawals", dayKey));
    try {
      const list = raw ? JSON.parse(raw) : [];
      setWithdrawals(Array.isArray(list) ? list : []);
    } catch {
      setWithdrawals([]);
    }
  }, [isSingleDay, dayKey]);

  // Persist opening values + withdrawals for selected day (single day only)
  useEffect(() => {
    if (!isSingleDay) return;
    localStorage.setItem(lsKey("opening_cash", dayKey), String(Number(openingCash || 0)));
  }, [openingCash, isSingleDay, dayKey]);
  useEffect(() => {
    if (!isSingleDay) return;
    localStorage.setItem(lsKey("opening_till", dayKey), String(Number(openingTill || 0)));
  }, [openingTill, isSingleDay, dayKey]);
  useEffect(() => {
    if (!isSingleDay) return;
    localStorage.setItem(lsKey("withdrawals", dayKey), JSON.stringify(withdrawals || []));
  }, [withdrawals, isSingleDay, dayKey]);

  // Range filters
  const inRange = (t) => {
    const d = new Date(t);
    return d >= dFrom && d <= dTo;
  };

  const salesInRange = useMemo(() => sales.filter((s) => inRange(s.createdAt)), [sales, dFrom, dTo]);
  const expensesInRange = useMemo(() => expenses.filter((e) => inRange(e.date)), [expenses, dFrom, dTo]);

  // Totals
  const totals = useMemo(() => {
    const totalSales = salesInRange.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const cashSales = salesInRange.reduce((sum, r) => (normPM(r) === "cash" ? sum + Number(r.total || 0) : sum), 0);
    const tillSales = salesInRange.reduce((sum, r) => (normPM(r) === "till" ? sum + Number(r.total || 0) : sum), 0);
    const withdrawalSales = salesInRange.reduce(
      (sum, r) => (normPM(r) === "withdrawal" ? sum + Number(r.total || 0) : sum),
      0
    );
    const totalExpenses = expensesInRange.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const netProfit = totalSales - totalExpenses;
    return { totalSales, totalExpenses, netProfit, cashSales, tillSales, withdrawalSales };
  }, [salesInRange, expensesInRange]);

  // Manual withdrawals breakdown (single day)
  const withdrawalManual = useMemo(() => {
    const cash = withdrawals.filter((w) => w.source === "cash").reduce((s, w) => s + Number(w.amount || 0), 0);
    const till = withdrawals.filter((w) => w.source === "till").reduce((s, w) => s + Number(w.amount || 0), 0);
    return { cash, till, total: cash + till };
  }, [withdrawals]);

  // Expected cashier balances (single day only)
  const cashierBalances = useMemo(() => {
    if (!isSingleDay) return null;
    const cash = Number(openingCash || 0) + Number(totals.cashSales || 0) - Number(withdrawalManual.cash || 0);
    const till = Number(openingTill || 0) + Number(totals.tillSales || 0) - Number(withdrawalManual.till || 0);
    return { cash, till, grand: cash + till };
  }, [isSingleDay, openingCash, openingTill, totals.cashSales, totals.tillSales, withdrawalManual]);

  // POS withdrawals details (paymentMethod=withdrawal)
  const posWithdrawals = useMemo(() => salesInRange.filter((r) => normPM(r) === "withdrawal"), [salesInRange]);

  function addWithdrawal() {
    if (!isSingleDay) return;
    const amt = Number(wAmount || 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }
    const row = {
      id: `${Date.now()}`,
      time: new Date().toISOString(),
      source: wSource,
      amount: amt,
      note: String(wNote || "").trim(),
    };
    setWithdrawals((prev) => [row, ...prev]);
    setWAmount(0);
    setWNote("");
  }

  function removeWithdrawal(id) {
    setWithdrawals((prev) => prev.filter((x) => x.id !== id));
  }

  const withdrawalColumns = [
    {
      key: "time",
      title: "Time",
      render: (r) => (
        <div>
          <div className="font-semibold text-ink">{fmtT(r.time)}</div>
          <div className="text-xs text-mute">{fmtD(r.time)}</div>
        </div>
      ),
    },
    {
      key: "source",
      title: "Source",
      render: (r) => (
        <span className={r.source === "cash" ? "ui-badge-gold" : "ui-badge-green"}>
          {r.source}
        </span>
      ),
    },
    { key: "amount", title: "Amount", render: (r) => <b>{K(r.amount)}</b> },
    { key: "note", title: "Note", render: (r) => <span className="text-mute">{r.note || "—"}</span> },
    {
      key: "actions",
      title: "",
      render: (r) => (
        <button className="ui-btn ui-btn-ghost" onClick={() => removeWithdrawal(r.id)}>
          Remove
        </button>
      ),
    },
  ];

  const posWithdrawalColumns = [
    { key: "invoiceNo", title: "Invoice", render: (r) => <b>{r.invoiceNo || "—"}</b> },
    { key: "createdAt", title: "Time", render: (r) => <span className="text-mute">{fmtT(r.createdAt)}</span> },
    { key: "total", title: "Total", render: (r) => <b>{K(r.total)}</b> },
    { key: "clientName", title: "Client", render: (r) => <span className="text-mute">{r.clientName || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      {/* Header + date range */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">Summary</div>
          <div className="ui-sub mt-1">Cashier + totals + withdrawals with details</div>
        </div>

        <div className="ui-card p-3 md:p-4 flex flex-wrap items-center gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-mute">Range</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="ui-input !w-auto"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-mute">→</span>
            <input
              type="date"
              className="ui-input !w-auto"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {!isSingleDay && (
            <span className="ui-badge">Cashier section works when From = To</span>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title="Total Sales" value={K(totals.totalSales)} subtitle="All payments" />
        <Card title="Total Expenses" value={K(totals.totalExpenses)} subtitle="Operational costs" />
        <Card title="Net Profit" value={K(totals.netProfit)} subtitle="Sales minus expenses" />
      </div>

      <Section title="Sales by Payment Method" subtitle="Cash / Till / Withdrawal (POS)">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card title="Cash Sales" value={K(totals.cashSales)} />
          <Card title="Till Sales" value={K(totals.tillSales)} />
          <Card title="Withdrawal (POS)" value={K(totals.withdrawalSales)} />
        </div>
      </Section>

      {/* Cashier section */}
      <Section
        title="Cashier"
        subtitle={isSingleDay ? `Day: ${dayKey}` : "Select a single day to enable cashier calculations"}
      >
        {!isSingleDay ? (
          <div className="ui-card p-4 text-sm text-mute">
            To manage cashier totals (opening cash, opening till, withdrawals), set <b>From = To</b>.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Opening */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="ui-card p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-mute">Opening Cash</div>
                <input
                  type="number"
                  min="0"
                  className="ui-input mt-2"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(Number(e.target.value || 0))}
                />
                <div className="ui-sub mt-2">Stored locally for this day</div>
              </div>
              <div className="ui-card p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-mute">Opening Till</div>
                <input
                  type="number"
                  min="0"
                  className="ui-input mt-2"
                  value={openingTill}
                  onChange={(e) => setOpeningTill(Number(e.target.value || 0))}
                />
                <div className="ui-sub mt-2">Stored locally for this day</div>
              </div>
            </div>

            {/* Expected balances */}
            {cashierBalances && (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card
                  title="Expected Cash"
                  value={K(cashierBalances.cash)}
                  subtitle={`Opening + Cash Sales - Withdrawals (${K(withdrawalManual.cash)})`}
                />
                <Card
                  title="Expected Till"
                  value={K(cashierBalances.till)}
                  subtitle={`Opening + Till Sales - Withdrawals (${K(withdrawalManual.till)})`}
                />
                <Card title="Grand Total" value={K(cashierBalances.grand)} subtitle="Cash + Till" />
              </div>
            )}

            {/* Withdrawals add */}
            <div className="ui-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="ui-h2">Manual Withdrawals</div>
                  <div className="ui-sub mt-1">Record withdrawals with details</div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="ui-label">Source</span>
                    <select className="ui-select mt-1 !w-auto" value={wSource} onChange={(e) => setWSource(e.target.value)}>
                      <option value="cash">cash</option>
                      <option value="till">till</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="ui-label">Amount</span>
                    <input
                      type="number"
                      min="0"
                      className="ui-input mt-1 !w-[160px]"
                      value={wAmount}
                      onChange={(e) => setWAmount(Number(e.target.value || 0))}
                    />
                  </label>
                  <label className="block">
                    <span className="ui-label">Note</span>
                    <input
                      type="text"
                      className="ui-input mt-1 !w-[220px]"
                      value={wNote}
                      onChange={(e) => setWNote(e.target.value)}
                      placeholder="e.g. supplier payment"
                    />
                  </label>
                  <button className="ui-btn ui-btn-primary" onClick={addWithdrawal}>
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-3">
                <Card title="Withdrawals (Cash)" value={K(withdrawalManual.cash)} />
                <Card title="Withdrawals (Till)" value={K(withdrawalManual.till)} />
                <Card title="Withdrawals (Total)" value={K(withdrawalManual.total)} />
              </div>

              <div className="mt-4">
                <Table columns={withdrawalColumns} data={withdrawals} keyField="id" emptyText="No withdrawals" />
              </div>
            </div>

            {/* POS withdrawals list */}
            <Section title="POS Withdrawals" subtitle="Sales recorded with paymentMethod = withdrawal">
              <Table columns={posWithdrawalColumns} data={posWithdrawals} keyField="invoiceNo" emptyText="No POS withdrawals" />
            </Section>
          </div>
        )}
      </Section>
    </div>
  );
}
