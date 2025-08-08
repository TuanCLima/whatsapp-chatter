// API configuration that works in both development and production
const API_BASE_URL = import.meta.env.PROD
  ? '' // In production, use relative URLs (same domain)
  : 'http://localhost:3000' // In development, point to backend server

export { API_BASE_URL }
