import React, { useEffect, useMemo, useState } from "react";
import Section from "../components/Section";
import Card from "../components/Card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

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

function StatIcon({ children }) {
  return <span className="h-6 w-6 text-ink/70">{children}</span>;
}

export default function OverviewPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await (await fetch(url("/api/sales?page=1&limit=2000"), { credentials: "include" })).json();
        const sRows = Array.isArray(s) ? s : Array.isArray(s?.rows) ? s.rows : [];
        setSales(sRows);

        const e = await (await fetch(url("/api/expenses"), { credentials: "include" })).json();
        setExpenses(Array.isArray(e) ? e : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const dFrom = useMemo(() => startOfDay(new Date(fromDate)), [fromDate]);
  const dTo = useMemo(() => endOfDay(new Date(toDate)), [toDate]);
  const oneDay = useMemo(() => sameDay(dFrom, dTo), [dFrom, dTo]);

  const totals = useMemo(() => {
    const inRange = (t) => {
      const d = new Date(t);
      return d >= dFrom && d <= dTo;
    };
    const normPM = (r) => {
      const raw = String(r?.paymentMethod ?? r?.payment ?? r?.method ?? "").trim().toLowerCase();
      const s = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      if (s === "send money" || s === "sendmoney" || s === "send") return "send_money";
      if (s === "withdrawel") return "withdrawal"; // common misspelling
      return s;
    };

    const inRangeSales = sales.filter((s) => inRange(s.createdAt));
    const totalSales = inRangeSales.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const cash = inRangeSales.reduce((sum, r) => (normPM(r) === "cash" ? sum + Number(r.total || 0) : sum), 0);
    const till = inRangeSales.reduce((sum, r) => (normPM(r) === "till" ? sum + Number(r.total || 0) : sum), 0);
    const withdrawal = inRangeSales.reduce(
      (sum, r) => (normPM(r) === "withdrawal" ? sum + Number(r.total || 0) : sum),
      0
    );
    const sendMoney = inRangeSales.reduce(
      (sum, r) => (normPM(r) === "send_money" ? sum + Number(r.total || 0) : sum),
      0
    );

    const totalExpenses = expenses.filter((e) => inRange(e.date)).reduce((s, r) => s + Number(r.amount || 0), 0);

    return {
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      cash,
      till,
      withdrawal,
      sendMoney,
    };
  }, [sales, expenses, dFrom, dTo]);

  const chartData = useMemo(() => {
    const inRange = (t) => {
      const d = new Date(t);
      return d >= dFrom && d <= dTo;
    };

    if (oneDay) {
      // hourly
      const bS = Array(24).fill(0);
      const bE = Array(24).fill(0);
      sales.forEach((s) => {
        if (inRange(s.createdAt)) {
          const h = new Date(s.createdAt).getHours();
          bS[h] += Number(s.total || 0);
        }
      });
      expenses.forEach((e) => {
        if (inRange(e.date)) {
          const h = new Date(e.date).getHours ? new Date(e.date).getHours() : 0;
          bE[h] += Number(e.amount || 0);
        }
      });
      return Array.from({ length: 24 }).map((_, h) => ({
        label: `${h}:00`,
        sales: bS[h],
        expenses: bE[h],
        net: bS[h] - bE[h],
      }));
    }

    // daily
    const days = [];
    for (let d = startOfDay(dFrom); d <= dTo; d = new Date(d.getTime() + 86400000)) days.push(fmtD(d));
    const mapS = Object.create(null);
    const mapE = Object.create(null);
    days.forEach((d) => {
      mapS[d] = 0;
      mapE[d] = 0;
    });
    sales.forEach((s) => {
      const d = fmtD(s.createdAt);
      if (d in mapS) mapS[d] += Number(s.total || 0);
    });
    expenses.forEach((e) => {
      const d = fmtD(e.date);
      if (d in mapE) mapE[d] += Number(e.amount || 0);
    });
    return days.map((d) => ({ label: d, sales: mapS[d], expenses: mapE[d], net: mapS[d] - mapE[d] }));
  }, [sales, expenses, dFrom, dTo, oneDay]);

  return (
    <div className="space-y-6">
      {/* Header + Date Range */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="ui-h1">Overview</div>
          <div className="ui-sub mt-1">Sales, expenses, and net profit for the selected range.</div>
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
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card
          title="Total Sales"
          value={K(totals.totalSales)}
          subtitle="All sales in range"
          icon={
            <StatIcon>
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M7 18q-.825 0-1.412-.587Q5 16.825 5 16V8q0-.825.588-1.412Q6.175 6 7 6h10q.825 0 1.413.588Q19 7.175 19 8v8q0 .825-.587 1.413Q17.825 18 17 18Z" />
              </svg>
            </StatIcon>
          }
        />
        <Card
          title="Expenses"
          value={K(totals.totalExpenses)}
          subtitle="Operational costs"
          icon={
            <StatIcon>
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm1 17.93V20h-2v-1.07a8.13 8.13 0 0 1-3.68-1.5l1.14-1.63A6.52 6.52 0 0 0 12 17c1.36 0 2.25-.55 2.25-1.46 0-.94-.8-1.3-2.57-1.74-2.27-.56-3.7-1.35-3.7-3.32 0-1.6 1.14-2.82 3.02-3.18V4h2v1.25a6.9 6.9 0 0 1 3.04 1.24l-1.02 1.67A6.08 6.08 0 0 0 12 7c-1.48 0-1.95.67-1.95 1.33 0 .8.6 1.12 2.74 1.66 2.52.6 3.54 1.5 3.54 3.42 0 1.68-1.16 2.95-3.33 3.52Z" />
              </svg>
            </StatIcon>
          }
        />
        <Card
          title="Net Profit"
          value={K(totals.netProfit)}
          subtitle="Sales minus expenses"
          icon={
            <StatIcon>
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
              </svg>
            </StatIcon>
          }
        />
      </div>

      {/* Payment method breakdown */}
      <Section
        title="Payment Method Breakdown"
        subtitle="Computed from POS sales within the selected range"
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <Card title="Cash" value={K(totals.cash)} subtitle="Paid in Cash" />
          <Card title="Till" value={K(totals.till)} subtitle="Paid via Till" />
          <Card title="Withdrawal" value={K(totals.withdrawal)} subtitle="Paid via Withdrawal" />
          <Card title="Send Money" value={K(totals.sendMoney)} subtitle="Paid via Send Money" />
        </div>
      </Section>

      {/* Chart */}
      <Section title={oneDay ? "Hourly Trend" : "Daily Trend"} subtitle="Sales vs Expenses vs Net">
        <div className="ui-card p-3 md:p-4" style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            {oneDay ? (
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(15,23,42,0.10)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#64748B" }} tickMargin={8} />
                <YAxis stroke="#64748B" tick={{ fill: "#64748B" }} tickMargin={8} />
                <Tooltip
                  contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#0F172A" }}
                  labelStyle={{ color: "#0F172A" }}
                />
                <Legend wrapperStyle={{ color: "#64748B" }} />
                <Line type="monotone" dataKey="sales" name="Sales" stroke="#C57A2A" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#DC2626" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="net" name="Net Profit" stroke="#16A34A" strokeWidth={3} dot={false} />
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(15,23,42,0.10)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#64748B" }} tickMargin={8} />
                <YAxis stroke="#64748B" tick={{ fill: "#64748B" }} tickMargin={8} />
                <Tooltip
                  contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#0F172A" }}
                  labelStyle={{ color: "#0F172A" }}
                />
                <Legend wrapperStyle={{ color: "#64748B" }} />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="#C57A2A" fill="rgba(197,122,42,.16)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#DC2626" fill="rgba(220,38,38,.12)" strokeWidth={3} />
                <Area type="monotone" dataKey="net" name="Net Profit" stroke="#16A34A" fill="rgba(22,163,74,.10)" strokeWidth={3} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
