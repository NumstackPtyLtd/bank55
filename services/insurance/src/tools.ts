import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'
import crypto from 'crypto'

export const tools: McpTool[] = [
  {
    name: 'list_policies',
    description: 'List all insurance policies.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string', description: 'Customer ID (admin only)' }, status: { type: 'string', enum: ['active', 'lapsed', 'cancelled'] } }, required: [] },
  },
  {
    name: 'get_policy_details',
    description: 'Get full details of a specific policy including beneficiaries and claims.',
    inputSchema: { type: 'object', properties: { policy_id: { type: 'string' } }, required: ['policy_id'] },
  },
  {
    name: 'get_premium_info',
    description: 'Get premium amount, frequency, and next payment date.',
    inputSchema: { type: 'object', properties: { policy_id: { type: 'string' } }, required: ['policy_id'] },
  },
  {
    name: 'get_next_premium',
    description: 'Get the next premium payment due.',
    inputSchema: { type: 'object', properties: { policy_id: { type: 'string' } }, required: ['policy_id'] },
  },
  {
    name: 'list_premium_payments',
    description: 'View premium payment history.',
    inputSchema: { type: 'object', properties: { policy_id: { type: 'string' }, limit: { type: 'number', description: 'Max entries (default 12)' } }, required: ['policy_id'] },
  },
  {
    name: 'pay_premium',
    description: 'Make a premium payment.',
    inputSchema: {
      type: 'object',
      properties: { policy_id: { type: 'string' }, amount: { type: 'number', description: 'Defaults to premium amount' }, source_wallet: { type: 'string' } },
      required: ['policy_id'],
    },
  },
  {
    name: 'submit_claim',
    description: 'Submit an insurance claim.',
    inputSchema: {
      type: 'object',
      properties: {
        policy_id: { type: 'string' },
        type: { type: 'string', description: 'Claim type (accident, theft, damage, medical, death, etc.)' },
        description: { type: 'string' },
        amount: { type: 'number' },
        incident_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['policy_id', 'type', 'description', 'amount', 'incident_date'],
    },
  },
  {
    name: 'check_claim_status',
    description: 'Check the status of a claim.',
    inputSchema: { type: 'object', properties: { claim_id: { type: 'string' } }, required: ['claim_id'] },
  },
  {
    name: 'list_claims',
    description: 'List all claims.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' }, status: { type: 'string' }, policy_id: { type: 'string' } }, required: [] },
  },
  {
    name: 'get_cover_summary',
    description: 'Summary of all active cover: total insured, premiums, etc.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: [] },
  },
  {
    name: 'list_beneficiaries',
    description: 'List beneficiaries on a policy.',
    inputSchema: { type: 'object', properties: { policy_id: { type: 'string' } }, required: ['policy_id'] },
  },
  {
    name: 'get_insurance_overview',
    description: 'Complete insurance overview: policies, premiums, pending claims, cover amounts.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: [] },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; client: any }): Promise<ToolResult> {
  const { db, client } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  const isAdmin = !client.customer_id
  const customerId = client.customer_id

  const ownsPolicy = (policyId: string) => {
    if (isAdmin) return true
    const p = db.prepare('SELECT customer_id FROM policies WHERE id = ?').get(policyId) as any
    return p?.customer_id === customerId
  }

  const resolveCustomer = (cid?: string) => isAdmin && cid ? cid : customerId

  switch (name) {
    case 'list_policies': {
      const cid = resolveCustomer(args.customer_id as string)
      let sql = 'SELECT id, type, policy_number, status, premium, cover_amount, payment_frequency, next_payment_date, linked_asset FROM policies WHERE 1=1'
      const params: any[] = []
      if (cid) { sql += ' AND customer_id = ?'; params.push(cid) }
      if (args.status) { sql += ' AND status = ?'; params.push(args.status) }
      const rows = db.prepare(sql).all(...params)
      if (!(rows as any[]).length) return text('No policies found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_policy_details': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const policy = db.prepare('SELECT * FROM policies WHERE id = ?').get(pid) as any
      if (!policy) return error('Policy not found')
      const beneficiaries = db.prepare('SELECT * FROM policy_beneficiaries WHERE policy_id = ?').all(pid)
      const claims = db.prepare('SELECT id, type, status, amount_claimed, amount_approved, incident_date FROM claims WHERE policy_id = ?').all(pid)
      const lastPayment = db.prepare('SELECT * FROM premium_payments WHERE policy_id = ? ORDER BY payment_date DESC LIMIT 1').get(pid)
      return text(JSON.stringify({ ...policy, beneficiaries, claims, last_payment: lastPayment }, null, 2))
    }

    case 'get_premium_info': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const p = db.prepare('SELECT id, type, policy_number, premium, payment_frequency, next_payment_date, status FROM policies WHERE id = ?').get(pid) as any
      if (!p) return error('Policy not found')
      return text(`Policy: ${p.policy_number} (${p.type})\nPremium: ZAR ${p.premium.toFixed(2)} / ${p.payment_frequency}\nNext Due: ${p.next_payment_date}\nStatus: ${p.status}`)
    }

    case 'get_next_premium': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const p = db.prepare('SELECT * FROM policies WHERE id = ?').get(pid) as any
      if (!p) return error('Policy not found')
      if (p.status === 'lapsed') return text('Policy has lapsed. Contact support to reinstate.')
      if (p.status === 'cancelled') return text('Policy is cancelled.')
      return text(`Next Premium:\n  Policy: ${p.policy_number} (${p.type})\n  Amount: ZAR ${p.premium.toFixed(2)}\n  Due: ${p.next_payment_date}\n  Frequency: ${p.payment_frequency}`)
    }

    case 'list_premium_payments': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const limit = (args.limit as number) || 12
      const rows = db.prepare('SELECT * FROM premium_payments WHERE policy_id = ? ORDER BY payment_date DESC LIMIT ?').all(pid, limit)
      if (!(rows as any[]).length) return text('No premium payments found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'pay_premium': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const p = db.prepare('SELECT * FROM policies WHERE id = ?').get(pid) as any
      if (!p) return error('Policy not found')
      if (p.status === 'cancelled') return error('Cannot pay on cancelled policy')

      const amount = (args.amount as number) || p.premium
      const freqMonths = p.payment_frequency === 'monthly' ? 1 : p.payment_frequency === 'quarterly' ? 3 : 12
      const nextDate = addMonths(p.next_payment_date, freqMonths)
      const payId = `pp-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString().slice(0, 10)

      db.transaction(() => {
        db.prepare('INSERT INTO premium_payments VALUES (?,?,?,?,?,?,?,?,?,?)').run(
          payId, pid, amount, now, p.next_payment_date, nextDate, 'completed', `PREM-${now}`, args.source_wallet || null, new Date().toISOString()
        )
        db.prepare('UPDATE policies SET next_payment_date = ?, status = ? WHERE id = ?').run(nextDate, 'active', pid)
      })()

      return text(`Premium paid!\n  Policy: ${p.policy_number} (${p.type})\n  Amount: ZAR ${amount.toFixed(2)}\n  Period: ${p.next_payment_date} to ${nextDate}\n  Next Due: ${nextDate}`)
    }

    case 'submit_claim': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const p = db.prepare('SELECT * FROM policies WHERE id = ?').get(pid) as any
      if (!p) return error('Policy not found')
      if (p.status !== 'active') return error(`Cannot claim on ${p.status} policy`)
      if ((args.amount as number) > p.cover_amount) return error(`Claim ZAR ${(args.amount as number).toFixed(2)} exceeds cover of ZAR ${p.cover_amount.toFixed(2)}`)

      const claimId = `clm-${crypto.randomUUID().slice(0, 8)}`
      const cid = customerId || db.prepare('SELECT customer_id FROM policies WHERE id = ?').get(pid) as any
      const now = new Date().toISOString()
      db.prepare('INSERT INTO claims VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        claimId, pid, typeof cid === 'string' ? cid : cid.customer_id, args.type, args.description, args.amount, null, 'submitted', args.incident_date, null, null, null, now, now
      )

      return text(`Claim submitted!\n  ID: ${claimId}\n  Policy: ${p.policy_number} (${p.type})\n  Type: ${args.type}\n  Amount: ZAR ${(args.amount as number).toFixed(2)}\n  Excess: ZAR ${p.excess.toFixed(2)}\n  Status: submitted`)
    }

    case 'check_claim_status': {
      const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(args.claim_id as string) as any
      if (!claim) return error('Claim not found')
      if (!isAdmin && claim.customer_id !== customerId) return error('Access denied')
      return text(JSON.stringify(claim, null, 2))
    }

    case 'list_claims': {
      const cid = resolveCustomer(args.customer_id as string)
      let sql = 'SELECT * FROM claims WHERE 1=1'
      const params: any[] = []
      if (cid) { sql += ' AND customer_id = ?'; params.push(cid) }
      if (args.status) { sql += ' AND status = ?'; params.push(args.status) }
      if (args.policy_id) { sql += ' AND policy_id = ?'; params.push(args.policy_id) }
      sql += ' ORDER BY created_at DESC'
      const rows = db.prepare(sql).all(...params)
      if (!(rows as any[]).length) return text('No claims found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_cover_summary': {
      const cid = resolveCustomer(args.customer_id as string)
      const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ? AND status = ?').all(cid, 'active') as any[]
      if (!policies.length) return text('No active policies.')
      const totalCover = policies.reduce((s, p) => s + p.cover_amount, 0)
      const totalPremium = policies.reduce((s, p) => s + p.premium, 0)
      return text(JSON.stringify({
        active_policies: policies.length,
        total_cover: `ZAR ${totalCover.toFixed(2)}`,
        total_monthly_premiums: `ZAR ${totalPremium.toFixed(2)}`,
        policies: policies.map(p => ({ type: p.type, policy_number: p.policy_number, cover: `ZAR ${p.cover_amount.toFixed(2)}`, premium: `ZAR ${p.premium.toFixed(2)}/${p.payment_frequency}`, excess: `ZAR ${p.excess.toFixed(2)}`, asset: p.linked_asset })),
      }, null, 2))
    }

    case 'list_beneficiaries': {
      const pid = args.policy_id as string
      if (!ownsPolicy(pid)) return error('Access denied')
      const rows = db.prepare('SELECT * FROM policy_beneficiaries WHERE policy_id = ?').all(pid)
      if (!(rows as any[]).length) return text('No beneficiaries on this policy.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_insurance_overview': {
      const cid = resolveCustomer(args.customer_id as string)
      const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(cid) as any[]
      const active = policies.filter(p => p.status === 'active')
      const claims = db.prepare('SELECT * FROM claims WHERE customer_id = ?').all(cid) as any[]
      const pending = claims.filter(c => ['submitted', 'under_review'].includes(c.status))
      return text(JSON.stringify({
        summary: {
          total_policies: policies.length,
          active: active.length,
          monthly_premiums: `ZAR ${active.reduce((s, p) => s + p.premium, 0).toFixed(2)}`,
          total_cover: `ZAR ${active.reduce((s, p) => s + p.cover_amount, 0).toFixed(2)}`,
          open_claims: pending.length,
        },
        policies: policies.map(p => ({ id: p.id, type: p.type, number: p.policy_number, status: p.status, premium: p.premium, cover: p.cover_amount, asset: p.linked_asset })),
        recent_claims: claims.slice(0, 5).map(c => ({ id: c.id, type: c.type, status: c.status, amount: c.amount_claimed, date: c.incident_date })),
      }, null, 2))
    }

    default:
      return error(`Unknown tool: ${name}`)
  }
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}
