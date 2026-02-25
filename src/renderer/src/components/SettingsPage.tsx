import { useState, useEffect } from 'react'
import { Settings, Save, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Props {
  onSaved: () => void
}

export default function SettingsPage({ onSaved }: Props) {
  const [settings, setSettings] = useState<AppSettings>({
    jenkinsUrl: '',
    jenkinsUsername: '',
    jenkinsToken: '',
    refreshInterval: 30,
    showNotifications: true
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.getVersion().then(setAppVersion)
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
              Show desktop notifications for build failures
            </label>
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
            <p className="text-sm text-emerald-400">✓ Connection successful</p>
          )}
          {testResult === false && (
            <p className="text-sm text-red-400">
              ✗ Connection failed. Check your URL and credentials.
            </p>
          )}
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
