import { useState, useEffect, useMemo } from 'react'
import { customersApi } from '../../../../infrastructure/api/customers'
import { useAppState } from '../DashboardApp'

const FLAGS: Record<string, string> = { ZA: '🇿🇦', NG: '🇳🇬', KE: '🇰🇪', GB: '🇬🇧', US: '🇺🇸', DE: '🇩🇪' }
const COUNTRY_NAMES: Record<string, string> = { ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', GB: 'United Kingdom', US: 'United States', DE: 'Germany' }
const PAGE_SIZE = 25

export function CustomersPanel() {
  const { trackAction } = useAppState()
  const [customers, setCustomers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterKyc, setFilterKyc] = useState<string>('')
  const [page, setPage] = useState(0)
  const [actionResult, setActionResult] = useState<string | null>(null)

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    setLoading(true)
    try {
      const data = await customersApi.list()
      setCustomers(Array.isArray(data) ? data : [])
    } catch (e: any) { setActionResult(`Error: ${e.message}`) }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filterCountry && c.country !== filterCountry) return false
      if (filterStatus && c.status !== filterStatus) return false
      if (filterKyc && c.kyc_status !== filterKyc) return false
      if (search) {
        const q = search.toLowerCase()
        return `${c.first_name} ${c.last_name} ${c.email} ${c.id}`.toLowerCase().includes(q)
      }
      return true
    })
  }, [customers, search, filterCountry, filterStatus, filterKyc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const countries = [...new Set(customers.map((c) => c.country))].sort()

  async function selectCustomer(id: string) {
    try {
      const data = await customersApi.get(id)
      setSelected(data)
    } catch (e: any) { setActionResult(`Error: ${e.message}`) }
  }

  async function verifyCustomer(id: string) {
    const result = await customersApi.verify(id)
    setActionResult(result)
    trackAction('customers', 'verify_kyc', id, {}, result)
    loadCustomers()
    selectCustomer(id)
  }

  async function suspendCustomer(id: string) {
    const result = await customersApi.suspend(id, 'Suspended via admin dashboard')
    setActionResult(result)
    trackAction('customers', 'suspend', id, { reason: 'Suspended via admin dashboard' }, result)
    loadCustomers()
    selectCustomer(id)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length} of {customers.length} customers — Service :5501 (API Key)
          </p>
        </div>
        <button onClick={loadCustomers} className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm">
          Refresh
        </button>
      </div>

      {actionResult && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <div className="flex justify-between items-start">
            <pre className="whitespace-pre-wrap text-xs font-mono">{actionResult}</pre>
            <button onClick={() => setActionResult(null)} className="text-emerald-400 hover:text-emerald-600 ml-4">✕</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search name, email, ID..."
          className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        <select value={filterCountry} onChange={(e) => { setFilterCountry(e.target.value); setPage(0) }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
          <option value="">All Countries</option>
          {countries.map((c) => <option key={c} value={c}>{FLAGS[c] || ''} {COUNTRY_NAMES[c] || c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterKyc} onChange={(e) => { setFilterKyc(e.target.value); setPage(0) }} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
          <option value="">All KYC</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Country</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">KYC</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Risk</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : pageData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>
                ) : (
                  pageData.map((c: any) => (
                    <tr
                      key={c.id}
                      onClick={() => selectCustomer(c.id)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${
                        selected?.id === c.id ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base mr-1">{FLAGS[c.country] || ''}</span>
                        <span className="text-xs text-gray-500">{c.country}</span>
                      </td>
                      <td className="px-4 py-3"><KycBadge status={c.kyc_status} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3"><RiskBadge score={c.risk_score} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30">Prev</button>
                  <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div>
          {selected ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sticky top-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selected.first_name} {selected.last_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{FLAGS[selected.country]}</span>
                    <code className="text-xs text-gray-400 font-mono">{selected.id}</code>
                  </div>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <Field label="Email" value={selected.email} />
                <Field label="Phone" value={selected.phone} />
                <Field label="ID Number" value={selected.id_number} />
                <Field label="Country" value={COUNTRY_NAMES[selected.country] || selected.country} />
                <Field label="Currency" value={selected.currency} />
                <Field label="DOB" value={selected.date_of_birth} />
                <Field label="KYC Tier" value={selected.kyc_tier} />
                <Field label="KYC Status" value={selected.kyc_status} />
                <Field label="Risk Score" value={`${selected.risk_score}/100`} />
                <Field label="Created" value={selected.created_at?.slice(0, 10)} />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                {selected.kyc_status !== 'verified' && (
                  <button onClick={() => verifyCustomer(selected.id)} className="flex-1 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium">
                    Verify KYC
                  </button>
                )}
                {selected.status === 'active' && (
                  <button onClick={() => suspendCustomer(selected.id)} className="flex-1 px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm shadow-sm">
              Select a customer to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className="text-gray-800 text-sm">{value || '—'}</span>
    </div>
  )
}

function KycBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    expired: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${styles[status] || ''}`}>{status}</span>
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${styles[status] || ''}`}>{status}</span>
}

function RiskBadge({ score }: { score: number }) {
  const color = score > 50 ? 'text-red-600 bg-red-50' : score > 20 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${color}`}>{score}</span>
}
