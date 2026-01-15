import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = API_ORIG.replace(/\/api$/, "");
const url = (p) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

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
  String(r?.paymentMethod ?? r?.payment ?? r?.method ?? "")
    .trim()
    .toLowerCase();

function lsKey(prefix, day) {
  return `zaad_${prefix}_${day}`;
}

function readDayOpen() {
  try {
    // App.jsx stores Start-Day info under "dayOpen"
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

  // === Cashier controls (single day)
  const [openingCash, setOpeningCash] = useState(0);
  const [openingTill, setOpeningTill] = useState(0);

  // Manual withdrawals with details (single day)
  // {id, time, source: 'cash'|'till', amount, note}
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

    // Prefer values from Start Day (dayOpen) if it matches the selected day
    const dayOpen = readDayOpen();
    const dayOpenMatches = dayOpen?.date === dayKey;

    const oc =
      dayOpenMatches
        ? Number(dayOpen?.openingCashTotal || 0)
        : Number(localStorage.getItem(lsKey("opening_cash", dayKey)) || 0);

    // openingTillTotal is added in updated App; fallback to mpesaWithdrawal if older data exists
    const ot =
      dayOpenMatches
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

  // Filter helpers
  const inRange = (t) => {
    const d = new Date(t);
    return d >= dFrom && d <= dTo;
  };

  const salesInRange = useMemo(() => sales.filter((s) => inRange(s.createdAt)), [sales, dFrom, dTo]);
  const expensesInRange = useMemo(() => expenses.filter((e) => inRange(e.date)), [expenses, dFrom, dTo]);

  // Sales totals by payment method
  const totals = useMemo(() => {
    const totalSales = salesInRange.reduce((sum, r) => sum + Number(r.total || 0), 0);

    const cashSales = salesInRange.reduce(
      (sum, r) => (normPM(r) === "cash" ? sum + Number(r.total || 0) : sum),
      0
    );
    const tillSales = salesInRange.reduce(
      (sum, r) => (normPM(r) === "till" ? sum + Number(r.total || 0) : sum),
      0
    );
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
    const cash = withdrawals
      .filter((w) => w.source === "cash")
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const till = withdrawals
      .filter((w) => w.source === "till")
      .reduce((s, w) => s + Number(w.amount || 0), 0);
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
      source: wSource, // cash | till
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

  return (
    <div className="page-surface">
      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-white/80">From</label>
        <input
          type="date"
          className="rounded-xl bg-white/90 text-black px-3 py-2"
          value={fromDate}
          max={toDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <label className="text-white/80">To</label>
        <input
          type="date"
          className="rounded-xl bg-white/90 text-black px-3 py-2"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        {!isSingleDay && (
          <div className="text-sm text-white/60">
            Cashier section works when From = To (single day).
          </div>
        )}
      </div>

      {/* High-level summary cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-6">
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Total Sales</div>
          <div className="text-3xl font-semibold">{K(totals.totalSales)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Cash Sales</div>
          <div className="text-3xl font-semibold">{K(totals.cashSales)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Till Sales</div>
          <div className="text-3xl font-semibold">{K(totals.tillSales)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Withdrawal (POS)</div>
          <div className="text-3xl font-semibold">{K(totals.withdrawalSales)}</div>
          <div className="text-xs text-white/50 mt-1">
            Sum of records where paymentMethod = withdrawal
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-6">
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Expenses</div>
          <div className="text-3xl font-semibold">{K(totals.totalExpenses)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Net Profit</div>
          <div className="text-3xl font-semibold">{K(totals.netProfit)}</div>
        </div>
      </div>

      {/* Cashier accounting */}
      <Section title="Cashier Accounting — Opening + Sales − Withdrawals">
        {!isSingleDay ? (
          <div className="text-white/70">
            Select a single day to manage opening balances and withdrawal details.
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Opening */}
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="text-white/80 font-semibold mb-3">Opening Amounts</div>

              <label className="block mb-3">
                <span className="block text-white/70 mb-1">Opening Cash</span>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl bg-white/90 text-black px-3 py-2"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(+e.target.value || 0)}
                />
              </label>

              <label className="block">
                <span className="block text-white/70 mb-1">Opening Till</span>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl bg-white/90 text-black px-3 py-2"
                  value={openingTill}
                  onChange={(e) => setOpeningTill(+e.target.value || 0)}
                />
              </label>

              <div className="text-xs text-white/50 mt-3">
                For {dayKey}: values are auto-saved (local storage).
              </div>
            </div>

            {/* Add Withdrawal */}
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="text-white/80 font-semibold mb-3">Record Withdrawal (Details)</div>

              <label className="block mb-3">
                <span className="block text-white/70 mb-1">From</span>
                <select
                  className="w-full rounded-xl bg-white/90 text-black px-3 py-2"
                  value={wSource}
                  onChange={(e) => setWSource(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="till">Till</option>
                </select>
              </label>

              <label className="block mb-3">
                <span className="block text-white/70 mb-1">Amount</span>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl bg-white/90 text-black px-3 py-2"
                  value={wAmount}
                  onChange={(e) => setWAmount(+e.target.value || 0)}
                />
              </label>

              <label className="block mb-3">
                <span className="block text-white/70 mb-1">Note (optional)</span>
                <input
                  className="w-full rounded-xl bg-white/90 text-black px-3 py-2"
                  value={wNote}
                  onChange={(e) => setWNote(e.target.value)}
                  placeholder="Reason / reference..."
                />
              </label>

              <button className="btn-gold w-full" onClick={addWithdrawal}>
                Add Withdrawal
              </button>

              <div className="mt-4 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Withdrawals (Cash)</span>
                  <b>{K(withdrawalManual.cash)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Withdrawals (Till)</span>
                  <b>{K(withdrawalManual.till)}</b>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                  <span>Total Withdrawals</span>
                  <b>{K(withdrawalManual.total)}</b>
                </div>
              </div>
            </div>

            {/* Balances */}
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="text-white/80 font-semibold mb-3">Expected Cashier Balance</div>

              <div className="flex justify-between items-center rounded-xl bg-white/5 p-3 mb-3">
                <span className="text-white/80">Cash in Drawer</span>
                <b className="text-xl">{K(cashierBalances?.cash || 0)}</b>
              </div>

              <div className="flex justify-between items-center rounded-xl bg-white/5 p-3 mb-3">
                <span className="text-white/80">Till Balance</span>
                <b className="text-xl">{K(cashierBalances?.till || 0)}</b>
              </div>

              <div className="flex justify-between items-center border-t border-white/10 pt-3">
                <span className="text-white/80">Total on Hand</span>
                <b className="text-2xl">{K(cashierBalances?.grand || 0)}</b>
              </div>

              <div className="text-xs text-white/50 mt-2">
                Calculation:
                Cash = Opening Cash + Cash Sales − Cash Withdrawals
                / Till = Opening Till + Till Sales − Till Withdrawals
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Manual Withdrawal Details */}
      <Section title="Withdrawals (Manual) — Details">
        {!isSingleDay ? (
          <div className="text-white/70">
            Select a single day to view/manage manual withdrawals.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/70 border-b border-white/10">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 text-white/85">
                    <td className="py-2 pr-3">{fmtT(w.time)}</td>
                    <td className="py-2 pr-3">{w.source === "cash" ? "Cash" : "Till"}</td>
                    <td className="py-2 pr-3">{K(w.amount)}</td>
                    <td className="py-2 pr-3">{w.note || "—"}</td>
                    <td className="py-2 pr-3">
                      <button className="btn" onClick={() => removeWithdrawal(w.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {!withdrawals.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-white/60">
                      No manual withdrawals recorded for this day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* POS Withdrawal records */}
      <Section title="Withdrawals (POS) — Details">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/70 border-b border-white/10">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Invoice</th>
                <th className="py-2 pr-3">Client</th>
              </tr>
            </thead>
            <tbody>
              {posWithdrawals.map((r, idx) => (
                <tr key={r.id || r.invoiceNo || idx} className="border-b border-white/5 text-white/85">
                  <td className="py-2 pr-3">{fmtD(r.createdAt)}</td>
                  <td className="py-2 pr-3">{fmtT(r.createdAt)}</td>
                  <td className="py-2 pr-3">{K(r.total)}</td>
                  <td className="py-2 pr-3">{r.invoiceNo || "—"}</td>
                  <td className="py-2 pr-3">{r.clientName || "—"}</td>
                </tr>
              ))}
              {!posWithdrawals.length && (
                <tr>
                  <td colSpan={5} className="py-3 text-white/60">
                    No POS withdrawals in selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Expenses details */}
      <Section title="Expenses — Details">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/70 border-b border-white/10">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Title/Category</th>
                <th className="py-2 pr-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expensesInRange.map((e, idx) => (
                <tr key={idx} className="border-b border-white/5 text-white/85">
                  <td className="py-2 pr-3">{fmtD(e.date)}</td>
                  <td className="py-2 pr-3">{e.title || e.category || e.note || "—"}</td>
                  <td className="py-2 pr-3">{K(e.amount)}</td>
                </tr>
              ))}
              {!expensesInRange.length && (
                <tr>
                  <td colSpan={3} className="py-3 text-white/60">
                    No expenses in selected range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
