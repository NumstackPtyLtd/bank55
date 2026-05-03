import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import crypto from 'crypto'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())
const PORT = parseInt(process.env.PORT || '5500')
const DB_PATH = process.env.DB_PATH || '/data/platform.db'

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// --- Session store ---
const sessions = new Map<string, { user_id: string; email: string; role: string; customer_id: string; created: number; expires: number }>()

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Platform', auth: 'session-cookie', tools: tools.length }))

// Login -> session token
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
  if (!user) return c.json({ error: 'Invalid email or password' }, 401)

  // Simple password check (in prod would be bcrypt)
  if (user.password_hash !== hashPassword(password)) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  if (user.status !== 'active') return c.json({ error: 'Account is not active' }, 403)

  const sessionId = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  sessions.set(sessionId, {
    user_id: user.id,
    email: user.email,
    role: user.role,
    customer_id: user.customer_id,
    created: now,
    expires: now + 8 * 60 * 60 * 1000, // 8 hours
  })

  return c.json({
    session_token: sessionId,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, customer_id: user.customer_id },
    expires_in: 28800,
  })
})

// Logout
app.post('/auth/logout', async (c) => {
  const token = c.req.header('X-Session-Token')
  if (token) sessions.delete(token)
  return c.json({ message: 'Logged out' })
})

// Session validation (for dashboard to check if still logged in)
app.get('/auth/me', async (c) => {
  const token = c.req.header('X-Session-Token')
  if (!token) return c.json({ authenticated: false }, 401)
  const session = sessions.get(token)
  if (!session || session.expires < Date.now()) return c.json({ authenticated: false }, 401)
  const user = db.prepare('SELECT id, email, name, role, customer_id FROM users WHERE id = ?').get(session.user_id)
  return c.json({ authenticated: true, user })
})

// --- Action Log API (for AI reasoning) ---
// Records all dashboard actions so MCP tools can query what happened
app.use('/api/*', async (c, next) => {
  const token = c.req.header('X-Session-Token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const session = sessions.get(token)
  if (!session || session.expires < Date.now()) return c.json({ error: 'Session expired' }, 401)
  c.set('session' as never, session)
  await next()
})

app.post('/api/actions', async (c) => {
  const session = c.get('session' as never) as any
  const { service, action, target, params, result, success } = await c.req.json()
  const id = `act-${crypto.randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO action_log (id, user_id, user_email, customer_id, service, action, target, params, result, success, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, session.user_id, session.email, session.customer_id, service, action, target || null, JSON.stringify(params || {}), JSON.stringify(result || ''), success ? 1 : 0, now)
  return c.json({ id, recorded: true })
})

app.get('/api/actions', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50')
  const service = c.req.query('service')
  const since = c.req.query('since')
  let sql = 'SELECT * FROM action_log WHERE 1=1'
  const params: any[] = []
  if (service) { sql += ' AND service = ?'; params.push(service) }
  if (since) { sql += ' AND created_at >= ?'; params.push(since) }
  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)
  const rows = db.prepare(sql).all(...params)
  return c.json(rows)
})

app.get('/api/actions/summary', async (c) => {
  const since = c.req.query('since') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const rows = db.prepare(
    `SELECT service, action, COUNT(*) as count, MAX(created_at) as last_at
     FROM action_log WHERE created_at >= ? GROUP BY service, action ORDER BY count DESC`
  ).all(since)
  const total = (db.prepare('SELECT COUNT(*) as c FROM action_log WHERE created_at >= ?').get(since) as any).c
  return c.json({ since, total_actions: total, breakdown: rows })
})

// Session middleware for MCP
app.use('/mcp', async (c, next) => {
  const token = c.req.header('X-Session-Token')
  if (!token) return c.json({ error: 'Missing X-Session-Token header. Use POST /auth/login first.' }, 401)
  const session = sessions.get(token)
  if (!session) return c.json({ error: 'Invalid session' }, 401)
  if (session.expires < Date.now()) {
    sessions.delete(token)
    return c.json({ error: 'Session expired. Please login again.' }, 401)
  }
  c.set('session' as never, session)
  await next()
})

// MCP
const mcpRouter = createMcpRouter('Bank55 Platform', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const session = c.get('session' as never) as any
  const result = await mcpRouter(body, { db, session })
  return result === null ? c.body(null, 204) : c.json(result)
})

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'bank55-salt').digest('hex')
}

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Platform] Running on port ${PORT}`)
  console.log(`  Auth: POST /auth/login (email + password) -> X-Session-Token`)
  console.log(`  Actions: GET/POST /api/actions (requires session)`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
})
