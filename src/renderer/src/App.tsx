import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Server,
  ListOrdered,
  Settings as SettingsIcon,
  Activity,
  Download,
  RefreshCw,
  X,
  MessageSquare,
  Keyboard
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import NodesView from './components/NodesView'
import QueueView from './components/QueueView'
import SettingsPage from './components/SettingsPage'
import JobDetail from './components/JobDetail'
import { useRunningBuilds, useQueue } from './hooks/useJenkins'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useThemeProvider, ThemeContext } from './hooks/useTheme'

type Page =
  | { id: 'dashboard' }
  | { id: 'nodes' }
  | { id: 'queue' }
  | { id: 'settings' }
  | { id: 'job'; fullname: string }

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { id: 'nodes' as const, label: 'Nodes', icon: Server, shortcut: '2' },
  { id: 'queue' as const, label: 'Queue', icon: ListOrdered, shortcut: '3' },
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon, shortcut: ',' }
]

export default function App() {
  const themeValue = useThemeProvider()
  const [page, setPage] = useState<Page>({ id: 'dashboard' })
  const [configured, setConfigured] = useState<boolean | null>(null)
  const isReady = configured === true
  const { data: runningBuilds } = useRunningBuilds(isReady ? 10000 : 0)
  const { data: queueItems } = useQueue(isReady ? 10000 : 0)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [pendingInputCount, setPendingInputCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.settings.isConfigured().then(setConfigured)
    window.api.getVersion().then(setAppVersion)
    window.api.onNavigate((target) => {
      if (target === 'settings') setPage({ id: 'settings' })
    })
  }, [])

  // Listen for pending input events from the main process
  useEffect(() => {
    window.api.onPendingInput(() => {
      setPendingInputCount((c) => c + 1)
    })
  }, [])

  // Listen for auto-update events
  useEffect(() => {
    window.api.updater.getStatus().then(setUpdateStatus)
    window.api.updater.onStatus((status) => {
      const s = status as UpdateStatus
      setUpdateStatus(s)
      // Only un-dismiss for actionable statuses (new download or ready to install)
      if (s.status === 'downloading' || s.status === 'ready') {
        setUpdateDismissed(false)
      }
    })
  }, [])

  // Redirect to settings if not configured
  useEffect(() => {
    if (configured === false) setPage({ id: 'settings' })
  }, [configured])

  const navigate = useCallback((pageId: string) => {
    setPage({ id: pageId } as Page)
  }, [])

  const openJob = useCallback((fullname: string) => {
    setPage({ id: 'job', fullname })
  }, [])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => {
      if (page.id !== 'dashboard') navigate('dashboard')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    },
    onRefresh: () => {
      // The active view handles its own refresh via polling, but we can force a page re-render
      // by briefly navigating away and back — or simpler, just do nothing as polling handles it.
      // For now, we trigger the browser-level approach
      window.dispatchEvent(new CustomEvent('force-refresh'))
    },
    onBack: () => {
      if (page.id === 'job') navigate('dashboard')
    },
    onGoToDashboard: () => navigate('dashboard'),
    onGoToNodes: () => navigate('nodes'),
    onGoToQueue: () => navigate('queue'),
    onGoToSettings: () => navigate('settings')
  })

  const runningCount = runningBuilds?.length ?? 0
  const queueCount = queueItems?.length ?? 0

  return (
    <ThemeContext.Provider value={themeValue}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col">
          {/* Titlebar drag area */}
          <div className="titlebar-drag h-10 flex items-center pl-20 pr-4 border-b border-slate-800">
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
                  <kbd className="text-[9px] text-slate-600 font-mono hidden group-hover:inline">
                    {item.shortcut}
                  </kbd>
                </button>
              )
            })}
          </div>

          {/* Pending inputs indicator */}
          {pendingInputCount > 0 && (
            <div className="px-4 py-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <MessageSquare size={12} className="animate-pulse" />
                <span>{pendingInputCount} input{pendingInputCount !== 1 ? 's' : ''} waiting</span>
              </div>
            </div>
          )}

          {/* Running builds indicator */}
          {runningCount > 0 && (
            <div className="px-4 py-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <Activity size={12} className="animate-pulse" />
                <span>{runningCount} build{runningCount !== 1 ? 's' : ''} running</span>
              </div>
            </div>
          )}

          {/* Shortcuts hint + version */}
          <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-600">v{appVersion}</span>
            <Keyboard size={10} className="text-slate-700" title="Cmd+K: Search | Cmd+R: Refresh | Esc: Back" />
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {/* Update banner */}
          {!updateDismissed && updateStatus.status === 'ready' && (
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-900/50 border-b border-emerald-700/50 text-sm">
              <Download size={14} className="text-emerald-400" />
              <span className="text-emerald-200 flex-1">
                Version {updateStatus.version} is ready to install
              </span>
              <button
                onClick={() => window.api.updater.install()}
                className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 transition"
              >
                Restart & Update
              </button>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="p-1 text-emerald-400 hover:text-emerald-200 transition"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {!updateDismissed && updateStatus.status === 'downloading' && (
            <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/30 border-b border-blue-700/30 text-sm">
              <RefreshCw size={14} className="text-blue-400 animate-spin" />
              <span className="text-blue-200 flex-1">
                Downloading update... {updateStatus.progress ?? 0}%
              </span>
              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${updateStatus.progress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {page.id === 'dashboard' && <Dashboard onOpenJob={openJob} searchInputRef={searchInputRef} />}
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
          </div>
        </main>
      </div>
    </ThemeContext.Provider>
  )
}
