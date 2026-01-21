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
import ManagerRoute from './components/ManagerRoute'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OverviewPage from './pages/OverviewPage'
import ProductsPage from './pages/ProductsPage'
import ExpensesPage from './pages/ExpensesPage'
import SalesPage from './pages/SalesPage'
import POSPage from './pages/POSPage'
import DeliveryPage from './pages/DeliveryPage'
import ClientsPage from './pages/ClientsPage'
import WhatsAppPage from './pages/WhatsAppPage'
import SummeryPage from './pages/SummeryPage'
import { AuthProvider, useAuth } from './context/AuthContext'

/* ======================
   Helpers
====================== */
function getLocalDateISO() {
  const d = new Date()
  // local YYYY-MM-DD
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function fetchJsonWithTimeout(input, init = {}, timeoutMs = 2500) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  } finally {
    clearTimeout(t)
  }
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
  const location = useLocation()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      const today = getLocalDateISO()

      try {
        const { res: r, data } = await fetchJsonWithTimeout(
          `/api/cash/today?date=${encodeURIComponent(today)}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
          2500
        )

        if (r.status === 401 || r.status === 403) {
          if (!cancelled) setStatus('login')
          return
        }

        if (r.ok && data?.found) {
          if (!cancelled) setStatus('ok')
          return
        }

        if (!cancelled) setStatus('cash')
      } catch (e) {
        // If API is unavailable, fall back to cash page
        if (!cancelled) setStatus('cash')
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (status === 'checking') {
    return (
      <div className="p-6">
        <div className="ui-card p-4">Checking today's cash session…</div>
      </div>
    )
  }
  if (status === 'login') return <Navigate to="/login" replace />
  if (status === 'cash') return <Navigate to="/cash" replace />

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
  const { employee, logout: doLogout } = useAuth()
  const today = getLocalDateISO()

  // Keep a local state copy so UI updates immediately after Start/End Day
  const [dayOpenState, setDayOpenState] = useState(null)
  const isOpenedToday = !!dayOpenState && dayOpenState.date === today

  const [counts, setCounts] = useState(buildInitialCounts())
  const [tillNo, setTillNo] = useState(dayOpenState?.tillNo ? String(dayOpenState.tillNo) : '')
  const [tillTotal, setTillTotal] = useState(
    dayOpenState?.openingTillTotal != null ? String(dayOpenState.openingTillTotal) : '0'
  )
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

  // If the day is already opened in backend, load it automatically
  useEffect(() => {
    let cancelled = false

    async function loadOpenedDay() {
      if (isOpenedToday) return
      try {
        const { res: r, data } = await fetchJsonWithTimeout(
          `/api/cash/today?date=${encodeURIComponent(today)}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
          2500
        )
        if (!r.ok || !data?.found || !data?.row) return

        const row = data.row
        const loaded = {
          date: today,
          openId: row.openId || row.openID || '',
          openedAt: row.openedAt || '',
          openingCashTotal: Number(row.openingCashTotal || 0),
          openingTillTotal: Number(row.openingTillTotal || 0),
          cashBreakdown: Array.isArray(row.cashBreakdown) ? row.cashBreakdown : [],
          tillNo: String(row.tillNo || ''),
          mpesaWithdrawal: Number(row.mpesaWithdrawal ?? row.withdrawalCash ?? 0),
          withdrawalCash: Number(row.withdrawalCash ?? row.mpesaWithdrawal ?? 0),
          sendMoney: Number(row.sendMoney || 0),
        }

        if (!cancelled) setDayOpenState(loaded)
      } catch {
        // ignore
      }
    }

    loadOpenedDay()
    return () => {
      cancelled = true
    }
  }, [today])

  // Reset form when switching between "Start Day" and "End Day"
  useEffect(() => {
    setCounts(buildInitialCounts())
    setErr('')
    setOk('')
    if (isOpenedToday && dayOpenState?.tillNo) setTillNo(String(dayOpenState.tillNo))
    if (isOpenedToday) {
      setWithdrawalCash(String(dayOpenState?.withdrawalCash ?? dayOpenState?.mpesaWithdrawal ?? 0))
      setSendMoney(String(dayOpenState?.sendMoney ?? 0))
      setTillTotal(String(dayOpenState?.openingTillTotal ?? 0))
    } else {
      setWithdrawalCash('0')
      setSendMoney('0')
      setTillTotal('0')
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

      const tillNum = parseNonNegNumber(tillTotal)
      if (tillNum === null) throw new Error('Till Total must be a non-negative number.')

      const payload = {
        date: today,
        openingCashTotal: totalCash,
        cashBreakdown: buildBreakdown(),
        tillNo: tillNo.trim(),
        openingTillTotal: tillNum,
        // Back-compat: backend currently reads mpesaWithdrawal. We also send a clearer name.
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
        employee: employee?.name || employee?.username || '',
        openedAt: new Date().toISOString(),
      }

      const r = await fetch('/api/cash/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        // If the day is already opened, load it from backend and switch UI to End Day
        if (r.status === 409) {
          try {
            const { res: rr, data: dd } = await fetchJsonWithTimeout(
              `/api/cash/today?date=${encodeURIComponent(today)}`,
              {
                cache: 'no-store',
                credentials: 'include',
              },
              2500
            )
            if (rr.ok && dd?.found && dd?.row) {
              const row = dd.row
              const loaded = {
                date: today,
                openId: row.openId || row.openID || data?.openId || '',
                openedAt: row.openedAt || '',
                openingCashTotal: Number(row.openingCashTotal || 0),
                openingTillTotal: Number(row.openingTillTotal || 0),
                cashBreakdown: Array.isArray(row.cashBreakdown) ? row.cashBreakdown : [],
                tillNo: String(row.tillNo || ''),
                mpesaWithdrawal: Number(row.mpesaWithdrawal ?? row.withdrawalCash ?? 0),
                withdrawalCash: Number(row.withdrawalCash ?? row.mpesaWithdrawal ?? 0),
                sendMoney: Number(row.sendMoney || 0),
              }
              setDayOpenState(loaded)
              setOk('Start Day already saved for today. Loaded existing record.')
              return
            }
          } catch {}
        }
        throw new Error(data?.error || 'Failed to save Start Day.')
      }

      const newDay = {
        date: today,
        openId: data?.openId || data?.id || null,
        openingCashTotal: totalCash,
        openingTillTotal: tillNum,
        cashBreakdown: payload.cashBreakdown,
        tillNo: tillNo.trim(),
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
        openedAt: payload.openedAt,
      }

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

      const tillNum = parseNonNegNumber(tillTotal)
      if (tillNum === null) throw new Error('Till Total must be a non-negative number.')

      const payload = {
        date: today,
        openId: dayOpenState?.openId || null,
        closingCashTotal: totalCash,
        cashBreakdown: buildBreakdown(),
        tillNo: tillNo.trim(),
        closingTillTotal: tillNum,
        mpesaWithdrawal: withdrawalNum,
        withdrawalCash: withdrawalNum,
        sendMoney: sendMoneyNum,
        employee: employee?.name || employee?.username || '',
        closedAt: new Date().toISOString(),
      }

      const r = await fetch('/api/cash/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || 'Failed to save End Day.')

      await doLogout()
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
            Go to Daily Report
          </button>
        )}
      </div>

      {isOpenedToday && (
        <div className="text-sm opacity-80 mb-3">
          Morning cash recorded: <b>KSh {Number(dayOpenState?.openingCashTotal || 0)}</b> · Morning till recorded:{' '}
          <b>KSh {Number(dayOpenState?.openingTillTotal || 0)}</b>
        </div>
      )}

      <form onSubmit={isOpenedToday ? submitEndDay : submitStartDay} className="space-y-4">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.75)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Payment Methods</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <label className="block text-sm font-semibold mb-1">
                {isOpenedToday ? 'Closing Till Total (KSh)' : 'Opening Till Total (KSh)'}
              </label>
              <input
                value={tillTotal}
                onChange={(e) => setTillTotal(e.target.value)}
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
   Routes
====================== */
function RoutedPages() {
  const location = useLocation()

  // Keep backend warm so the app doesn't appear to "sleep" after idle time
  useEffect(() => {
    let timer = null
    const ping = async () => {
      try {
        await fetch('/api/healthz', {
          cache: 'no-store',
          credentials: 'include',
        })
      } catch {
        // ignore
      }
    }

    ping()
    timer = setInterval(ping, 4 * 60 * 1000)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])

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
              <ManagerRoute>
                <DayOpenedRoute>
                  <PageWrapper>
                    <div className="summery-page space-y-6">
                      <SummeryPage />
                    </div>
                  </PageWrapper>
                </DayOpenedRoute>
              </ManagerRoute>
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
              <ManagerRoute>
                <DayOpenedRoute>
                  <PageWrapper>
                    <div className="products-page space-y-6">
                      <ProductsPage />
                    </div>
                  </PageWrapper>
                </DayOpenedRoute>
              </ManagerRoute>
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
          path="/delivery"
          element={
            <ProtectedRoute>
              <DayOpenedRoute>
                <PageWrapper>
                  <div className="space-y-6">
                    <DeliveryPage />
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
              <ManagerRoute>
                <DayOpenedRoute>
                  <PageWrapper>
                    <div className="clients-page space-y-6">
                      <ClientsPage />
                    </div>
                  </PageWrapper>
                </DayOpenedRoute>
              </ManagerRoute>
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
              <ManagerRoute>
                <DayOpenedRoute>
                  <PageWrapper>
                    <div className="space-y-6">
                      <WhatsAppPage />
                    </div>
                  </PageWrapper>
                </DayOpenedRoute>
              </ManagerRoute>
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
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  )
}
