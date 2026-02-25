import Store from 'electron-store'

export interface AppSettings {
  jenkinsUrl: string
  jenkinsUsername: string
  jenkinsToken: string
  refreshInterval: number // seconds
  showNotifications: boolean
}

interface StoreSchema extends AppSettings {
  favorites: string[] // list of fullnames marked as favorite
}

const defaults: StoreSchema = {
  jenkinsUrl: '',
  jenkinsUsername: '',
  jenkinsToken: '',
  refreshInterval: 30,
  showNotifications: true,
  favorites: []
}

const store = new Store<StoreSchema>({
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

// ─── Favorites ─────────────────────────────────────────────

export function getFavorites(): string[] {
  return store.get('favorites') || []
}

export function toggleFavorite(fullname: string): string[] {
  const favorites = getFavorites()
  const index = favorites.indexOf(fullname)
  if (index >= 0) {
    favorites.splice(index, 1)
  } else {
    favorites.push(fullname)
  }
  store.set('favorites', favorites)
  return favorites
}

export function isFavorite(fullname: string): boolean {
  return getFavorites().includes(fullname)
}
