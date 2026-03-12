import axios from "axios"

const API = axios.create({
  // baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  baseURL: "https://stocksignals-65rz.onrender.com",
  timeout: 60000,
  withCredentials: false
})


export default API