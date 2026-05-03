import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'
import crypto from 'crypto'

export const tools: McpTool[] = [
  {
    name: 'list_loans',
    description: 'List all loans for the authenticated customer.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string', description: 'Customer ID (admin only, defaults to self)' }, status: { type: 'string', enum: ['active', 'paid_off', 'defaulted'] } }, required: [] },
  },
  {
    name: 'get_loan_details',
    description: 'Get full details of a specific loan.',
    inputSchema: { type: 'object', properties: { loan_id: { type: 'string' } }, required: ['loan_id'] },
  },
  {
    name: 'get_loan_balance',
    description: 'Get outstanding balance on a loan.',
    inputSchema: { type: 'object', properties: { loan_id: { type: 'string' } }, required: ['loan_id'] },
  },
  {
    name: 'get_next_payment',
    description: 'Get the next payment due for a loan.',
    inputSchema: { type: 'object', properties: { loan_id: { type: 'string' } }, required: ['loan_id'] },
  },
  {
    name: 'get_payment_schedule',
    description: 'View upcoming payment schedule for a loan.',
    inputSchema: { type: 'object', properties: { loan_id: { type: 'string' }, limit: { type: 'number', description: 'Number of upcoming entries (default 6)' } }, required: ['loan_id'] },
  },
  {
    name: 'list_payments',
    description: 'View payment history for a loan.',
    inputSchema: { type: 'object', properties: { loan_id: { type: 'string' }, limit: { type: 'number', description: 'Max entries (default 12)' } }, required: ['loan_id'] },
  },
  {
    name: 'make_payment',
    description: 'Make a payment on a loan.',
    inputSchema: {
      type: 'object',
      properties: {
        loan_id: { type: 'string' },
        amount: { type: 'number', description: 'Payment amount (defaults to monthly_payment)' },
        source_wallet: { type: 'string', description: 'Source wallet ID' },
      },
      required: ['loan_id'],
    },
  },
  {
    name: 'get_loan_summary',
    description: 'Summary of all loans: total owed, monthly commitments, etc.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string', description: 'Customer ID (admin only)' } }, required: [] },
  },
  {
    name: 'apply_for_loan',
    description: 'Submit a new loan application.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['vehicle', 'personal', 'home', 'student', 'business'] },
        amount: { type: 'number' },
        term_months: { type: 'number' },
        purpose: { type: 'string' },
        monthly_income: { type: 'number' },
      },
      required: ['type', 'amount', 'term_months', 'purpose'],
    },
  },
  {
    name: 'check_application_status',
    description: 'Check status of loan application(s).',
    inputSchema: { type: 'object', properties: { application_id: { type: 'string', description: 'Specific application (optional, lists all if omitted)' } }, required: [] },
  },
  {
    name: 'calculate_loan',
    description: 'Calculate estimated monthly payment and total cost for a potential loan.',
    inputSchema: {
      type: 'object',
      properties: { amount: { type: 'number' }, rate: { type: 'number', description: 'Annual interest rate (%)' }, term_months: { type: 'number' } },
      required: ['amount', 'rate', 'term_months'],
    },
  },
  {
    name: 'get_amortization',
    description: 'Get full amortization table for a loan or hypothetical loan.',
    inputSchema: {
      type: 'object',
      properties: { loan_id: { type: 'string', description: 'Existing loan ID (optional)' }, amount: { type: 'number' }, rate: { type: 'number' }, term_months: { type: 'number' } },
      required: [],
    },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; oauth: any }): Promise<ToolResult> {
  const { db, oauth } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  const isAdmin = oauth.scope.includes('loans:admin')
  const customerId = oauth.customer_id

  const ownsLoan = (loanId: string) => {
    if (isAdmin) return true
    const loan = db.prepare('SELECT customer_id FROM loans WHERE id = ?').get(loanId) as any
    return loan?.customer_id === customerId
  }

  const resolveCustomer = (cid?: string) => {
    if (cid && isAdmin) return cid
    return customerId
  }

  switch (name) {
    case 'list_loans': {
      const cid = resolveCustomer(args.customer_id as string)
      if (!cid) return error('No customer context. Use admin credentials or customer-bound client.')
      let sql = 'SELECT id, type, original_amount, balance, interest_rate, monthly_payment, status, next_payment_date FROM loans WHERE customer_id = ?'
      const params: any[] = [cid]
      if (args.status) { sql += ' AND status = ?'; params.push(args.status) }
      const rows = db.prepare(sql).all(...params)
      if (!(rows as any[]).length) return text('No loans found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_loan_details': {
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(lid) as any
      if (!loan) return error('Loan not found')
      const totalPaid = (db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM loan_payments WHERE loan_id = ? AND status = ?').get(lid, 'completed') as any).total
      const remaining = loan.term_months - loan.months_paid
      return text(JSON.stringify({ ...loan, total_paid: totalPaid, remaining_months: remaining, monthly_commitment: loan.monthly_payment }, null, 2))
    }

    case 'get_loan_balance': {
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const loan = db.prepare('SELECT id, type, balance, monthly_payment, interest_rate, next_payment_date, status FROM loans WHERE id = ?').get(lid) as any
      if (!loan) return error('Loan not found')
      if (loan.status === 'paid_off') return text(`Loan ${loan.id} (${loan.type}) is fully paid off.`)
      return text(`Loan: ${loan.id} (${loan.type})\nOutstanding: ZAR ${loan.balance.toFixed(2)}\nMonthly Payment: ZAR ${loan.monthly_payment.toFixed(2)}\nRate: ${loan.interest_rate}% p.a.\nNext Due: ${loan.next_payment_date}`)
    }

    case 'get_next_payment': {
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(lid) as any
      if (!loan) return error('Loan not found')
      if (loan.status === 'paid_off') return text('Loan is paid off. No payments due.')
      const next = db.prepare('SELECT * FROM loan_schedule WHERE loan_id = ? AND status = ? ORDER BY payment_number LIMIT 1').get(lid, 'upcoming') as any
      if (next) {
        return text(`Next Payment (#${next.payment_number}):\n  Due: ${next.due_date}\n  Principal: ZAR ${next.principal.toFixed(2)}\n  Interest: ZAR ${next.interest.toFixed(2)}\n  Total: ZAR ${next.total.toFixed(2)}`)
      }
      return text(`Next payment: ZAR ${loan.monthly_payment.toFixed(2)} due ${loan.next_payment_date}`)
    }

    case 'get_payment_schedule': {
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const limit = (args.limit as number) || 6
      const rows = db.prepare('SELECT * FROM loan_schedule WHERE loan_id = ? AND status = ? ORDER BY payment_number LIMIT ?').all(lid, 'upcoming', limit)
      if (!(rows as any[]).length) return text('No upcoming scheduled payments.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'list_payments': {
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const limit = (args.limit as number) || 12
      const rows = db.prepare('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY payment_date DESC LIMIT ?').all(lid, limit)
      if (!(rows as any[]).length) return text('No payment history.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'make_payment': {
      if (!oauth.scope.includes('loans:write')) return error('Insufficient scope: loans:write required')
      const lid = args.loan_id as string
      if (!ownsLoan(lid)) return error('Access denied')
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(lid) as any
      if (!loan) return error('Loan not found')
      if (loan.status !== 'active') return error(`Cannot pay on ${loan.status} loan`)

      const amount = (args.amount as number) || loan.monthly_payment
      const monthlyRate = loan.interest_rate / 100 / 12
      const interest = loan.balance * monthlyRate
      const principal = Math.min(amount - interest, loan.balance)
      const newBalance = Math.max(0, loan.balance - principal)

      const paymentId = `lp-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString().slice(0, 10)
      const nextDate = addMonths(loan.next_payment_date, 1)

      db.transaction(() => {
        db.prepare('INSERT INTO loan_payments VALUES (?,?,?,?,?,?,?,?,?,?)').run(
          paymentId, lid, amount, principal, interest, now, 'completed', `PMT-${now}`, args.source_wallet || loan.disbursement_wallet, new Date().toISOString()
        )
        db.prepare('UPDATE loans SET balance = ?, months_paid = months_paid + 1, next_payment_date = ? WHERE id = ?').run(newBalance, nextDate, lid)
        if (newBalance <= 0) db.prepare('UPDATE loans SET status = ?, balance = 0 WHERE id = ?').run('paid_off', lid)
        db.prepare("UPDATE loan_schedule SET status = 'paid' WHERE loan_id = ? AND status = 'upcoming' ORDER BY payment_number LIMIT 1").run(lid)
      })()

      return text(`Payment applied to ${loan.type} loan (${lid}):\n  Amount: ZAR ${amount.toFixed(2)}\n  Principal: ZAR ${principal.toFixed(2)}\n  Interest: ZAR ${interest.toFixed(2)}\n  New Balance: ZAR ${newBalance.toFixed(2)}\n  Next Due: ${newBalance > 0 ? nextDate : 'PAID OFF'}`)
    }

    case 'get_loan_summary': {
      const cid = resolveCustomer(args.customer_id as string)
      if (!cid) return error('No customer context')
      const loans = db.prepare('SELECT * FROM loans WHERE customer_id = ?').all(cid) as any[]
      const active = loans.filter(l => l.status === 'active')
      return text(JSON.stringify({
        total_loans: loans.length,
        active_loans: active.length,
        total_outstanding: `ZAR ${active.reduce((s, l) => s + l.balance, 0).toFixed(2)}`,
        total_monthly: `ZAR ${active.reduce((s, l) => s + l.monthly_payment, 0).toFixed(2)}`,
        loans: loans.map(l => ({ id: l.id, type: l.type, balance: l.balance, monthly: l.monthly_payment, status: l.status })),
      }, null, 2))
    }

    case 'apply_for_loan': {
      if (!oauth.scope.includes('loans:write')) return error('Insufficient scope')
      if (!customerId) return error('Customer context required to apply')
      const id = `la-${crypto.randomUUID().slice(0, 8)}`
      db.prepare('INSERT INTO loan_applications VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        id, customerId, args.type, args.amount, args.term_months, args.purpose, args.monthly_income || null, 'submitted', null, null, new Date().toISOString()
      )
      return text(`Application submitted!\n  ID: ${id}\n  Type: ${args.type}\n  Amount: ZAR ${(args.amount as number).toFixed(2)}\n  Term: ${args.term_months} months\n  Status: submitted`)
    }

    case 'check_application_status': {
      if (args.application_id) {
        const app = db.prepare('SELECT * FROM loan_applications WHERE id = ?').get(args.application_id as string) as any
        if (!app) return error('Application not found')
        if (!isAdmin && app.customer_id !== customerId) return error('Access denied')
        return text(JSON.stringify(app, null, 2))
      }
      const cid = customerId || (isAdmin ? null : null)
      if (!cid && !isAdmin) return error('No customer context')
      const sql = isAdmin && !customerId ? 'SELECT * FROM loan_applications ORDER BY created_at DESC' : 'SELECT * FROM loan_applications WHERE customer_id = ? ORDER BY created_at DESC'
      const rows = isAdmin && !customerId ? db.prepare(sql).all() : db.prepare(sql).all(cid)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'calculate_loan': {
      const P = args.amount as number
      const r = (args.rate as number) / 100 / 12
      const n = args.term_months as number
      const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      const totalCost = monthly * n
      return text(`Loan Estimate:\n  Principal: ZAR ${P.toFixed(2)}\n  Rate: ${args.rate}% p.a.\n  Term: ${n} months (${(n / 12).toFixed(1)} years)\n  Monthly Payment: ZAR ${monthly.toFixed(2)}\n  Total Interest: ZAR ${(totalCost - P).toFixed(2)}\n  Total Repayment: ZAR ${totalCost.toFixed(2)}`)
    }

    case 'get_amortization': {
      let P: number, r: number, n: number
      if (args.loan_id) {
        if (!ownsLoan(args.loan_id as string)) return error('Access denied')
        const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(args.loan_id as string) as any
        if (!loan) return error('Loan not found')
        P = loan.balance; r = loan.interest_rate / 100 / 12; n = loan.term_months - loan.months_paid
      } else {
        if (!args.amount || !args.rate || !args.term_months) return error('Provide loan_id or amount+rate+term_months')
        P = args.amount as number; r = (args.rate as number) / 100 / 12; n = args.term_months as number
      }
      const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      let balance = P
      const table: any[] = []
      for (let i = 1; i <= Math.min(n, 12); i++) {
        const interest = balance * r
        const principal = monthly - interest
        balance -= principal
        table.push({ month: i, payment: monthly.toFixed(2), principal: principal.toFixed(2), interest: interest.toFixed(2), balance: Math.max(0, balance).toFixed(2) })
      }
      return text(`Amortization (first ${table.length} months of ${n}):\n${JSON.stringify(table, null, 2)}`)
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
