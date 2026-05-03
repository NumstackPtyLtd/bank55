import { useState } from 'react'
import { walletsApi } from '../../../../infrastructure/api/wallets'
import { loansApi } from '../../../../infrastructure/api/loans'
import { insuranceApi } from '../../../../infrastructure/api/insurance'
import { customersApi } from '../../../../infrastructure/api/customers'
import { useAppState } from '../DashboardApp'

interface Scenario {
  id: string
  title: string
  description: string
  category: 'transfer' | 'loan' | 'insurance' | 'fraud' | 'lifecycle'
  steps: string[]
}

const SCENARIOS: Scenario[] = [
  { id: 'p2p-transfer', title: 'P2P Transfer: Elvis → Thabo', description: 'Elvis sends ZAR 500 to Thabo. Both see the transaction.', category: 'transfer', steps: ['Login as Elvis', 'Transfer ZAR 500', 'Verify debit', 'Verify Thabo credit'] },
  { id: 'loan-payment', title: 'Loan Payment', description: 'Elvis pays his vehicle loan. Balance decreases.', category: 'loan', steps: ['OAuth2 auth', 'Make payment', 'Verify balance'] },
  { id: 'insurance-claim', title: 'Submit Insurance Claim', description: 'Elvis files a vehicle claim.', category: 'insurance', steps: ['HMAC auth', 'Submit claim', 'Check status'] },
  { id: 'premium-payment', title: 'Pay Insurance Premium', description: 'Elvis pays vehicle insurance premium.', category: 'insurance', steps: ['HMAC auth', 'Pay premium', 'Verify next date'] },
  { id: 'kyc-verification', title: 'KYC Verification', description: 'Verify Lindiwe pending KYC.', category: 'lifecycle', steps: ['Check status', 'Verify', 'Confirm'] },
  { id: 'fraud-freeze', title: 'Fraud Detection', description: 'Detect high risk on Naledi, show frozen.', category: 'fraud', steps: ['Check risk', 'View status', 'Confirm frozen'] },
  { id: 'new-customer', title: 'New Customer Onboard', description: 'Register a new customer.', category: 'lifecycle', steps: ['Create', 'Check KYC pending', 'Audit log'] },
  { id: 'cross-service', title: 'Cross-Service Journey', description: 'Full financial picture for Elvis.', category: 'lifecycle', steps: ['Profile', 'Wallets', 'Loans', 'Insurance'] },
]

export function ScenariosPanel() {
  const { logs, addLog, clearLogs } = useAppState()
  const [running, setRunning] = useState<string | null>(null)

  async function runScenario(scenario: Scenario) {
    setRunning(scenario.id)
    const log = (step: string, result: string, success = true) => addLog(scenario.id, step, result, success)

    try {
      switch (scenario.id) {
        case 'p2p-transfer': {
          log('Authenticating as Elvis...', 'POST /auth/token → JWT')
          const token = await walletsApi.login('1055001234', '1234')
          log('Got JWT', token.slice(0, 40) + '...')
          log('Transferring ZAR 500...', 'to 1055002345')
          const result = await walletsApi.transfer(token, '1055002345', 500, 'Scenario: braai money')
          log('Transfer complete', result)
          const thaboToken = await walletsApi.login('1055002345', '5678')
          const txns = await walletsApi.listTransactions(thaboToken, undefined, { limit: 1 })
          log('Thabo received', txns[0]?.description || 'confirmed')
          break
        }
        case 'loan-payment': {
          log('OAuth2 client_credentials...', 'elvis-loans-client')
          await loansApi.getToken('elvis-loans-client', 'elvis-secret-2024')
          log('Authenticated', 'scope: loans:read loans:write')
          const before = await loansApi.getLoanBalance('loan-001')
          log('Before', before)
          const result = await loansApi.makePayment('loan-001')
          log('Payment applied', result)
          break
        }
        case 'insurance-claim': {
          log('HMAC signing...', 'ins-elvis')
          const result = await insuranceApi.submitClaim({
            policy_id: 'pol-001', type: 'collision',
            description: 'Fender bender in parking lot', amount: 15000,
            incident_date: new Date().toISOString().slice(0, 10),
          })
          log('Claim submitted', result)
          break
        }
        case 'premium-payment': {
          log('HMAC signing...', 'ins-elvis')
          const info = await insuranceApi.getPremiumInfo('pol-001')
          log('Premium info', info)
          const result = await insuranceApi.payPremium('pol-001')
          log('Paid', result)
          break
        }
        case 'kyc-verification': {
          const kyc = await customersApi.getKyc('cust-005')
          log('Current', `KYC: ${kyc.customer.kyc_status}`)
          const result = await customersApi.verify('cust-005')
          log('Verified', result)
          const after = await customersApi.get('cust-005')
          log('Confirmed', `Now: ${after.kyc_status}`)
          break
        }
        case 'fraud-freeze': {
          const risk = await customersApi.getRisk('cust-003')
          log('Risk', `Score: ${risk.risk_score}, Level: ${risk.risk_level}`)
          const customer = await customersApi.get('cust-003')
          log('Status', `${customer.status} (auto-suspended)`)
          break
        }
        case 'new-customer': {
          const result = await customersApi.create({
            first_name: 'Bongani', last_name: 'Mthembu',
            id_number: `ZA${Date.now().toString().slice(-9)}`,
            email: `bongani${Date.now()}@test.co.za`, phone: '+27831112233',
          })
          log('Created', result)
          break
        }
        case 'cross-service': {
          const cust = await customersApi.get('cust-001')
          log('Customer', `${cust.first_name} ${cust.last_name} | KYC: ${cust.kyc_status}`)
          const token = await walletsApi.login('1055001234', '1234')
          const wallets = await walletsApi.listWallets(token)
          log('Wallets', `${wallets.length} accounts | ZAR ${wallets.reduce((s: number, w: any) => s + w.balance, 0).toFixed(2)}`)
          const loans = await loansApi.getSummary('cust-001')
          log('Loans', `${loans.active_loans} active | ${loans.total_outstanding}`)
          const ins = await insuranceApi.getCoverSummary('cust-001')
          log('Insurance', `${ins.active_policies} policies | ${ins.total_cover}`)
          break
        }
      }
    } catch (e: any) {
      log('ERROR', e.message, false)
    }
    setRunning(null)
  }

  const categoryStyles: Record<string, string> = {
    transfer: 'border-violet-200 bg-violet-50/50',
    loan: 'border-amber-200 bg-amber-50/50',
    insurance: 'border-rose-200 bg-rose-50/50',
    fraud: 'border-red-200 bg-red-50/50',
    lifecycle: 'border-blue-200 bg-blue-50/50',
  }

  const scenarioLogs = logs.filter((l) => SCENARIOS.some((s) => s.id === l.panel))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scenarios</h2>
          <p className="text-gray-500 text-sm mt-0.5">Simulate real banking operations across all services</p>
        </div>
        {scenarioLogs.length > 0 && (
          <button onClick={clearLogs} className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            Clear Logs
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => runScenario(s)} disabled={running !== null}
              className={`w-full text-left p-4 rounded-xl border transition-all shadow-sm ${categoryStyles[s.category]} ${running === s.id ? 'ring-2 ring-emerald-400' : ''} ${running && running !== s.id ? 'opacity-50' : 'hover:shadow-md'}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 text-sm">{s.title}</h4>
                {running === s.id && <span className="text-xs text-emerald-600 animate-pulse font-medium">Running...</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              <div className="flex gap-1 mt-2">
                {s.steps.map((_, i) => (
                  <span key={i} className="text-[9px] bg-white/80 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">{i + 1}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="sticky top-8">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Execution Log</h3>
          <div className="rounded-xl border border-gray-200 bg-white p-4 max-h-[600px] overflow-y-auto font-mono text-xs shadow-sm">
            {scenarioLogs.length === 0 ? (
              <p className="text-gray-400">Click a scenario to run...</p>
            ) : (
              <div className="space-y-2">
                {scenarioLogs.map((entry, i) => (
                  <div key={i}>
                    <div className="text-gray-500">{entry.step}</div>
                    {entry.result && (
                      <pre className={`ml-2 mt-0.5 whitespace-pre-wrap ${entry.success ? 'text-emerald-700' : 'text-red-600'}`}>{entry.result}</pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
