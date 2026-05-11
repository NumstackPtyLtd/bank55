import { useState, useEffect } from 'react'
import { walletsApi } from '../../../../infrastructure/api/wallets'
import { notificationsApi } from '../../../../infrastructure/api/notifications'
import { useAppState } from '../DashboardApp'
import { CustomerPicker } from '../shared/CustomerPicker'
import { EmptyState } from '../shared/EmptyState'

// Wallet credentials keyed by customer ID
const WALLET_CREDS: Record<string, { account: string; pin: string; label: string }[]> = {
  'cust-001': [
    { account: '1055001234', pin: '1234', label: 'Cheque' },
    { account: '1055005678', pin: '1234', label: 'Savings' },
    { account: '1055009999', pin: '1234', label: 'Credit' },
  ],
  'cust-002': [{ account: '1055002345', pin: '5678', label: 'Cheque' }],
  'cust-003': [{ account: '1055003456', pin: '9999', label: 'Cheque (Frozen)' }],
  'cust-004': [
    { account: '1055004567', pin: '4321', label: 'Cheque' },
    { account: '1055008888', pin: '4321', label: 'Savings' },
  ],
  'cust-005': [{ account: '1055006789', pin: '1111', label: 'Cheque' }],
}

export function WalletsPanel() {
  const { trackAction } = useAppState()
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [activeWallet, setActiveWallet] = useState<typeof WALLET_CREDS['cust-001'][0] | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [wallets, setWallets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')

  const availableCreds = selectedCustomer ? WALLET_CREDS[selectedCustomer.id] || [] : []

  useEffect(() => {
    if (availableCreds.length > 0) {
      setActiveWallet(availableCreds[0])
    } else {
      setActiveWallet(null)
      setWallets([])
      setTransactions([])
      setToken(null)
    }
  }, [selectedCustomer])

  useEffect(() => {
    if (activeWallet) login(activeWallet)
  }, [activeWallet])

  async function login(cred: { account: string; pin: string }) {
    try {
      walletsApi.clearTokenCache()
      const t = await walletsApi.login(cred.account, cred.pin)
      setToken(t)
      const w = await walletsApi.listWallets(t)
      setWallets(w)
      const txns = await walletsApi.listTransactions(t, undefined, { limit: 15 })
      setTransactions(txns)
    } catch (e: any) { setActionResult(`Login failed: ${e.message}`) }
  }

  async function doTransfer() {
    if (!token || !transferTo || !transferAmount) return
    try {
      const result = await walletsApi.transfer(token, transferTo, parseFloat(transferAmount), transferNote || undefined)
      setActionResult(result)
      trackAction('wallets', 'transfer', transferTo, { amount: transferAmount, note: transferNote }, result)
      // Send notifications to both parties
      const senderName = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Customer'
      const senderEmail = selectedCustomer?.email || ''
      notificationsApi.send({
        customer_id: selectedCustomer?.id || '', customer_email: senderEmail, customer_name: senderName,
        type: 'transfer', subject: `Transfer Sent: ZAR ${parseFloat(transferAmount).toFixed(2)}`,
        body: `You sent ZAR ${parseFloat(transferAmount).toFixed(2)} to account ${transferTo}.\n\n${transferNote || ''}`,
        metadata: { amount: transferAmount, to: transferTo },
      }).catch(() => {})
      setTransferTo(''); setTransferAmount(''); setTransferNote('')
      if (activeWallet) login(activeWallet)
    } catch (e: any) { setActionResult(`Transfer failed: ${e.message}`) }
  }

  async function loadStatement() {
    if (!token) return
    const s = await walletsApi.getStatement(token)
    setActionResult(s)
  }

  const noAccess = selectedCustomer && availableCreds.length === 0

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Wallets</h2>
        <p className="text-gray-500 text-sm mt-0.5">Service :5502, JWT Bearer Auth (account + PIN)</p>
      </div>

      <div className="mb-6 max-w-md">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Customer</label>
        <CustomerPicker selected={selectedCustomer} onSelect={setSelectedCustomer} color="violet" />
      </div>

      {availableCreds.length > 1 && (
        <div className="flex gap-2 mb-4">
          {availableCreds.map((cred) => (
            <button key={cred.account} onClick={() => setActiveWallet(cred)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${activeWallet?.account === cred.account ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {cred.label} ({cred.account})
            </button>
          ))}
        </div>
      )}

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
          icon="◉"
          title="No customer selected"
          description="Search and select a customer above to view their wallets, transactions, and make transfers."
          hint="Tip: Try Elvis Magagula. He has cheque, savings, and credit accounts"
          color="violet"
        />
      ) : noAccess ? (
        <EmptyState
          icon="◉"
          title="No wallet credentials"
          description="This customer doesn't have seeded wallet credentials. Only the first 5 demo customers have wallet PIN access."
          hint="Try Elvis, Thabo, Naledi, Sipho, or Lindiwe"
          color="violet"
        />
      ) : activeWallet ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Accounts</h3>
            {wallets.map((w: any) => (
              <div key={w.id} className={`p-4 rounded-xl border shadow-sm ${w.status === 'frozen' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-gray-500 capitalize">{w.type}</span>
                    <div className="font-mono text-sm text-gray-700">{w.account_number}</div>
                  </div>
                  <WalletStatus status={w.status} />
                </div>
                <div className="mt-2 text-xl font-bold text-gray-900">{w.currency} {w.balance?.toFixed(2)}</div>
                <div className="text-xs text-gray-400">Available: {w.currency} {w.available_balance?.toFixed(2)}</div>
              </div>
            ))}
            <button onClick={loadStatement} className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Mini Statement
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Transactions</h3>
            <div className="space-y-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden max-h-[500px] overflow-y-auto">
              {transactions.map((t: any) => (
                <div key={t.id} className="px-4 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-800 truncate max-w-[180px]">{t.description}</span>
                    <span className={`text-sm font-medium ${t.type === 'credit' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {t.type === 'credit' ? '+' : '-'}{t.amount?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-0.5 text-xs text-gray-400">
                    <span>{t.category}</span>
                    <span>{t.created_at?.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Transfer</h3>
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
              <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="To account number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
              <input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Amount" type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
              <input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
              <button onClick={doTransfer} className="w-full px-4 py-2.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 font-medium shadow-sm">
                Send Transfer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WalletStatus({ status }: { status: string }) {
  const styles: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', frozen: 'bg-red-50 text-red-700', closed: 'bg-gray-100 text-gray-500' }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[status] || ''}`}>{status}</span>
}
