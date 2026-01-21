import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await api('/api/auth/me', { cache: 'no-store' })
      setEmployee(data?.employee || null)
      return data?.employee || null
    } catch (e) {
      setEmployee(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    setEmployee(null)
  }

  const value = useMemo(() => ({ employee, loading, refresh, logout }), [employee, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
