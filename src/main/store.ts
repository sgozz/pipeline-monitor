import Store from 'electron-store'

export interface AppSettings {
  jenkinsUrl: string
  jenkinsUsername: string
  jenkinsToken: string
  refreshInterval: number // seconds
  showNotifications: boolean
}

const defaults: AppSettings = {
  jenkinsUrl: '',
  jenkinsUsername: '',
  jenkinsToken: '',
  refreshInterval: 30,
  showNotifications: true
}

const store = new Store<AppSettings>({
  defaults,
  encryptionKey: 'jenkins-ui-v1' // basic obfuscation for credentials
})

export function getSettings(): AppSettings {
  return {
    jenkinsUrl: store.get('jenkinsUrl'),
    jenkinsUsername: store.get('jenkinsUsername'),
    jenkinsToken: store.get('jenkinsToken'),
    refreshInterval: store.get('refreshInterval'),
    showNotifications: store.get('showNotifications')
  }
}

export function setSettings(settings: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(settings)) {
    store.set(key as keyof AppSettings, value)
  }
  return getSettings()
}

export function isConfigured(): boolean {
  const s = getSettings()
  return !!(s.jenkinsUrl && s.jenkinsUsername && s.jenkinsToken)
}
