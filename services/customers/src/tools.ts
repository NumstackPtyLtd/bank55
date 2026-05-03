import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'
import crypto from 'crypto'

export const tools: McpTool[] = [
  {
    name: 'search_customers',
    description: 'Search for customers by name, email, ID number, or phone.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search term' } }, required: ['query'] },
  },
  {
    name: 'get_customer',
    description: 'Get full customer profile by customer ID.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string', description: 'Customer ID' } }, required: ['customer_id'] },
  },
  {
    name: 'list_customers',
    description: 'List all customers with optional status filter.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'suspended', 'closed'], description: 'Filter by status' }, kyc_status: { type: 'string', enum: ['verified', 'pending', 'failed', 'expired'], description: 'Filter by KYC status' } }, required: [] },
  },
  {
    name: 'create_customer',
    description: 'Register a new customer.',
    inputSchema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        id_number: { type: 'string', description: '13-digit SA ID number' },
        email: { type: 'string' },
        phone: { type: 'string' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD' },
        address: { type: 'string' },
      },
      required: ['first_name', 'last_name', 'id_number', 'email'],
    },
  },
  {
    name: 'update_customer',
    description: 'Update customer details (email, phone, address).',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'get_kyc_status',
    description: 'Check KYC verification status and documents for a customer.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
  },
  {
    name: 'verify_customer',
    description: 'Mark a customer as KYC verified (admin only).',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
  },
  {
    name: 'suspend_customer',
    description: 'Suspend a customer account with reason.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' }, reason: { type: 'string' } }, required: ['customer_id', 'reason'] },
  },
  {
    name: 'get_audit_log',
    description: 'View audit trail for a customer.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' }, limit: { type: 'number', description: 'Max entries (default 20)' } }, required: ['customer_id'] },
  },
  {
    name: 'get_risk_assessment',
    description: 'Get risk score and assessment details for a customer.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; client: { name: string; role: string } }): Promise<ToolResult> {
  const { db, client } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  switch (name) {
    case 'search_customers': {
      const q = args.query as string
      const rows = db.prepare(
        `SELECT id, first_name, last_name, email, phone, country, currency, kyc_status, kyc_tier, risk_score, status
         FROM customers WHERE first_name || ' ' || last_name LIKE ? OR email LIKE ? OR id_number = ? OR phone LIKE ?`
      ).all(`%${q}%`, `%${q}%`, q, `%${q}%`)
      if (!(rows as any[]).length) return text(`No customers found for "${q}".`)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_customer': {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(args.customer_id as string)
      if (!customer) return error('Customer not found.')
      return text(JSON.stringify(customer, null, 2))
    }

    case 'list_customers': {
      let sql = 'SELECT id, first_name, last_name, email, country, currency, kyc_status, kyc_tier, risk_score, status, created_at FROM customers WHERE 1=1'
      const params: any[] = []
      if (args.status) { sql += ' AND status = ?'; params.push(args.status) }
      if (args.kyc_status) { sql += ' AND kyc_status = ?'; params.push(args.kyc_status) }
      sql += ' ORDER BY created_at DESC'
      const rows = db.prepare(sql).all(...params)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'create_customer': {
      if (client.role === 'readonly') return error('Permission denied: readonly API key cannot create customers.')
      const id = `cust-${crypto.randomUUID().slice(0, 6)}`
      const now = new Date().toISOString()
      db.prepare(
        'INSERT INTO customers (id, first_name, last_name, id_number, email, phone, date_of_birth, address, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).run(id, args.first_name, args.last_name, args.id_number, args.email, args.phone || null, args.date_of_birth || null, args.address || null, now, now)
      db.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?)').run(`audit-${crypto.randomUUID().slice(0, 6)}`, id, 'customer_created', client.name, `New customer registered`, now)
      return text(`Customer created: ${id}\nName: ${args.first_name} ${args.last_name}\nStatus: active, KYC: pending`)
    }

    case 'update_customer': {
      if (client.role === 'readonly') return error('Permission denied.')
      const cid = args.customer_id as string
      const updates: string[] = []
      const params: any[] = []
      if (args.email) { updates.push('email = ?'); params.push(args.email) }
      if (args.phone) { updates.push('phone = ?'); params.push(args.phone) }
      if (args.address) { updates.push('address = ?'); params.push(args.address) }
      if (!updates.length) return error('No fields to update.')
      updates.push('updated_at = ?'); params.push(new Date().toISOString())
      params.push(cid)
      db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
      return text(`Customer ${cid} updated.`)
    }

    case 'get_kyc_status': {
      const customer = db.prepare('SELECT id, first_name, last_name, kyc_status, kyc_verified_at FROM customers WHERE id = ?').get(args.customer_id as string) as any
      if (!customer) return error('Customer not found.')
      const docs = db.prepare('SELECT * FROM kyc_documents WHERE customer_id = ? ORDER BY created_at').all(args.customer_id as string)
      return text(JSON.stringify({ customer, documents: docs }, null, 2))
    }

    case 'verify_customer': {
      if (client.role !== 'admin') return error('Permission denied: only admin can verify customers.')
      const now = new Date().toISOString()
      db.prepare('UPDATE customers SET kyc_status = ?, kyc_verified_at = ?, updated_at = ? WHERE id = ?').run('verified', now, now, args.customer_id)
      db.prepare('UPDATE kyc_documents SET status = ?, verified_at = ? WHERE customer_id = ? AND status = ?').run('verified', now, args.customer_id, 'pending')
      db.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?)').run(`audit-${crypto.randomUUID().slice(0, 6)}`, args.customer_id, 'kyc_verified', client.name, 'Customer verified', now)
      return text(`Customer ${args.customer_id} KYC status set to verified.`)
    }

    case 'suspend_customer': {
      if (client.role === 'readonly') return error('Permission denied.')
      const now = new Date().toISOString()
      db.prepare('UPDATE customers SET status = ?, updated_at = ? WHERE id = ?').run('suspended', now, args.customer_id)
      db.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?)').run(`audit-${crypto.randomUUID().slice(0, 6)}`, args.customer_id, 'account_suspended', client.name, args.reason, now)
      return text(`Customer ${args.customer_id} suspended. Reason: ${args.reason}`)
    }

    case 'get_audit_log': {
      const limit = (args.limit as number) || 20
      const rows = db.prepare('SELECT * FROM audit_log WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?').all(args.customer_id as string, limit)
      if (!(rows as any[]).length) return text('No audit entries found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_risk_assessment': {
      const customer = db.prepare('SELECT id, first_name, last_name, risk_score, kyc_status, status FROM customers WHERE id = ?').get(args.customer_id as string) as any
      if (!customer) return error('Customer not found.')
      let level = 'low'
      if (customer.risk_score > 50) level = 'high'
      else if (customer.risk_score > 20) level = 'medium'
      return text(JSON.stringify({
        customer_id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        risk_score: customer.risk_score,
        risk_level: level,
        kyc_status: customer.kyc_status,
        account_status: customer.status,
        flags: customer.risk_score > 50 ? ['high_risk', 'enhanced_monitoring'] : [],
      }, null, 2))
    }

    default:
      return error(`Unknown tool: ${name}`)
  }
}
