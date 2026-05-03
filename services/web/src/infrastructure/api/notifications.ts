import { request } from './base'

const BASE = 'http://localhost:5505'
const SERVICE_TOKEN = 'notif-platform-token'

function headers() {
  return { 'X-Service-Token': SERVICE_TOKEN }
}

function mcp(toolName: string, args: any = {}) {
  return request<any>(`${BASE}/mcp`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }),
  }).then((res) => res.result)
}

export const notificationsApi = {
  health: () => request<any>(`${BASE}/health`),

  send: async (data: { customer_id: string; customer_email?: string; customer_name?: string; type: string; subject: string; body: string; metadata?: any }) => {
    const res = await mcp('send_notification', data)
    return res.content[0].text
  },

  sendFromTemplate: async (templateName: string, customerId: string, customerEmail: string, variables: Record<string, string>) => {
    const res = await mcp('send_from_template', { template_name: templateName, customer_id: customerId, customer_email: customerEmail, variables })
    return res.content[0].text
  },

  list: async (customerId?: string, status?: string, limit?: number) => {
    const res = await mcp('list_notifications', { customer_id: customerId, status, limit })
    try { return JSON.parse(res.content[0].text) } catch { return res.content[0].text }
  },

  getStats: async (customerId?: string) => {
    const res = await mcp('get_notification_stats', { customer_id: customerId })
    return JSON.parse(res.content[0].text)
  },

  getTemplates: async () => {
    const res = await mcp('list_templates')
    return JSON.parse(res.content[0].text)
  },

  getPreferences: async (customerId: string) => {
    const res = await mcp('get_preferences', { customer_id: customerId })
    return JSON.parse(res.content[0].text)
  },

  // Convenience: notify on transfer
  notifyTransfer: (senderId: string, senderEmail: string, senderName: string, recipientId: string, recipientEmail: string, recipientName: string, amount: number, reference: string) => {
    return Promise.all([
      notificationsApi.send({
        customer_id: senderId, customer_email: senderEmail, customer_name: senderName,
        type: 'transfer', subject: `Transfer Sent: ZAR ${amount.toFixed(2)}`,
        body: `You sent ZAR ${amount.toFixed(2)} to ${recipientName}.\n\nReference: ${reference}`,
        metadata: { amount, reference, recipient: recipientName },
      }),
      notificationsApi.send({
        customer_id: recipientId, customer_email: recipientEmail, customer_name: recipientName,
        type: 'transfer', subject: `Payment Received: ZAR ${amount.toFixed(2)}`,
        body: `You received ZAR ${amount.toFixed(2)} from ${senderName}.\n\nReference: ${reference}`,
        metadata: { amount, reference, sender: senderName },
      }),
    ])
  },

  // Convenience: notify on loan payment
  notifyLoanPayment: (customerId: string, email: string, name: string, loanType: string, amount: number, balance: number) => {
    return notificationsApi.send({
      customer_id: customerId, customer_email: email, customer_name: name,
      type: 'payment', subject: `Loan Payment Confirmed: ZAR ${amount.toFixed(2)}`,
      body: `Your ${loanType} loan payment of ZAR ${amount.toFixed(2)} has been processed.\n\nRemaining Balance: ZAR ${balance.toFixed(2)}`,
      metadata: { loan_type: loanType, amount, balance },
    })
  },

  // Convenience: notify on insurance premium
  notifyPremiumPayment: (customerId: string, email: string, name: string, policyType: string, amount: number, nextDate: string) => {
    return notificationsApi.send({
      customer_id: customerId, customer_email: email, customer_name: name,
      type: 'payment', subject: `Insurance Premium Paid: ZAR ${amount.toFixed(2)}`,
      body: `Your ${policyType} insurance premium of ZAR ${amount.toFixed(2)} has been processed.\n\nNext Due: ${nextDate}`,
      metadata: { policy_type: policyType, amount, next_date: nextDate },
    })
  },
}
