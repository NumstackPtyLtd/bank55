import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createDb, createMcpRouter } from '@bank55/shared'
import { initSchema, seed } from './schema.js'
import { tools, handleTool } from './tools.js'

const app = new Hono()
app.use('*', cors())
const PORT = parseInt(process.env.PORT || '5501')
const DB_PATH = process.env.DB_PATH || '/data/customers.db'

// Valid API keys (in production this would be a database table)
const API_KEYS: Record<string, { name: string; role: 'admin' | 'service' | 'readonly' }> = {
  'bank55-admin-key-2024': { name: 'Bank55 Admin Console', role: 'admin' },
  'bank55-platform-key': { name: 'Bank55 Platform', role: 'service' },
  'bank55-wallets-key': { name: 'Wallets Service', role: 'service' },
  'bank55-loans-key': { name: 'Loans Service', role: 'readonly' },
  'bank55-insurance-key': { name: 'Insurance Service', role: 'readonly' },
}

const db = createDb(DB_PATH)
initSchema(db)
seed(db)

// Health (no auth)
app.get('/health', (c) => c.json({ status: 'ok', service: 'Bank55 Customers', auth: 'api-key', tools: tools.length }))

// API Key auth middleware
app.use('/mcp', async (c, next) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey || !API_KEYS[apiKey]) {
    return c.json({ error: 'Invalid or missing API key. Provide X-API-Key header.' }, 401)
  }
  c.set('apiClient' as never, API_KEYS[apiKey])
  await next()
})

// MCP endpoint
const mcpRouter = createMcpRouter('Bank55 Customers', '1.0.0', tools, handleTool)
app.post('/mcp', async (c) => {
  const body = await c.req.json()
  const client = c.get('apiClient' as never) as { name: string; role: string }
  const result = await mcpRouter(body, { db, client })
  return result === null ? c.body(null, 204) : c.json(result)
})

// Direct REST API for inter-service calls
app.get('/api/customers/:id', async (c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey || !API_KEYS[apiKey]) return c.json({ error: 'Unauthorized' }, 401)
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(c.req.param('id'))
  if (!customer) return c.json({ error: 'Not found' }, 404)
  return c.json(customer)
})

app.get('/api/customers', async (c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey || !API_KEYS[apiKey]) return c.json({ error: 'Unauthorized' }, 401)
  const rows = db.prepare('SELECT id, first_name, last_name, email, phone, kyc_status FROM customers').all()
  return c.json(rows)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[Customers] Running on port ${PORT}`)
  console.log(`  Auth: X-API-Key header`)
  console.log(`  MCP: POST http://localhost:${PORT}/mcp`)
  console.log(`  Keys: ${Object.keys(API_KEYS).join(', ')}`)
})
