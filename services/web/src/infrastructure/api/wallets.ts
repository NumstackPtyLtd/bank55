import { request } from './base'

const BASE = 'http://localhost:5502'

let cachedTokens: Record<string, string> = {}

async function getToken(accountNumber: string, pin: string): Promise<string> {
  const key = `${accountNumber}:${pin}`
  if (cachedTokens[key]) return cachedTokens[key]
  const res = await request<any>(`${BASE}/auth/token`, {
    method: 'POST',
    body: JSON.stringify({ account_number: accountNumber, pin }),
  })
  cachedTokens[key] = res.access_token
  return res.access_token
}

async function mcp(token: string, method: string, params?: any) {
  return request<any>(`${BASE}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
}

// Default admin-like access using Elvis's account
async function adminMcp(toolName: string, args: any = {}) {
  const token = await getToken('1055001234', '1234')
  const res = await mcp(token, 'tools/call', { name: toolName, arguments: args })
  return res.result
}

export const walletsApi = {
  health: () => request<any>(`${BASE}/health`),

  login: (accountNumber: string, pin: string) => getToken(accountNumber, pin),

  getBalance: async (token: string, walletId?: string) => {
    const res = await mcp(token, 'tools/call', { name: 'get_balance', arguments: walletId ? { wallet_id: walletId } : {} })
    return res.result.content[0].text
  },

  listWallets: async (token: string) => {
    const res = await mcp(token, 'tools/call', { name: 'list_wallets', arguments: {} })
    return JSON.parse(res.result.content[0].text)
  },

  listTransactions: async (token: string, walletId?: string, filters?: { limit?: number; category?: string; type?: string }) => {
    const res = await mcp(token, 'tools/call', { name: 'list_transactions', arguments: { wallet_id: walletId, ...filters } })
    return JSON.parse(res.result.content[0].text)
  },

  transfer: async (token: string, toAccountNumber: string, amount: number, description?: string) => {
    const res = await mcp(token, 'tools/call', { name: 'transfer', arguments: { to_account_number: toAccountNumber, amount, description } })
    return res.result.content[0].text
  },

  payExternal: async (token: string, data: { bank: string; account_number: string; branch_code: string; recipient_name: string; amount: number; reference: string }) => {
    const res = await mcp(token, 'tools/call', { name: 'pay_external', arguments: data })
    return res.result.content[0].text
  },

  getStatement: async (token: string, walletId?: string) => {
    const res = await mcp(token, 'tools/call', { name: 'get_statement', arguments: { wallet_id: walletId } })
    return res.result.content[0].text
  },

  getSpending: async (token: string, walletId?: string, month?: string) => {
    const res = await mcp(token, 'tools/call', { name: 'get_spending_summary', arguments: { wallet_id: walletId, month } })
    return JSON.parse(res.result.content[0].text)
  },

  freeze: async (token: string, reason: string, walletId?: string) => {
    const res = await mcp(token, 'tools/call', { name: 'freeze_wallet', arguments: { wallet_id: walletId, reason } })
    return res.result.content[0].text
  },

  clearTokenCache: () => { cachedTokens = {} },
}
