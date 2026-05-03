import { useState } from 'react'
import type { Service } from '../../../domain'

interface Props {
  service: Service
}

const AUTH_COLORS: Record<string, string> = {
  'api-key': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'jwt': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'oauth2': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'hmac': 'bg-red-500/10 text-red-400 border-red-500/20',
  'session': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export function ServiceCard({ service }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group rounded-xl border border-gray-800 bg-gray-900/50 p-6 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{service.name}</h3>
          <code className="text-xs text-gray-500 font-mono">:{service.port}</code>
        </div>
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${AUTH_COLORS[service.auth.type]}`}>
          {service.auth.label}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">{service.description}</p>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-bank-400 hover:text-bank-300 font-medium transition-colors"
      >
        {expanded ? 'Hide' : 'Show'} {service.tools.length} tools
      </button>

      {expanded && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-800 pt-3">
          {service.tools.map((tool) => (
            <li key={tool.name} className="flex items-start gap-2 text-xs">
              <code className="text-bank-400 font-mono whitespace-nowrap">{tool.name}</code>
              <span className="text-gray-500">{tool.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
