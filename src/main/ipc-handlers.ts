import { ipcMain } from 'electron'
import { JenkinsAPI, JenkinsConfig } from './jenkins-api'
import { getSettings, setSettings, isConfigured } from './store'

let api: JenkinsAPI | null = null

function getApi(): JenkinsAPI {
  if (!api) {
    const settings = getSettings()
    api = new JenkinsAPI({
      url: settings.jenkinsUrl,
      username: settings.jenkinsUsername,
      token: settings.jenkinsToken
    })
  }
  return api
}

function ensureConfigured(): void {
  if (!isConfigured()) {
    throw new Error('Jenkins is not configured. Please set your credentials in Settings.')
  }
}

function refreshApi(): void {
  const settings = getSettings()
  const config: JenkinsConfig = {
    url: settings.jenkinsUrl,
    username: settings.jenkinsUsername,
    token: settings.jenkinsToken
  }
  if (api) {
    api.updateConfig(config)
  } else {
    api = new JenkinsAPI(config)
  }
}

export function registerIpcHandlers(): void {
  // ─── Settings ───────────────────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:set', (_, settings) => {
    const result = setSettings(settings)
    refreshApi()
    return result
  })

  ipcMain.handle('settings:is-configured', () => isConfigured())

  ipcMain.handle('settings:test-connection', async () => {
    try {
      refreshApi()
      return await getApi().testConnection()
    } catch {
      return false
    }
  })

  // ─── Items (Jobs) ──────────────────────────────────────────
  ipcMain.handle('jenkins:get-all-items', async () => {
    ensureConfigured()
    return await getApi().getAllItems()
  })

  ipcMain.handle('jenkins:get-item', async (_, fullname: string) => {
    ensureConfigured()
    return await getApi().getItem(fullname)
  })

  ipcMain.handle('jenkins:query-items', async (_, pattern: string) => {
    ensureConfigured()
    return await getApi().queryItems(pattern)
  })

  // ─── Builds ─────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-build', async (_, fullname: string, number?: number) => {
    ensureConfigured()
    return await getApi().getBuild(fullname, number)
  })

  ipcMain.handle('jenkins:get-build-history', async (_, fullname: string, limit?: number) => {
    ensureConfigured()
    return await getApi().getBuildHistory(fullname, limit)
  })

  ipcMain.handle(
    'jenkins:get-console-output',
    async (_, fullname: string, number?: number) => {
      ensureConfigured()
      return await getApi().getConsoleOutput(fullname, number)
    }
  )

  ipcMain.handle(
    'jenkins:get-test-report',
    async (_, fullname: string, number?: number) => {
      ensureConfigured()
      return await getApi().getTestReport(fullname, number)
    }
  )

  ipcMain.handle('jenkins:get-running-builds', async () => {
    ensureConfigured()
    return await getApi().getRunningBuilds()
  })

  ipcMain.handle(
    'jenkins:build-item',
    async (_, fullname: string, params?: Record<string, string>) => {
      ensureConfigured()
      return await getApi().buildItem(fullname, params)
    }
  )

  ipcMain.handle('jenkins:stop-build', async (_, fullname: string, number: number) => {
    ensureConfigured()
    return await getApi().stopBuild(fullname, number)
  })

  // ─── Nodes ──────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-all-nodes', async () => {
    ensureConfigured()
    return await getApi().getAllNodes()
  })

  ipcMain.handle('jenkins:get-node', async (_, name: string) => {
    ensureConfigured()
    return await getApi().getNode(name)
  })

  // ─── Queue ──────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-queue-items', async () => {
    ensureConfigured()
    return await getApi().getQueueItems()
  })

  ipcMain.handle('jenkins:cancel-queue-item', async (_, id: number) => {
    ensureConfigured()
    return await getApi().cancelQueueItem(id)
  })
}
