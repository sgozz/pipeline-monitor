import { useState, useEffect, useCallback, useRef } from 'react'

type FetchFn<T> = () => Promise<T>

interface UsePollingResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function usePolling<T>(
  fetchFn: FetchFn<T>,
  intervalMs: number,
  enabled = true
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchRef = useRef(fetchFn)
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
    refresh()
    const timer = setInterval(refresh, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled, refresh])

  return { data, loading, error, refresh }
}

export function useJenkinsItems(intervalMs = 30000) {
  return usePolling(() => window.api.jenkins.getAllItems(), intervalMs, intervalMs > 0)
}

export function useRunningBuilds(intervalMs = 10000) {
  return usePolling(() => window.api.jenkins.getRunningBuilds(), intervalMs, intervalMs > 0)
}

export function useBuildHistory(fullname: string, limit = 20) {
  return usePolling(
    () => window.api.jenkins.getBuildHistory(fullname, limit),
    30000
  )
}

export function useNodes(intervalMs = 15000) {
  return usePolling(() => window.api.jenkins.getAllNodes(), intervalMs, intervalMs > 0)
}

export function useQueue(intervalMs = 10000) {
  return usePolling(() => window.api.jenkins.getQueueItems(), intervalMs, intervalMs > 0)
}
