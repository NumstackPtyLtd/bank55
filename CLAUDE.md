# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bank55 is a fictional bank built as a **monorepo of six Hono microservices**, each exposing MCP (Model Context Protocol) tools over HTTP. It exists to test AI agents, MCP clients, and multi-auth orchestration. 66 MCP tools across 6 services, 6 different authentication mechanisms, 200+ seeded customers across 6 countries.

## Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # Start all backend services in parallel
pnpm dev:web          # Start the Astro web dashboard (:5555) separately
pnpm docker:up        # Start everything via Docker Compose (includes Mailpit)
pnpm docker:down
pnpm docker:logs
```

Individual services (from within any service directory or root):
```bash
pnpm dev:customers    # :5501
pnpm dev:wallets      # :5502
pnpm dev:loans        # :5503
pnpm dev:insurance    # :5504
pnpm dev:platform     # :5500 (gateway)
pnpm dev:notifications # :5505
```

There are no tests. There is no lint script at the root — TypeScript compilation (`tsc --noEmit`) is the type check.

## Architecture

```
Platform Gateway  :5500  Session Token auth     13 MCP tools
Customers         :5501  API Key auth           10 MCP tools
Wallets           :5502  JWT Bearer auth        10 MCP tools
Loans             :5503  OAuth2 client creds    12 MCP tools
Insurance         :5504  HMAC Signature auth    12 MCP tools
Notifications     :5505  Service Token auth      9 MCP tools
Web dashboard     :5555  Astro + React
Mailpit (email)   :5580  UI / :5525 SMTP
```

Each backend service is a standalone Hono app with:
- Its own SQLite database (`better-sqlite3`)
- An MCP endpoint at `POST /mcp` (JSON-RPC 2.0)
- A health endpoint at `GET /health`
- Auth middleware specific to that service

## Adding a new tool

Every tool lives in `services/{name}/src/tools.ts`. The pattern is consistent across all services:

```typescript
// 1. Add to the tools array
export const tools: McpTool[] = [
  {
    name: 'do_thing',
    description: 'What it does and when to call it',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '...' } },
      required: ['id'],
    },
  },
]

// 2. Add a case in handleTool
export async function handleTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'do_thing': {
      const row = ctx.db.prepare('SELECT ...').get(args.id as string)
      if (!row) return { content: [{ type: 'text', text: 'Not found' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(row) }] }
    }
  }
}
```

`ToolContext` is `{ db: Database, credentials: Record<string, string> }`. The shared MCP router in `packages/shared/src/mcp.ts` handles `initialize`, `tools/list`, and `tools/call` — you only write the tool definitions and handler.

## Database pattern

Each service has `src/schema.ts` with two exports:
- `initSchema(db)` — creates tables, called on startup
- `seed(db)` — populates demo data, called once on first run (guarded by a row count check)

SQLite databases default to `/data/{service}.db` in Docker and an in-memory/local path in dev. WAL mode and foreign keys are enabled on every connection via `packages/shared/src/db.ts`.

ID format: `{prefix}-{uuid.slice(0,6..8)}` — e.g. `cust-a1b2c3`, `txn-d4e5f6`.

## Authentication per service

| Service | Mechanism | How to get credentials |
|---|---|---|
| Customers | `X-API-Key` header | Seeded API keys in schema.ts |
| Wallets | `Authorization: Bearer {jwt}` | `POST /auth/token` with account_number + PIN |
| Loans | `Authorization: Bearer {token}` | `POST /oauth/token` with client_id + client_secret |
| Insurance | `X-Client-Id` + `X-Timestamp` + `X-Signature` (HMAC-SHA256) | Seeded client credentials |
| Platform | `X-Session-Token` header | `POST /auth/login` with email + password |
| Notifications | `X-Service-Token` header | Seeded service token (for inter-service calls only) |

Credentials for all services are catalogued in `services/web/src/application/CredentialCatalog.ts`.

## Cross-service communication

Services don't call each other's MCP endpoints. When a service needs data from another it uses a direct REST API (e.g. Customers exposes `/api/customers/:id` for internal calls). The Notifications service is called by other services using its service token.

## Web dashboard

`services/web/` follows domain-driven design:
- `src/domain/` — value objects: `AuthMethod`, `Tool`, `Port`, `Service`, `Credential`
- `src/application/` — `ServiceCatalog` and `CredentialCatalog` (single source of truth for service metadata)
- `src/infrastructure/api/` — one HTTP client per backend service
- `src/presentation/` — Astro pages + React islands

When adding a new service or changing ports/auth, update `ServiceCatalog` and `CredentialCatalog` — the UI derives everything from them.
