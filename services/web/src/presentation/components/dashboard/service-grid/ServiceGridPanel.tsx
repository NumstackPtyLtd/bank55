import { useState, useEffect } from 'react'
import type { ActivePanel } from '../DashboardApp'
import { getServiceCatalog } from '../../../../application/services/ServiceCatalog'

interface ServiceStatus {
  id: string
  name: string
  port: number
  auth: string
  tools: number
  status: 'online' | 'offline' | 'loading'
  icon: string
  color: string
  panel: ActivePanel
}

const SERVICES: Omit<ServiceStatus, 'status' | 'tools'>[] = [
  { id: 'platform', name: 'Platform', port: 5500, auth: 'Session', icon: '⬡', color: 'emerald', panel: 'overview' },
  { id: 'customers', name: 'Customers', port: 5501, auth: 'API Key', icon: '●', color: 'blue', panel: 'customers' },
  { id: 'wallets', name: 'Wallets', port: 5502, auth: 'JWT', icon: '◉', color: 'violet', panel: 'wallets' },
  { id: 'loans', name: 'Loans', port: 5503, auth: 'OAuth2', icon: '◆', color: 'amber', panel: 'loans' },
  { id: 'insurance', name: 'Insurance', port: 5504, auth: 'HMAC', icon: '◇', color: 'rose', panel: 'insurance' },
  { id: 'notifications', name: 'Notifications', port: 5505, auth: 'Service Token', icon: '✉', color: 'blue', panel: 'notifications' },
]

interface Props {
  onNavigate: (panel: ActivePanel) => void
}

export function ServiceGridPanel({ onNavigate }: Props) {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({ ...s, status: 'loading' as const, tools: 0 }))
  )

  useEffect(() => {
    SERVICES.forEach(async (svc) => {
      try {
        const res = await fetch(`http://localhost:${svc.port}/health`)
        const data = await res.json()
        setServices((prev) =>
          prev.map((s) => (s.id === svc.id ? { ...s, status: 'online', tools: data.tools || 0 } : s))
        )
      } catch {
        setServices((prev) =>
          prev.map((s) => (s.id === svc.id ? { ...s, status: 'offline' } : s))
        )
      }
    })
  }, [])

  const online = services.filter((s) => s.status === 'online').length
  const totalTools = services.reduce((sum, s) => sum + s.tools, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Service Overview</h2>
        <p className="text-gray-500 text-sm mt-1">
          {online}/{services.length} services online, {totalTools} MCP tools available
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {services.map((svc) => (
          <button
            key={svc.id}
            onClick={() => svc.panel !== 'overview' && onNavigate(svc.panel)}
            className={`relative group p-6 rounded-xl border transition-all text-left ${
              svc.status === 'online'
                ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${getIconColor(svc.color)}`}>{svc.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                  <code className="text-xs text-gray-400 font-mono">localhost:{svc.port}</code>
                </div>
              </div>
              <StatusDot status={svc.status} />
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs">
              <span className={`${getBadgeColor(svc.color)} px-2 py-0.5 rounded-full font-medium`}>{svc.auth}</span>
              <span className="text-gray-400">{svc.tools} tools</span>
            </div>
          </button>
        ))}
      </div>

      <ToolsReference />
    </div>
  )
}

function ToolsReference() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const catalog = getServiceCatalog()

  const allTools = catalog.flatMap((svc) =>
    svc.tools.map((t) => ({ ...t, service: svc.name, serviceId: svc.id, port: svc.port, auth: svc.auth.label }))
  )

  const filtered = search
    ? allTools.filter((t) => `${t.name} ${t.description} ${t.service}`.toLowerCase().includes(search.toLowerCase()))
    : allTools

  const serviceColors: Record<string, string> = {
    Customers: 'bg-blue-50 text-blue-700',
    Wallets: 'bg-violet-50 text-violet-700',
    Loans: 'bg-amber-50 text-amber-700',
    Insurance: 'bg-rose-50 text-rose-700',
    Platform: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{open ? '▾' : '▸'}</span>
          <span className="text-sm font-medium text-gray-700">MCP Tools Reference</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{allTools.length} tools across {catalog.length} services</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools by name, description, or service..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {filtered.map((tool) => (
              <div key={`${tool.service}-${tool.name}`} className="px-5 py-2.5 flex items-start gap-3">
                <code className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{tool.name}</code>
                <span className="text-xs text-gray-500 flex-1">{tool.description}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${serviceColors[tool.service] || 'bg-gray-100 text-gray-600'}`}>
                  {tool.service}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-gray-400">No tools match "{search}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors = { online: 'bg-emerald-500', offline: 'bg-red-500', loading: 'bg-amber-400 animate-pulse' }
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[status as keyof typeof colors]}`} />
}

function getIconColor(color: string): string {
  const map: Record<string, string> = { emerald: 'text-emerald-600', blue: 'text-blue-600', violet: 'text-violet-600', amber: 'text-amber-600', rose: 'text-rose-600' }
  return map[color] || 'text-gray-600'
}

function getBadgeColor(color: string): string {
  const map: Record<string, string> = { emerald: 'bg-emerald-100 text-emerald-700', blue: 'bg-blue-100 text-blue-700', violet: 'bg-violet-100 text-violet-700', amber: 'bg-amber-100 text-amber-700', rose: 'bg-rose-100 text-rose-700' }
  return map[color] || 'bg-gray-100 text-gray-700'
}
