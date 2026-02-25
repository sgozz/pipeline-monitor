import { contextBridge, ipcRenderer } from 'electron'

export type JenkinsAPI = typeof api.jenkins
export type SettingsAPI = typeof api.settings

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
    getRunningBuilds: () => ipcRenderer.invoke('jenkins:get-running-builds'),
    buildItem: (fullname: string, params?: Record<string, string>) =>
      ipcRenderer.invoke('jenkins:build-item', fullname, params),
    stopBuild: (fullname: string, number: number) =>
      ipcRenderer.invoke('jenkins:stop-build', fullname, number),
    getAllNodes: () => ipcRenderer.invoke('jenkins:get-all-nodes'),
    getNode: (name: string) => ipcRenderer.invoke('jenkins:get-node', name),
    getQueueItems: () => ipcRenderer.invoke('jenkins:get-queue-items'),
    cancelQueueItem: (id: number) => ipcRenderer.invoke('jenkins:cancel-queue-item', id)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:set', settings),
    isConfigured: () => ipcRenderer.invoke('settings:is-configured'),
    testConnection: () => ipcRenderer.invoke('settings:test-connection')
  },
  onNavigate: (callback: (page: string) => void) => {
    ipcRenderer.on('navigate', (_, page) => callback(page))
  }
}

contextBridge.exposeInMainWorld('api', api)
