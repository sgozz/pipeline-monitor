import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'

type FetchFn<T> = () => Promise<T>

interface UsePollingResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Singleton visibility tracker.
 * Registers listeners once and shares state across all hooks.
 */
let _visible = true
const _listeners = new Set<() => void>()
let _initialized = false

function _initVisibility(): void {
  if (_initialized) return
  _initialized = true
  const update = (v: boolean) => {
    if (_visible === v) return
    _visible = v
    _listeners.forEach((l) => l())
  }
  window.api.onVisibilityChange(update)
  document.addEventListener('visibilitychange', () => {
    update(document.visibilityState === 'visible')
  })
}

function useAppVisible(): boolean {
  _initVisibility()
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb)
      return () => _listeners.delete(cb)
    },
    () => _visible
  )
}


/**
 * Generic polling hook with:
 * - Automatic pause when app is hidden/minimized
 * - Immediate refresh when app becomes visible again
 * - Configurable interval
 */
export function usePolling<T>(
  fetchFn: FetchFn<T>,
  intervalMs: number,
  enabled = true
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchRef = useRef(fetchFn)
  const appVisible = useAppVisible()
  fetchRef.current = fetchFn

  const refresh = useCallback(async () => {
    try {
      setLoading((prev) => (data === null ? true : prev))
      const result = await fetchRef.current()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [data])

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return

    // If app is not visible, don't poll — but do one refresh when it becomes visible
    if (!appVisible) return

    refresh()
    const timer = setInterval(refresh, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled, refresh, appVisible])

  return { data, loading, error, refresh }
}

/**
 * Dashboard items — polls every 30s, pauses when hidden.
 */
export function useJenkinsItems(intervalMs = 30000) {
  return usePolling(() => window.api.jenkins.getAllItems(), intervalMs, intervalMs > 0)
}

/**
 * Favorites + pinned folder items only — lightweight poll for Dashboard default view.
 */
export function useFavoriteItems(intervalMs = 30000) {
  return usePolling(() => window.api.jenkins.getItemsForFavorites(), intervalMs, intervalMs > 0)
}

/**
 * Running builds — polls every 10s, pauses when hidden.
 */
export function useRunningBuilds(intervalMs = 10000) {
  return usePolling(() => window.api.jenkins.getRunningBuilds(), intervalMs, intervalMs > 0)
}

/**
 * Build history with smart interval:
 * - 15s if any build is currently running (need progress updates)
 * - 60s if all builds are completed (nothing is changing)
 */
export function useBuildHistory(fullname: string, limit = 20) {
  const [smartInterval, setSmartInterval] = useState(30000)
  const result = usePolling(
    () => window.api.jenkins.getBuildHistory(fullname, limit),
    smartInterval
  )

  // Adjust polling interval based on whether any builds are running
  useEffect(() => {
    if (result.data) {
      const hasRunning = result.data.some((b) => b.building)
      setSmartInterval(hasRunning ? 15000 : 60000)
    }
  }, [result.data])

  return result
}

/**
 * Nodes — polls every 15s, pauses when hidden.
 */
export function useNodes(intervalMs = 15000) {
  return usePolling(() => window.api.jenkins.getAllNodes(), intervalMs, intervalMs > 0)
}

/**
 * Queue — polls every 10s, pauses when hidden.
 */
export function useQueue(intervalMs = 10000) {
  return usePolling(() => window.api.jenkins.getQueueItems(), intervalMs, intervalMs > 0)
}
