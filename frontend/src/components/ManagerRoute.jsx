import React, { useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Simple manager gate for sensitive pages.
// IMPORTANT: This version DOES NOT persist unlock state.
// The user must enter the PIN every time they enter the page.

export default function ManagerRoute({ children }) {
  const location = useLocation()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  const requiredPin = useMemo(() => {
    // Configure this value in Render/Vite env as VITE_MANAGER_PIN
    return (import.meta.env.VITE_MANAGER_PIN || '0000').toString()
  }, [])

  const { employee, loading } = useAuth()
  if (loading) return (
    <div className="p-6"><div className="ui-card p-4">Loading session…</div></div>
  )
  if (!employee) return <Navigate to="/login" replace />

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

    setUnlocked(true)
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
                setPin('')
                setErr('')
              }}
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-ink/50">
            You will be asked for the PIN again the next time you open this page.
          </div>
        </form>
      </div>
    </div>
  )
}
