import { request } from './base'

const BASE = 'http://localhost:5501'
const API_KEY = 'bank55-admin-key-2024'

function headers() {
  return { 'X-API-Key': API_KEY }
}

function mcp(method: string, params?: any) {
  return request<any>(`${BASE}/mcp`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
}

export const customersApi = {
  health: () => request<any>(`${BASE}/health`),

  list: async (filters?: { status?: string; kyc_status?: string }) => {
    const res = await mcp('tools/call', { name: 'list_customers', arguments: filters || {} })
    return JSON.parse(res.result.content[0].text)
  },

  get: async (customerId: string) => {
    const res = await mcp('tools/call', { name: 'get_customer', arguments: { customer_id: customerId } })
    return JSON.parse(res.result.content[0].text)
  },

  search: async (query: string) => {
    const res = await mcp('tools/call', { name: 'search_customers', arguments: { query } })
    return JSON.parse(res.result.content[0].text)
  },

  create: async (data: { first_name: string; last_name: string; id_number: string; email: string; phone?: string; date_of_birth?: string; address?: string }) => {
    const res = await mcp('tools/call', { name: 'create_customer', arguments: data })
    return res.result.content[0].text
  },

  update: async (customerId: string, data: { email?: string; phone?: string; address?: string }) => {
    const res = await mcp('tools/call', { name: 'update_customer', arguments: { customer_id: customerId, ...data } })
    return res.result.content[0].text
  },

  getKyc: async (customerId: string) => {
    const res = await mcp('tools/call', { name: 'get_kyc_status', arguments: { customer_id: customerId } })
    return JSON.parse(res.result.content[0].text)
  },

  verify: async (customerId: string) => {
    const res = await mcp('tools/call', { name: 'verify_customer', arguments: { customer_id: customerId } })
    return res.result.content[0].text
  },

  suspend: async (customerId: string, reason: string) => {
    const res = await mcp('tools/call', { name: 'suspend_customer', arguments: { customer_id: customerId, reason } })
    return res.result.content[0].text
  },

  getRisk: async (customerId: string) => {
    const res = await mcp('tools/call', { name: 'get_risk_assessment', arguments: { customer_id: customerId } })
    return JSON.parse(res.result.content[0].text)
  },

  getAudit: async (customerId: string) => {
    const res = await mcp('tools/call', { name: 'get_audit_log', arguments: { customer_id: customerId } })
    return JSON.parse(res.result.content[0].text)
  },
}
