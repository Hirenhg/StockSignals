import { createContext, useContext, useState, useEffect } from 'react'
import API, { wakeServer } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const logout = (message) => {
    localStorage.removeItem('token')
    delete API.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
    if (message) alert(message)
  }

  useEffect(() => {
    // Intercept 403 responses for single-device enforcement
    const interceptor = API.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 403 && err.response?.data?.error?.includes('another device')) {
          logout('You have been logged out because your account was accessed from another device.')
        }
        return Promise.reject(err)
      }
    )
    return () => API.interceptors.response.eject(interceptor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (token) {
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`
      wakeServer()
      API.get('/api/auth/me', { timeout: 90000 })
        .then(res => {
          setUser(res.data)
          API.post('/api/auth/refresh').then(r => {
            localStorage.setItem('token', r.data.token)
            API.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`
            setToken(r.data.token)
          }).catch(() => {})
        })
        .catch((err) => {
          if (err.response?.status === 403) {
            logout('You have been logged out because your account was accessed from another device.')
          } else {
            logout()
          }
        })
        .finally(() => setLoading(false))
    } else {
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

  return (
    <AuthContext.Provider value={{ user, token, loading, login, updateProfile, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
