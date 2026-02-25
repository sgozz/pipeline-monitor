import Store from 'electron-store'

export interface AppSettings {
  jenkinsUrl: string
  jenkinsUsername: string
  jenkinsToken: string
  refreshInterval: number // seconds
  showNotifications: boolean
  theme: 'dark' | 'light'
  soundAlerts: boolean
}

export interface ServerProfile {
  name: string
  url: string
  username: string
  token: string
}

interface StoreSchema extends AppSettings {
  favorites: string[] // list of fullnames marked as favorite
  pinnedFolders: string[] // list of folder names pinned to top
  serverProfiles: ServerProfile[] // saved connection profiles
}

const defaults: StoreSchema = {
  jenkinsUrl: '',
  jenkinsUsername: '',
  jenkinsToken: '',
  refreshInterval: 30,
  showNotifications: true,
  theme: 'dark',
  soundAlerts: false,
  favorites: [],
  pinnedFolders: [],
  serverProfiles: []
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
    showNotifications: store.get('showNotifications'),
    theme: store.get('theme') ?? 'dark',
    soundAlerts: store.get('soundAlerts') ?? false
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

// ─── Pinned Folders ─────────────────────────────────────────

export function getPinnedFolders(): string[] {
  return store.get('pinnedFolders') || []
}

export function setPinnedFolders(folders: string[]): string[] {
  store.set('pinnedFolders', folders)
  return folders
}

// ─── Server Profiles (Multi-Jenkins) ─────────────────────────

export function getServerProfiles(): ServerProfile[] {
  return store.get('serverProfiles') || []
}

export function saveServerProfile(profile: ServerProfile): ServerProfile[] {
  const profiles = getServerProfiles()
  const idx = profiles.findIndex((p) => p.name === profile.name)
  if (idx >= 0) {
    profiles[idx] = profile
  } else {
    profiles.push(profile)
  }
  store.set('serverProfiles', profiles)
  return profiles
}

export function deleteServerProfile(name: string): ServerProfile[] {
  const profiles = getServerProfiles().filter((p) => p.name !== name)
  store.set('serverProfiles', profiles)
  return profiles
}

export function loadServerProfile(name: string): AppSettings | null {
  const profile = getServerProfiles().find((p) => p.name === name)
  if (!profile) return null
  setSettings({
    jenkinsUrl: profile.url,
    jenkinsUsername: profile.username,
    jenkinsToken: profile.token
  })
  return getSettings()
}
