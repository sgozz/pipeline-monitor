import type { JenkinsAPI, SettingsAPI } from './index'

declare global {
  interface Window {
    api: {
      jenkins: JenkinsAPI
      settings: SettingsAPI
      onNavigate: (callback: (page: string) => void) => void
    }
  }
}
