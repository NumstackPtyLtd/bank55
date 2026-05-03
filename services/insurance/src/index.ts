import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import crypto from 'crypto'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())
const PORT = parseInt(process.env.PORT || '5504')
const DB_PATH = process.env.DB_PATH || '/data/insurance.db'

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// --- HMAC Client Registry ---
// Each client has a shared secret used to sign requests
const HMAC_CLIENTS: Record<string, { secret: string; name: string; customer_id?: string }> = {
  'ins-elvis': { secret: 'hmac-elvis-secret-x9k2m', name: 'Elvis Insurance Portal', customer_id: 'cust-001' },
  'ins-thabo': { secret: 'hmac-thabo-secret-p4j7n', name: 'Thabo Insurance Portal', customer_id: 'cust-002' },
  'ins-sipho': { secret: 'hmac-sipho-secret-w2r8q', name: 'Sipho Insurance Portal', customer_id: 'cust-004' },
  'ins-platform': { secret: 'hmac-platform-secret-a1b2c', name: 'Bank55 Platform', customer_id: undefined },
  'ins-admin': { secret: 'hmac-admin-secret-z7y6x', name: 'Insurance Admin', customer_id: undefined },
}

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Insurance', auth: 'hmac-signature', tools: tools.length }))

// HMAC signature generation helper endpoint (for testing)
app.post('/auth/sign', async (c) => {
  const { client_id, body } = await c.req.json()
  const client = HMAC_CLIENTS[client_id]
  if (!client) return c.json({ error: 'Unknown client_id' }, 400)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = `${timestamp}.${JSON.stringify(body)}`
  const signature = crypto.createHmac('sha256', client.secret).update(payload).digest('hex')
  return c.json({ client_id, timestamp, signature, note: 'Set headers: X-Client-Id, X-Timestamp, X-Signature' })
})

// HMAC auth middleware
app.use('/mcp', async (c, next) => {
  const clientId = c.req.header('X-Client-Id')
  const timestamp = c.req.header('X-Timestamp')
  const signature = c.req.header('X-Signature')

  if (!clientId || !timestamp || !signature) {
    return c.json({
      error: 'Missing authentication headers',
      required: { 'X-Client-Id': 'Your client ID', 'X-Timestamp': 'Unix timestamp', 'X-Signature': 'HMAC-SHA256(timestamp.body, secret)' },
      hint: 'Use POST /auth/sign to generate test signatures',
    }, 401)
  }

  const client = HMAC_CLIENTS[clientId]
  if (!client) return c.json({ error: 'Unknown client' }, 401)

  // Check timestamp freshness (5 min window)
  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(timestamp)
  if (Math.abs(now - ts) > 300) {
    return c.json({ error: 'Timestamp expired. Must be within 5 minutes.' }, 401)
  }

  // Verify HMAC signature
  const rawBody = await c.req.text()
  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', client.secret).update(payload).digest('hex')

  if (signature !== expected) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  c.set('hmacClient' as never, { ...client, client_id: clientId })
  // Re-parse body since we consumed it
  c.set('parsedBody' as never, JSON.parse(rawBody))
  await next()
})

// MCP
const mcpRouter = createMcpRouter('Bank55 Insurance', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = c.get('parsedBody' as never) as any
  const client = c.get('hmacClient' as never) as any
  const result = await mcpRouter(body, { db, client })
  return result === null ? c.body(null, 204) : c.json(result)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Insurance] Running on port ${PORT}`)
  console.log(`  Auth: HMAC-SHA256 (X-Client-Id + X-Timestamp + X-Signature)`)
  console.log(`  Helper: POST /auth/sign (generates signature for testing)`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
  console.log(`  Clients: ${Object.keys(HMAC_CLIENTS).join(', ')}`)
})
