export function Footer() {
  return (
    <footer className="border-t border-gray-800 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-lg font-bold">
              <span className="text-white">Bank</span>
              <span className="text-bank-400">55</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Fictional bank for MCP tool testing. Not a real financial institution.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#services" className="hover:text-gray-300 transition-colors">Services</a>
            <a href="#auth" className="hover:text-gray-300 transition-colors">Auth</a>
            <a href="#getting-started" className="hover:text-gray-300 transition-colors">Docs</a>
            <a
              href="https://github.com/supaproxyhq/bank55"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800/50 text-center text-xs text-gray-600">
          Built for the AI tooling community. Use freely for testing MCP integrations.
        </div>
      </div>
    </footer>
  )
}
