import axios from "axios"

const API = axios.create({
  // baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  baseURL: "https://stocksignals-65rz.onrender.com",
  timeout: 60000,
  withCredentials: false
})

// Retry interceptor for cold-start failures (Render free tier spins down)
API.interceptors.response.use(
  res => res,
  async (error) => {
    const config = error.config
    if (!config || config._retryCount >= 2) return Promise.reject(error)

    const isRetryable = !error.response || error.code === 'ECONNABORTED' || error.response?.status >= 500
    if (!isRetryable) return Promise.reject(error)

    config._retryCount = (config._retryCount || 0) + 1
    const delay = config._retryCount * 3000
    await new Promise(r => setTimeout(r, delay))
    return API(config)
  }
)

// Wake up Render server on app load
export const wakeServer = () => {
  API.get('/api/health', { timeout: 90000 }).catch(() => {})
}

export default API
