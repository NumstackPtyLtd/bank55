import { useState, useEffect, useMemo } from 'react'
import { customersApi } from '../../../../infrastructure/api/customers'

const FLAGS: Record<string, string> = { ZA: '🇿🇦', NG: '🇳🇬', KE: '🇰🇪', GB: '🇬🇧', US: '🇺🇸', DE: '🇩🇪' }

interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  country: string
  status: string
}

interface Props {
  selected: Customer | null
  onSelect: (customer: Customer) => void
  color?: string
}

export function CustomerPicker({ selected, onSelect, color = 'emerald' }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    customersApi.list().then((data) => {
      if (Array.isArray(data)) setCustomers(data)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!search) return customers.slice(0, 20)
    const q = search.toLowerCase()
    return customers.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email} ${c.id}`.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [customers, search])

  const colorStyles: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
          selected ? colorStyles[color] : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        }`}
      >
        {selected ? (
          <span>{FLAGS[selected.country] || ''} {selected.first_name} {selected.last_name} <span className="text-xs opacity-60">({selected.id})</span></span>
        ) : (
          <span className="text-gray-400">Select a customer...</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No customers found</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 ${
                    selected?.id === c.id ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {FLAGS[c.country] || ''} {c.first_name} {c.last_name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-gray-400">{c.email}</div>
                </button>
              ))
            )}
          </div>
          {customers.length > 20 && !search && (
            <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
              Showing 20 of {customers.length}, type to search
            </div>
          )}
        </div>
      )}
    </div>
  )
}
