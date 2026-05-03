export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-bank-950/50 via-gray-950 to-gray-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-bank-500/10 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-bank-500/30 bg-bank-500/10 px-4 py-1.5 text-sm text-bank-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bank-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-bank-500" />
          </span>
          Open Source MCP Testing Infrastructure
        </div>

        <h1 className="text-5xl font-900 tracking-tight sm:text-7xl">
          <span className="text-white">Bank</span>
          <span className="text-bank-400">55</span>
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
          A fictional bank with <strong className="text-white">5 microservices</strong>,{' '}
          <strong className="text-white">55 MCP tools</strong>, and{' '}
          <strong className="text-white">5 distinct auth mechanisms</strong>.
          Built for testing AI agents, MCP clients, and multi-service orchestration.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="/dashboard"
            className="rounded-lg bg-bank-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-bank-500/25 hover:bg-bank-500 transition-colors"
          >
            Open Dashboard
          </a>
          <a
            href="#getting-started"
            className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
          >
            Get Started
          </a>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto text-center">
          <Stat value="5" label="Services" />
          <Stat value="55" label="MCP Tools" />
          <Stat value="5" label="Auth Types" />
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
