import React, { useMemo, useState } from 'react'
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
   ✅ Helpers
   ========================= */
function getToken() {
  return localStorage.getItem('token') || ''
}

function getEmployee() {
  try {
    return JSON.parse(localStorage.getItem('employee') || '{}')
  } catch {
    return {}
  }
}

// تاريخ اليوم بصيغة YYYY-MM-DD حسب توقيت الجهاز
function getLocalDateISO() {
  // en-CA يعطي YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA')
}

function getDayOpen() {
  try {
    return JSON.parse(localStorage.getItem('day_open') || 'null')
  } catch {
    return null
  }
}

function setDayOpen(payload) {
  localStorage.setItem('day_open', JSON.stringify(payload))
}

function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('employee')
  localStorage.removeItem('day_open')
}

/* =========================
   ✅ Guards
   ========================= */
function ProtectedRoute({ children }) {
  const location = useLocation()
  const token = getToken()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

// يمنع الدخول لأي صفحة غير /cash إذا لم يتم فتح اليوم (Opening Cash)
function DayOpenedRoute({ children }) {
  const day = getDayOpen()
  const today = getLocalDateISO()

  // لو لا يوجد day_open أو تاريخ قديم => لازم يروح /cash
  if (!day || day.date !== today) return <Navigate to="/cash" replace />
  return children
}

/* =========================
   ✅ Login Page
   ========================= */
function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const tokenAlready = useMemo(() => !!getToken(), [])
  if (tokenAlready) return <Navigate to="/cash" replace />

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

      // ✅ بعد تسجيل الدخول: نبدأ دائمًا من صفحة الكاش (فتح اليوم)
      const from = location.state?.from
      nav(from || '/cash', { replace: true })
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
   ✅ Cash Page (Start Day)
   - Opening cash
   - Mpesa till no
   - Mpesa withdrawal
   - After save => /overview
   ========================= */
function CashPage() {
  const nav = useNavigate()

  const [openingCash, setOpeningCash] = useState('')
  const [mpesaTillNo, setMpesaTillNo] = useState('')
  const [mpesaWithdrawal, setMpesaWithdrawal] = useState('0')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const token = getToken()
  if (!token) return <Navigate to="/login" replace />

  // لو اليوم مفتوح بالفعل، ادخل للصفحة الرئيسية
  const existing = getDayOpen()
  const today = getLocalDateISO()
  if (existing && existing.date === today) return <Navigate to="/overview" replace />

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setLoading(true)

    try {
      const openCashNum = Number(openingCash)
      const withdrawNum = Number(mpesaWithdrawal || 0)

      if (!Number.isFinite(openCashNum) || openCashNum < 0) throw new Error('قيمة افتتاحية الكاش غير صحيحة')
      if (!mpesaTillNo.trim()) throw new Error('أدخل Mpesa Till No')
      if (!Number.isFinite(withdrawNum) || withdrawNum < 0) throw new Error('قيمة Mpesa Withdrawal غير صحيحة')

      const payload = {
        date: today,
        openingCash: openCashNum,
        mpesaTillNo: mpesaTillNo.trim(),
        mpesaWithdrawal: withdrawNum,
        employee: getEmployee(),
        openedAt: new Date().toISOString(),
      }

      const r = await fetch('/api/cash/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'فشل حفظ افتتاحية اليوم')

      // نخزن حالة فتح اليوم محليًا، ويمكن حفظ رقم السجل القادم من السيرفر إن وجد
      setDayOpen({
        date: today,
        openId: data?.openId || data?.id || null,
        openingCash: openCashNum,
        mpesaTillNo: mpesaTillNo.trim(),
        mpesaWithdrawal: withdrawNum,
        openedAt: payload.openedAt,
      })

      setOk('تم حفظ افتتاحية اليوم بنجاح')
      nav('/overview', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'فشل حفظ البيانات')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <WrapSurface className="cash-page">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">بداية اليوم - صفحة الكاش</h2>
          <p className="text-sm opacity-80 mb-6">سجّل افتتاحية الكاش وبيانات Mpesa قبل بدء البيع</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">الكاش الموجود في الكاشير (Opening Cash)</label>
              <input
                className="w-full"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                inputMode="decimal"
                placeholder="مثال: 1500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Mpesa Till No</label>
              <input
                className="w-full"
                value={mpesaTillNo}
                onChange={(e) => setMpesaTillNo(e.target.value)}
                placeholder="مثال: 123456"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Mpesa Withdrawal (بداية اليوم)</label>
              <input
                className="w-full"
                value={mpesaWithdrawal}
                onChange={(e) => setMpesaWithdrawal(e.target.value)}
                inputMode="decimal"
                placeholder="مثال: 0"
              />
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}
            {ok && <div className="text-sm text-green-700">{ok}</div>}

            <button disabled={loading} className="btn-gold" type="submit">
              {loading ? 'جاري الحفظ...' : 'بدء اليوم'}
            </button>
          </form>
        </div>
      </WrapSurface>
    </PageWrapper>
  )
}

/* =========================
   ✅ End Day Modal (Close Day + Logout)
   ========================= */
function EndDayModal({ open, onClose }) {
  const nav = useNavigate()
  const [closingCash, setClosingCash] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      const closeCashNum = Number(closingCash)
      if (!Number.isFinite(closeCashNum) || closeCashNum < 0) throw new Error('قيمة كاش نهاية اليوم غير صحيحة')

      const day = getDayOpen()
      const today = getLocalDateISO()

      const payload = {
        date: today,
        openId: day?.openId || null,
        closingCash: closeCashNum,
        employee: getEmployee(),
        closedAt: new Date().toISOString(),
      }

      const r = await fetch('/api/cash/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'فشل حفظ نهاية اليوم')

      // بعد إغلاق اليوم: Logout
      clearSession()
      onClose?.()
      nav('/login', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'فشل إنهاء اليوم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2">إنهاء اليوم</h3>
        <p className="text-sm text-[#555] mb-4">سجّل كاش نهاية اليوم ثم سيتم تسجيل الخروج تلقائيًا</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">الكاش في نهاية اليوم (Closing Cash)</label>
            <input
              className="w-full"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              inputMode="decimal"
              placeholder="مثال: 9800"
              required
            />
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex gap-2">
            <button disabled={loading} className="btn-gold" type="submit">
              {loading ? 'جاري الحفظ...' : 'حفظ وإنهاء اليوم'}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-[#ddd] text-[#111]"
              onClick={onClose}
              disabled={loading}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================
   ✅ Floating End Day Button
   - يظهر فقط إذا:
     - يوجد token
     - اليوم مفتوح
     - وليس في /login أو /cash
   ========================= */
function EndDayFloatingControl() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const token = getToken()
  const day = getDayOpen()
  const today = getLocalDateISO()

  const isLogin = location.pathname === '/login'
  const isCash = location.pathname === '/cash'

  const canShow = !!token && day && day.date === today && !isLogin && !isCash

  if (!canShow) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[9998] px-4 py-3 rounded-2xl shadow-lg border border-[#eee] bg-white"
        title="إنهاء اليوم"
      >
        إنهاء اليوم
      </button>

      <EndDayModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/* =========================
   ✅ Fallback
   ========================= */
function NotFoundOrLogin() {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return (
    <PageWrapper>
      <div className="p-6 text-mute">Not Found</div>
    </PageWrapper>
  )
}

/* =========================
   ✅ Routes
   ========================= */
function RoutedPages() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ✅ يبدأ المشروع من صفحة تسجيل الدخول */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login (بدون Layout) */}
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ صفحة فتح اليوم (الكاش) - محمية فقط بـ token */}
        <Route
          path="/cash"
          element={
            <ProtectedRoute>
              <CashPage />
            </ProtectedRoute>
          }
        />

        {/* ✅ صفحات محمية + تتطلب فتح اليوم */}
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="overview-page">
                    <OverviewPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="whatsapp-page">
                    <WhatsAppPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="products-page">
                    <ProductsPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="expenses-page">
                    <ExpensesPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="pos-page">
                    <POSPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="clients-page">
                    <ClientsPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <WrapSurface className="sales-page">
                    <SalesPage />
                  </WrapSurface>
                </PageWrapper>
              </DayOpenedRoute>
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
      <div className="min-h-screen relative z-10">
        {/* زر إنهاء اليوم (يظهر حسب الشروط) */}
        <EndDayFloatingControl />

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
