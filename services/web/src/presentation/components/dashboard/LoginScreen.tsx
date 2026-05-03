import { useState } from 'react'
import { platformApi } from '../../../infrastructure/api/platform'

interface Props {
  onLogin: (user: any) => void
}

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await platformApi.login(email, password)
      onLogin(res.user)
    } catch (err: any) {
      try {
        const body = JSON.parse(err.message)
        setError(body.error || 'Login failed')
      } catch {
        setError('Login failed. Check credentials.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-gray-900">Bank</span>
            <span className="text-emerald-600">55</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">Sign in to the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="elvis@numstack.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Demo Accounts</h3>
          <div className="space-y-2 text-xs">
            {[
              { email: 'elvis@numstack.com', pw: 'bank55pass', role: 'admin' },
              { email: 'admin@bank55.co.za', pw: 'admin2024', role: 'admin' },
              { email: 'thabo@email.co.za', pw: 'thabo123', role: 'customer' },
              { email: 'sipho@company.co.za', pw: 'sipho123', role: 'customer' },
            ].map((acc) => (
              <button
                key={acc.email}
                onClick={() => { setEmail(acc.email); setPassword(acc.pw) }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-gray-700">{acc.email}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    acc.role === 'admin' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>{acc.role}</span>
                </div>
                <span className="text-gray-400">Password: {acc.pw}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
