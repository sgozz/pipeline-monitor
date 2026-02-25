/**
 * In-memory cache with TTL for Jenkins API responses.
 * Prevents redundant requests to Jenkins when multiple components
 * request the same data within a short time window.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  etag?: string
  lastModified?: string
}

class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>()

  /**
   * Get a cached value if it exists and hasn't expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return undefined
    }
    return entry.data as T
  }

  /**
   * Store a value in the cache with a TTL in milliseconds.
   */
  set<T>(key: string, data: T, ttl: number, etag?: string, lastModified?: string): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl, etag, lastModified })
  }

  /**
   * Get the ETag/Last-Modified for a cache key (for conditional requests).
   * Returns them even if the entry is expired — we still want to send
   * conditional headers so Jenkins can respond with 304.
   */
  getConditionalHeaders(key: string): { etag?: string; lastModified?: string } | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    return { etag: entry.etag, lastModified: entry.lastModified }
  }

  /**
   * Refresh the timestamp of an existing entry (used when 304 Not Modified).
   */
  touch(key: string): void {
    const entry = this.store.get(key)
    if (entry) {
      entry.timestamp = Date.now()
    }
  }

  /**
   * Invalidate a specific key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix)
      return
    }
    // Prefix match
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Invalidate all cached data.
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get cache stats for debugging.
   */
  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: [...this.store.keys()] }
  }
}

/** Singleton cache instance */
export const apiCache = new ApiCache()

/** Common TTL values in milliseconds */
export const CacheTTL = {
  /** Items/jobs list — moderate TTL, this is the heaviest call */
  ITEMS: 30_000,
  /** Nodes — moderate TTL */
  NODES: 15_000,
  /** Queue items — short TTL, changes frequently */
  QUEUE: 10_000,
  /** Build history — moderate TTL */
  BUILD_HISTORY: 20_000,
  /** Single build info — short TTL */
  BUILD: 10_000,
  /** Stages for completed builds — very long TTL, they never change */
  STAGES_COMPLETED: 24 * 60 * 60_000,
  /** Stages for running builds — short TTL */
  STAGES_RUNNING: 10_000
} as const
