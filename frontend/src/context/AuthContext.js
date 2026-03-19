import { createContext, useContext, useState, useEffect } from 'react'
import API from '../services/api'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`
      API.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { logout() })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const sendOTP = async (mobile) => {
    const res = await API.post('/api/auth/send-otp', { mobile })
    return res.data
  }

  const verifyOTP = async (mobile, otp) => {
    const res = await API.post('/api/auth/verify-otp', { mobile, otp })
    if (res.data.token) {
      localStorage.setItem('token', res.data.token)
      API.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`
      setToken(res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }

  const updateProfile = async (name) => {
    const res = await API.put('/api/auth/profile', { name })
    setUser(prev => ({ ...prev, name: res.data.name }))
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete API.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, sendOTP, verifyOTP, updateProfile, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
