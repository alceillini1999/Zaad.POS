import React, { useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

// Simple manager gate for sensitive pages.
<<<<<<< HEAD
// IMPORTANT: This version DOES NOT persist unlock state.
// The user must enter the PIN every time they enter the page.

export default function ManagerRoute({ children }) {
  const location = useLocation()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  const requiredPin = useMemo(() => {
    // Configure this value in Render/Vite env as VITE_MANAGER_PIN
=======
// Uses a local PIN (VITE_MANAGER_PIN) and stores a short-lived unlock flag.

const STORAGE_KEY = 'manager_unlock_until'

function nowMs() {
  return Date.now()
}

function getUnlockUntil() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0)
  } catch {
    return 0
  }
}

function setUnlockForMinutes(minutes) {
  const until = nowMs() + minutes * 60 * 1000
  try {
    localStorage.setItem(STORAGE_KEY, String(until))
  } catch {}
  return until
}

function clearUnlock() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export default function ManagerRoute({ children, minutes = 30 }) {
  const location = useLocation()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  const requiredPin = useMemo(() => {
    // IMPORTANT: Configure this value in Render/Vite env as VITE_MANAGER_PIN
>>>>>>> f89241e65e8175c959333876e3e5609aea11f6e7
    return (import.meta.env.VITE_MANAGER_PIN || '0000').toString()
  }, [])

  // Require login session first
  const token = (() => {
    try {
      return localStorage.getItem('token') || ''
    } catch {
      return ''
    }
  })()
  if (!token) return <Navigate to="/login" replace />

<<<<<<< HEAD
=======
  const unlocked = getUnlockUntil() > nowMs()
>>>>>>> f89241e65e8175c959333876e3e5609aea11f6e7
  if (unlocked) return children

  function submit(e) {
    e.preventDefault()
    setErr('')

    const entered = String(pin || '').trim()
    if (!entered) {
      setErr('Please enter the manager PIN.')
      return
    }
    if (entered !== requiredPin) {
      setErr('Wrong PIN.')
      setPin('')
      return
    }
<<<<<<< HEAD

    setUnlocked(true)
=======
    setUnlockForMinutes(Number(minutes || 30))
>>>>>>> f89241e65e8175c959333876e3e5609aea11f6e7
    setPin('')
  }

  return (
    <div className="p-6">
      <div className="ui-card p-5 max-w-lg">
        <div className="text-lg font-semibold">Manager Access Required</div>
        <div className="text-sm text-ink/70 mt-1">
          This page is restricted. Enter the manager PIN to continue.
        </div>
        <div className="text-xs text-ink/50 mt-1">
          Page: <span className="font-mono">{location.pathname}</span>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Manager PIN</label>
            <input
              className="ui-input w-full"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
            />
            {err ? <div className="text-sm text-red-600 mt-2">{err}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" className="ui-btn">
              Unlock
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              onClick={() => {
<<<<<<< HEAD
=======
                clearUnlock()
>>>>>>> f89241e65e8175c959333876e3e5609aea11f6e7
                setPin('')
                setErr('')
              }}
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-ink/50">
<<<<<<< HEAD
            You will be asked for the PIN again the next time you open this page.
=======
            Unlock lasts <b>{minutes}</b> minutes on this device.
>>>>>>> f89241e65e8175c959333876e3e5609aea11f6e7
          </div>
        </form>
      </div>
    </div>
  )
}
