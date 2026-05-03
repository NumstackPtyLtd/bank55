import type { ActivePanel } from '../DashboardApp'
import { useAppState } from '../DashboardApp'

const NAV_ITEMS: { id: ActivePanel; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '⬡' },
  { id: 'customers', label: 'Customers', icon: '●' },
  { id: 'wallets', label: 'Wallets', icon: '◉' },
  { id: 'loans', label: 'Loans', icon: '◆' },
  { id: 'insurance', label: 'Insurance', icon: '◇' },
  { id: 'notifications', label: 'Notifications', icon: '✉' },
  { id: 'scenarios', label: 'Scenarios', icon: '▶' },
]

interface Props {
  active: ActivePanel
  onNavigate: (panel: ActivePanel) => void
  user: any
  onLogout: () => void
}

export function Sidebar({ active, onNavigate, user, onLogout }: Props) {
  const { logs } = useAppState()

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col shadow-sm">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-xl font-bold">
          <span className="text-gray-900">Bank</span>
          <span className="text-emerald-600">55</span>
        </h1>
        <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Dashboard</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === item.id
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="text-base opacity-70">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-500">5 services online</span>
        </div>
        {logs.length > 0 && (
          <div className="text-[10px] text-gray-400">{logs.length} actions tracked</div>
        )}

        {/* User info */}
        {user && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-700 truncate">{user.name}</div>
            <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                user.role === 'admin' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}>{user.role}</span>
              <button onClick={onLogout} className="text-[10px] text-gray-400 hover:text-red-600 transition-colors">
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
