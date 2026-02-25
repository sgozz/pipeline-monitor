import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Server,
  ListOrdered,
  Settings as SettingsIcon,
  Activity
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import NodesView from './components/NodesView'
import QueueView from './components/QueueView'
import SettingsPage from './components/SettingsPage'
import JobDetail from './components/JobDetail'
import { useRunningBuilds, useQueue } from './hooks/useJenkins'

type Page =
  | { id: 'dashboard' }
  | { id: 'nodes' }
  | { id: 'queue' }
  | { id: 'settings' }
  | { id: 'job'; fullname: string }

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'nodes' as const, label: 'Nodes', icon: Server },
  { id: 'queue' as const, label: 'Queue', icon: ListOrdered },
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon }
]

export default function App() {
  const [page, setPage] = useState<Page>({ id: 'dashboard' })
  const [configured, setConfigured] = useState<boolean | null>(null)
  const isReady = configured === true
  const { data: runningBuilds } = useRunningBuilds(isReady ? 10000 : 0)
  const { data: queueItems } = useQueue(isReady ? 10000 : 0)

  useEffect(() => {
    window.api.settings.isConfigured().then(setConfigured)
    window.api.onNavigate((target) => {
      if (target === 'settings') setPage({ id: 'settings' })
    })
  }, [])

  // Redirect to settings if not configured
  useEffect(() => {
    if (configured === false) setPage({ id: 'settings' })
  }, [configured])

  const navigate = (pageId: string) => {
    setPage({ id: pageId } as Page)
  }

  const openJob = (fullname: string) => {
    setPage({ id: 'job', fullname })
  }

  const runningCount = runningBuilds?.length ?? 0
  const queueCount = queueItems?.length ?? 0

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <nav className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Titlebar drag area */}
        <div className="titlebar-drag h-10 flex items-center px-4 border-b border-slate-800">
          <span className="titlebar-no-drag text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Jenkins UI
          </span>
        </div>

        {/* Nav items */}
        <div className="flex-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = page.id === item.id
            const badge =
              item.id === 'queue'
                ? queueCount
                : item.id === 'nodes'
                  ? runningCount
                  : 0

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`titlebar-no-drag w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Running builds indicator */}
        {runningCount > 0 && (
          <div className="px-4 py-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Activity size={12} className="animate-pulse" />
              <span>{runningCount} build{runningCount !== 1 ? 's' : ''} running</span>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950">
        {page.id === 'dashboard' && <Dashboard onOpenJob={openJob} />}
        {page.id === 'job' && (
          <JobDetail
            fullname={page.fullname}
            onBack={() => navigate('dashboard')}
          />
        )}
        {page.id === 'nodes' && <NodesView />}
        {page.id === 'queue' && <QueueView />}
        {page.id === 'settings' && (
          <SettingsPage onSaved={() => setConfigured(true)} />
        )}
      </main>
    </div>
  )
}
