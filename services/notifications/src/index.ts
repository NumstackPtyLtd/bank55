import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import nodemailer from 'nodemailer'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())

const PORT = parseInt(process.env.PORT || '5505')
const DB_PATH = process.env.DB_PATH || '/data/notifications.db'
const SMTP_HOST = process.env.SMTP_HOST || 'localhost'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025')

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// SMTP transport (Mailpit)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  tls: { rejectUnauthorized: false },
})

// --- Auth: Service Token (internal services use this) ---
const SERVICE_TOKENS: Record<string, string> = {
  'notif-platform-token': 'Bank55 Platform',
  'notif-wallets-token': 'Wallets Service',
  'notif-loans-token': 'Loans Service',
  'notif-insurance-token': 'Insurance Service',
  'notif-admin-token': 'Admin Console',
}

function validateServiceToken(token: string | undefined): string | null {
  if (!token) return null
  return SERVICE_TOKENS[token] || null
}

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Notifications', auth: 'service-token', tools: tools.length, smtp: `${SMTP_HOST}:${SMTP_PORT}` }))

// Auth middleware for /mcp and /api
app.use('/mcp', async (c, next) => {
  const token = c.req.header('X-Service-Token')
  const service = validateServiceToken(token)
  if (!service) return c.json({ error: 'Invalid or missing X-Service-Token' }, 401)
  c.set('service' as never, service)
  await next()
})

app.use('/api/*', async (c, next) => {
  const token = c.req.header('X-Service-Token')
  const service = validateServiceToken(token)
  if (!service) return c.json({ error: 'Invalid or missing X-Service-Token' }, 401)
  c.set('service' as never, service)
  await next()
})

// --- Direct API for sending notifications (used by other services) ---
app.post('/api/notify', async (c) => {
  const sender = c.get('service' as never) as string
  const { customer_id, customer_email, customer_name, channel, type, subject, body, metadata } = await c.req.json()

  const id = `notif-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  // Store notification
  db.prepare(
    `INSERT INTO notifications (id, customer_id, channel, type, subject, body, metadata, status, sender, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, customer_id, channel || 'email', type, subject, body, JSON.stringify(metadata || {}), 'pending', sender, now)

  // Send email if channel is email
  if (channel === 'email' || !channel) {
    try {
      await transporter.sendMail({
        from: '"Bank55" <noreply@bank55.co.za>',
        to: customer_email || `${customer_id}@bank55.local`,
        subject: subject,
        html: renderEmail(type, subject, body, customer_name),
      })
      db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id)
    } catch (err: any) {
      db.prepare('UPDATE notifications SET status = ?, error = ? WHERE id = ?').run('failed', err.message, id)
    }
  }

  // SMS placeholder
  if (channel === 'sms') {
    db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('sent', id)
  }

  // Push placeholder
  if (channel === 'push') {
    db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('sent', id)
  }

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
  return c.json(notification)
})

// Batch notify
app.post('/api/notify/batch', async (c) => {
  const sender = c.get('service' as never) as string
  const { notifications } = await c.req.json()
  const results = []
  for (const n of notifications) {
    const id = `notif-${crypto.randomUUID().slice(0, 8)}`
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO notifications (id, customer_id, channel, type, subject, body, metadata, status, sender, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(id, n.customer_id, n.channel || 'email', n.type, n.subject, n.body, JSON.stringify(n.metadata || {}), 'pending', sender, now)

    if (n.channel === 'email' || !n.channel) {
      try {
        await transporter.sendMail({
          from: '"Bank55" <noreply@bank55.co.za>',
          to: n.customer_email || `${n.customer_id}@bank55.local`,
          subject: n.subject,
          html: renderEmail(n.type, n.subject, n.body, n.customer_name),
        })
        db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id)
      } catch {
        db.prepare('UPDATE notifications SET status = ? WHERE id = ?').run('failed', id)
      }
    }
    results.push(id)
  }
  return c.json({ sent: results.length, ids: results })
})

// MCP
const mcpRouter = createMcpRouter('Bank55 Notifications', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const service = c.get('service' as never) as string
  const result = await mcpRouter(body, { db, service, transporter })
  return result === null ? c.body(null, 204) : c.json(result)
})

function renderEmail(type: string, subject: string, body: string, customerName?: string): string {
  const greeting = customerName ? `Hi ${customerName},` : 'Dear Customer,'
  const typeColors: Record<string, string> = {
    transfer: '#7c3aed',
    payment: '#059669',
    loan: '#d97706',
    insurance: '#e11d48',
    security: '#dc2626',
    info: '#2563eb',
  }
  const color = typeColors[type] || '#059669'

  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 3px solid ${color}; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 24px;">Bank<span style="color: ${color}">55</span></h1>
      </div>
      <p style="color: #374151; font-size: 15px;">${greeting}</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">${subject}</h2>
        <p style="margin: 0; color: #4b5563; font-size: 14px; white-space: pre-line;">${body}</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        This is an automated notification from Bank55. Do not reply to this email.<br>
        Bank55 is a fictional bank for MCP testing purposes.
      </p>
    </div>
  `
}

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Notifications] Running on port ${PORT}`)
  console.log(`  Auth: X-Service-Token header`)
  console.log(`  SMTP: ${SMTP_HOST}:${SMTP_PORT} (Mailpit)`)
  console.log(`  API: POST /api/notify, POST /api/notify/batch`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
})
