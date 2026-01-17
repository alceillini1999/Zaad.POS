import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OverviewPage from './pages/OverviewPage'
import ProductsPage from './pages/ProductsPage'
import ExpensesPage from './pages/ExpensesPage'
import SalesPage from './pages/SalesPage'
import POSPage from './pages/POSPage'
import ClientsPage from './pages/ClientsPage'
import WhatsAppPage from './pages/WhatsAppPage'
import SummeryPage from './pages/SummeryPage'

/* ======================
   Helpers / Session
====================== */
function getToken() {
  try {
    return localStorage.getItem('token') || ''
  } catch {
    return ''
  }
}
function getEmployee() {
  try {
    const raw = localStorage.getItem('employee')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function clearSession() {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('employee')
    localStorage.removeItem('dayOpen')
  } catch {}
}
function setDayOpen(day) {
  try {
    localStorage.setItem('dayOpen', JSON.stringify(day))
  } catch {}
}
function getDayOpen() {
  try {
    const raw = localStorage.getItem('dayOpen')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function getLocalDateISO() {
  const d = new Date()
  // local YYYY-MM-DD
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* ======================
   UI Wrappers
====================== */
function AppBackground({ children }) {
  return (
    <div
      className="min-h-screen text-ink bg-base"
      style={{
        backgroundImage:
          "radial-gradient(900px 320px at 12% 0%, rgba(197,122,42,0.18), transparent 60%), radial-gradient(820px 300px at 92% 10%, rgba(31,157,138,0.14), transparent 55%)",
      }}
    >
      {children}
    </div>
  )
}
function PageWrapper({ children }) {
  return (
    <motion.div
      className=""
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  )
}

/* ======================
   Day Open Gate
====================== */
function DayOpenedRoute({ children }) {
  const today = getLocalDateISO()
  const day = getDayOpen()
  if (!day || day.date !== today) return <Navigate to="/cash" replace />
  return children
}

/* ======================
   Cash Denominations
====================== */
// Include 1 KSh as requested
const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1]

function buildInitialCounts() {
  const obj = {}
  for (const d of DENOMS) obj[d] = ''
  return obj
}
function parseNonNegInt(v) {
  if (v === '') return 0
  if (v == null) return null
  const s = String(v).trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function parseNonNegNumber(v) {
  if (v === '') return 0
  if (v == null) return null
  const s = String(v).replace(/,/g, '').trim()
  if (s === '') return 0
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/* ======================
   Cash Page (UPDATED)
   - Start Day: enter morning cash + Save
   - End Day: enter evening cash + Save & logout
====================== */
function CashPage() {
  const nav = useNavigate()

  const token = getToken()
  if (!token) return <Navigate to="/login" replace />

  const today = getLocalDateISO()

  // Keep a local state copy so UI updates immediately after Start/End Day
  const [dayOpenState, setDayOpenState] = useState(() => getDayOpen())
  const isOpenedToday = !!dayOpenState && dayOpenState.date === today

  const [counts, setCounts] = useState(buildInitialCounts())
  const [tillNo, setTillNo] = useState(dayOpenState?.tillNo ? String(dayOpenState.tillNo) : '')
  // Payment methods (besides cash)
  const [withdrawalCash, setWithdrawalCash] = useState(
    dayOpenState?.withdrawalCash != null
      ? String(dayOpenState.withdrawalCash)
      : String(dayOpenState?.mpesaWithdrawal ?? 0)
  )
  const [sendMoney, setSendMoney] = useState(dayOpenState?.sendMoney != null ? String(dayOpenState.sendMoney) : '0')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  // Reset form when switching between "Start Day" and "End Day"
  useEffect(() => {
    setCounts(buildInitialCounts())
    setErr('')
    setOk('')
    if (isOpenedToday && dayOpenState?.tillNo) setTillNo(String(dayOpenState.tillNo))
    if (isOpenedToday) {
      setWithdrawalCash(String(dayOpenState?.withdrawalCash ?? dayOpenState?.mpesaWithdrawal ?? 0))
      setSendMoney(String(dayOpenState?.sendMoney ?? 0))
    } else {
      setWithdrawalCash('0')
      setSendMoney('0')
    }
  }, [isOpenedToday]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const buildBreakdown = () =>
    DENOMS.map((d) => ({
      denom: d,
      count: parseNonNegInt(counts[d]) ?? 0,
      amount: d * (parseNonNegInt(counts[d]) ?? 0),
    }))

  const submitStartDay = async (e) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setLoading(true)

    try {
      if (totalCash === null) throw new Error('Please enter valid whole numbers for cash counts.')
      if (!tillNo.trim()) throw new Error('Till Number is required.')

      const withdrawalNum = parseNonNegNumber(withdrawalCash)
      if (withdrawalNum === null) throw new Error('Withdrawal Cash must be a non-negative number.')

      const sendMoneyNum = parseNonNegNumber(sendMoney)
      if (sendMoneyNum === null) throw new Error('Send Money must be a non-negative number.')

      const payload = {
        date: today,
        openingCashTotal: totalCash,
        cashBreakdown: buildBreakdown(),
        tillNo: tillNo.trim(),
        // Back-compat: backend currently reads mpesaWithdrawal. We also send a clearer name.
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
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
      if (!r.ok) throw new Error(data?.error || 'Failed to save Start Day.')

      const newDay = {
        date: today,
        openId: data?.openId || data?.id || null,
        openingCashTotal: totalCash,
        cashBreakdown: payload.cashBreakdown,
        tillNo: tillNo.trim(),
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
        openedAt: payload.openedAt,
      }

      setDayOpen(newDay)
      setDayOpenState(newDay)
      setOk('Start Day saved successfully.')
    } catch (e2) {
      setErr(e2.message || 'Failed to save Start Day.')
    } finally {
      setLoading(false)
    }
  }

  const submitEndDay = async (e) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setLoading(true)

    try {
      if (totalCash === null) throw new Error('Please enter valid whole numbers for cash counts.')
      if (!tillNo.trim()) throw new Error('Till Number is required.')

      const withdrawalNum = parseNonNegNumber(withdrawalCash)
      if (withdrawalNum === null) throw new Error('Withdrawal Cash must be a non-negative number.')

      const sendMoneyNum = parseNonNegNumber(sendMoney)
      if (sendMoneyNum === null) throw new Error('Send Money must be a non-negative number.')

      const payload = {
        date: today,
        openId: dayOpenState?.openId || null,
        closingCashTotal: totalCash,
        cashBreakdown: buildBreakdown(),
        tillNo: tillNo.trim(),
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
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
      setDayOpenState(null)
      nav('/login', { replace: true })
    } catch (e2) {
      setErr(e2.message || 'Failed to save End Day.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4" style={{ color: '#111' }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold">
            {isOpenedToday ? 'End Day (Evening Balances)' : 'Start Day (Morning Balances)'}
          </h2>
          <div className="text-sm opacity-80">Date: {today}</div>
        </div>

        {isOpenedToday && (
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-black/20 bg-white/70 hover:bg-white/90"
            onClick={() => nav('/overview')}
          >
            Go to Overview
          </button>
        )}
      </div>

      {isOpenedToday && (
        <div className="text-sm opacity-80 mb-3">
          Morning cash recorded: <b>KSh {Number(dayOpenState?.openingCashTotal || 0)}</b>
        </div>
      )}

      <form onSubmit={isOpenedToday ? submitEndDay : submitStartDay} className="space-y-4">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.75)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Payment Methods</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Withdrawal Cash (KSh)</label>
              <input
                value={withdrawalCash}
                onChange={(e) => setWithdrawalCash(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.2)',
                  background: 'white',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Till Number</label>
              <input
                value={tillNo}
                onChange={(e) => setTillNo(e.target.value)}
                placeholder="e.g. TILL-1"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.2)',
                  background: 'white',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Send Money (KSh)</label>
              <input
                value={sendMoney}
                onChange={(e) => setSendMoney(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.2)',
                  background: 'white',
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.75)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Cash (by denominations)</h3>
            <div className="text-sm opacity-90">
              Total Cash: <span className="font-bold">{totalCash === null ? '—' : `KSh ${totalCash}`}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DENOMS.map((d) => (
              <div key={d} className="flex items-center gap-3">
                <div className="w-28 font-semibold">KSh {d}</div>
                <input
                  value={counts[d]}
                  onChange={(e) => onCountChange(d, e.target.value)}
                  inputMode="numeric"
                  placeholder="Count"
                  style={{
                    width: 140,
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.2)',
                    background: 'white',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {err && <div className="text-sm" style={{ color: '#b00020' }}>{err}</div>}
        {ok && <div className="text-sm" style={{ color: '#1b5e20' }}>{ok}</div>}

        <button disabled={loading} className="btn-gold" type="submit">
          {loading ? 'Saving...' : isOpenedToday ? 'End Day' : 'Start Day'}
        </button>
      </form>
    </div>
  )
}

/* ======================
   End Day Modal (kept)
   (no longer used since we removed floating button)
====================== */
function EndDayModal({ open, onClose }) {
  const nav = useNavigate()

  const [counts, setCounts] = useState(buildInitialCounts())
  const [tillNo, setTillNo] = useState('')
  const [closingTillTotal, setClosingTillTotal] = useState('0')
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

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      if (closingTotal === null) throw new Error('Invalid cash counts (must be whole numbers).')
      if (!tillNo.trim()) throw new Error('Till No is required.')

      const withdrawNum = Number(closingTillTotal || 0)
      if (!Number.isFinite(withdrawNum) || withdrawNum < 0) {
        throw new Error('Invalid Closing Till amount.')
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
        closingTillTotal: withdrawNum,
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

  if (!open) return null

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
        <p className="text-sm text-[#555] mb-4">Count closing cash, then save.</p>

        <form onSubmit={submit} className="space-y-4">
          <div className="bg-black/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Cash Count</div>
              <div className="text-sm">
                Total:{' '}
                <span className="font-bold">
                  {closingTotal === null ? '—' : `KSh ${closingTotal}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DENOMS.map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <div className="w-24 font-semibold">KSh {d}</div>
                  <input
                    className="w-32"
                    value={counts[d]}
                    onChange={(e) => onCountChange(d, e.target.value)}
                    inputMode="numeric"
                    placeholder="Count"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Till No</label>
              <input
                className="w-full"
                value={tillNo}
                onChange={(e) => setTillNo(e.target.value)}
                placeholder="e.g., TILL-1"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Closing Till Amount</label>
              <input
                className="w-full"
                value={closingTillTotal}
                onChange={(e) => setClosingTillTotal(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex items-center justify-end gap-2">
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

/* ======================
   Floating End Day Control (kept but NOT rendered now)
====================== */
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
        className="fixed bottom-5 right-5 z-[9998] px-4 py-3 rounded-2xl shadow-lg border border-[#eee] 
        bg-white text-[#111] hover:bg-[#f7f7f7] font-semibold"
      >
        End Day
      </button>
      <EndDayModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/* ======================
   Routes
====================== */
function RoutedPages() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/cash"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="cash-page space-y-6">
                  <CashPage />
                </div>
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
                  <div className="overview-page space-y-6">
                    <OverviewPage />
                  </div>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/summery"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <div className="summery-page space-y-6">
                    <SummeryPage />
                  </div>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <div className="space-y-6">
                    <Dashboard />
                  </div>
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
                  <div className="products-page space-y-6">
                    <ProductsPage />
                  </div>
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
                  <div className="expenses-page space-y-6">
                    <ExpensesPage />
                  </div>
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
                  <div className="space-y-6">
                    <POSPage />
                  </div>
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
                  <div className="clients-page space-y-6">
                    <ClientsPage />
                  </div>
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
                  <div className="sales-page space-y-6">
                    <SalesPage />
                  </div>
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
                  <div className="space-y-6">
                    <WhatsAppPage />
                  </div>
                </PageWrapper>
              </DayOpenedRoute>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

/* ======================
   App Shell (UPDATED)
   - Removed floating end-day button
====================== */
function AppShell() {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  return (
    <AppBackground>
      <div className="min-h-screen relative z-10">
        {isLogin ? (
          <RoutedPages />
        ) : (
          <Layout>
            <RoutedPages />
          </Layout>
        )}
      </div>
    </AppBackground>
  )
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  )
}
