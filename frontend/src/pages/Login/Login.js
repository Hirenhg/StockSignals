import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const { login, updateProfile, isLoggedIn, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('mobile') // mobile -> name
  const [mobile, setMobile] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && isLoggedIn && step !== 'name') navigate('/', { replace: true })
  }, [authLoading, isLoggedIn, navigate, step])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (mobile.length < 10) { setError('Enter valid 10-digit mobile number'); return }
    setLoading(true); setError('')
    try {
      const result = await login(mobile)
      if (result.user?.name) {
        navigate('/')
      } else {
        setStep('name')
      }
    } catch (err) {
      const msg = err.response?.data?.error || (err.code === 'ECONNABORTED' ? 'Server is waking up, please try again' : 'Failed to login')
      setError(msg)
    } finally { setLoading(false) }
  }

  const handleSetName = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Enter your name'); return }
    setLoading(true); setError('')
    try {
      await updateProfile(name.trim())
      navigate('/')
    } catch { setError('Failed to save name') }
    finally { setLoading(false) }
  }

  return (
    <>
      <Helmet><title>Login - StockSignal</title></Helmet>
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="card shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <span style={{ fontSize: '40px' }}>📈</span>
              <h4 className="fw-bold mt-2">StockSignal</h4>
              <p className="text-muted mb-0">
                {step === 'mobile' && 'Login with your mobile number'}
                {step === 'name' && 'Set your display name'}
              </p>
            </div>

            {error && <div className="alert alert-danger py-2" style={{ fontSize: '13px' }}>{error}</div>}

            {step === 'mobile' && (
              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Mobile Number</label>
                  <div className="input-group">
                    <span className="input-group-text">+91</span>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="Enter 10-digit mobile"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                </div>
                <button className="btn btn-primary w-100" disabled={loading || mobile.length < 10}>
                  {loading ? 'Connecting to server...' : 'Login'}
                </button>
                <p className="text-muted text-center mt-3" style={{ fontSize: '12px' }}>
                  Login with your registered mobile number
                </p>
              </form>
            )}

            {step === 'name' && (
              <form onSubmit={handleSetName}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Your Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary w-100" disabled={loading || !name.trim()}>
                  {loading ? 'Saving...' : 'Continue'}
                </button>
                <button type="button" className="btn btn-link btn-sm w-100 mt-2 text-muted" onClick={() => navigate('/')}>
                  Skip for now
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Login
