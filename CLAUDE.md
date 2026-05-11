# Bank55

Bank55 is a mock banking platform built for testing MCP (Model Context Protocol) integrations with SupaProxy. It simulates a realistic multi-service banking environment with customers, wallets, loans, insurance, notifications, and a platform orchestrator. Each service exposes MCP tool endpoints, making it ideal for testing SupaProxy connections, consumers, and the agent loop.

See the [central hub](https://github.com/NumstackPtyLtd/supaproxy) for cross-repo governance, workflow, and conventions.

## Project structure

```
bank55/
  packages/
    shared/                   Shared utilities
      src/
        mcp.ts                MCP JSON-RPC router (createMcpRouter)
        db.ts                 SQLite database factory (better-sqlite3)
        index.ts              Package exports
  services/
    customers/                Customer management MCP server (port 5501)
    wallets/                  Wallet and transaction MCP server (port 5502)
    loans/                    Loan management MCP server (port 5503)
    insurance/                Insurance policy MCP server (port 5504)
    platform/                 Platform orchestrator MCP server (port 5500)
    notifications/            Notification and email MCP server (port 5505)
    web/                      Astro dashboard with DDD structure
      src/
        domain/               Models (Service, Credential), value objects (Tool, AuthMethod, Port)
        application/          Service and credential catalogues
        infrastructure/       API clients for each service
        presentation/         UI components
  docker-compose.yml          Full stack orchestration (all services + Mailpit)
  Dockerfile                  Multi-service Docker build
  pnpm-workspace.yaml         pnpm workspace (packages/*, services/*)
```

## Stack

| Layer | Tech |
|---|---|
| MCP services | Hono + TypeScript |
| Database | SQLite (better-sqlite3, WAL mode) |
| Dashboard | Astro + React |
| Auth | API key (X-API-Key header) |
| Email | Mailpit (dev SMTP on port 5525, UI on port 5580) |
| Monorepo | pnpm workspace |

## Services

| Service | Port | Package | Purpose |
|---|---|---|---|
| Platform | 5500 | @bank55/platform | Orchestrator and cross-service operations |
| Customers | 5501 | @bank55/customers | Customer profiles, KYC, risk assessment |
| Wallets | 5502 | @bank55/wallets | Accounts, transactions, balances |
| Loans | 5503 | @bank55/loans | Loan applications, approvals, repayments |
| Insurance | 5504 | @bank55/insurance | Policy management, claims |
| Notifications | 5505 | @bank55/notifications | Email and notification delivery |

## Development

```bash
pnpm install

# Run all services in parallel
pnpm dev

# Run individual services
pnpm dev:customers
pnpm dev:wallets
pnpm dev:loans
pnpm dev:insurance
pnpm dev:platform
pnpm dev:notifications
pnpm dev:web
```

### Docker

```bash
docker compose up --build -d    # Start all services
docker compose down             # Stop all services
docker compose logs -f          # Follow logs
```

## MCP protocol

Each service implements the MCP JSON-RPC protocol via the shared `createMcpRouter`. The MCP endpoint is `POST /mcp` on each service. Authentication uses the `X-API-Key` header.

### Connecting to SupaProxy

Point a SupaProxy HTTP connection at any service's `/mcp` endpoint with the appropriate API key in the headers.

## Git workflow

All changes go through pull requests. NEVER push directly to main.

### Branch naming

```
feat/short-description
fix/short-description
chore/short-description
docs/short-description
```

### Destructive commands

NEVER run these commands:
- `git push --force`
- `git reset --hard`
- `git clean -f`
- `rm -rf` on project directories

If something needs to be undone, create a revert commit on a branch.

## Code rules

### Type safety

- No `any` types. Define interfaces for all data structures.
- No `as any` casts.

### No hardcoded values

- No env var fallbacks. Use `requireEnv()` with no defaults.
- No hardcoded API URLs, secrets, or magic numbers.

### Writing standards

- British English throughout (colour, organisation, behaviour).
- No em dashes or en dashes. Use commas, full stops, or semicolons.
- No smart quotes. Use straight quotes only.
- Sentence case for headings.
