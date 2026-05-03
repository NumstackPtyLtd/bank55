import { request } from './base'

const BASE = 'http://localhost:5503'

let cachedTokens: Record<string, string> = {}

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const key = `${clientId}:${clientSecret}`
  if (cachedTokens[key]) return cachedTokens[key]
  const res = await request<any>(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  })
  cachedTokens[key] = res.access_token
  return res.access_token
}

async function mcp(token: string, toolName: string, args: any = {}) {
  const res = await request<any>(`${BASE}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }),
  })
  return res.result
}

async function adminMcp(toolName: string, args: any = {}) {
  const token = await getToken('bank55-platform', 'platform-secret-2024')
  return mcp(token, toolName, args)
}

export const loansApi = {
  health: () => request<any>(`${BASE}/health`),

  getToken: (clientId: string, clientSecret: string) => getToken(clientId, clientSecret),

  listLoans: async (customerId?: string) => {
    const res = await adminMcp('list_loans', customerId ? { customer_id: customerId } : {})
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  getLoanDetails: async (loanId: string) => {
    const res = await adminMcp('get_loan_details', { loan_id: loanId })
    return JSON.parse(res.content[0].text)
  },

  getLoanBalance: async (loanId: string) => {
    const res = await adminMcp('get_loan_balance', { loan_id: loanId })
    return res.content[0].text
  },

  getNextPayment: async (loanId: string) => {
    const res = await adminMcp('get_next_payment', { loan_id: loanId })
    return res.content[0].text
  },

  getSchedule: async (loanId: string) => {
    const res = await adminMcp('get_payment_schedule', { loan_id: loanId })
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  listPayments: async (loanId: string) => {
    const res = await adminMcp('list_payments', { loan_id: loanId })
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  makePayment: async (loanId: string, amount?: number) => {
    const res = await adminMcp('make_payment', { loan_id: loanId, amount })
    return res.content[0].text
  },

  getSummary: async (customerId?: string) => {
    const res = await adminMcp('get_loan_summary', customerId ? { customer_id: customerId } : {})
    return JSON.parse(res.content[0].text)
  },

  apply: async (data: { type: string; amount: number; term_months: number; purpose: string }) => {
    const res = await adminMcp('apply_for_loan', data)
    return res.content[0].text
  },

  calculate: async (amount: number, rate: number, termMonths: number) => {
    const res = await adminMcp('calculate_loan', { amount, rate, term_months: termMonths })
    return res.content[0].text
  },

  clearTokenCache: () => { cachedTokens = {} },
}
