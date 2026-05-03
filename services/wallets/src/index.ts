import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import crypto from 'crypto'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())
const PORT = parseInt(process.env.PORT || '5502')
const DB_PATH = process.env.DB_PATH || '/data/wallets.db'
const JWT_SECRET = process.env.JWT_SECRET || 'wallets-jwt-secret-2024'

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// --- JWT helpers ---
function signJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyJwt(token: string): any | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch { return null }
}

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Wallets', auth: 'jwt-bearer', tools: tools.length }))

// Login - get JWT by account_number + PIN
app.post('/auth/token', async (c) => {
  const { account_number, pin } = await c.req.json()
  const wallet = db.prepare('SELECT * FROM wallets WHERE account_number = ?').get(account_number) as any
  if (!wallet) return c.json({ error: 'Invalid account number' }, 401)
  const cred = db.prepare('SELECT * FROM wallet_credentials WHERE wallet_id = ?').get(wallet.id) as any
  if (!cred || cred.pin !== pin) return c.json({ error: 'Invalid PIN' }, 401)

  const token = signJwt({
    sub: wallet.customer_id,
    wallet_id: wallet.id,
    account_number: wallet.account_number,
    type: wallet.type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  })
  return c.json({ access_token: token, token_type: 'Bearer', expires_in: 3600, wallet_id: wallet.id })
})

// JWT auth middleware
app.use('/mcp', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Missing Bearer token. Use POST /auth/token to get one.' }, 401)
  const payload = verifyJwt(auth.slice(7))
  if (!payload) return c.json({ error: 'Invalid or expired token' }, 401)
  c.set('jwt' as never, payload)
  await next()
})

// MCP
const mcpRouter = createMcpRouter('Bank55 Wallets', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const jwt = c.get('jwt' as never) as any
  const result = await mcpRouter(body, { db, jwt })
  return result === null ? c.body(null, 204) : c.json(result)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Wallets] Running on port ${PORT}`)
  console.log(`  Auth: POST /auth/token (account_number + pin) -> Bearer JWT`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
})
