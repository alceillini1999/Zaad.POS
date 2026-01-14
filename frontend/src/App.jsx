import React, { useEffect, useMemo, useState } from 'react'
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

// YYYY-MM-DD (local)
function getLocalDateISO() {
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

// Block dashboard pages if day is not opened
function DayOpenedRoute({ children }) {
  const day = getDayOpen()
  const today = getLocalDateISO()
  if (!day || day.date !== today) return <Navigate to="/cash" replace />
  return children
}

/* =========================
   ✅ Login Page (as-is)
   - After login => /cash
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
   ✅ Cash Counting (Denominations)
   ========================= */
const DENOMS = [1000, 500, 200, 100, 50, 40, 20, 10, 5, 1]

function buildInitialCounts() {
  const obj = {}
  for (const d of DENOMS) obj[d] = ''
  return obj
}

function parseNonNegInt(value) {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (!Number.isInteger(n)) return null
  if (n < 0) return null
  return n
}

/* =========================
   ✅ Cash Page (Start Day) — English
   - Count notes by denomination
   - Till No (single field)
   - Mpesa Withdrawal (amount)
   - Save => /overview
   ========================= */
function CashPage() {
  const nav = useNavigate()

  const [counts, setCounts] = useState(buildInitialCounts())
  const [tillNo, setTillNo] = useState('')
  const [mpesaWithdrawal, setMpesaWithdrawal] = useState('0')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const token = getToken()
  if (!token) return <Navigate to="/login" replace />

  const today = getLocalDateISO()

  // If already opened today => go to Overview
  const existing = getDayOpen()
  if (existing && existing.date === today) return <Navigate to="/overview" replace />

  const totalCash = useMemo(() => {
    let sum = 0
    for (const d of DENOMS) {
      const c = parseNonNegInt(counts[d])
      if (c === null) return null
      sum += d * c
    }
    return sum
  }, [counts])

  const onCountChange = (denom, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return
    setCounts((prev) => ({ ...prev, [denom]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setLoading(true)

    try {
      if (totalCash === null) throw new Error('Invalid cash counts (must be whole numbers).')
      if (!tillNo.trim()) throw new Error('Till No is required.')

      const withdrawNum = Number(mpesaWithdrawal || 0)
      if (!Number.isFinite(withdrawNum) || withdrawNum < 0) {
        throw new Error('Invalid Mpesa Withdrawal amount.')
      }

      const breakdown = DENOMS.map((d) => ({
        denom: d,
        count: parseNonNegInt(counts[d]) ?? 0,
        amount: d * (parseNonNegInt(counts[d]) ?? 0),
      }))

      const payload = {
        date: today,
        openingCashTotal: totalCash,
        cashBreakdown: breakdown,
        tillNo: tillNo.trim(),
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
      if (!r.ok) {
        const msg = data?.error || 'Failed to save Start Day.'
        throw new Error(msg)
      }

      setDayOpen({
        date: today,
        openId: data?.openId || data?.id || null,
        openingCashTotal: totalCash,
        cashBreakdown: breakdown,
        tillNo: tillNo.trim(),
        mpesaWithdrawal: withdrawNum,
        openedAt: payload.openedAt,
      })

      setOk('Start Day saved successfully.')
      nav('/overview', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'Failed to save.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <WrapSurface className="cash-page">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Start Day — Cash Setup</h2>
          <p className="text-sm opacity-80 mb-6">
            Count cash notes, then enter Till No and Mpesa Withdrawal to begin the day.
          </p>

          <form onSubmit={submit} className="space-y-6">
            <div className="bg-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Cash Count (by denomination)</h3>
                <div className="text-sm opacity-90">
                  Total:{' '}
                  <span className="font-bold">
                    {totalCash === null ? '—' : `KSh ${totalCash}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DENOMS.map((d) => {
                  const c = parseNonNegInt(counts[d])
                  const amount = c === null ? '—' : d * c
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <div className="w-24 font-semibold">KSh {d}</div>
                      <input
                        className="w-32"
                        value={counts[d]}
                        onChange={(e) => onCountChange(d, e.target.value)}
                        inputMode="numeric"
                        placeholder="Count"
                      />
                      <div className="text-sm opacity-90">
                        Amount:{' '}
                        <span className="font-semibold">
                          {amount === '—' ? '—' : `KSh ${amount}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Mpesa Till No</label>
                <input
                  className="w-full"
                  value={tillNo}
                  onChange={(e) => setTillNo(e.target.value)}
                  placeholder="e.g. 123456"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Mpesa Withdrawal (Start Day)</label>
                <input
                  className="w-full"
                  value={mpesaWithdrawal}
                  onChange={(e) => setMpesaWithdrawal(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 0"
                />
              </div>
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}
            {ok && <div className="text-sm text-green-700">{ok}</div>}

            <button disabled={loading} className="btn-gold" type="submit">
              {loading ? 'Saving...' : 'Start Day'}
            </button>
          </form>
        </div>
      </WrapSurface>
    </PageWrapper>
  )
}

/* =========================
   ✅ End Day Modal — English
   - Count closing cash by denomination
   - Till No + Mpesa Withdrawal (End Day)
   - Save => logout
   ========================= */
function EndDayModal({ open, onClose }) {
  const nav = useNavigate()

  const [counts, setCounts] = useState(buildInitialCounts())
  const [tillNo, setTillNo] = useState('')
  const [mpesaWithdrawal, setMpesaWithdrawal] = useState('0')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Prefill Till No from Start Day when modal opens
  useEffect(() => {
    if (!open) return
    const day = getDayOpen()
    if (day?.tillNo && !tillNo) setTillNo(String(day.tillNo))
  }, [open]) // intentionally not depending on tillNo to avoid re-running

  const closingTotal = useMemo(() => {
    let sum = 0
    for (const d of DENOMS) {
      const c = parseNonNegInt(counts[d])
      if (c === null) return null
      sum += d * c
    }
    return sum
  }, [counts])

  const onCountChange = (denom, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return
    setCounts((prev) => ({ ...prev, [denom]: value }))
  }

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      if (closingTotal === null) throw new Error('Invalid cash counts (must be whole numbers).')
      if (!tillNo.trim()) throw new Error('Till No is required.')

      const withdrawNum = Number(mpesaWithdrawal || 0)
      if (!Number.isFinite(withdrawNum) || withdrawNum < 0) {
        throw new Error('Invalid Mpesa Withdrawal amount.')
      }

      const day = getDayOpen()
      const today = getLocalDateISO()

      const breakdown = DENOMS.map((d) => ({
        denom: d,
        count: parseNonNegInt(counts[d]) ?? 0,
        amount: d * (parseNonNegInt(counts[d]) ?? 0),
      }))

      const payload = {
        date: today,
        openId: day?.openId || null,
        closingCashTotal: closingTotal,
        cashBreakdown: breakdown,
        tillNo: tillNo.trim(),
        mpesaWithdrawal: withdrawNum,
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
      if (!r.ok) throw new Error(data?.error || 'Failed to save End Day.')

      clearSession()
      onClose?.()
      nav('/login', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'Failed to save End Day.')
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
        className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-2">End Day</h3>
        <p className="text-sm text-[#555] mb-4">
          Count closing cash by denomination. Enter Till No and Mpesa Withdrawal. After saving, you will be logged out automatically.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Closing Cash Count</div>
            <div className="text-sm text-[#111]">
              Total:{' '}
              <span className="font-bold">
                {closingTotal === null ? '—' : `KSh ${closingTotal}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DENOMS.map((d) => {
              const c = parseNonNegInt(counts[d])
              const amount = c === null ? '—' : d * c
              return (
                <div key={d} className="flex items-center gap-3">
                  <div className="w-24 font-semibold text-[#111]">KSh {d}</div>
                  <input
                    className="w-32"
                    value={counts[d]}
                    onChange={(e) => onCountChange(d, e.target.value)}
                    inputMode="numeric"
                    placeholder="Count"
                  />
                  <div className="text-sm text-[#111] opacity-80">
                    Amount:{' '}
                    <span className="font-semibold">
                      {amount === '—' ? '—' : `KSh ${amount}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Mpesa Till No</label>
              <input
                className="w-full"
                value={tillNo}
                onChange={(e) => setTillNo(e.target.value)}
                placeholder="e.g. 123456"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Mpesa Withdrawal (End Day)</label>
              <input
                className="w-full"
                value={mpesaWithdrawal}
                onChange={(e) => setMpesaWithdrawal(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 0"
              />
            </div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex gap-2">
            <button disabled={loading} className="btn-gold" type="submit">
              {loading ? 'Saving...' : 'Save & End Day'}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-[#ddd] text-[#111]"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================
   ✅ Floating End Day Button
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
        title="End Day"
      >
        End Day
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/cash"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <WrapSurface className="cash-page">
                  <CashPage />
                </WrapSurface>
              </PageWrapper>
            </ProtectedRoute>
          }
        />

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
