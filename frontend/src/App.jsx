import React, { useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Layout from './components/Layout'

import OverviewPage from './pages/OverviewPage'
import WhatsAppPage from './pages/WhatsAppPage'
import ProductsPage from './pages/ProductsPage'
import ExpensesPage from './pages/ExpensesPage'
import POSPage from './pages/POSPage'
import ClientsPage from './pages/ClientsPage'
import SalesPage from './pages/SalesPage'

import { AnimatePresence } from 'framer-motion'
import PageWrapper from './ui/anim/PageWrapper'
import AppBackground from './ui/theme/AppBackground'

function WrapSurface({ children, className = '' }) {
  return <div className={`page-surface ${className}`}>{children}</div>
}

/* =========================
   ✅ Auth Helpers (Frontend)
   - Token يُحفظ محليًا فقط (localStorage)
   - السيرفر يتحقق من الجلسة في Google Sheets
   ========================= */
function getToken() {
  return localStorage.getItem('token') || ''
}

function ProtectedRoute({ children }) {
  const location = useLocation()
  const token = getToken()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/* =========================
   ✅ Login Page (Inline)
   - POST /api/auth/login
   - يحفظ token + employee في localStorage
   ========================= */
function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // ✅ أفضل من useMemo([]): فحص مباشر كل render
  if (getToken()) return <Navigate to="/overview" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      const u = username.trim()
      const p = pin.trim()

      if (!u || !p) throw new Error('أدخل اسم المستخدم و PIN')

      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ username: u, pin: p }),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Login failed')

      if (!data?.token) throw new Error('Missing token from server response')

      localStorage.setItem('token', data.token)
      localStorage.setItem('employee', JSON.stringify(data.employee || {}))

      // يرجع للمسار المطلوب قبل التحويل للّوجين، أو يفتح overview
      const from = location.state?.from
      nav(from || '/overview', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-lg">
          <h1 className="text-xl font-bold text-[#111] mb-2">تسجيل دخول الموظفين</h1>
          <p className="text-sm text-[#555] mb-6">قم بتسجيل الدخول لبدء اليوم</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">اسم المستخدم</label>
              <input
                className="w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#111] mb-1">PIN</label>
              <input
                className="w-full"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="مثال: 1234"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
              />
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}

            <button disabled={loading} className="w-full btn-gold" type="submit">
              {loading ? 'جاري تسجيل الدخول...' : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    </PageWrapper>
  )
}

/* =========================
   ✅ Cash Page (Placeholder)
   ========================= */
function CashPage() {
  return (
    <PageWrapper>
      <WrapSurface className="cash-page">
        <h2 className="text-2xl font-bold mb-4">الكاش</h2>
        <p className="text-sm opacity-90">
          هذه صفحة الكاش. يمكننا لاحقًا إضافة: افتتاحية الكاش، سحب/إيداع، إغلاق اليوم، وملخص.
        </p>
      </WrapSurface>
    </PageWrapper>
  )
}

function NotFoundOrLogin() {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return (
    <PageWrapper>
      <div className="p-6 text-mute">Not Found</div>
    </PageWrapper>
  )
}

function RoutedPages() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ✅ يبدأ المشروع من صفحة تسجيل الدخول */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login (بدون Layout) */}
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ صفحات محمية */}
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="overview-page">
                  <OverviewPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="whatsapp-page">
                  <WhatsAppPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="products-page">
                  <ProductsPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="expenses-page">
                  <ExpensesPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="pos-page">
                  <POSPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="clients-page">
                  <ClientsPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="sales-page">
                  <SalesPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />

        {/* ✅ صفحة الكاش */}
        <Route
          path="/cash"
          element={
            <ProtectedRoute>
              <CashPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundOrLogin />} />
      </Routes>
    </AnimatePresence>
  )
}

function AppShell() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  return (
    <AppBackground>
      {/* هذا السطح يضمن أن المحتوى فوق الخلفية */}
      <div className="min-h-screen relative z-10">
        {isLogin ? (
          <RoutedPages />
        ) : (
          <Layout className="motion-ready">
            <RoutedPages />
          </Layout>
        )}
      </div>
    </AppBackground>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
