import { useState } from 'react'

const STEPS = [
  {
    title: 'Clone & Install',
    code: `git clone https://github.com/supaproxyhq/bank55.git
cd bank55
pnpm install`,
  },
  {
    title: 'Start Services',
    code: `# All services at once
pnpm dev

# Or with Docker
docker compose up --build -d`,
  },
  {
    title: 'Connect via MCP',
    code: `// Example: Claude Desktop mcp_servers config
{
  "bank55-wallets": {
    "url": "http://localhost:3101/mcp",
    "transport": "http",
    "headers": {
      "Authorization": "Bearer <jwt-token>"
    }
  },
  "bank55-loans": {
    "url": "http://localhost:3102/mcp",
    "transport": "http",
    "headers": {
      "Authorization": "Bearer <oauth-token>"
    }
  }
}`,
  },
  {
    title: 'Authenticate',
    code: `# Wallets: Get JWT
curl -X POST http://localhost:3101/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"account_number":"1055001234","pin":"1234"}'

# Loans: Get OAuth2 token
curl -X POST http://localhost:3102/oauth/token \\
  -d "grant_type=client_credentials\\
&client_id=elvis-loans-client\\
&client_secret=elvis-secret-2024"

# Insurance: Generate HMAC signature
curl -X POST http://localhost:3103/auth/sign \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"ins-elvis","body":{...}}'`,
  },
  {
    title: 'Call MCP Tools',
    code: `# List available tools
curl -X POST http://localhost:3101/mcp \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_balance",
      "arguments": {}
    }
  }'`,
  },
]

export function GettingStarted() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <section id="getting-started" className="px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Getting Started</h2>
          <p className="mt-4 text-gray-400">Up and running in under 2 minutes.</p>
        </div>

        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          <nav className="flex md:flex-col gap-2">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeStep === i
                    ? 'bg-bank-600/20 text-bank-400 border border-bank-500/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="font-mono text-xs mr-2">{i + 1}.</span>
                {step.title}
              </button>
            ))}
          </nav>

          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <span className="text-xs text-gray-500 font-mono ml-2">{STEPS[activeStep].title}</span>
            </div>
            <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">
              {STEPS[activeStep].code}
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
