import axios from "axios"

const API = axios.create({
  // baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000" || "https://stocksignals-65rz.onrender.com",
  baseURL: "https://stocksignals-65rz.onrender.com",
  timeout: 30000,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
})


export default API