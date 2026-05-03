import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'
import crypto from 'crypto'

export const tools: McpTool[] = [
  {
    name: 'get_balance',
    description: 'Get current balance and available balance for the authenticated wallet.',
    inputSchema: { type: 'object', properties: { wallet_id: { type: 'string', description: 'Wallet ID (defaults to authenticated wallet)' } }, required: [] },
  },
  {
    name: 'list_wallets',
    description: 'List all wallets belonging to the authenticated customer.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_transactions',
    description: 'List transactions with filtering options.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: { type: 'string', description: 'Wallet ID (defaults to authenticated wallet)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
        category: { type: 'string', description: 'Filter by category (income, transfer, groceries, etc.)' },
        type: { type: 'string', enum: ['debit', 'credit'], description: 'Filter debit or credit' },
        from_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        to_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: [],
    },
  },
  {
    name: 'get_transaction',
    description: 'Get details of a specific transaction by ID or reference.',
    inputSchema: { type: 'object', properties: { transaction_id: { type: 'string' }, reference: { type: 'string' } }, required: [] },
  },
  {
    name: 'transfer',
    description: 'Transfer money to another wallet (internal P2P or own accounts).',
    inputSchema: {
      type: 'object',
      properties: {
        to_account_number: { type: 'string', description: 'Destination account number' },
        amount: { type: 'number', description: 'Amount to transfer' },
        description: { type: 'string', description: 'Transfer description/note' },
        from_wallet_id: { type: 'string', description: 'Source wallet (defaults to authenticated wallet)' },
      },
      required: ['to_account_number', 'amount'],
    },
  },
  {
    name: 'pay_external',
    description: 'Make a payment to an external account (EFT).',
    inputSchema: {
      type: 'object',
      properties: {
        bank: { type: 'string', description: 'Recipient bank name' },
        account_number: { type: 'string', description: 'Recipient account number' },
        branch_code: { type: 'string', description: 'Branch code' },
        recipient_name: { type: 'string', description: 'Recipient name' },
        amount: { type: 'number' },
        reference: { type: 'string', description: 'Payment reference' },
        from_wallet_id: { type: 'string', description: 'Source wallet (defaults to authenticated)' },
      },
      required: ['bank', 'account_number', 'branch_code', 'recipient_name', 'amount', 'reference'],
    },
  },
  {
    name: 'get_spending_summary',
    description: 'Get spending breakdown by category for a given period.',
    inputSchema: {
      type: 'object',
      properties: {
        wallet_id: { type: 'string' },
        month: { type: 'string', description: 'YYYY-MM (default current month)' },
      },
      required: [],
    },
  },
  {
    name: 'list_scheduled_payments',
    description: 'List scheduled/recurring payments.',
    inputSchema: { type: 'object', properties: { wallet_id: { type: 'string' } }, required: [] },
  },
  {
    name: 'freeze_wallet',
    description: 'Freeze wallet (for lost card / suspicious activity).',
    inputSchema: { type: 'object', properties: { wallet_id: { type: 'string' }, reason: { type: 'string' } }, required: ['reason'] },
  },
  {
    name: 'get_statement',
    description: 'Get a mini-statement (last N transactions with running balance).',
    inputSchema: { type: 'object', properties: { wallet_id: { type: 'string' }, count: { type: 'number', description: 'Number of entries (default 10)' } }, required: [] },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; jwt: any }): Promise<ToolResult> {
  const { db, jwt } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  const myCustomerId = jwt.sub
  const myWalletId = jwt.wallet_id

  const ownsWallet = (wid: string) => {
    const w = db.prepare('SELECT customer_id FROM wallets WHERE id = ?').get(wid) as any
    return w?.customer_id === myCustomerId
  }

  const resolveWallet = (wid?: string) => wid || myWalletId

  switch (name) {
    case 'get_balance': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied: wallet does not belong to you.')
      const w = db.prepare('SELECT * FROM wallets WHERE id = ?').get(wid) as any
      if (!w) return error('Wallet not found')
      return text(`Account: ${w.account_number} (${w.type})\nBalance: ${w.currency} ${w.balance.toFixed(2)}\nAvailable: ${w.currency} ${w.available_balance.toFixed(2)}\nStatus: ${w.status}\nDaily Limit: ${w.currency} ${w.daily_limit.toFixed(2)}`)
    }

    case 'list_wallets': {
      const rows = db.prepare('SELECT id, type, account_number, balance, available_balance, currency, status FROM wallets WHERE customer_id = ?').all(myCustomerId)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'list_transactions': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied')
      let sql = 'SELECT * FROM transactions WHERE wallet_id = ?'
      const params: any[] = [wid]
      if (args.category) { sql += ' AND category = ?'; params.push(args.category) }
      if (args.type) { sql += ' AND type = ?'; params.push(args.type) }
      if (args.from_date) { sql += ' AND created_at >= ?'; params.push(args.from_date) }
      if (args.to_date) { sql += ' AND created_at <= ?'; params.push(args.to_date + ' 23:59:59') }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push((args.limit as number) || 20)
      const rows = db.prepare(sql).all(...params)
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_transaction': {
      let txn
      if (args.transaction_id) {
        txn = db.prepare('SELECT * FROM transactions WHERE id = ? AND wallet_id IN (SELECT id FROM wallets WHERE customer_id = ?)').get(args.transaction_id as string, myCustomerId) as any
      } else if (args.reference) {
        txn = db.prepare('SELECT * FROM transactions WHERE reference = ? AND wallet_id IN (SELECT id FROM wallets WHERE customer_id = ?) ORDER BY created_at DESC LIMIT 1').get(args.reference as string, myCustomerId) as any
      } else {
        return error('Provide transaction_id or reference')
      }
      if (!txn) return error('Transaction not found')
      return text(JSON.stringify(txn, null, 2))
    }

    case 'transfer': {
      const fromWid = resolveWallet(args.from_wallet_id as string)
      if (!ownsWallet(fromWid)) return error('Access denied')
      const amount = args.amount as number
      if (amount <= 0) return error('Amount must be positive')

      const fromW = db.prepare('SELECT * FROM wallets WHERE id = ?').get(fromWid) as any
      if (!fromW) return error('Source wallet not found')
      if (fromW.status !== 'active') return error('Source wallet is not active')
      if (amount > fromW.daily_limit) return error(`Exceeds daily limit of ZAR ${fromW.daily_limit.toFixed(2)}`)
      if (fromW.available_balance < amount) return error('Insufficient available balance')

      const toW = db.prepare('SELECT * FROM wallets WHERE account_number = ?').get(args.to_account_number as string) as any
      if (!toW) return error('Destination account not found')
      if (toW.status !== 'active') return error('Destination account is not active')

      const ref = `TRF-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()
      const desc = (args.description as string) || 'Transfer'
      const fromName = db.prepare('SELECT account_number FROM wallets WHERE id = ?').get(fromWid) as any
      const toName = toW.account_number

      db.transaction(() => {
        db.prepare('UPDATE wallets SET balance = balance - ?, available_balance = available_balance - ? WHERE id = ?').run(amount, amount, fromWid)
        db.prepare('UPDATE wallets SET balance = balance + ?, available_balance = available_balance + ? WHERE id = ?').run(amount, amount, toW.id)
        const newFromBal = (db.prepare('SELECT balance FROM wallets WHERE id = ?').get(fromWid) as any).balance
        const newToBal = (db.prepare('SELECT balance FROM wallets WHERE id = ?').get(toW.id) as any).balance
        db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          `txn-${crypto.randomUUID().slice(0, 8)}`, fromWid, 'debit', amount, newFromBal, desc, 'transfer', ref, `Account ${toName}`, toW.id, 'internal', 'completed', args.description ? JSON.stringify({ note: args.description }) : null, now
        )
        db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          `txn-${crypto.randomUUID().slice(0, 8)}`, toW.id, 'credit', amount, newToBal, desc, 'transfer', ref, `Account ${fromName.account_number}`, fromWid, 'internal', 'completed', args.description ? JSON.stringify({ note: args.description }) : null, now
        )
      })()

      return text(`Transfer successful!\n  Amount: ZAR ${amount.toFixed(2)}\n  To: ${toName}\n  Reference: ${ref}\n  Description: ${desc}`)
    }

    case 'pay_external': {
      const fromWid = resolveWallet(args.from_wallet_id as string)
      if (!ownsWallet(fromWid)) return error('Access denied')
      const amount = args.amount as number
      if (amount <= 0) return error('Amount must be positive')

      const fromW = db.prepare('SELECT * FROM wallets WHERE id = ?').get(fromWid) as any
      if (fromW.status !== 'active') return error('Wallet is not active')
      if (fromW.available_balance < amount) return error('Insufficient available balance')

      const ref = args.reference as string
      const now = new Date().toISOString()
      db.transaction(() => {
        db.prepare('UPDATE wallets SET balance = balance - ?, available_balance = available_balance - ? WHERE id = ?').run(amount, amount, fromWid)
        const newBal = (db.prepare('SELECT balance FROM wallets WHERE id = ?').get(fromWid) as any).balance
        db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
          `txn-${crypto.randomUUID().slice(0, 8)}`, fromWid, 'debit', amount, newBal,
          `EFT to ${args.recipient_name}`, 'payment', ref, args.recipient_name, null, 'eft', 'completed',
          JSON.stringify({ bank: args.bank, account: args.account_number, branch: args.branch_code }), now
        )
      })()

      return text(`EFT Payment submitted!\n  Amount: ZAR ${amount.toFixed(2)}\n  To: ${args.recipient_name} (${args.bank})\n  Account: ${args.account_number}\n  Reference: ${ref}`)
    }

    case 'get_spending_summary': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied')
      const month = (args.month as string) || new Date().toISOString().slice(0, 7)
      const rows = db.prepare(
        `SELECT category, COUNT(*) as count, SUM(amount) as total FROM transactions
         WHERE wallet_id = ? AND type = 'debit' AND strftime('%Y-%m', created_at) = ?
         GROUP BY category ORDER BY total DESC`
      ).all(wid, month)
      const total = (rows as any[]).reduce((s, r) => s + r.total, 0)
      return text(JSON.stringify({ month, wallet_id: wid, total_spent: `ZAR ${total.toFixed(2)}`, breakdown: rows }, null, 2))
    }

    case 'list_scheduled_payments': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied')
      const rows = db.prepare('SELECT * FROM scheduled_payments WHERE wallet_id = ? AND status = ? ORDER BY next_run').all(wid, 'active')
      if (!(rows as any[]).length) return text('No scheduled payments.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'freeze_wallet': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied')
      db.prepare('UPDATE wallets SET status = ? WHERE id = ?').run('frozen', wid)
      return text(`Wallet ${wid} frozen. Reason: ${args.reason}\nContact support to unfreeze.`)
    }

    case 'get_statement': {
      const wid = resolveWallet(args.wallet_id as string)
      if (!ownsWallet(wid)) return error('Access denied')
      const count = (args.count as number) || 10
      const wallet = db.prepare('SELECT account_number, type, balance, currency FROM wallets WHERE id = ?').get(wid) as any
      const rows = db.prepare('SELECT created_at, type, amount, balance_after, description, reference FROM transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?').all(wid, count) as any[]

      let stmt = `Mini Statement - ${wallet.account_number} (${wallet.type})\nCurrent Balance: ${wallet.currency} ${wallet.balance.toFixed(2)}\n${'─'.repeat(60)}\n`
      for (const t of rows) {
        const sign = t.type === 'debit' ? '-' : '+'
        stmt += `${t.created_at.slice(0, 16)}  ${sign}${t.amount.toFixed(2).padStart(10)}  Bal: ${t.balance_after.toFixed(2).padStart(12)}  ${t.description}\n`
      }
      return text(stmt)
    }

    default:
      return error(`Unknown tool: ${name}`)
  }
}
