import type { JenkinsAPI, SettingsAPI, FavoritesAPI, UpdaterAPI } from './index'

declare global {
  interface Window {
    api: {
      jenkins: JenkinsAPI
      settings: SettingsAPI
      favorites: FavoritesAPI
      updater: UpdaterAPI
      onNavigate: (callback: (page: string) => void) => void
      onVisibilityChange: (callback: (visible: boolean) => void) => void
  }
}
