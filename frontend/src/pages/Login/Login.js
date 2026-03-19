import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const { sendOTP, verifyOTP, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('mobile') // mobile -> otp -> name
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (mobile.length < 10) { setError('Enter valid 10-digit mobile number'); return }
    setLoading(true); setError('')
    try {
      await sendOTP(mobile)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return }
    setLoading(true); setError('')
    try {
      const result = await verifyOTP(mobile, otp)
      if (result.user?.name) {
        navigate('/')
      } else {
        setStep('name')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP')
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
                {step === 'otp' && 'Enter OTP sent via Telegram'}
                {step === 'name' && 'Set your display name'}
              </p>
            </div>

            {error && <div className="alert alert-danger py-2" style={{ fontSize: '13px' }}>{error}</div>}

            {step === 'mobile' && (
              <form onSubmit={handleSendOTP}>
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
                    />
                  </div>
                </div>
                <button className="btn btn-primary w-100" disabled={loading || mobile.length < 10}>
                  {loading ? 'Sending OTP...' : 'Send OTP via Telegram'}
                </button>
                <p className="text-muted text-center mt-3" style={{ fontSize: '12px' }}>
                  OTP will be sent to the Telegram bot linked with this app
                </p>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <label className="form-label fw-semibold mb-0">Enter OTP</label>
                    <small className="text-muted">Sent to +91{mobile}</small>
                  </div>
                </div>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control form-control-lg text-center fw-bold"
                    placeholder="● ● ● ● ● ●"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    autoFocus
                    style={{ letterSpacing: '8px', fontSize: '24px' }}
                  />
                </div>
                <button className="btn btn-primary w-100 mb-2" disabled={loading || otp.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <div className="d-flex justify-content-between">
                  <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={() => { setStep('mobile'); setOtp(''); setError('') }}>
                    ← Change number
                  </button>
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={handleSendOTP} disabled={loading}>
                    Resend OTP
                  </button>
                </div>
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
