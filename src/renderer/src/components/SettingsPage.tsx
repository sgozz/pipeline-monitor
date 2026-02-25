import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle, XCircle, Loader2, Sun, Moon, Volume2, ServerCrash, Trash2, Plus } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

interface Props {
  onSaved: () => void
}

export default function SettingsPage({ onSaved }: Props) {
  const { theme, toggle } = useTheme()
  const [profiles, setProfiles] = useState<ServerProfile[]>([])
  const [newProfileName, setNewProfileName] = useState('')
  const [settings, setSettings] = useState<AppSettings>({
    jenkinsUrl: '',
    jenkinsUsername: '',
    jenkinsToken: '',
    refreshInterval: 30,
    showNotifications: true,
    theme: 'dark',
    soundAlerts: false
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.getVersion().then(setAppVersion)
    window.api.profiles.get().then(setProfiles).catch(() => {})
  }, [])

  const handleChange = (key: keyof AppSettings, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
    setSaved(false)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    // Save first so the main process has the latest credentials
    await window.api.settings.set(settings)
    const result = await window.api.settings.testConnection()
    setTestResult(result)
    setTesting(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await window.api.settings.set(settings)
    setSaving(false)
    setSaved(true)
    onSaved()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="titlebar-drag flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <Settings size={16} className="titlebar-no-drag text-slate-400" />
        <h1 className="titlebar-no-drag text-sm font-semibold text-slate-200">Settings</h1>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto p-6 max-w-xl">
        <div className="space-y-5">
          {/* Jenkins URL */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Jenkins URL
            </label>
            <input
              type="url"
              value={settings.jenkinsUrl}
              onChange={(e) => handleChange('jenkinsUrl', e.target.value)}
              placeholder="https://jenkins.example.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={settings.jenkinsUsername}
              onChange={(e) => handleChange('jenkinsUsername', e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* API Token */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              API Token
            </label>
            <input
              type="password"
              value={settings.jenkinsToken}
              onChange={(e) => handleChange('jenkinsToken', e.target.value)}
              placeholder="Jenkins API token"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Generate at: Jenkins → User → Configure → API Token
            </p>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Refresh Interval (seconds)
            </label>
            <input
              type="number"
              min={10}
              max={300}
              value={settings.refreshInterval}
              onChange={(e) => handleChange('refreshInterval', parseInt(e.target.value) || 30)}
              className="w-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="notifications"
              checked={settings.showNotifications}
              onChange={(e) => handleChange('showNotifications', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <label
              htmlFor="notifications"
              className="text-sm text-slate-300 cursor-pointer"
            >
              Show desktop notifications for build status changes
            </label>
          </div>

          {/* Sound Alerts */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="soundAlerts"
              checked={settings.soundAlerts}
              onChange={(e) => handleChange('soundAlerts', e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <label
              htmlFor="soundAlerts"
              className="text-sm text-slate-300 cursor-pointer flex items-center gap-1.5"
            >
              <Volume2 size={14} className="text-slate-500" />
              Play sound on build failure
            </label>
          </div>

          {/* Server Profiles (Multi-Jenkins) */}
          <div className="pt-3 border-t border-slate-800">
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Server Profiles
            </label>
            <div className="space-y-2 mb-2">
              {profiles.map((p) => (
                <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded text-sm">
                  <ServerCrash size={12} className="text-slate-500" />
                  <span className="flex-1 text-slate-300 truncate">{p.name}</span>
                  <span className="text-xs text-slate-600 truncate max-w-[120px]">{p.url}</span>
                  <button
                    onClick={async () => {
                      const result = await window.api.profiles.load(p.name)
                      if (result) {
                        setSettings(result)
                        onSaved()
                      }
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Load
                  </button>
                  <button
                    onClick={async () => {
                      const updated = await window.api.profiles.delete(p.name)
                      setProfiles(updated)
                    }}
                    className="p-0.5 text-slate-600 hover:text-red-400 transition"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile name"
                className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={async () => {
                  if (!newProfileName.trim()) return
                  const updated = await window.api.profiles.save({
                    name: newProfileName.trim(),
                    url: settings.jenkinsUrl,
                    username: settings.jenkinsUsername,
                    token: settings.jenkinsToken
                  })
                  setProfiles(updated)
                  setNewProfileName('')
                }}
                disabled={!newProfileName.trim() || !settings.jenkinsUrl}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700 transition disabled:opacity-40"
              >
                <Plus size={10} />
                Save Current
              </button>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-medium text-slate-400">Theme</label>
            <button
              onClick={() => {
                toggle()
                handleChange('theme', theme === 'dark' ? 'light' : 'dark')
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-300 hover:bg-slate-700 transition"
            >
              {theme === 'dark' ? (
                <>
                  <Moon size={14} className="text-blue-400" />
                  Dark
                </>
              ) : (
                <>
                  <Sun size={14} className="text-amber-400" />
                  Light
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={handleTestConnection}
              disabled={testing || !settings.jenkinsUrl || !settings.jenkinsUsername || !settings.jenkinsToken}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : testResult === true ? (
                <CheckCircle size={14} className="text-emerald-400" />
              ) : testResult === false ? (
                <XCircle size={14} className="text-red-400" />
              ) : null}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !settings.jenkinsUrl}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <CheckCircle size={14} />
              ) : (
                <Save size={14} />
              )}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>

          {/* Test result message */}
          {testResult === true && (
            <p className="text-sm text-emerald-400">Connection successful</p>
          )}
          {testResult === false && (
            <p className="text-sm text-red-400">
              Connection failed. Check your URL and credentials.
            </p>
          )}

          {/* Keyboard shortcuts reference */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-medium text-slate-400 mb-3">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              {[
                ['Cmd+K', 'Search jobs'],
                ['Cmd+R', 'Refresh current view'],
                ['Cmd+1', 'Dashboard'],
                ['Cmd+2', 'Nodes'],
                ['Cmd+3', 'Queue'],
                ['Cmd+,', 'Settings'],
                ['Cmd+F', 'Search in console'],
                ['Escape', 'Go back']
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">
                    {key}
                  </kbd>
                  <span className="text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* App version */}
        <div className="mt-8 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Jenkins UI v{appVersion}
          </p>
        </div>
      </div>
    </div>
  )
}
