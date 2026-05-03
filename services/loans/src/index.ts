import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import crypto from 'crypto'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())
const PORT = parseInt(process.env.PORT || '5503')
const DB_PATH = process.env.DB_PATH || '/data/loans.db'

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// --- OAuth2 Client Registry ---
const CLIENTS: Record<string, { secret: string; name: string; scope: string; customer_id?: string }> = {
  'elvis-loans-client': { secret: 'elvis-secret-2024', name: 'Elvis Personal', scope: 'loans:read loans:write', customer_id: 'cust-001' },
  'thabo-loans-client': { secret: 'thabo-secret-2024', name: 'Thabo Personal', scope: 'loans:read loans:write', customer_id: 'cust-002' },
  'sipho-loans-client': { secret: 'sipho-secret-2024', name: 'Sipho Personal', scope: 'loans:read loans:write', customer_id: 'cust-004' },
  'bank55-platform': { secret: 'platform-secret-2024', name: 'Bank55 Platform', scope: 'loans:read loans:write loans:admin' },
  'bank55-wallets': { secret: 'wallets-secret-2024', name: 'Wallets Service', scope: 'loans:read' },
}

// Active tokens store
const tokens = new Map<string, { client_id: string; scope: string; customer_id?: string; expires: number }>()

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Loans', auth: 'oauth2-client-credentials', tools: tools.length }))

// OAuth2 token endpoint
app.post('/oauth/token', async (c) => {
  const body = await c.req.parseBody()
  const grantType = body.grant_type as string
  if (grantType !== 'client_credentials') {
    return c.json({ error: 'unsupported_grant_type', error_description: 'Only client_credentials is supported' }, 400)
  }

  const clientId = body.client_id as string
  const clientSecret = body.client_secret as string
  const client = CLIENTS[clientId]

  if (!client || client.secret !== clientSecret) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid client_id or client_secret' }, 401)
  }

  const requestedScope = (body.scope as string) || client.scope
  const accessToken = crypto.randomBytes(32).toString('hex')
  const expiresIn = 3600

  tokens.set(accessToken, {
    client_id: clientId,
    scope: requestedScope,
    customer_id: client.customer_id,
    expires: Date.now() + expiresIn * 1000,
  })

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: requestedScope,
  })
})

// Token introspection (for debugging)
app.post('/oauth/introspect', async (c) => {
  const { token } = await c.req.parseBody()
  const info = tokens.get(token as string)
  if (!info || info.expires < Date.now()) {
    return c.json({ active: false })
  }
  return c.json({ active: true, client_id: info.client_id, scope: info.scope, customer_id: info.customer_id })
})

// Bearer token auth middleware
app.use('/mcp', async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'invalid_token', error_description: 'Use POST /oauth/token with client_credentials to get an access token' }, 401)
  }
  const token = auth.slice(7)
  const info = tokens.get(token)
  if (!info || info.expires < Date.now()) {
    tokens.delete(token)
    return c.json({ error: 'invalid_token', error_description: 'Token expired or invalid' }, 401)
  }
  c.set('oauth' as never, info)
  await next()
})

// MCP
const mcpRouter = createMcpRouter('Bank55 Loans', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const oauth = c.get('oauth' as never) as any
  const result = await mcpRouter(body, { db, oauth })
  return result === null ? c.body(null, 204) : c.json(result)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Loans] Running on port ${PORT}`)
  console.log(`  Auth: POST /oauth/token (grant_type=client_credentials&client_id=X&client_secret=Y)`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
  console.log(`  Clients: ${Object.keys(CLIENTS).join(', ')}`)
})
