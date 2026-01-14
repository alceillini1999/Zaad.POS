import React from "react";
import { NavLink, Link } from "react-router-dom";

/** شريط ساعة بسيط في الهيدر */
function Clock() {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-xs md:text-sm opacity-80">{now.toLocaleTimeString()}</span>;
}

/** عنصر رابط جانبي موحّد */
function SideItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block w-full text-left px-4 py-2 rounded-xl transition
         ${isActive ? "bg-white text-black shadow-sm" : "text-white/90 hover:bg-white/10"}`
      }
    >
      {children}
    </NavLink>
  );
}

/**
 * Layout عام للتطبيق — كل الخلفيات صارت شفافة تمامًا
 * حتى لا تغطي الخلفية المتحركة (AppBackground).
 */
export default function Layout({ children, className = "" }) {
  return (
    <div className={`min-h-screen bg-transparent text-white ${className}`}>
      {/* Header شفاف */}
      <header
        className="sticky top-0 z-30 bg-transparent backdrop-blur border-b border-white/10"
        role="banner"
      >
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/overview" className="flex items-center gap-3">
            {/* ✅ تكبير اللوجو + كسر كاش الصورة */}
            <img
              src="/logo.png?v=4"
              alt="Zaad Bakery"
              className="h-12 md:h-14 w-auto select-none object-contain drop-shadow-lg"
              onError={(e) => (e.currentTarget.style.display = "none")}
              draggable="false"
            />

            <div className="leading-tight">
              <div className="font-bold tracking-wide text-base md:text-lg">Zaad Bakery</div>
              <div className="text-white/70 text-xs md:text-sm">Egyptian Bakery</div>
            </div>
          </Link>

          <Clock />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-2 md:px-4 py-4 md:py-6 flex gap-4">
        {/* Sidebar شفاف مع حد خفيف */}
        <aside
          className="hidden md:flex md:w-60 shrink-0 bg-transparent border border-white/10 rounded-2xl p-3 backdrop-blur"
          role="navigation"
          aria-label="Sidebar"
        >
          <nav className="flex flex-col gap-2 w-full">
            {/* ✅ إضافة لوجو داخل السايدبار بدل نص فقط */}
            <Link to="/overview" className="flex items-center gap-3 px-3 py-2">
              <img
                src="/logo.png?v=4"
                alt="Zaad Bakery"
                className="h-12 w-auto object-contain drop-shadow-lg"
                onError={(e) => (e.currentTarget.style.display = "none")}
                draggable="false"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold opacity-95">Zaad Bakery</div>
                <div className="text-xs opacity-70">Egyptian Bakery</div>
              </div>
            </Link>

            <div className="h-px bg-white/10 my-1" />

            <SideItem to="/overview">Overview</SideItem>
            <SideItem to="/whatsapp">WhatsApp</SideItem>
            <SideItem to="/products">Products</SideItem>
            <SideItem to="/expenses">Expenses</SideItem>
            <SideItem to="/pos">POS</SideItem>
            <SideItem to="/clients">Clients</SideItem>
            <SideItem to="/sales">Sales</SideItem>
          </nav>
        </aside>

        {/* المحتوى الرئيسي — بدون أي خلفية صلبة */}
        <main className="flex-1 bg-transparent" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
