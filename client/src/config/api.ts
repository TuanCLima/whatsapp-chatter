const LOCALHOST_URL = 'http://localhost:3000'

// API configuration that works in both development and production
const API_BASE_URL = import.meta.env.PROD
  ? '' // In production, use relative URLs (same domain)
  : LOCALHOST_URL // In development, point to backend server

const API_BASE_URL_ABSOLUTE = import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || window.location.origin // Use env var or fallback to current origin
  : LOCALHOST_URL // In development, point to backend server

export { API_BASE_URL, API_BASE_URL_ABSOLUTE }
