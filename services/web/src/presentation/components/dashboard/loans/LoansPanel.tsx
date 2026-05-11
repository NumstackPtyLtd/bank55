import { useState, useEffect } from 'react'
import { loansApi } from '../../../../infrastructure/api/loans'
import { useAppState } from '../DashboardApp'
import { CustomerPicker } from '../shared/CustomerPicker'
import { EmptyState } from '../shared/EmptyState'

export function LoansPanel() {
  const { trackAction } = useAppState()
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [selectedLoan, setSelectedLoan] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [calcAmount, setCalcAmount] = useState('200000')
  const [calcRate, setCalcRate] = useState('11.5')
  const [calcTerm, setCalcTerm] = useState('60')

  useEffect(() => {
    if (selectedCustomer) loadLoans()
    else { setLoans([]); setSelectedLoan(null) }
  }, [selectedCustomer])

  async function loadLoans() {
    try {
      const data = await loansApi.listLoans(selectedCustomer.id)
      setLoans(Array.isArray(data) ? data : [])
      setSelectedLoan(null)
      setPayments([])
    } catch (e: any) { setActionResult(`Error: ${e.message}`) }
  }

  async function selectLoan(loanId: string) {
    const detail = await loansApi.getLoanDetails(loanId)
    setSelectedLoan(detail)
    const pmts = await loansApi.listPayments(loanId)
    setPayments(Array.isArray(pmts) ? pmts : [])
  }

  async function makePayment(loanId: string) {
    const result = await loansApi.makePayment(loanId)
    setActionResult(result)
    trackAction('loans', 'make_payment', loanId, {}, result)
    selectLoan(loanId)
    loadLoans()
  }

  async function calculate() {
    const result = await loansApi.calculate(parseFloat(calcAmount), parseFloat(calcRate), parseInt(calcTerm))
    setActionResult(result)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Loans</h2>
        <p className="text-gray-500 text-sm mt-0.5">Service :5503, OAuth2 Client Credentials</p>
      </div>

      <div className="mb-6 max-w-md">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Customer</label>
        <CustomerPicker selected={selectedCustomer} onSelect={setSelectedCustomer} color="amber" />
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
          icon="◆"
          title="No customer selected"
          description="Search and select a customer above to view their loans, payment history, and amortization details."
          hint="Tip: Try Elvis Magagula. He has a vehicle loan and a paid-off student loan"
          color="amber"
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Loans</h3>
          {loans.length === 0 ? (
            <p className="text-sm text-gray-400">No loans found for this customer</p>
          ) : loans.map((l: any) => (
            <button key={l.id} onClick={() => selectLoan(l.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors shadow-sm ${selectedLoan?.id === l.id ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900 capitalize">{l.type}</span>
                <LoanStatus status={l.status} />
              </div>
              <div className="mt-1 text-xs text-gray-500">Balance: ZAR {l.balance?.toFixed(2)} | Monthly: ZAR {l.monthly_payment?.toFixed(2)}</div>
              {l.next_payment_date && <div className="text-[10px] text-gray-400 mt-0.5">Next: {l.next_payment_date}</div>}
            </button>
          ))}
        </div>

        <div>
          {selectedLoan ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-semibold text-gray-900 capitalize">{selectedLoan.type} Loan</h4>
                <button onClick={() => makePayment(selectedLoan.id)} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-500 font-medium">
                  Make Payment
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Original" value={`ZAR ${selectedLoan.original_amount?.toFixed(2)}`} />
                <Field label="Outstanding" value={`ZAR ${selectedLoan.balance?.toFixed(2)}`} />
                <Field label="Rate" value={`${selectedLoan.interest_rate}% p.a.`} />
                <Field label="Monthly" value={`ZAR ${selectedLoan.monthly_payment?.toFixed(2)}`} />
                <Field label="Term" value={`${selectedLoan.term_months} months`} />
                <Field label="Paid" value={`${selectedLoan.months_paid} months`} />
                <Field label="Remaining" value={`${selectedLoan.remaining_months} months`} />
                <Field label="Total Paid" value={`ZAR ${selectedLoan.total_paid?.toFixed(2)}`} />
              </div>
              {payments.length > 0 && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <h5 className="text-xs font-semibold text-gray-500 mb-2">Payment History</h5>
                  <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
                    {payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-gray-600">
                        <span>{p.payment_date}</span>
                        <span>ZAR {p.amount?.toFixed(2)}</span>
                        <span className="text-emerald-600">{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm shadow-sm">
              Select a loan
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Calculator</h3>
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
            <input value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} placeholder="Amount" type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={calcRate} onChange={(e) => setCalcRate(e.target.value)} placeholder="Rate (%)" type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input value={calcTerm} onChange={(e) => setCalcTerm(e.target.value)} placeholder="Term (months)" type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={calculate} className="w-full px-4 py-2.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500 font-medium">Calculate</button>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-gray-400 block">{label}</span><span className="text-gray-800">{value}</span></div>
}

function LoanStatus({ status }: { status: string }) {
  const s: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', paid_off: 'bg-blue-50 text-blue-700', defaulted: 'bg-red-50 text-red-700' }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}
