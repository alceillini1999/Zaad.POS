import React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Layout (Full Redesign)
 * - Sidebar حديث (قابل للفتح/الإغلاق على الموبايل)
 * - Topbar احترافي + عنوان الصفحة + بحث (UI فقط)
 * - إحساس Dashboard Enterprise بدل Neon
 */

function Icon({ children, className = "" }) {
  return (
    <span
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-xl " +
        "bg-base border border-line text-ink/80 " +
        className
      }
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

const icons = {
  overview: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7V11h-7v9Zm0-18v7h7V2h-7Z"
      />
    </svg>
  ),
  summary: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M7 17h10v-2H7v2Zm0-4h10v-2H7v2Zm0-4h10V7H7v2ZM5 21q-.825 0-1.412-.587Q3 19.825 3 19V5q0-.825.588-1.412Q4.175 3 5 3h14q.825 0 1.413.588Q21 4.175 21 5v14q0 .825-.587 1.413Q19.825 21 19 21Z"
      />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.66 15l-1.3 5 5.12-1.34A10 10 0 1 0 12 2Zm0 18a7.94 7.94 0 0 1-4.07-1.12l-.3-.18-3.04.8.82-2.95-.2-.31A8 8 0 1 1 12 20Zm4.66-5.54c-.25-.13-1.47-.72-1.7-.8s-.4-.13-.57.13-.65.8-.8.97-.29.19-.54.06a6.53 6.53 0 0 1-1.92-1.18 7.25 7.25 0 0 1-1.33-1.66c-.14-.25 0-.38.1-.5l.39-.45c.13-.16.17-.26.26-.43s.04-.32-.02-.45-.57-1.37-.78-1.88c-.2-.48-.4-.42-.57-.43h-.49c-.17 0-.45.06-.68.32s-.9.88-.9 2.14.92 2.48 1.04 2.65c.13.17 1.8 2.74 4.36 3.85.61.26 1.08.42 1.45.54.61.2 1.17.17 1.61.1.49-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.14-1.18-.06-.1-.23-.16-.48-.29Z"
      />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M7 18q-.825 0-1.412-.587Q5 16.825 5 16V8q0-.825.588-1.412Q6.175 6 7 6h10q.825 0 1.413.588Q19 7.175 19 8v8q0 .825-.587 1.413Q17.825 18 17 18Zm0-2h10V8H7v8Zm-2 6q-.825 0-1.412-.587Q3 20.825 3 20V4q0-.825.588-1.412Q4.175 2 5 2h14q.825 0 1.413.588Q21 3.175 21 4v16q0 .825-.587 1.413Q19.825 22 19 22Z" />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm1 17.93V20h-2v-1.07a8.13 8.13 0 0 1-3.68-1.5l1.14-1.63A6.52 6.52 0 0 0 12 17c1.36 0 2.25-.55 2.25-1.46 0-.94-.8-1.3-2.57-1.74-2.27-.56-3.7-1.35-3.7-3.32 0-1.6 1.14-2.82 3.02-3.18V4h2v1.25a6.9 6.9 0 0 1 3.04 1.24l-1.02 1.67A6.08 6.08 0 0 0 12 7c-1.48 0-1.95.67-1.95 1.33 0 .8.6 1.12 2.74 1.66 2.52.6 3.54 1.5 3.54 3.42 0 1.68-1.16 2.95-3.33 3.52Z" />
    </svg>
  ),
  cash: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M21 7H3q-.825 0-1.412-.587Q1 5.825 1 5t.588-1.413Q2.175 3 3 3h18q.825 0 1.413.587Q23 4.175 23 5t-.587 1.413Q21.825 7 21 7Zm0 4v8q0 .825-.587 1.413Q19.825 21 19 21H5q-.825 0-1.412-.587Q3 19.825 3 19v-8h18ZM6 17h6v-2H6v2Z" />
    </svg>
  ),
  pos: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M5 4h14v2H5V4Zm0 4h14v2H5V8Zm0 4h14v2H5v-2Zm0 4h9v2H5v-2Z" />
    </svg>
  ),
  delivery: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M3 6h13v8h2.5l2.5 3.5V20h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3V6Zm2 2v10h.18a2 2 0 0 1 3.64 0H15V8H5Zm12 8h3.34L21 14h-4v2Zm-9 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  ),
  clients: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M12 12q-1.65 0-2.825-1.175Q8 9.65 8 8t1.175-2.825Q10.35 4 12 4t2.825 1.175Q16 6.35 16 8t-1.175 2.825Q13.65 12 12 12Zm-8 8v-1.4q0-.85.438-1.575.437-.725 1.162-1.125A14.2 14.2 0 0 1 9.05 14.65 15.8 15.8 0 0 1 12 14.4q1.525 0 2.95.25t3.45 1.25q.725.4 1.163 1.125.437.725.437 1.575V20Z" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="currentColor" d="M5 19q-.825 0-1.412-.587Q3 17.825 3 17V5q0-.825.588-1.412Q4.175 3 5 3h14q.825 0 1.413.588Q21 4.175 21 5v12q0 .825-.587 1.413Q19.825 19 19 19Zm0-2h14V5H5v12Zm2-2h2v-6H7v6Zm4 0h2V7h-2v8Zm4 0h2v-4h-2v4Z" />
    </svg>
  ),
};

const NAV = [
  { to: "/overview", label: "Daily Report", key: "overview" },
  { to: "/summery", label: "Summary", key: "summary" },
  { to: "/pos", label: "POS", key: "pos" },
  { to: "/delivery", label: "Delivery", key: "delivery" },
  { to: "/sales", label: "Sales", key: "sales" },
  { to: "/products", label: "Products", key: "products" },
  { to: "/clients", label: "Clients", key: "clients" },
  { to: "/expenses", label: "Expenses", key: "expenses" },
  { to: "/cash", label: "Cash", key: "cash" },
  { to: "/whatsapp", label: "WhatsApp", key: "whatsapp" },
];

function getTitle(pathname) {
  const hit = NAV.find((x) => pathname === x.to || pathname.startsWith(x.to + "/"));
  return hit?.label || "Dashboard";
}

function getEmployeeName() {
  try {
    const raw = localStorage.getItem("employee");
    const emp = raw ? JSON.parse(raw) : null;
    return emp?.name || emp?.username || "Employee";
  } catch {
    return "Employee";
  }
}

function clearSession() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("employee");
    localStorage.removeItem("dayOpen");
  } catch {}
}

function SideLink({ to, label, iconKey, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
          isActive ? "active" : "",
          isActive
            ? "bg-white shadow-soft border border-line"
            : "hover:bg-white/70 hover:border-line border border-transparent",
        ].join(" ")
      }
    >
      <span
        className={
          "inline-flex h-9 w-9 items-center justify-center rounded-xl " +
          "bg-base border border-line text-ink/70 group-hover:text-ink"
        }
      >
        {icons[iconKey]}
      </span>
      <span className="font-semibold text-sm text-ink/90 group-hover:text-ink">
        {label}
      </span>
      {/* active indicator */}
      <span
        className={
          "absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-gold " +
          "opacity-0 group-[.active]:opacity-100"
        }
      />
    </NavLink>
  );
}

function MobileDrawer({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[360px] bg-base border-r border-line"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [drawer, setDrawer] = React.useState(false);

  const pageTitle = React.useMemo(() => getTitle(pathname), [pathname]);
  const employee = React.useMemo(() => getEmployeeName(), []);

  const logout = () => {
    clearSession();
    nav("/login");
  };

  const Sidebar = (
    <div className="h-full flex flex-col">
      <div className="p-4">
        <Link to="/overview" className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white border border-line shadow-soft flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png?v=5"
              alt="Zaad Bakery"
              className="h-10 w-10 object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
              draggable="false"
            />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-ink">Zaad Bakery</div>
            <div className="text-xs text-mute">POS & Dashboard</div>
          </div>
        </Link>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-2xl bg-white border border-line shadow-soft px-3 py-3">
          <div className="text-xs text-mute">Signed in</div>
          <div className="font-semibold text-ink truncate">{employee}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-2 overflow-auto">
        {NAV.map((it) => (
          <SideLink
            key={it.to}
            to={it.to}
            label={it.label}
            iconKey={it.key}
            onNavigate={() => setDrawer(false)}
          />
        ))}
      </nav>

      <div className="p-4">
        <button className="ui-btn ui-btn-ghost w-full" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-72">
        <aside className="h-full bg-base/60 backdrop-blur border-r border-line">{Sidebar}</aside>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)}>
        <aside className="h-full bg-base/60 backdrop-blur">{Sidebar}</aside>
      </MobileDrawer>

      {/* Main */}
      <div className="lg:pl-72">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-base/75 backdrop-blur border-b border-line">
          <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center gap-3">
            <button
              className="lg:hidden ui-btn ui-btn-ghost"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Icon className="bg-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
                </svg>
              </Icon>
            </button>

            <div className="min-w-0">
              <div className="text-lg md:text-xl font-extrabold tracking-tight text-ink">
                {pageTitle}
              </div>
              <div className="text-xs text-mute">Modern POS • Clean reporting • Fast workflow</div>
            </div>

            <div className="flex-1" />

            {/* Search (UI only) */}
            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-soft w-[320px]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-mute">
                <path
                  fill="currentColor"
                  d="M9.5 3a6.5 6.5 0 1 0 4.1 11.6l4.9 4.9 1.4-1.4-4.9-4.9A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                />
              </svg>
              <input
                className="w-full bg-transparent outline-none text-sm"
                placeholder="Search (coming soon)…"
                disabled
              />
            </div>

            <button className="ui-btn ui-btn-primary hidden sm:inline-flex" onClick={() => nav("/pos")}>
              New Sale
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-5 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
