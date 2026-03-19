import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const auth = useAuth()
  const isLoggedIn = auth?.isLoggedIn || false
  const loading = auth?.loading || false
  if (loading) return null
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return children
}

export default ProtectedRoute
