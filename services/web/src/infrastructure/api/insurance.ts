import { request } from './base'
import crypto from 'crypto'

const BASE = 'http://localhost:5504'

function generateHmac(clientId: string, secret: string, body: string): { timestamp: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = `${timestamp}.${body}`
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return { timestamp, signature }
}

// For browser: use the /auth/sign helper endpoint
async function getSignature(clientId: string, body: any): Promise<{ timestamp: string; signature: string }> {
  const res = await request<any>(`${BASE}/auth/sign`, {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, body }),
  })
  return { timestamp: res.timestamp, signature: res.signature }
}

async function mcp(clientId: string, toolName: string, args: any = {}) {
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }
  const { timestamp, signature } = await getSignature(clientId, body)
  const res = await request<any>(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'X-Client-Id': clientId,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: JSON.stringify(body),
  })
  return res.result
}

async function adminMcp(toolName: string, args: any = {}) {
  return mcp('ins-admin', toolName, args)
}

export const insuranceApi = {
  health: () => request<any>(`${BASE}/health`),

  listPolicies: async (customerId?: string) => {
    const res = await adminMcp('list_policies', customerId ? { customer_id: customerId } : {})
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  getPolicyDetails: async (policyId: string) => {
    const res = await adminMcp('get_policy_details', { policy_id: policyId })
    return JSON.parse(res.content[0].text)
  },

  getPremiumInfo: async (policyId: string) => {
    const res = await adminMcp('get_premium_info', { policy_id: policyId })
    return res.content[0].text
  },

  payPremium: async (policyId: string) => {
    const res = await adminMcp('pay_premium', { policy_id: policyId })
    return res.content[0].text
  },

  submitClaim: async (data: { policy_id: string; type: string; description: string; amount: number; incident_date: string }) => {
    const res = await adminMcp('submit_claim', data)
    return res.content[0].text
  },

  listClaims: async (customerId?: string) => {
    const res = await adminMcp('list_claims', customerId ? { customer_id: customerId } : {})
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  checkClaim: async (claimId: string) => {
    const res = await adminMcp('check_claim_status', { claim_id: claimId })
    return JSON.parse(res.content[0].text)
  },

  getCoverSummary: async (customerId?: string) => {
    const res = await adminMcp('get_cover_summary', customerId ? { customer_id: customerId } : {})
    return JSON.parse(res.content[0].text)
  },

  getOverview: async (customerId?: string) => {
    const res = await adminMcp('get_insurance_overview', customerId ? { customer_id: customerId } : {})
    return JSON.parse(res.content[0].text)
  },

  listBeneficiaries: async (policyId: string) => {
    const res = await adminMcp('list_beneficiaries', { policy_id: policyId })
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },
}
