import type { JenkinsAPI, SettingsAPI, FavoritesAPI } from './index'

declare global {
  interface Window {
    api: {
      jenkins: JenkinsAPI
      settings: SettingsAPI
      favorites: FavoritesAPI
      onNavigate: (callback: (page: string) => void) => void
    }
  }
}
