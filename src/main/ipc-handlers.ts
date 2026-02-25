import { app, ipcMain } from 'electron'
import { JenkinsAPI, JenkinsConfig } from './jenkins-api'
import { getSettings, setSettings, isConfigured, getFavorites, toggleFavorite } from './store'
import { getUpdateStatus, checkForUpdates, installUpdate } from './updater'
import { apiCache, CacheTTL } from './cache'

let api: JenkinsAPI | null = null

/** In-flight request deduplication: prevents multiple identical requests from hitting Jenkins */
const inFlight = new Map<string, Promise<unknown>>()

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
  // Clear cache when config changes — old data may be from a different server
  apiCache.clear()
}

/**
 * Cached + deduplicated fetch helper.
 * 1. Returns cached data if TTL hasn't expired
 * 2. Deduplicates concurrent requests for the same key
 * 3. Stores the result in cache
 */
async function cachedFetch<T>(
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Check cache
  const cached = apiCache.get<T>(cacheKey)
  if (cached !== undefined) return cached

  // 2. Deduplicate in-flight requests
  const existing = inFlight.get(cacheKey)
  if (existing) return existing as Promise<T>

  // 3. Fetch and cache
  const promise = fetcher()
    .then((data) => {
      apiCache.set(cacheKey, data, ttl)
      return data
    })
    .finally(() => {
      inFlight.delete(cacheKey)
    })

  inFlight.set(cacheKey, promise)
  return promise
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
    return cachedFetch('items:all', CacheTTL.ITEMS, () => getApi().getAllItems())
  })

  ipcMain.handle('jenkins:get-item', async (_, fullname: string) => {
    ensureConfigured()
    return await getApi().getItem(fullname)
  })

  ipcMain.handle('jenkins:query-items', async (_, pattern: string) => {
    ensureConfigured()
    // queryItems calls getAllItems internally, which will hit the cache
    return await getApi().queryItems(pattern)
  })

  // ─── Builds ─────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-build', async (_, fullname: string, number?: number) => {
    ensureConfigured()
    return await getApi().getBuild(fullname, number)
  })

  ipcMain.handle('jenkins:get-build-history', async (_, fullname: string, limit?: number) => {
    ensureConfigured()
    return cachedFetch(
      `builds:${fullname}:${limit ?? 20}`,
      CacheTTL.BUILD_HISTORY,
      () => getApi().getBuildHistory(fullname, limit)
    )
  })

  ipcMain.handle(
    'jenkins:get-console-output',
    async (_, fullname: string, number?: number) => {
      ensureConfigured()
      // Console output is never cached — it's large and streamed
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

  ipcMain.handle(
    'jenkins:get-stages',
    async (_, fullname: string, number?: number) => {
      ensureConfigured()
      const cacheKey = `stages:${fullname}:${number ?? 'last'}`

      // For stages, check if we have a completed build cached (infinite TTL)
      const cached = apiCache.get<JenkinsStage[]>(cacheKey)
      if (cached !== undefined) return cached

      const stages = await getApi().getStages(fullname, number)

      // Determine TTL: completed build stages never change
      const isCompleted = stages.length > 0 &&
        stages.every((s) => s.status !== 'IN_PROGRESS' && s.status !== 'PAUSED_PENDING_INPUT')
      const ttl = isCompleted ? CacheTTL.STAGES_COMPLETED : CacheTTL.STAGES_RUNNING

      apiCache.set(cacheKey, stages, ttl)
      return stages
    }
  )

  ipcMain.handle('jenkins:get-running-builds', async () => {
    ensureConfigured()
    // Running builds derive from nodes — use nodes cache internally
    return cachedFetch('running-builds', CacheTTL.NODES, () => getApi().getRunningBuilds())
  })

  ipcMain.handle(
    'jenkins:build-item',
    async (_, fullname: string, params?: Record<string, string>) => {
      ensureConfigured()
      const result = await getApi().buildItem(fullname, params)
      // Invalidate caches that will be affected by the new build
      apiCache.invalidate('items:')
      apiCache.invalidate(`builds:${fullname}`)
      apiCache.invalidate('running-builds')
      return result
    }
  )

  ipcMain.handle('jenkins:stop-build', async (_, fullname: string, number: number) => {
    ensureConfigured()
    const result = await getApi().stopBuild(fullname, number)
    apiCache.invalidate(`builds:${fullname}`)
    apiCache.invalidate('running-builds')
    return result
  })

  // ─── Nodes ──────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-all-nodes', async () => {
    ensureConfigured()
    return cachedFetch('nodes:all', CacheTTL.NODES, () => getApi().getAllNodes())
  })

  ipcMain.handle('jenkins:get-node', async (_, name: string) => {
    ensureConfigured()
    return await getApi().getNode(name)
  })

  // ─── Queue ──────────────────────────────────────────────────
  ipcMain.handle('jenkins:get-queue-items', async () => {
    ensureConfigured()
    return cachedFetch('queue:all', CacheTTL.QUEUE, () => getApi().getQueueItems())
  })

  ipcMain.handle('jenkins:cancel-queue-item', async (_, id: number) => {
    ensureConfigured()
    const result = await getApi().cancelQueueItem(id)
    apiCache.invalidate('queue:')
    return result
  })

  // ─── Favorites ────────────────────────────────────────────
  ipcMain.handle('favorites:get', () => getFavorites())

  ipcMain.handle('favorites:toggle', (_, fullname: string) => toggleFavorite(fullname))

  // ─── Updater ─────────────────────────────────────────────
  ipcMain.handle('updater:get-status', () => getUpdateStatus())

  ipcMain.handle('updater:check', () => {
    checkForUpdates()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })

  // ─── App Info ─────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion())
}

// Re-export JenkinsStage type for the stages handler
import type { JenkinsStage } from './jenkins-api'
export type { JenkinsStage }
