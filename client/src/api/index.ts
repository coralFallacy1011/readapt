import axios from 'axios'

// In production (Vercel), VITE_API_URL = https://your-render-server.onrender.com
// In dev, requests go to /api which Vite proxies to localhost:5000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
