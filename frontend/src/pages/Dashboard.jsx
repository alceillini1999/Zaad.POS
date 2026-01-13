// src/pages/Dashboard.jsx
import React from "react";

/**
 * Dashboard (Overview) — تصميم عصري باستخدام Tailwind CSS
 * يحتوي: بطاقات إحصاءات، مخطط مبسط (SVG placeholder)، نشاط حديث وقائمة سريعة.
 * هذه الصفحة تستخدم بيانات ثابتة كمثال — اربطها لاحقاً بالـ API لعرض بيانات حقيقية.
 */

function StatCard({ title, value, delta, icon }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex items-start gap-4">
      <div className="flex-shrink-0 bg-yellow-50 p-3 rounded-lg">
        {icon}
      </div>

      <div className="flex-1">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="mt-1 text-2xl font-bold text-gray-800">{value}</div>
        {delta && <div className="text-sm text-green-600 mt-1">{delta}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  // بيانات مثال
  const stats = [
    { title: "Total Sales", value: "$18,245", delta: "+8% vs last week", icon: <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3v18h18" /></svg> },
    { title: "Active Clients", value: "134", delta: "+3 new", icon: <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A7 7 0 1118.88 6.196" /></svg> },
    { title: "Products in Stock", value: "298", delta: "-2 low", icon: <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7l9-4 9 4v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg> },
  ];

  const recent = [
    "New client added: Ahmed Khaled",
    "Order #A123 completed",
    "Stock updated: Coffee Beans +20",
    "Expense recorded: Utilities $450",
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of store performance & recent activity</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-3 py-2 rounded border hover:bg-gray-100 text-sm">Filter</button>
            <button className="px-4 py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-white text-sm">New Sale</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <StatCard key={i} title={s.title} value={s.value} delta={s.delta} icon={s.icon} />
          ))}
        </div>

        {/* Main content: chart + recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart area (use a real chart lib later) */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Sales (Last 30 days)</h3>
              <div className="text-sm text-gray-500">USD</div>
            </div>

            {/* Simple SVG sparkline / area placeholder */}
            <div className="w-full h-56">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fff7ed" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* area */}
                <path d="M0,30 C10,20 25,15 40,12 C55,10 70,8 85,7 C95,6 100,5 100,5 L100,40 L0,40 Z" fill="url(#g)" />
                {/* line */}
                <path d="M0,30 C10,20 25,15 40,12 C55,10 70,8 85,7 C95,6 100,5" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* quick stats under chart */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                <div className="text-xs text-gray-500">Avg sale</div>
                <div className="font-semibold text-gray-800 mt-1">$45.20</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                <div className="text-xs text-gray-500">Orders</div>
                <div className="font-semibold text-gray-800 mt-1">1,234</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                <div className="text-xs text-gray-500">Conversion</div>
                <div className="font-semibold text-gray-800 mt-1">3.2%</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm">
                <div className="text-xs text-gray-500">Return rate</div>
                <div className="font-semibold text-gray-800 mt-1">1.1%</div>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Activity</h3>
            <ul className="space-y-3 text-gray-600">
              {recent.map((r, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-yellow-500" />
                  <div>
                    <div className="text-sm">{r}</div>
                    <div className="text-xs text-gray-400 mt-1">just now</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 text-center">
              <button className="text-sm text-yellow-600 hover:underline">View all activity</button>
            </div>
          </div>
        </div>

        {/* Shortcuts / quick links */}
        <div className="bg-white rounded-xl shadow p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg">New Order</button>
            <button className="px-4 py-2 border rounded-lg">Add Product</button>
            <button className="px-4 py-2 border rounded-lg">Add Client</button>
            <button className="px-4 py-2 border rounded-lg">Export CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}
