import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { employee, loading } = useAuth()
  if (loading) {
    return (
      <div className="p-6">
        <div className="ui-card p-4">Loading session…</div>
      </div>
    )
  }
  if (!employee) return <Navigate to="/login" replace />
  return children
}
