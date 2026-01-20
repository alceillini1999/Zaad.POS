import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import OverviewNeonAnimated from "../ui/theme/OverviewNeonAnimated";

const C = {
  bg: "#0B0F14",
  card: "rgba(18,22,28,.78)",
  border: "rgba(255,255,255,.06)",
  gold: "#F2C041",
  brown: "#8B5E3C",
};

const LINKS = [
  { to: "/overview", label: "Daily Report", icon: "🏠" },
  { to: "/whatsapp", label: "WhatsApp", icon: "💬" },
  { to: "/products", label: "Products", icon: "🧾" },
  { to: "/expenses", label: "Expenses", icon: "💸" },
  { to: "/pos", label: "POS", icon: "🛒" },
  { to: "/clients", label: "Clients", icon: "👥" },
  { to: "/sales", label: "Sales", icon: "📈" },
];

function Brand({ size = 56, showText = true }) {
  return (
    <div className="flex items-center gap-4">
      {/* اللوجو بدون صندوق */}
      <img
        src="/logo.png"
        alt="Zaad Bakery"
        style={{ height: size }}
        className="w-auto object-contain drop-shadow-lg"
        draggable="false"
      />

      {showText && (
        <div className="leading-tight">
          <div className="text-white font-bold tracking-wide text-lg">
            Zaad Bakery
          </div>
          <div className="text-white/70 text-sm">
            Egyptian Bakery
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const now = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className="sticky top-0 z-40 backdrop-blur-sm"
      style={{
        background:
          "linear-gradient(180deg, rgba(242,192,65,0.28), rgba(242,192,65,0.10) 40%, transparent)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Brand size={64} showText />
        <div className="text-white/70 text-sm">{now}</div>
      </div>
    </div>
  );
}

function SideBar() {
  const { pathname } = useLocation();

  return (
    <aside
      className="hidden md:block h-screen sticky top-0 pt-6"
      style={{
        width: 260,
        background:
          "linear-gradient(180deg, rgba(26,18,11,0.88), rgba(18,22,28,0.88))",
        borderRight: `1px solid ${C.border}`,
      }}
    >
      <div className="px-5">
        <div className="mb-8">
          <Brand size={72} showText />
        </div>

        <nav className="space-y-2">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors border"
                style={{
                  borderColor: C.border,
                  background: active
                    ? `linear-gradient(135deg, ${C.gold}, ${C.brown})`
                    : C.card,
                  color: active ? "#0B0F14" : "#ffffffcc",
                }}
              >
                <span>{l.icon}</span>
                <span className="text-sm font-medium">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default function NeonAppShell({ children }) {
  return (
    <OverviewNeonAnimated>
      <div className="min-h-screen" style={{ background: C.bg, color: "#fff" }}>
        <TopBar />
        <div className="mx-auto max-w-7xl flex gap-6 px-4">
          <SideBar />
          <main className="flex-1 py-6">
            <div
              className="rounded-2xl border backdrop-blur-sm"
              style={{ borderColor: C.border, background: C.card }}
            >
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </OverviewNeonAnimated>
  );
}
