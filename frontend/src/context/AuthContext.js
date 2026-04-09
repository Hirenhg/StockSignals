import { createContext, useContext, useState, useEffect } from 'react'
import API, { wakeServer } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Wake server first, then verify token
      wakeServer()
      API.get('/api/auth/me', { timeout: 90000 })
        .then(res => {
          setUser(res.data)
          // Refresh token in background (don't block UI)
          API.post('/api/auth/refresh').then(r => {
            localStorage.setItem('token', r.data.token)
            API.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`
            setToken(r.data.token)
          }).catch(() => {})
        })
        .catch(() => { logout() })
        .finally(() => setLoading(false))
    } else {
      // No token — still wake server so login is fast
      wakeServer()
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (mobile) => {
    const res = await API.post('/api/auth/login', { mobile }, { timeout: 90000 })
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
    <AuthContext.Provider value={{ user, token, loading, login, updateProfile, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
