// src/ui/theme/OverviewNeon.jsx
import React from "react";
import { motion } from "framer-motion";

// ألوان مستخلصة من شعار Zaad Bakery + لمسة نيّون
const colors = {
  bg: "#0B0F14",
  card: "rgba(18,22,28,0.8)",
  border: "rgba(255,255,255,0.06)",
  gold: "#F2C041",
  accent1: "#a855f7",
  accent2: "#22d3ee",
  accent3: "#f97316",
};

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function Stat({ label, value, delta }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ borderColor: colors.border, background: colors.card }}>
      <div className="text-sm/5 text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
        {typeof value === "number" ? `$${fmt.format(value)}` : value}
      </div>
      {delta && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400/90">
          <span>{/* trending icon placeholder */}</span>
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

function NeonButton({ children, onClick, variant = "primary" }) {
  const base = "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300";
  if (variant === "ghost") {
    return (
      <button onClick={onClick} className={`${base} border`} style={{ borderColor: colors.border, background: "transparent", color: "#fff" }}>
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={base}
      style={{
        color: "#0b0f14",
        background: `linear-gradient(135deg, ${colors.gold}, ${colors.accent3})`,
        boxShadow: `0 0 24px ${colors.accent3}40, inset 0 0 1px #fff6`,
      }}
    >
      {children}
    </button>
  );
}

// مخطط SVG خفيف بدون مكتبات خارجية
function AreaChart({ data = [] }) {
  const w = 620, h = 220, pad = 24;
  const xs = (i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
  const max = Math.max(1, ...data.map(d => d.value));
  const ys = (v) => h - pad - (v / max) * (h - pad * 2);

  const points = data.map((d, i) => ({ x: xs(i), y: ys(d.value) }));
  const dPath = points.map((p, i, a) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const p0 = a[i - 1] || p;
    const p1 = p;
    const p2 = a[i + 1] || p1;
    const pMinus = a[i - 2] || p0;
    const s = 0.2;
    const cp1x = p0.x + (p1.x - pMinus.x) * s;
    const cp1y = p0.y + (p1.y - pMinus.y) * s;
    const cp2x = p1.x - (p2.x - p0.x) * s;
    const cp2y = p1.y - (p2.y - p0.y) * s;
    return `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }).join(" ");

  const area = `${dPath} L ${pad},${h - pad} L ${xs(0)},${h - pad} Z`;

  return (
    <svg width={w} height={h} className="rounded-2xl w-full" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <defs>
        <linearGradient id="stroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={colors.accent2} />
          <stop offset="50%" stopColor={colors.accent1} />
          <stop offset="100%" stopColor={colors.accent3} />
        </linearGradient>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.accent1} stopOpacity={0.35} />
          <stop offset="60%" stopColor={colors.accent3} stopOpacity={0.08} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </linearGradient>
      </defs>

      {data.map((_, i) => <line key={`x-${i}`} x1={xs(i)} y1={pad} x2={xs(i)} y2={h - pad} stroke="rgba(255,255,255,0.04)" />)}
      {[0, .25, .5, .75, 1].map((r, i) => <line key={`y-${i}`} x1={pad} y1={ys(max * r)} x2={w - pad} y2={ys(max * r)} stroke="rgba(255,255,255,0.06)" />)}

      <path d={area} fill="url(#fill)" />
      <path d={dPath} fill="none" stroke="url(#stroke)" strokeWidth={3} />

      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" opacity={0.9} />)}
    </svg>
  );
}

function RightPanel({ value = 0, holders = 0, portfolioName = "" }) {
  return (
    <div className="rounded-2xl p-5 sticky top-6 h-fit" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="text-white/60 text-sm">Origin</div>
      <div className="mt-1 text-white text-lg font-semibold">{portfolioName}</div>
      <div className="mt-3 text-3xl font-bold text-white">${fmt.format(value)}</div>

      <div className="mt-6 flex items-center justify-center">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={colors.accent2} />
                <stop offset="50%" stopColor={colors.accent1} />
                <stop offset="100%" stopColor={colors.accent3} />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r="54" stroke="#ffffff14" strokeWidth="12" fill="none" />
            <circle cx="70" cy="70" r="54" stroke="url(#ring)" strokeWidth="12" fill="none" strokeLinecap="round"
              strokeDasharray={`${Math.PI * 2 * 54}`} strokeDashoffset={`${Math.PI * 2 * 54 * 0.5}`} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{holders}</div>
              <div className="text-white/60 text-xs">Share Holders</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <NeonButton>Buy</NeonButton>
        <NeonButton variant="ghost">Sell</NeonButton>
      </div>
    </div>
  );
}

export default function OverviewNeon({
  stats = { balance: 42069, investment: 20619, totalGain: 8664, totalLoss: 1212 },
  chartData = [],
  actions = { onDeposit: () => {}, onWithdraw: () => {} },
  rightPanel = { portfolioName: "Zaad Bakery", value: 0, holders: 0 },
  children,
}) {
  return (
    <div className="min-h-screen" style={{ background: colors.bg }}>
      {/* شريط علوي نيوني */}
      <div className="h-28 w-full"
        style={{
          background: `radial-gradient(1200px 220px at 10% -30%, ${colors.gold}22, transparent 60%),
                       radial-gradient(900px 180px at 90% -20%, ${colors.accent1}26, transparent 60%),
                       linear-gradient(90deg, ${colors.accent2}0f, ${colors.accent1}10, ${colors.accent3}12)`,
          borderBottom: `1px solid ${colors.border}`,
        }} />

      <div className="mx-auto max-w-7xl px-6 -mt-12 pb-16">
        {/* بطاقة الرأس */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="rounded-2xl border p-6 backdrop-blur" style={{ background: colors.card, borderColor: colors.border }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-white/60 text-sm">Overall Portfolio</div>
              <div className="text-3xl font-semibold tracking-tight text-white mt-1">
                ${fmt.format(stats.balance)}
              </div>
            </div>
            <div className="flex gap-3">
              <NeonButton onClick={actions.onWithdraw}>Withdraw</NeonButton>
              <NeonButton onClick={actions.onDeposit}>Deposit</NeonButton>
            </div>
          </div>

          {/* أرقام سريعة */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Investment" value={stats.investment} delta="+2.4%" />
            <Stat label="Total Gain" value={stats.totalGain} delta="+4.2%" />
            <Stat label="Total Loss" value={stats.totalLoss} delta="-0.6%" />
            <Stat label="My Balance" value={stats.balance} />
          </div>
        </motion.div>

        {/* المحتوى الرئيسي */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="lg:col-span-2">
            <div className="rounded-2xl border p-6" style={{ background: colors.card, borderColor: colors.border }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/60 text-sm">Overview Statistic</div>
                  <div className="text-white text-xl font-semibold mt-1">Sales & Revenue</div>
                </div>
                <div className="flex gap-2">
                  {"1D 1W 1M 1Y".split(" ").map(k => (
                    <button key={k} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: colors.border, color: "#fff" }}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <AreaChart data={chartData} />
              </div>
            </div>

            {/* هنا يوضع المحتوى/الجداول الأصلية */}
            {children}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <RightPanel value={rightPanel.value} holders={rightPanel.holders} portfolioName={rightPanel.portfolioName} />
          </motion.div>
        </div>
      </div>

      {/* توهج محيطي يحمل ألوان الهوية */}
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `radial-gradient(600px 200px at 15% 10%, ${colors.gold}12, transparent 60%),
                       radial-gradient(600px 220px at 85% 12%, ${colors.accent2}10, transparent 60%)`,
        }} />
    </div>
  );
}
