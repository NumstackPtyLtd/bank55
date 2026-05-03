import { request } from './base'

const BASE = 'http://localhost:5500'
const SESSION_KEY = 'bank55_session'

function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

function storeSession(token: string) {
  localStorage.setItem(SESSION_KEY, token)
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('bank55_user')
}

function storeUser(user: any) {
  localStorage.setItem('bank55_user', JSON.stringify(user))
}

function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null
  const u = localStorage.getItem('bank55_user')
  return u ? JSON.parse(u) : null
}

export const platformApi = {
  health: () => request<any>(`${BASE}/health`),

  login: async (email: string, password: string) => {
    const res = await request<any>(`${BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    storeSession(res.session_token)
    storeUser(res.user)
    return res
  },

  logout: () => {
    const token = getStoredSession()
    clearStoredSession()
    if (token) {
      fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { 'X-Session-Token': token } }).catch(() => {})
    }
  },

  getSession: getStoredSession,
  getUser: getStoredUser,

  checkAuth: async (): Promise<{ authenticated: boolean; user?: any }> => {
    const token = getStoredSession()
    if (!token) return { authenticated: false }
    try {
      const res = await request<any>(`${BASE}/auth/me`, { headers: { 'X-Session-Token': token } })
      if (res.authenticated) {
        storeUser(res.user)
        return res
      }
      clearStoredSession()
      return { authenticated: false }
    } catch {
      clearStoredSession()
      return { authenticated: false }
    }
  },

  // Action logging - records everything so AI can reason about it
  recordAction: async (data: { service: string; action: string; target?: string; params?: any; result?: any; success?: boolean }) => {
    const token = getStoredSession()
    if (!token) return
    try {
      await request<any>(`${BASE}/api/actions`, {
        method: 'POST',
        headers: { 'X-Session-Token': token },
        body: JSON.stringify(data),
      })
    } catch {
      // Don't block on logging failures
    }
  },

  getActions: async (filters?: { limit?: number; service?: string; since?: string }) => {
    const token = getStoredSession()
    if (!token) return []
    const params = new URLSearchParams()
    if (filters?.limit) params.set('limit', String(filters.limit))
    if (filters?.service) params.set('service', filters.service)
    if (filters?.since) params.set('since', filters.since)
    const res = await request<any>(`${BASE}/api/actions?${params}`, { headers: { 'X-Session-Token': token } })
    return res
  },

  getActionSummary: async () => {
    const token = getStoredSession()
    if (!token) return null
    return request<any>(`${BASE}/api/actions/summary`, { headers: { 'X-Session-Token': token } })
  },

  // MCP calls (existing)
  mcp: async (toolName: string, args: any = {}) => {
    const token = getStoredSession()
    if (!token) throw new Error('Not authenticated')
    const res = await request<any>(`${BASE}/mcp`, {
      method: 'POST',
      headers: { 'X-Session-Token': token },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }),
    })
    return res.result
  },
}
