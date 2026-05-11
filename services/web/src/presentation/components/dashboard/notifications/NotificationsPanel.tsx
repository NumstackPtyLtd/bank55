import { useState, useEffect, useMemo } from 'react'
import { notificationsApi } from '../../../../infrastructure/api/notifications'
import { CustomerPicker } from '../shared/CustomerPicker'

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  transfer: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Transfer' },
  payment: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Payment' },
  insurance: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Insurance' },
  security: { bg: 'bg-red-50', text: 'text-red-700', label: 'Security' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Info' },
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  sent: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  failed: { bg: 'bg-red-50', text: 'text-red-700' },
  read: { bg: 'bg-blue-50', text: 'text-blue-700' },
}

const CHANNEL_ICONS: Record<string, string> = {
  email: '✉',
  sms: '✆',
  push: '⊙',
  in_app: '◻',
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterCustomer, setFilterCustomer] = useState<any>(null)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { load() }, [filterCustomer])

  async function load() {
    setLoading(true)
    try {
      const [notifs, s] = await Promise.all([
        notificationsApi.list(filterCustomer?.id, undefined, 100),
        notificationsApi.getStats(filterCustomer?.id),
      ])
      setNotifications(Array.isArray(notifs) ? notifs : [])
      setStats(s)
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filterType && n.type !== filterType) return false
      if (filterStatus && n.status !== filterStatus) return false
      return true
    })
  }, [notifications, filterType, filterStatus])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-500 text-sm mt-0.5">Service :5505, Email trail and delivery log</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm">
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-4 mb-6 flex-wrap">
          <StatPill label="Total" value={stats.total} />
          {(stats.by_status || []).map((s: any) => (
            <StatPill key={s.status} label={s.status} value={s.count} color={STATUS_STYLES[s.status]?.text} />
          ))}
          <div className="border-l border-gray-200 mx-1" />
          {(stats.by_type || []).map((t: any) => (
            <StatPill key={t.type} label={t.type} value={t.count} color={TYPE_STYLES[t.type]?.text} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-end">
        <div className="w-72">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Customer</label>
          <CustomerPicker selected={filterCustomer} onSelect={setFilterCustomer} color="emerald" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 h-[38px]">
          <option value="">All Types</option>
          {Object.entries(TYPE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 h-[38px]">
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        {(filterCustomer || filterType || filterStatus) && (
          <button onClick={() => { setFilterCustomer(null); setFilterType(''); setFilterStatus('') }} className="text-xs text-gray-400 hover:text-gray-600 h-[38px]">
            Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Notification list */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No notifications found</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((n: any) => {
                  const typeStyle = TYPE_STYLES[n.type] || TYPE_STYLES.info
                  const statusStyle = STATUS_STYLES[n.status] || STATUS_STYLES.pending
                  const isSelected = selected?.id === n.id

                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelected(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-lg mt-0.5 opacity-60">{CHANNEL_ICONS[n.channel] || '✉'}</span>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate">{n.subject}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{n.body?.slice(0, 80)}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-gray-400 font-mono">{n.customer_id}</span>
                              <span className="text-[10px] text-gray-300">from</span>
                              <span className="text-[10px] text-gray-500">{n.sender}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                            {n.type}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {n.status}
                          </span>
                          <span className="text-[10px] text-gray-400">{formatDate(n.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail view */}
        <div>
          {selected ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sticky top-8 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{CHANNEL_ICONS[selected.channel] || '✉'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(TYPE_STYLES[selected.type] || TYPE_STYLES.info).bg} ${(TYPE_STYLES[selected.type] || TYPE_STYLES.info).text}`}>
                    {selected.type}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(STATUS_STYLES[selected.status] || STATUS_STYLES.pending).bg} ${(STATUS_STYLES[selected.status] || STATUS_STYLES.pending).text}`}>
                    {selected.status}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{selected.subject}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block">To</span>
                  <span className="text-gray-800 font-mono">{selected.customer_id}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">From</span>
                  <span className="text-gray-800">{selected.sender}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Channel</span>
                  <span className="text-gray-800 capitalize">{selected.channel}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Created</span>
                  <span className="text-gray-800">{selected.created_at}</span>
                </div>
                {selected.sent_at && (
                  <div>
                    <span className="text-gray-400 block">Sent</span>
                    <span className="text-gray-800">{selected.sent_at}</span>
                  </div>
                )}
                {selected.error && (
                  <div className="col-span-2">
                    <span className="text-red-400 block">Error</span>
                    <span className="text-red-700 text-xs">{selected.error}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 block mb-1">Body</span>
                <div className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {selected.body}
                </div>
              </div>

              {selected.metadata && selected.metadata !== '{}' && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400 block mb-1">Metadata</span>
                  <pre className="text-[11px] text-gray-600 font-mono bg-gray-50 rounded-lg p-3 border border-gray-100 overflow-x-auto">
                    {JSON.stringify(JSON.parse(selected.metadata), null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100">
                <code className="text-[10px] text-gray-400 font-mono">{selected.id}</code>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <div className="text-4xl text-gray-300 mb-3">✉</div>
              <h3 className="text-sm font-medium text-gray-500">Select a notification</h3>
              <p className="text-xs text-gray-400 mt-1">Click any notification to see full details, metadata, and delivery status</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`font-semibold ${color || 'text-gray-900'}`}>{value}</span>
      <span className="text-gray-400 capitalize">{label}</span>
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = iso.slice(0, 10)
  const t = iso.slice(11, 16)
  return `${d} ${t}`
}
