import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
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
  // Auth is via httpOnly cookie
  const mergedHeaders = { ...(opts.headers || {}) };
  const res = await fetch(url(p), {
    mode: "cors",
    credentials: "include",
    cache: "no-store",
    ...opts,
    headers: mergedHeaders,
  });
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

// Auth is cookie-based

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
  // common misspellings / variants
  if (s === "withdrawel" || s === "withdrawel cash" || s.startsWith("withdrawel ")) return "withdrawal";
  if (s === "withdrawal" || s === "withdrawal cash" || s.startsWith("withdrawal ")) return "withdrawal";
  return s;
}



function normMethodStr(v) {
  const raw = String(v || "").trim().toLowerCase();
  const s = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (s === "send money" || s === "sendmoney" || s === "send") return "send_money";
  if (s === "withdrawel" || s === "withdrawel cash" || s.startsWith("withdrawel ")) return "withdrawal";
  if (s === "withdrawal" || s === "withdrawal cash" || s.startsWith("withdrawal ")) return "withdrawal";
  if (s === "till") return "till";
  if (s === "cash") return "cash";
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
  const { employee } = useAuth();
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

  // Transfers (convert money between methods) with history (range)
  const [transfers, setTransfers] = useState([]);
  const [tAmount, setTAmount] = useState("");
  const [tFrom, setTFrom] = useState("withdrawal");
  const [tTo, setTTo] = useState("cash");
  const [tNote, setTNote] = useState("");
  const [tDate, setTDate] = useState(today);

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

  // Load transfers for selected range (shared via Google Sheets)
  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString();
        const list = await api(`/api/transfers?${qs}`);
        setTransfers(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load transfers:', e);
        setTransfers([]);
      }
    })();
  }, [fromDate, toDate]);


  // Load opening values from backend sheet for the selected range
  useEffect(() => {
    let cancelled = false;

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
    setTDate(toDate);
  }, [toDate]);

  const totals = useMemo(() => {
    const inRange = (t) => {
      const d = new Date(t);
      return d >= dFrom && d <= dTo;
    };
    const salesInRange = sales.filter((s) => inRange(s.createdAt));
    const totalSales = salesInRange.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const expensesInRange = expenses.filter((e) => inRange(e.date));
    const totalExpenses = expensesInRange.reduce((s, r) => s + Number(r.amount || 0), 0);

    // Expenses by payment method (from Expenses page)
    const cashExpenses = expensesInRange.reduce((sum, r) => (normPM(r) === "cash" ? sum + Number(r.amount || 0) : sum), 0);
    const tillExpenses = expensesInRange.reduce((sum, r) => (normPM(r) === "till" ? sum + Number(r.amount || 0) : sum), 0);
    const withdrawalExpenses = expensesInRange.reduce(
      (sum, r) => (normPM(r) === "withdrawal" ? sum + Number(r.amount || 0) : sum),
      0
    );
    const sendMoneyExpenses = expensesInRange.reduce(
      (sum, r) => (normPM(r) === "send_money" ? sum + Number(r.amount || 0) : sum),
      0
    );

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
      cashExpenses,
      tillExpenses,
      withdrawalExpenses,
      sendMoneyExpenses,
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


  const transferSummary = useMemo(() => {
    const sumOut = (m) =>
      (transfers || []).filter(t => normMethodStr(t.from) === m).reduce((s, t) => s + Number(t.amount || 0), 0);
    const sumIn = (m) =>
      (transfers || []).filter(t => normMethodStr(t.to) === m).reduce((s, t) => s + Number(t.amount || 0), 0);

    const cashIn = sumIn('cash'), cashOut = sumOut('cash');
    const tillIn = sumIn('till'), tillOut = sumOut('till');
    const withdrawalIn = sumIn('withdrawal'), withdrawalOut = sumOut('withdrawal');
    const sendMoneyIn = sumIn('send_money'), sendMoneyOut = sumOut('send_money');

    return {
      cash: { in: cashIn, out: cashOut, net: cashIn - cashOut },
      till: { in: tillIn, out: tillOut, net: tillIn - tillOut },
      withdrawal: { in: withdrawalIn, out: withdrawalOut, net: withdrawalIn - withdrawalOut },
      sendMoney: { in: sendMoneyIn, out: sendMoneyOut, net: sendMoneyIn - sendMoneyOut },
    };
  }, [transfers]);


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

  // Expected available (Opening + Sales - Manual Withdrawals - Expenses by payment method)
  const expectedAvailable = useMemo(() => {
    const cash =
      openings.cash +
      Number(totals.cashSales || 0) -
      Number(withdrawalManual.cash || 0) -
      Number(totals.cashExpenses || 0) +
      Number(transferSummary.cash.net || 0);

    const till =
      openings.till +
      Number(totals.tillSales || 0) -
      Number(withdrawalManual.till || 0) -
      Number(totals.tillExpenses || 0) +
      Number(transferSummary.till.net || 0);

    const withdrawal =
      openings.withdrawal +
      Number(totals.withdrawalSales || 0) -
      Number(withdrawalManual.withdrawal || 0) -
      Number(totals.withdrawalExpenses || 0) +
      Number(transferSummary.withdrawal.net || 0);

    const sendMoney =
      openings.sendMoney +
      Number(totals.sendMoneySales || 0) -
      Number(withdrawalManual.sendMoney || 0) -
      Number(totals.sendMoneyExpenses || 0) +
      Number(transferSummary.sendMoney.net || 0);
    return { cash, till, withdrawal, sendMoney, total: cash + till + withdrawal + sendMoney };
  }, [openings, totals, withdrawalManual, transferSummary]);

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
          createdBy: employee?.name || employee?.username || ''
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

  
  const reloadTransfers = async () => {
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate }).toString();
      const list = await api(`/api/transfers?${qs}`);
      setTransfers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to reload transfers:', e);
      setTransfers([]);
    }
  };

  const addTransfer = async () => {
    const k = String(tDate || today).trim(); // YYYY-MM-DD
    const from = String(tFrom || '').trim();
    const to = String(tTo || '').trim();
    const amount = Number(String(tAmount || '').replace(/,/g, ''));

    if (!from) return alert('Select "From"');
    if (!to) return alert('Select "To"');
    if (normMethodStr(from) === normMethodStr(to)) return alert('From and To must be different');
    if (!amount || amount <= 0) return alert('Enter amount');

    try {
      await api('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: k,
          from,
          to,
          amount,
          note: tNote || '',
          createdBy: employee?.name || employee?.username || '',
        }),
      });
      setTAmount('');
      setTNote('');
      await reloadTransfers();
    } catch (e) {
      console.error('Failed to add transfer:', e);
      alert('Failed to add transfer');
    }
  };

  const removeTransfer = async (id) => {
    const ok = confirm('Remove this transfer?');
    if (!ok) return;
    try {
      await api(`/api/transfers/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await reloadTransfers();
    } catch (e) {
      console.error('Failed to remove transfer:', e);
      alert('Failed to remove transfer');
    }
  };

  const transferColumns = [
    { key: 'date', header: 'Date', render: (r) => r.date || '—' },
    {
      key: 'createdAt',
      header: 'Time',
      render: (r) => new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    { key: 'from', header: 'From', render: (r) => srcLabel(normMethodStr(r.from)) },
    { key: 'to', header: 'To', render: (r) => srcLabel(normMethodStr(r.to)) },
    { key: 'amount', header: 'Amount', render: (r) => K(r.amount) },
    { key: 'note', header: 'Note', render: (r) => r.note || '—' },
    { key: 'createdBy', header: 'By', render: (r) => r.createdBy || '—' },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button className="ui-btn ui-btn-ghost !px-3" onClick={() => removeTransfer(r.id)} type="button">
          Remove
        </button>
      ),
    },
  ];

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


  const exportPDF = () => {
    try {
      const esc = (s) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");

      // Format already-rendered values (e.g. "KSh 1,501") safely.
      const moneyStr = (s) => esc(String(s ?? "").trim() || "KSh 0");

      // Read the visible Card values from the page so the PDF matches the UI exactly.
      const getCardValue = (sectionId, title) => {
        const root = document.getElementById(sectionId);
        if (!root) return "KSh 0";
        const cards = Array.from(root.querySelectorAll(".ui-card"));
        const want = String(title || "").trim().toLowerCase();
        for (const c of cards) {
          const tEl = c.querySelector(".text-xs.font-bold.uppercase.tracking-wider");
          if (!tEl) continue;
          const t = String(tEl.textContent || "").trim().toLowerCase();
          if (t !== want) continue;
          const vEl = c.querySelector(".mt-2.text-2xl");
          if (!vEl) return "KSh 0";
          return String(vEl.textContent || "").trim() || "KSh 0";
        }
        return "KSh 0";
      };
      const methodLabel = (m) => {
        const nm = normMethodStr(m);
        if (nm === "cash") return "CASH";
        if (nm === "till") return "TILL";
        if (nm === "withdrawal") return "WITHDRAWEL";
        if (nm === "send_money") return "SEND MONEY";
        return String(m || "").toUpperCase();
      };

      const logoUrl = `${window.location.origin}/zaad-logo.png`;

      const rows2 = (arr) => arr.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("");

      // Pull visible values from the UI (per-section) so the PDF matches what you see.
      const vTotalSales = getCardValue("sum-totals", "Total Sales");
      const vTotalExpenses = getCardValue("sum-totals", "Total Expenses");
      const vNetProfit = getCardValue("sum-totals", "Net Profit");

      const vSalesCash = getCardValue("sum-sales-by-method", "Cash");
      const vSalesTill = getCardValue("sum-sales-by-method", "Till");
      const vSalesWithdrawal = getCardValue("sum-sales-by-method", "Withdrawal");
      const vSalesSendMoney = getCardValue("sum-sales-by-method", "Send Money");

      const vExpCash = getCardValue("sum-expenses-by-method", "CASH");
      const vExpTill = getCardValue("sum-expenses-by-method", "till");
      const vExpWithdrawal = getCardValue("sum-expenses-by-method", "WITHDRAWEL");
      const vExpSendMoney = getCardValue("sum-expenses-by-method", "send money");

      const vManCash = getCardValue("sum-manual", "Withdrawals (Cash)");
      const vManTill = getCardValue("sum-manual", "Withdrawals (Till)");
      const vManWithdrawal = getCardValue("sum-manual", "Withdrawals (Withdrawal)");
      const vManSendMoney = getCardValue("sum-manual", "Withdrawals (Send Money)");
      const vManTotal = moneyStr(K(withdrawalManual.total));

      const vExpAvailCash = getCardValue("sum-manual", "Expected Available (Cash)");
      const vExpAvailTill = getCardValue("sum-manual", "Expected Available (Till)");
      const vExpAvailWithdrawal = getCardValue("sum-manual", "Expected Available (Withdrawal)");
      const vExpAvailSendMoney = getCardValue("sum-manual", "Expected Available (Send Money)");
      const vExpAvailTotal = moneyStr(K(expectedAvailable.total));

      const vTrNetCash = getCardValue("sum-transfers", "Net Transfer (Cash)");
      const vTrNetTill = getCardValue("sum-transfers", "Net Transfer (Till)");
      const vTrNetWithdrawal = getCardValue("sum-transfers", "Net Transfer (Withdrawal)");
      const vTrNetSendMoney = getCardValue("sum-transfers", "Net Transfer (Send Money)");

      const salesRows = [
        ["CASH", moneyStr(vSalesCash)],
        ["TILL", moneyStr(vSalesTill)],
        ["WITHDRAWEL", moneyStr(vSalesWithdrawal)],
        ["SEND MONEY", moneyStr(vSalesSendMoney)],
        ["TOTAL", moneyStr(vTotalSales)],
      ];

      const expensesRows = [
        ["CASH", moneyStr(vExpCash)],
        ["TILL", moneyStr(vExpTill)],
        ["WITHDRAWEL", moneyStr(vExpWithdrawal)],
        ["SEND MONEY", moneyStr(vExpSendMoney)],
        ["TOTAL", moneyStr(vTotalExpenses)],
      ];

      const manualRows = [
        ["CASH", moneyStr(vManCash)],
        ["TILL", moneyStr(vManTill)],
        ["WITHDRAWEL", moneyStr(vManWithdrawal)],
        ["SEND MONEY", moneyStr(vManSendMoney)],
        ["TOTAL", vManTotal],
      ];

      const expectedRows = [
        ["CASH", moneyStr(vExpAvailCash)],
        ["TILL", moneyStr(vExpAvailTill)],
        ["WITHDRAWEL", moneyStr(vExpAvailWithdrawal)],
        ["SEND MONEY", moneyStr(vExpAvailSendMoney)],
        ["TOTAL", vExpAvailTotal],
      ];

      const transferNetRows = [
        ["CASH", moneyStr(vTrNetCash)],
        ["TILL", moneyStr(vTrNetTill)],
        ["WITHDRAWEL", moneyStr(vTrNetWithdrawal)],
        ["SEND MONEY", moneyStr(vTrNetSendMoney)],
      ];

      const transfersRows = (transfers || []).map((t) => [
        esc(t.date || ""),
        methodLabel(t.from),
        methodLabel(t.to),
        moneyStr(K(t.amount || 0)),
        esc(t.note || ""),
      ]);

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Zaad Bakery Summary</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0F172A; }
    .header { display:flex; align-items:center; gap:14px; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px; }
    .logo { width: 64px; height: 64px; object-fit: contain; }
    h1 { font-size: 18px; margin: 0; }
    .sub { color: #64748B; font-size: 12px; margin-top: 4px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .card { border:1px solid #E2E8F0; border-radius: 10px; padding: 10px; }
    .card h2 { font-size: 13px; margin: 0 0 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #E2E8F0; padding: 6px 8px; text-align: left; }
    th { background: #F8FAFC; }
    .kpi { display:flex; justify-content: space-between; gap: 10px; font-size: 12px; }
    .kpi b { font-size: 13px; }
    .full { grid-column: 1 / -1; }
    .mt { margin-top: 12px; }
    .muted { color: #64748B; }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'"/>
    <div>
      <h1>Zaad Bakery — Summary Report</h1>
      <div class="sub">Date Range: <b>${esc(fromDate)}</b> → <b>${esc(toDate)}</b></div>
      <div class="sub muted">Generated: ${esc(new Date().toLocaleString())}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card full">
      <h2>Totals</h2>
      <div class="kpi"><span>Total Sales</span><b>${moneyStr(vTotalSales)}</b></div>
      <div class="kpi"><span>Total Expenses</span><b>${moneyStr(vTotalExpenses)}</b></div>
      <div class="kpi"><span>Net</span><b>${moneyStr(vNetProfit)}</b></div>
      
    </div>

    <div class="card">
      <h2>Sales by Payment Method</h2>
      <table><thead><tr><th>Method</th><th>Amount</th></tr></thead><tbody>${rows2(salesRows)}</tbody></table>
    </div>

    <div class="card">
      <h2>Expenses by Payment Method</h2>
      <table><thead><tr><th>Method</th><th>Amount</th></tr></thead><tbody>${rows2(expensesRows)}</tbody></table>
    </div>

    <div class="card">
      <h2>Manual Withdrawals</h2>
      <table><thead><tr><th>Method</th><th>Amount</th></tr></thead><tbody>${rows2(manualRows)}</tbody></table>
      <div class="sub muted mt">Manual withdrawals are amounts taken out from a method.</div>
    </div>

    <div class="card">
      <h2>Transfers Net (In − Out)</h2>
      <table><thead><tr><th>Method</th><th>Net</th></tr></thead><tbody>${rows2(transferNetRows)}</tbody></table>
    </div>

    <div class="card full">
      <h2>Expected Available by Method</h2>
      <table><thead><tr><th>Method</th><th>Expected Available</th></tr></thead><tbody>${rows2(expectedRows)}</tbody></table>
      <div class="sub muted mt">Formula per method: (Openings + Sales) − (Manual + Expenses by same method) + (Net Transfers).</div>
    </div>

    <div class="card full">
      <h2>Transfers History</h2>
      ${
        transfersRows.length
          ? `<table>
              <thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Note</th></tr></thead>
              <tbody>${transfersRows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("")}</tbody>
            </table>`
          : `<div class="sub muted">No transfers in this range.</div>`
      }
    </div>
  </div>

  <script>
    window.onload = () => setTimeout(() => window.print(), 250);
  </script>
</body>
</html>`;

      // Print-to-PDF without popups.
      // We render the report into a hidden iframe and trigger the browser print dialog.
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";

      // Use srcdoc when available (Chrome supports it) to avoid cross-window popups.
      iframe.srcdoc = html;
      document.body.appendChild(iframe);

      const cleanup = () => {
        try {
          iframe.remove();
        } catch {}
      };

      iframe.onload = () => {
        // Give the logo a moment to load.
        const w = iframe.contentWindow;
        if (!w) {
          cleanup();
          alert("Could not open print preview.");
          return;
        }
        w.onafterprint = cleanup;
        setTimeout(() => {
          try {
            w.focus();
            w.print();
          } catch {
            cleanup();
            alert("Could not open print preview.");
          }
        }, 350);
      };
    } catch (e) {
      console.error(e);
      alert("Could not generate PDF.");
    }
  };

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
      <Section sectionId="sum-totals" title="Totals" subtitle="Sales / Expenses / Net" actions={<button className="ui-btn-primary" onClick={exportPDF}>Export PDF</button>}>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card title="Total Sales" value={K(totals.totalSales)} />
          <Card title="Total Expenses" value={K(totals.totalExpenses)} />
          <Card title="Net Profit" value={K(totals.netProfit)} />
        </div>
      </Section>

      {/* Expenses by payment method */}
      <Section sectionId="sum-expenses-by-method" title="Expenses by Payment Method" subtitle="Computed from Expenses within the selected range">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="CASH" value={K(totals.cashExpenses)} />
          <Card title="WITHDRAWEL" value={K(totals.withdrawalExpenses)} />
          <Card title="till" value={K(totals.tillExpenses)} />
          <Card title="send money" value={K(totals.sendMoneyExpenses)} />
        </div>
      </Section>

      {/* Sales by payment method */}
      <Section sectionId="sum-sales-by-method" title="Sales by Payment Method" subtitle="Computed from POS sales within the selected range">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Cash" value={K(totals.cashSales)} />
          <Card title="Till" value={K(totals.tillSales)} />
          <Card title="Withdrawal" value={K(totals.withdrawalSales)} />
          <Card title="Send Money" value={K(totals.sendMoneySales)} />
        </div>
      </Section>

      {/* Manual withdrawals */}
      <Section sectionId="sum-manual" title="Manual Withdrawals" subtitle="Money taken out during the day (record the source)" >
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
          <Card title="Expected Available (Cash)" value={K(expectedAvailable.cash)} subtitle="(Openings + Sales) - (Manual + Expenses by Cash)" />
          <Card title="Expected Available (Till)" value={K(expectedAvailable.till)} subtitle="(Openings + Sales) - (Manual + Expenses by Till)" />
          <Card title="Expected Available (Withdrawal)" value={K(expectedAvailable.withdrawal)} subtitle="(Openings + Sales) - (Manual + Expenses by Withdrawal)" />
          <Card title="Expected Available (Send Money)" value={K(expectedAvailable.sendMoney)} subtitle="(Openings + Sales) - (Manual + Expenses by Send Money)" />
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


      {/* Transfers */}
      <Section sectionId="sum-transfers" title="Transfers" subtitle="Move money between payment methods (history is saved)">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Net Transfer (Cash)" value={K(transferSummary.cash.net)} subtitle={`In ${K(transferSummary.cash.in)} • Out ${K(transferSummary.cash.out)}`} />
          <Card title="Net Transfer (Till)" value={K(transferSummary.till.net)} subtitle={`In ${K(transferSummary.till.in)} • Out ${K(transferSummary.till.out)}`} />
          <Card title="Net Transfer (Withdrawal)" value={K(transferSummary.withdrawal.net)} subtitle={`In ${K(transferSummary.withdrawal.in)} • Out ${K(transferSummary.withdrawal.out)}`} />
          <Card title="Net Transfer (Send Money)" value={K(transferSummary.sendMoney.net)} subtitle={`In ${K(transferSummary.sendMoney.in)} • Out ${K(transferSummary.sendMoney.out)}`} />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <label className="block">
            <span className="ui-label">Date</span>
            <input className="ui-input mt-1" type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} />
          </label>

          <label className="block">
            <span className="ui-label">Amount</span>
            <input className="ui-input mt-1" value={tAmount} onChange={(e) => setTAmount(e.target.value)} inputMode="numeric" placeholder="0" />
          </label>

          <label className="block">
            <span className="ui-label">From</span>
            <select className="ui-select mt-1" value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="till">Till</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="send_money">Send Money</option>
            </select>
          </label>

          <label className="block">
            <span className="ui-label">To</span>
            <select className="ui-select mt-1" value={tTo} onChange={(e) => setTTo(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="till">Till</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="send_money">Send Money</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="ui-label">Note</span>
            <input className="ui-input mt-1" value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="e.g. convert Mpesa to cash" />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="ui-btn ui-btn-primary" onClick={addTransfer} type="button">
            Add Transfer
          </button>
          <div className="ui-badge">Transfers count: <b className="ml-1">{(transfers || []).length}</b></div>
        </div>

        <div className="mt-4">
          <Table columns={transferColumns} data={transfers} keyField="id" emptyText="No transfers" />
        </div>
      </Section>


    </div>
  );
}