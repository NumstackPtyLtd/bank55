import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { platformApi } from '../../../infrastructure/api/platform'
import { Sidebar } from './sidebar/Sidebar'
import { LoginScreen } from './LoginScreen'
import { ServiceGridPanel } from './service-grid/ServiceGridPanel'
import { CustomersPanel } from './customers/CustomersPanel'
import { WalletsPanel } from './wallets/WalletsPanel'
import { LoansPanel } from './loans/LoansPanel'
import { InsurancePanel } from './insurance/InsurancePanel'
import { ScenariosPanel } from './scenarios/ScenariosPanel'
import { NotificationsPanel } from './notifications/NotificationsPanel'

export type ActivePanel = 'overview' | 'customers' | 'wallets' | 'loans' | 'insurance' | 'notifications' | 'scenarios'

interface LogEntry {
  timestamp: string
  panel: string
  step: string
  result: string
  success: boolean
}

interface AppState {
  logs: LogEntry[]
  addLog: (panel: string, step: string, result: string, success?: boolean) => void
  clearLogs: () => void
  user: any | null
  trackAction: (service: string, action: string, target?: string, params?: any, result?: any, success?: boolean) => void
}

const AppContext = createContext<AppState>({ logs: [], addLog: () => {}, clearLogs: () => {}, user: null, trackAction: () => {} })
export const useAppState = () => useContext(AppContext)

function getHashPanel(): ActivePanel {
  if (typeof window === 'undefined') return 'overview'
  const hash = window.location.hash.slice(1) as ActivePanel
  const valid: ActivePanel[] = ['overview', 'customers', 'wallets', 'loans', 'insurance', 'notifications', 'scenarios']
  return valid.includes(hash) ? hash : 'overview'
}

export function DashboardApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [user, setUser] = useState<any>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel>('overview')
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Check existing session on mount
  useEffect(() => {
    platformApi.checkAuth().then((res) => {
      setAuthenticated(res.authenticated)
      if (res.authenticated) setUser(res.user)
    })
  }, [])

  // Hash routing
  useEffect(() => {
    setActivePanel(getHashPanel())
    const onHash = () => setActivePanel(getHashPanel())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((panel: ActivePanel) => {
    window.location.hash = panel
    setActivePanel(panel)
  }, [])

  const handleLogin = useCallback((userData: any) => {
    setAuthenticated(true)
    setUser(userData)
  }, [])

  const handleLogout = useCallback(() => {
    platformApi.logout()
    setAuthenticated(false)
    setUser(null)
  }, [])

  const addLog = useCallback((panel: string, step: string, result: string, success = true) => {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), panel, step, result, success }])
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  // Track actions to the server for AI reasoning
  const trackAction = useCallback((service: string, action: string, target?: string, params?: any, result?: any, success?: boolean) => {
    platformApi.recordAction({ service, action, target, params, result, success: success !== false })
    addLog(service, `${action}${target ? `: ${target}` : ''}`, typeof result === 'string' ? result : JSON.stringify(result || ''), success)
  }, [addLog])

  // Loading state
  if (authenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Checking session...</div>
      </div>
    )
  }

  // Not authenticated - show login
  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <AppContext.Provider value={{ logs, addLog, clearLogs, user, trackAction }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar active={activePanel} onNavigate={navigate} user={user} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {activePanel === 'overview' && <ServiceGridPanel onNavigate={navigate} />}
          {activePanel === 'customers' && <CustomersPanel />}
          {activePanel === 'wallets' && <WalletsPanel />}
          {activePanel === 'loans' && <LoansPanel />}
          {activePanel === 'insurance' && <InsurancePanel />}
          {activePanel === 'notifications' && <NotificationsPanel />}
          {activePanel === 'scenarios' && <ScenariosPanel />}
        </main>
      </div>
    </AppContext.Provider>
  )
}
