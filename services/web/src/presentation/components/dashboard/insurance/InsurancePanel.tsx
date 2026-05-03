import { useState, useEffect } from 'react'
import { insuranceApi } from '../../../../infrastructure/api/insurance'
import { useAppState } from '../DashboardApp'
import { CustomerPicker } from '../shared/CustomerPicker'
import { EmptyState } from '../shared/EmptyState'

export function InsurancePanel() {
  const { trackAction } = useAppState()
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [policies, setPolicies] = useState<any[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null)
  const [claims, setClaims] = useState<any[]>([])
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [claimType, setClaimType] = useState('')
  const [claimDesc, setClaimDesc] = useState('')
  const [claimAmount, setClaimAmount] = useState('')

  useEffect(() => {
    if (selectedCustomer) loadData()
    else { setPolicies([]); setClaims([]); setSelectedPolicy(null) }
  }, [selectedCustomer])

  async function loadData() {
    try {
      const p = await insuranceApi.listPolicies(selectedCustomer.id)
      setPolicies(Array.isArray(p) ? p : [])
      const c = await insuranceApi.listClaims(selectedCustomer.id)
      setClaims(Array.isArray(c) ? c : [])
      setSelectedPolicy(null)
    } catch (e: any) { setActionResult(`Error: ${e.message}`) }
  }

  async function selectPolicy(policyId: string) {
    const detail = await insuranceApi.getPolicyDetails(policyId)
    setSelectedPolicy(detail)
  }

  async function payPremium(policyId: string) {
    const result = await insuranceApi.payPremium(policyId)
    setActionResult(result)
    trackAction('insurance', 'pay_premium', policyId, {}, result)
    loadData()
  }

  async function submitClaim() {
    if (!selectedPolicy || !claimType || !claimDesc || !claimAmount) return
    const result = await insuranceApi.submitClaim({
      policy_id: selectedPolicy.id, type: claimType, description: claimDesc,
      amount: parseFloat(claimAmount), incident_date: new Date().toISOString().slice(0, 10),
    })
    setActionResult(result)
    trackAction('insurance', 'submit_claim', selectedPolicy.id, { type: claimType, amount: claimAmount }, result)
    setClaimType(''); setClaimDesc(''); setClaimAmount('')
    loadData()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Insurance</h2>
        <p className="text-gray-500 text-sm mt-0.5">Service :5504 — HMAC Signature Auth</p>
      </div>

      <div className="mb-6 max-w-md">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Customer</label>
        <CustomerPicker selected={selectedCustomer} onSelect={setSelectedCustomer} color="rose" />
      </div>

      {actionResult && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-700">
          <div className="flex justify-between items-start">
            <pre className="whitespace-pre-wrap">{actionResult}</pre>
            <button onClick={() => setActionResult(null)} className="text-gray-400 hover:text-gray-600 ml-4">✕</button>
          </div>
        </div>
      )}

      {!selectedCustomer ? (
        <EmptyState
          icon="◇"
          title="No customer selected"
          description="Search and select a customer above to view their insurance policies, claims, and premium details."
          hint="Tip: Try Elvis Magagula — he has vehicle, life, and home insurance"
          color="rose"
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Policies</h3>
          {policies.length === 0 ? (
            <p className="text-sm text-gray-400">No policies for this customer</p>
          ) : policies.map((p: any) => (
            <button key={p.id} onClick={() => selectPolicy(p.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors shadow-sm ${selectedPolicy?.id === p.id ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900 capitalize">{p.type}</span>
                <PolicyStatus status={p.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">Cover: ZAR {p.cover_amount?.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Premium: ZAR {p.premium?.toFixed(2)}/{p.payment_frequency}</div>
            </button>
          ))}
        </div>

        <div>
          {selectedPolicy ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900 capitalize">{selectedPolicy.type} Insurance</h4>
                  <code className="text-[10px] text-gray-400">{selectedPolicy.policy_number}</code>
                </div>
                <button onClick={() => payPremium(selectedPolicy.id)} className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-500 font-medium">
                  Pay Premium
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Cover" value={`ZAR ${selectedPolicy.cover_amount?.toFixed(2)}`} />
                <Field label="Premium" value={`ZAR ${selectedPolicy.premium?.toFixed(2)}`} />
                <Field label="Excess" value={`ZAR ${selectedPolicy.excess?.toFixed(2)}`} />
                <Field label="Next Due" value={selectedPolicy.next_payment_date} />
                {selectedPolicy.linked_asset && <Field label="Asset" value={selectedPolicy.linked_asset} />}
              </div>
              {selectedPolicy.beneficiaries?.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <h5 className="text-xs font-semibold text-gray-500 mb-1">Beneficiaries</h5>
                  {selectedPolicy.beneficiaries.map((b: any) => (
                    <div key={b.id} className="text-xs text-gray-600">{b.name} ({b.relationship}) — {b.percentage}%</div>
                  ))}
                </div>
              )}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <h5 className="text-xs font-semibold text-gray-500">Submit Claim</h5>
                <input value={claimType} onChange={(e) => setClaimType(e.target.value)} placeholder="Type (accident, theft...)" className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs" />
                <input value={claimDesc} onChange={(e) => setClaimDesc(e.target.value)} placeholder="Description" className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs" />
                <input value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="Amount" type="number" className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs" />
                <button onClick={submitClaim} className="w-full px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-500 font-medium">Submit Claim</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm shadow-sm">
              Select a policy
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Claims</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {claims.length === 0 ? (
              <p className="text-sm text-gray-400">No claims</p>
            ) : claims.map((c: any) => (
              <div key={c.id} className="p-3 rounded-xl border border-gray-200 bg-white text-xs shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-900 font-medium capitalize">{c.type}</span>
                  <ClaimStatus status={c.status} />
                </div>
                <p className="text-gray-500 mt-1 truncate">{c.description}</p>
                <div className="flex justify-between mt-1 text-gray-400">
                  <span>ZAR {c.amount_claimed?.toFixed(2)}</span>
                  {c.amount_approved && <span className="text-emerald-600">Approved: ZAR {c.amount_approved.toFixed(2)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-gray-400 block">{label}</span><span className="text-gray-800 text-sm">{value || '—'}</span></div>
}
function PolicyStatus({ status }: { status: string }) {
  const s: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', lapsed: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600' }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s[status] || ''}`}>{status}</span>
}
function ClaimStatus({ status }: { status: string }) {
  const s: Record<string, string> = { submitted: 'bg-amber-50 text-amber-700', under_review: 'bg-blue-50 text-blue-700', approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700', paid_out: 'bg-violet-50 text-violet-700' }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
