import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Role-based manager gate for sensitive pages.
// Access is granted when the signed-in employee has role: manager / admin / owner.
// (Role comes from employees sheet "role" column and is returned by /api/auth/me)

function isManagerRole(role) {
  const r = String(role || '').trim().toLowerCase()
  return r === 'manager' || r === 'admin' || r === 'owner' || r === 'superadmin'
}

export default function ManagerRoute({ children }) {
  const location = useLocation()
  const { employee, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="ui-card w-full max-w-lg p-6">
          <div className="text-lg font-semibold">Loading…</div>
          <div className="text-sm text-ink/70 mt-1">Checking access…</div>
        </div>
      </div>
    )
  }

  if (!employee) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (isManagerRole(employee.role)) {
    return children
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="ui-card w-full max-w-lg p-6">
        <div className="text-lg font-semibold">Manager Access Required</div>
        <div className="text-sm text-ink/70 mt-1">
          You don&apos;t have permission to access this page.
        </div>
        <div className="text-xs text-ink/50 mt-2">
          Page: <span className="font-mono">{location.pathname}</span>
        </div>

        <div className="mt-4 ui-note">
          Ask your manager to set your role to <span className="font-mono">manager</span> in the{' '}
          <span className="font-mono">employees</span> sheet.
        </div>

        <div className="mt-4 flex gap-2">
          <a className="ui-btn" href="/daily-report">
            Back
          </a>
          <a className="ui-btn ui-btn-ghost" href="/pos">
            Go to POS
          </a>
        </div>
      </div>
    </div>
  )
}
