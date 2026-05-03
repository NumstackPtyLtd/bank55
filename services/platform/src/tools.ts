import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'

export const tools: McpTool[] = [
  {
    name: 'get_dashboard',
    description: 'Get the main banking dashboard: account summary, recent activity, notifications, upcoming payments.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_activity_feed',
    description: 'Get recent activity across all services (wallets, loans, insurance).',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max entries (default 20)' }, service: { type: 'string', enum: ['wallets', 'loans', 'insurance'], description: 'Filter by service' } }, required: [] },
  },
  {
    name: 'get_notifications',
    description: 'Get notifications (unread by default).',
    inputSchema: { type: 'object', properties: { unread_only: { type: 'boolean', description: 'Only unread (default true)' }, limit: { type: 'number' } }, required: [] },
  },
  {
    name: 'mark_notification_read',
    description: 'Mark a notification as read.',
    inputSchema: { type: 'object', properties: { notification_id: { type: 'string' }, all: { type: 'boolean', description: 'Mark all as read' } }, required: [] },
  },
  {
    name: 'get_financial_overview',
    description: 'Complete financial overview: total assets, liabilities, monthly commitments across all services.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string', description: 'Admin only - view another customer' } }, required: [] },
  },
  {
    name: 'search_activity',
    description: 'Search activity log by keyword, service, or date range.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        service: { type: 'string' },
        from_date: { type: 'string' },
        to_date: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_upcoming_payments',
    description: 'List all upcoming payments across loans and insurance.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_monthly_summary',
    description: 'Get monthly income vs expenses summary.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM (default current)' } }, required: [] },
  },
  {
    name: 'view_customer_360',
    description: 'Admin tool: Full 360-degree view of a customer across all services.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
  },
  {
    name: 'list_all_customers',
    description: 'Admin tool: List all customers with their status across services.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'track_cross_service_transaction',
    description: 'Track a transaction/reference across all services to see the full picture.',
    inputSchema: { type: 'object', properties: { reference: { type: 'string', description: 'Transaction reference or ID' } }, required: ['reference'] },
  },
  {
    name: 'get_action_log',
    description: 'View the dashboard action log - all operations performed by users. Use this to understand what actions have been taken, by whom, and their outcomes.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries (default 30)' },
        service: { type: 'string', description: 'Filter by service (customers, wallets, loans, insurance)' },
        user_email: { type: 'string', description: 'Filter by user email' },
        since: { type: 'string', description: 'Only actions after this ISO timestamp' },
      },
      required: [],
    },
  },
  {
    name: 'get_action_summary',
    description: 'Get a summary of dashboard actions - counts by service and action type. Useful for understanding operational patterns.',
    inputSchema: { type: 'object', properties: { since: { type: 'string', description: 'ISO timestamp (default last 24h)' } }, required: [] },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; session: any }): Promise<ToolResult> {
  const { db, session } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  const isAdmin = session.role === 'admin'
  const customerId = session.customer_id

  switch (name) {
    case 'get_dashboard': {
      const notifications = db.prepare('SELECT * FROM notifications WHERE customer_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 5').all(customerId) as any[]
      const recentActivity = db.prepare('SELECT * FROM activity_log WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5').all(customerId) as any[]

      return text(JSON.stringify({
        welcome: `Welcome back, ${session.email}`,
        unread_notifications: notifications.length,
        notifications: notifications.map(n => ({ type: n.type, title: n.title, message: n.message, service: n.service, date: n.created_at })),
        recent_activity: recentActivity.map(a => ({ service: a.service, action: a.action, details: JSON.parse(a.details || '{}'), date: a.created_at })),
      }, null, 2))
    }

    case 'get_activity_feed': {
      const limit = (args.limit as number) || 20
      let sql = 'SELECT * FROM activity_log WHERE customer_id = ?'
      const params: any[] = [customerId]
      if (args.service) { sql += ' AND service = ?'; params.push(args.service) }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)
      const rows = db.prepare(sql).all(...params) as any[]
      return text(JSON.stringify(rows.map(r => ({ ...r, details: JSON.parse(r.details || '{}') })), null, 2))
    }

    case 'get_notifications': {
      const unreadOnly = args.unread_only !== false
      const limit = (args.limit as number) || 20
      let sql = 'SELECT * FROM notifications WHERE customer_id = ?'
      const params: any[] = [customerId]
      if (unreadOnly) { sql += ' AND read = 0' }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)
      const rows = db.prepare(sql).all(...params)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'mark_notification_read': {
      if (args.all) {
        db.prepare('UPDATE notifications SET read = 1 WHERE customer_id = ?').run(customerId)
        return text('All notifications marked as read.')
      }
      if (args.notification_id) {
        db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND customer_id = ?').run(args.notification_id, customerId)
        return text(`Notification ${args.notification_id} marked as read.`)
      }
      return error('Provide notification_id or set all=true')
    }

    case 'get_financial_overview': {
      const cid = isAdmin && args.customer_id ? args.customer_id as string : customerId
      const activity = db.prepare('SELECT * FROM activity_log WHERE customer_id = ? ORDER BY created_at DESC').all(cid) as any[]

      // Aggregate from activity log
      const loanPayments = activity.filter(a => a.service === 'loans' && a.action === 'payment')
      const insurancePremiums = activity.filter(a => a.service === 'insurance' && a.action === 'premium_paid')
      const transfers = activity.filter(a => a.service === 'wallets' && a.action === 'transfer')

      const totalLoanPayments = loanPayments.reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)
      const totalPremiums = insurancePremiums.reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)

      return text(JSON.stringify({
        customer_id: cid,
        monthly_commitments: {
          loan_payments: `ZAR ${totalLoanPayments.toFixed(2)}`,
          insurance_premiums: `ZAR ${totalPremiums.toFixed(2)}`,
          total: `ZAR ${(totalLoanPayments + totalPremiums).toFixed(2)}`,
        },
        recent_transfers: transfers.slice(0, 5).map(t => JSON.parse(t.details)),
        services_active: [...new Set(activity.map(a => a.service))],
      }, null, 2))
    }

    case 'search_activity': {
      let sql = 'SELECT * FROM activity_log WHERE customer_id = ?'
      const params: any[] = [isAdmin && args.query ? customerId : customerId]
      if (args.service) { sql += ' AND service = ?'; params.push(args.service) }
      if (args.from_date) { sql += ' AND created_at >= ?'; params.push(args.from_date) }
      if (args.to_date) { sql += ' AND created_at <= ?'; params.push(args.to_date + ' 23:59:59') }
      if (args.query) { sql += ' AND (action LIKE ? OR details LIKE ?)'; params.push(`%${args.query}%`, `%${args.query}%`) }
      sql += ' ORDER BY created_at DESC LIMIT 20'
      const rows = db.prepare(sql).all(...params) as any[]
      return text(JSON.stringify(rows.map(r => ({ ...r, details: JSON.parse(r.details || '{}') })), null, 2))
    }

    case 'get_upcoming_payments': {
      const activity = db.prepare("SELECT * FROM activity_log WHERE customer_id = ? AND action = 'payment' ORDER BY created_at DESC").all(customerId) as any[]
      const notifications = db.prepare("SELECT * FROM notifications WHERE customer_id = ? AND (title LIKE '%Due%' OR title LIKE '%Payment%') AND read = 0 ORDER BY created_at DESC").all(customerId) as any[]
      return text(JSON.stringify({
        upcoming_alerts: notifications.map(n => ({ title: n.title, message: n.message, service: n.service, date: n.created_at })),
        recent_payments: activity.slice(0, 5).map(a => ({ service: a.service, ...JSON.parse(a.details || '{}'), date: a.created_at })),
      }, null, 2))
    }

    case 'get_monthly_summary': {
      const month = (args.month as string) || new Date().toISOString().slice(0, 7)
      const activity = db.prepare("SELECT * FROM activity_log WHERE customer_id = ? AND created_at LIKE ?").all(customerId, `${month}%`) as any[]

      const income = activity.filter(a => a.action === 'salary_received').reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)
      const loanPay = activity.filter(a => a.action === 'payment' && a.service === 'loans').reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)
      const insPay = activity.filter(a => a.action === 'premium_paid').reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)
      const outTransfers = activity.filter(a => a.action === 'transfer').reduce((s, a) => { const d = JSON.parse(a.details); return s + (d.amount || 0) }, 0)

      return text(JSON.stringify({
        month,
        income: `ZAR ${income.toFixed(2)}`,
        expenses: {
          loans: `ZAR ${loanPay.toFixed(2)}`,
          insurance: `ZAR ${insPay.toFixed(2)}`,
          transfers: `ZAR ${outTransfers.toFixed(2)}`,
          total: `ZAR ${(loanPay + insPay + outTransfers).toFixed(2)}`,
        },
        net: `ZAR ${(income - loanPay - insPay - outTransfers).toFixed(2)}`,
        activity_count: activity.length,
      }, null, 2))
    }

    case 'view_customer_360': {
      if (!isAdmin) return error('Admin access required')
      const cid = args.customer_id as string
      const activity = db.prepare('SELECT * FROM activity_log WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20').all(cid) as any[]
      const notifications = db.prepare('SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10').all(cid) as any[]
      const user = db.prepare('SELECT id, email, name, role, status, last_login FROM users WHERE customer_id = ?').get(cid) as any

      const serviceBreakdown: Record<string, any[]> = {}
      for (const a of activity) {
        if (!serviceBreakdown[a.service]) serviceBreakdown[a.service] = []
        serviceBreakdown[a.service].push({ action: a.action, details: JSON.parse(a.details || '{}'), date: a.created_at })
      }

      return text(JSON.stringify({
        customer_id: cid,
        user,
        services_used: Object.keys(serviceBreakdown),
        activity_by_service: serviceBreakdown,
        recent_notifications: notifications.map(n => ({ type: n.type, title: n.title, service: n.service, date: n.created_at })),
      }, null, 2))
    }

    case 'list_all_customers': {
      if (!isAdmin) return error('Admin access required')
      const users = db.prepare('SELECT id, customer_id, email, name, role, status, last_login FROM users ORDER BY created_at').all()
      return text(JSON.stringify(users, null, 2))
    }

    case 'track_cross_service_transaction': {
      const ref = args.reference as string
      const activity = db.prepare('SELECT * FROM activity_log WHERE details LIKE ? ORDER BY created_at').all(`%${ref}%`) as any[]
      if (!activity.length) return text(`No activity found for reference "${ref}".`)
      return text(JSON.stringify({
        reference: ref,
        trace: activity.map(a => ({
          service: a.service,
          action: a.action,
          customer_id: a.customer_id,
          details: JSON.parse(a.details || '{}'),
          timestamp: a.created_at,
        })),
      }, null, 2))
    }

    case 'get_action_log': {
      if (!isAdmin) return error('Admin access required')
      const limit = (args.limit as number) || 30
      let sql = 'SELECT * FROM action_log WHERE 1=1'
      const params: any[] = []
      if (args.service) { sql += ' AND service = ?'; params.push(args.service) }
      if (args.user_email) { sql += ' AND user_email = ?'; params.push(args.user_email) }
      if (args.since) { sql += ' AND created_at >= ?'; params.push(args.since) }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)
      const rows = db.prepare(sql).all(...params) as any[]
      if (!rows.length) return text('No actions recorded yet.')
      return text(JSON.stringify(rows.map(r => ({
        ...r,
        params: JSON.parse(r.params || '{}'),
        result: JSON.parse(r.result || '""'),
      })), null, 2))
    }

    case 'get_action_summary': {
      if (!isAdmin) return error('Admin access required')
      const since = (args.since as string) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const breakdown = db.prepare(
        `SELECT service, action, COUNT(*) as count, MAX(created_at) as last_at
         FROM action_log WHERE created_at >= ? GROUP BY service, action ORDER BY count DESC`
      ).all(since) as any[]
      const total = (db.prepare('SELECT COUNT(*) as c FROM action_log WHERE created_at >= ?').get(since) as any).c
      const users = db.prepare(
        `SELECT user_email, COUNT(*) as count FROM action_log WHERE created_at >= ? GROUP BY user_email ORDER BY count DESC`
      ).all(since)
      return text(JSON.stringify({ since, total_actions: total, by_service: breakdown, by_user: users }, null, 2))
    }

    default:
      return error(`Unknown tool: ${name}`)
  }
}
