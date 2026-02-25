import { contextBridge, ipcRenderer } from 'electron'

export type JenkinsAPI = typeof api.jenkins
export type SettingsAPI = typeof api.settings
export type FavoritesAPI = typeof api.favorites
export type UpdaterAPI = typeof api.updater

const api = {
  jenkins: {
    getAllItems: () => ipcRenderer.invoke('jenkins:get-all-items'),
    getItem: (fullname: string) => ipcRenderer.invoke('jenkins:get-item', fullname),
    queryItems: (pattern: string) => ipcRenderer.invoke('jenkins:query-items', pattern),
    getBuild: (fullname: string, number?: number) =>
      ipcRenderer.invoke('jenkins:get-build', fullname, number),
    getBuildHistory: (fullname: string, limit?: number) =>
      ipcRenderer.invoke('jenkins:get-build-history', fullname, limit),
    getConsoleOutput: (fullname: string, number?: number) =>
      ipcRenderer.invoke('jenkins:get-console-output', fullname, number),
    getTestReport: (fullname: string, number?: number) =>
      ipcRenderer.invoke('jenkins:get-test-report', fullname, number),
    getStages: (fullname: string, number?: number) =>
      ipcRenderer.invoke('jenkins:get-stages', fullname, number),
    getRunningBuilds: () => ipcRenderer.invoke('jenkins:get-running-builds'),
    buildItem: (fullname: string, params?: Record<string, string>) =>
      ipcRenderer.invoke('jenkins:build-item', fullname, params),
    stopBuild: (fullname: string, number: number) =>
      ipcRenderer.invoke('jenkins:stop-build', fullname, number),
    getAllNodes: () => ipcRenderer.invoke('jenkins:get-all-nodes'),
    getNode: (name: string) => ipcRenderer.invoke('jenkins:get-node', name),
    getQueueItems: () => ipcRenderer.invoke('jenkins:get-queue-items'),
    cancelQueueItem: (id: number) => ipcRenderer.invoke('jenkins:cancel-queue-item', id),
    getPendingInputs: (fullname: string, number?: number) =>
      ipcRenderer.invoke('jenkins:get-pending-inputs', fullname, number),
    submitInput: (fullname: string, number: number, inputId: string, params?: Record<string, string>) =>
      ipcRenderer.invoke('jenkins:submit-input', fullname, number, inputId, params),
    abortInput: (fullname: string, number: number, inputId: string) =>
      ipcRenderer.invoke('jenkins:abort-input', fullname, number, inputId)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:set', settings),
    isConfigured: () => ipcRenderer.invoke('settings:is-configured'),
    testConnection: () => ipcRenderer.invoke('settings:test-connection'),
    getPinnedFolders: (): Promise<string[]> => ipcRenderer.invoke('settings:get-pinned-folders'),
    setPinnedFolders: (folders: string[]): Promise<string[]> =>
      ipcRenderer.invoke('settings:set-pinned-folders', folders)
  },
  favorites: {
    get: (): Promise<string[]> => ipcRenderer.invoke('favorites:get'),
    toggle: (fullname: string): Promise<string[]> => ipcRenderer.invoke('favorites:toggle', fullname)
  },
  updater: {
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: unknown) => void) => {
      ipcRenderer.on('updater:status', (_, status) => callback(status))
    }
  },
  onNavigate: (callback: (page: string) => void) => {
    ipcRenderer.on('navigate', (_, page) => callback(page))
  },
  onVisibilityChange: (callback: (visible: boolean) => void) => {
    ipcRenderer.on('app:visibility', (_, visible) => callback(visible))
  },
  onPendingInput: (callback: (data: { fullname: string; buildNumber: number; input: unknown }) => void) => {
    ipcRenderer.on('jenkins:pending-input', (_, data) => callback(data))
  },
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version')
}

contextBridge.exposeInMainWorld('api', api)
