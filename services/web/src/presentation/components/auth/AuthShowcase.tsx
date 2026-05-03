import { useState } from 'react'
import type { Service, Credential } from '../../../domain'

interface Props {
  services: readonly Service[]
  credentials: Record<string, readonly Credential[]>
}

export function AuthShowcase({ services, credentials }: Props) {
  const [activeTab, setActiveTab] = useState(services[0].id)
  const activeService = services.find((s) => s.id === activeTab)!
  const activeCreds = credentials[activeTab] || []

  return (
    <section id="auth" className="px-6 py-24 lg:px-8 bg-gray-900/30">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Authentication</h2>
          <p className="mt-4 text-gray-400">
            Each service uses a different auth mechanism. Real-world diversity for realistic testing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => setActiveTab(service.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === service.id
                  ? 'bg-bank-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {service.name}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">{activeService.auth.label}</span>
              <span className="text-xs text-gray-500">{activeService.auth.description}</span>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Required Headers</h4>
              <div className="flex flex-wrap gap-2">
                {activeService.auth.headers.map((header) => (
                  <code key={header} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded font-mono">
                    {header}
                  </code>
                ))}
              </div>
            </div>

            {activeService.auth.tokenEndpoint && (
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Token Endpoint</h4>
                <code className="text-sm text-bank-400 font-mono">
                  POST http://localhost:{activeService.port}{activeService.auth.tokenEndpoint}
                </code>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Example</h4>
              <pre className="text-xs bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto font-mono text-gray-300">
                {activeService.auth.example}
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Test Credentials</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 text-gray-500 font-medium">Identity</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Secret</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Role</th>
                      <th className="text-left py-2 text-gray-500 font-medium">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCreds.map((cred, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-2 font-mono text-bank-400">{cred.identity}</td>
                        <td className="py-2 font-mono text-gray-400">{cred.secret || '(none)'}</td>
                        <td className="py-2">
                          <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{cred.role}</span>
                        </td>
                        <td className="py-2 text-gray-400">{cred.customerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
