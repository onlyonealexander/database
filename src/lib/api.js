const tokenKey = 'kaasfield_session'

export const apiBase = import.meta.env.VITE_API_URL || ''
export const hasDatabaseConfig = true

async function request(path, options = {}) {
  const token = localStorage.getItem(tokenKey)
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The server could not complete this request.')
  return body
}

export async function apiLogin(email, password) { const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem(tokenKey, result.token); return result }
export async function apiSignup(payload) { const result = await request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }); localStorage.setItem(tokenKey, result.token); return result }
export async function apiMe() { return request('/api/auth/me') }
export async function apiDashboard() { return request('/api/dashboard') }
export function apiSignOut() { localStorage.removeItem(tokenKey) }
