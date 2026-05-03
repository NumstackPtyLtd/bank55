# Bank55

A fictional bank built as a monorepo of microservices, each exposing [MCP](https://modelcontextprotocol.io/) tools over HTTP. Designed for testing AI agents, MCP clients, and multi-service orchestration.

**6 services. 64+ MCP tools. 6 distinct auth mechanisms. 200+ customers across 6 countries.**

> Bank55 is not a real financial institution. All data is fictional.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Platform Gateway (:5500)             │
│              Session Auth │ 13 tools              │
└────────┬──────────┬──────────┬──────────┬────────┘
         │          │          │          │
   ┌─────▼────┐ ┌──▼─────┐ ┌─▼──────┐ ┌─▼──────────┐
   │Customers │ │Wallets │ │ Loans  │ │ Insurance  │
   │  :5501   │ │ :5502  │ │ :5503  │ │   :5504    │
   │ API Key  │ │  JWT   │ │OAuth2  │ │   HMAC     │
   │ 10 tools │ │10 tools│ │12 tools│ │  12 tools  │
   └──────────┘ └────────┘ └────────┘ └────────────┘
                                 │
                          ┌──────▼──────┐
                          │Notifications│
                          │   :5505     │
                          │Svc Token    │
                          │  9 tools    │
                          └──────┬──────┘
                                 │
                          ┌──────▼──────┐
                          │   Mailpit   │
                          │  :5580 UI   │
                          │ :5525 SMTP  │
                          └─────────────┘
```

Each service has:
- Its own SQLite database
- Its own authentication mechanism
- Its own MCP endpoint at `POST /mcp`
- A health check at `GET /health`

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://docs.docker.com/get-docker/) (optional, for Mailpit email viewer)

### Local Development

```bash
# Install
pnpm install

# Start all backend services
pnpm dev

# In another terminal, start the web dashboard
pnpm dev:web
```

| Service        | URL                        |
|----------------|----------------------------|
| Dashboard      | http://localhost:5555       |
| Platform API   | http://localhost:5500       |
| Customers API  | http://localhost:5501       |
| Wallets API    | http://localhost:5502       |
| Loans API      | http://localhost:5503       |
| Insurance API  | http://localhost:5504       |
| Notifications  | http://localhost:5505       |
| Mailpit (Email)| http://localhost:5580       |

### Docker

```bash
docker compose up --build -d
```

## Authentication

Each service uses a different auth mechanism:

### Customers (:5501) — API Key

```bash
curl -X POST http://localhost:5501/mcp \
  -H "X-API-Key: bank55-admin-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Wallets (:5502) — JWT Bearer

```bash
# Get token
curl -X POST http://localhost:5502/auth/token \
  -H "Content-Type: application/json" \
  -d '{"account_number":"1055001234","pin":"1234"}'

# Use token
curl -X POST http://localhost:5502/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Loans (:5503) — OAuth2 Client Credentials

```bash
# Get token
curl -X POST http://localhost:5503/oauth/token \
  -d "grant_type=client_credentials&client_id=elvis-loans-client&client_secret=elvis-secret-2024"

# Use token
curl -X POST http://localhost:5503/mcp \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Insurance (:5504) — HMAC Signature

```bash
# Generate signature (helper endpoint)
curl -X POST http://localhost:5504/auth/sign \
  -H "Content-Type: application/json" \
  -d '{"client_id":"ins-elvis","body":{"jsonrpc":"2.0","id":1,"method":"tools/list"}}'

# Use signature
curl -X POST http://localhost:5504/mcp \
  -H "X-Client-Id: ins-elvis" \
  -H "X-Timestamp: <timestamp>" \
  -H "X-Signature: <signature>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Platform (:5500) — Session Token

```bash
# Login
curl -X POST http://localhost:5500/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"elvis@numstack.com","password":"bank55pass"}'

# Use session
curl -X POST http://localhost:5500/mcp \
  -H "X-Session-Token: <session_token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Notifications (:5505) — Service Token

```bash
curl -X POST http://localhost:5505/mcp \
  -H "X-Service-Token: notif-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Demo Credentials

### Dashboard (Platform)

| Email                  | Password    | Role     |
|------------------------|-------------|----------|
| elvis@numstack.com     | bank55pass  | admin    |
| admin@bank55.co.za     | admin2024   | admin    |
| thabo@email.co.za      | thabo123    | customer |
| sipho@company.co.za    | sipho123    | customer |

### Wallets (account / PIN)

| Account      | PIN  | Customer         |
|--------------|------|------------------|
| 1055001234   | 1234 | Elvis (Cheque)   |
| 1055005678   | 1234 | Elvis (Savings)  |
| 1055002345   | 5678 | Thabo (Cheque)   |
| 1055004567   | 4321 | Sipho (Cheque)   |

### Loans (client_id / secret)

| Client ID            | Secret               |
|----------------------|----------------------|
| elvis-loans-client   | elvis-secret-2024    |
| thabo-loans-client   | thabo-secret-2024    |
| bank55-platform      | platform-secret-2024 |

### Insurance (client_id / HMAC secret)

| Client ID    | Secret                    |
|--------------|---------------------------|
| ins-elvis    | hmac-elvis-secret-x9k2m   |
| ins-admin    | hmac-admin-secret-z7y6x   |

## Customers

200+ seeded customers across 6 jurisdictions:

| Country        | Regulator | Currency | Count |
|----------------|-----------|----------|-------|
| South Africa   | SARB      | ZAR      | ~60   |
| Nigeria        | CBN       | NGN      | ~40   |
| Kenya          | CBK       | KES      | ~30   |
| United Kingdom | FCA       | GBP      | ~20   |
| United States  | FinCEN    | USD      | ~20   |
| Germany        | BaFin     | EUR      | ~20   |

## Project Structure

```
bank55/
├── packages/
│   └── shared/              # DB, MCP router helpers
├── services/
│   ├── customers/            # Customer identity & KYC
│   ├── wallets/              # Accounts, transactions, transfers
│   ├── loans/                # Loan management & payments
│   ├── insurance/            # Policies, premiums, claims
│   ├── notifications/        # Email notifications via Mailpit
│   ├── platform/             # Gateway, dashboards, action log
│   └── web/                  # Astro + React dashboard
├── docker-compose.yml
├── Dockerfile
└── pnpm-workspace.yaml
```

## Use Cases

- **MCP client testing** — Connect any MCP client to one or more services
- **Multi-auth testing** — Each service uses a different auth mechanism
- **AI agent orchestration** — Cross-service workflows (transfer + notify, loan payment + receipt)
- **Scenario simulation** — Dashboard has one-click scenarios for common banking operations
- **Action auditing** — All dashboard actions are logged and queryable via MCP tools

## Tech Stack

- **Runtime**: Node.js 22, TypeScript
- **API**: [Hono](https://hono.dev/)
- **Database**: SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Frontend**: [Astro](https://astro.build/) + React + Tailwind CSS
- **Email**: [Mailpit](https://mailpit.axllent.org/) (SMTP capture)
- **Monorepo**: pnpm workspaces

## License

MIT - [Numstack Pty Ltd](https://numstack.com)
