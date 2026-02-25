/**
 * Jenkins REST API client.
 * Mirrors the same operations available in the mcp-jenkins MCP server.
 */

export interface JenkinsConfig {
  url: string
  username: string
  token: string
}

export interface JenkinsItem {
  class_: string
  name: string
  url: string
  fullname: string
  color: string
  lastBuild?: {
    number: number
    url: string
  }
  jobs?: JenkinsItem[]
}

export interface JenkinsBuild {
  number: number
  url: string
  timestamp: number
  duration: number
  estimatedDuration: number
  building: boolean
  result?: string
  previousBuild?: { number: number; url: string }
  nextBuild?: { number: number; url: string }
}

export interface JenkinsStage {
  id: string
  name: string
  status: string
  startTimeMillis: number
  durationMillis: number
  pauseDurationMillis: number
  stageFlowNodes?: { id: string; name: string; status: string }[]
}

export interface JenkinsPipelineRun {
  id: string
  name: string
  status: string
  durationMillis: number
  stages: JenkinsStage[]
}

export interface JenkinsRunningBuild {
  number: number
  url: string
  timestamp: number
  building: boolean | null
}

export interface JenkinsNode {
  displayName: string
  offline: boolean
  executors?: JenkinsExecutor[]
}

export interface JenkinsExecutor {
  currentExecutable?: {
    url: string
    timestamp: number
    number: number
    fullDisplayName: string
  }
}

export interface JenkinsQueueItem {
  id: number
  inQueueSince: number
  url: string
  why: string
  task?: {
    name: string
    url: string
    fullName?: string
  }
}

/**
 * Convert a Jenkins fullname (e.g., "MIND/mind-purchase-order-service/master")
 * to a URL path (e.g., "/job/MIND/job/mind-purchase-order-service/job/master")
 */
function fullnameToPath(fullname: string): string {
  return fullname
    .split('/')
    .map((part) => `/job/${encodeURIComponent(part)}`)
    .join('')
}

export class JenkinsAPI {
  private config: JenkinsConfig

  constructor(config: JenkinsConfig) {
    this.config = config
  }

  updateConfig(config: JenkinsConfig): void {
    this.config = config
  }

  private get baseUrl(): string {
    return this.config.url.replace(/\/+$/, '')
  }

  private get authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.config.username}:${this.config.token}`).toString('base64')
  }

  private async request<T>(
    path: string,
    options?: RequestInit & { conditionalHeaders?: { etag?: string; lastModified?: string } }
  ): Promise<{ data: T; etag?: string; lastModified?: string; notModified: boolean }> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>)
    }

    // Add conditional request headers if available
    if (options?.conditionalHeaders?.etag) {
      headers['If-None-Match'] = options.conditionalHeaders.etag
    }
    if (options?.conditionalHeaders?.lastModified) {
      headers['If-Modified-Since'] = options.conditionalHeaders.lastModified
    }

    const res = await fetch(url, {
      ...options,
      headers
    })

    // 304 Not Modified — data hasn't changed
    if (res.status === 304) {
      return { data: undefined as unknown as T, notModified: true }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Jenkins API error: ${res.status} ${res.statusText} - ${text}`)
    }

    const etag = res.headers.get('etag') || undefined
    const lastModified = res.headers.get('last-modified') || undefined
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const data = (await res.json()) as T
      return { data, etag, lastModified, notModified: false }
    }
    const data = (await res.text()) as unknown as T
    return { data, etag, lastModified, notModified: false }
  }

  /** Simple request that just returns the data (for non-cached calls) */
  private async requestSimple<T>(path: string, options?: RequestInit): Promise<T> {
    const result = await this.request<T>(path, options)
    return result.data
  }

  private async post(path: string): Promise<void> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader
      }
    })
    if (!res.ok && res.status !== 201 && res.status !== 302) {
      const text = await res.text().catch(() => '')
      throw new Error(`Jenkins API error: ${res.status} ${res.statusText} - ${text}`)
    }
  }

  // ─── Items (Jobs) ─────────────────────────────────────────────

  async getAllItems(): Promise<JenkinsItem[]> {
    const data = await this.requestSimple<{ jobs: JenkinsItem[] }>(
      '/api/json?tree=jobs[name,url,color,fullName,lastBuild[number,url],jobs[name,url,color,fullName,lastBuild[number,url],jobs[name,url,color,fullName,lastBuild[number,url]]]]'
    )
    return this.flattenJobs(data.jobs || [])
  }

  private flattenJobs(jobs: JenkinsItem[], parentPath = ''): JenkinsItem[] {
    const result: JenkinsItem[] = []
    for (const job of jobs) {
      const fullname = job.fullname || (parentPath ? `${parentPath}/${job.name}` : job.name)
      const normalized = { ...job, fullname }

      if (job.jobs && job.jobs.length > 0) {
        // This is a folder - recurse into it
        result.push(...this.flattenJobs(job.jobs, fullname))
      } else {
        // This is a leaf job
        result.push(normalized)
      }
    }
    return result
  }

  async getItem(fullname: string): Promise<JenkinsItem> {
    return this.requestSimple<JenkinsItem>(
      `${fullnameToPath(fullname)}/api/json?tree=name,url,color,fullName,lastBuild[number,url],jobs[name,url,color,fullName,lastBuild[number,url]]`
    )
  }
  async queryItems(pattern: string): Promise<JenkinsItem[]> {
    const all = await this.getAllItems()
    const lower = pattern.toLowerCase()
    return all.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) || item.fullname.toLowerCase().includes(lower)
    )
  }

  // ─── Builds ───────────────────────────────────────────────────

  async getBuild(fullname: string, number?: number): Promise<JenkinsBuild> {
    const buildPath = number ? `/${number}` : '/lastBuild'
    return this.requestSimple<JenkinsBuild>(
      `${fullnameToPath(fullname)}${buildPath}/api/json?tree=number,url,timestamp,duration,estimatedDuration,building,result,previousBuild[number,url],nextBuild[number,url]`
    )
  }
  async getBuildHistory(fullname: string, limit = 20): Promise<JenkinsBuild[]> {
    const data = await this.requestSimple<{ builds: JenkinsBuild[] }>(
      `${fullnameToPath(fullname)}/api/json?tree=builds[number,url,timestamp,duration,estimatedDuration,building,result]{0,${limit}}`
    )
    return data.builds || []
  }

  async getConsoleOutput(fullname: string, number?: number): Promise<string> {
    const buildPath = number ? `/${number}` : '/lastBuild'
    return this.requestSimple<string>(`${fullnameToPath(fullname)}${buildPath}/consoleText`)
  }

  async getTestReport(
    fullname: string,
    number?: number
  ): Promise<Record<string, unknown> | null> {
    try {
      const buildPath = number ? `/${number}` : '/lastBuild'
      return await this.requestSimple<Record<string, unknown>>(
        `${fullnameToPath(fullname)}${buildPath}/testReport/api/json`
      )
    } catch {
      return null
    }
  }

  async getStages(fullname: string, number?: number): Promise<JenkinsStage[]> {
    try {
      const buildPath = number ? `/${number}` : '/lastBuild'
      const data = await this.requestSimple<JenkinsPipelineRun>(
        `${fullnameToPath(fullname)}${buildPath}/wfapi/describe`
      )
      return data.stages || []
    } catch {
      // Not a pipeline job or wfapi not available
      return []
    }
  }

  async getRunningBuilds(): Promise<JenkinsRunningBuild[]> {
    // Use computer API to find running executables
    const nodes = await this.getAllNodes()
    const running: JenkinsRunningBuild[] = []
    for (const node of nodes) {
      if (node.executors) {
        for (const exec of node.executors) {
          if (exec.currentExecutable) {
            running.push({
              number: exec.currentExecutable.number,
              url: exec.currentExecutable.url,
              timestamp: exec.currentExecutable.timestamp,
              building: true
            })
          }
        }
      }
    }
    return running
  }

  async buildItem(
    fullname: string,
    params?: Record<string, string>
  ): Promise<{ queueUrl: string }> {
    const path = params
      ? `${fullnameToPath(fullname)}/buildWithParameters?${new URLSearchParams(params).toString()}`
      : `${fullnameToPath(fullname)}/build`

    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      redirect: 'manual'
    })

    const queueUrl = res.headers.get('location') || ''
    if (res.status !== 201 && res.status !== 302) {
      const text = await res.text().catch(() => '')
      throw new Error(`Failed to trigger build: ${res.status} - ${text}`)
    }
    return { queueUrl }
  }

  async stopBuild(fullname: string, number: number): Promise<void> {
    await this.post(`${fullnameToPath(fullname)}/${number}/stop`)
  }

  // ─── Nodes ────────────────────────────────────────────────────

  async getAllNodes(): Promise<JenkinsNode[]> {
    const data = await this.requestSimple<{ computer: JenkinsNode[] }>(
      '/computer/api/json?tree=computer[displayName,offline,executors[currentExecutable[url,timestamp,number,fullDisplayName]]]'
    )
    return data.computer || []
  }

  async getNode(name: string): Promise<JenkinsNode> {
    const encodedName = name === 'Built-In Node' ? '(built-in)' : encodeURIComponent(name)
    return this.requestSimple<JenkinsNode>(
      `/computer/${encodedName}/api/json?tree=displayName,offline,executors[currentExecutable[url,timestamp,number,fullDisplayName]]`
    )
  }
  // ─── Queue ────────────────────────────────────────────────────

  async getQueueItems(): Promise<JenkinsQueueItem[]> {
    const data = await this.requestSimple<{ items: JenkinsQueueItem[] }>(
      '/queue/api/json?tree=items[id,inQueueSince,url,why,task[name,url,fullName]]'
    )
    return data.items || []
  }

  async cancelQueueItem(id: number): Promise<void> {
    await this.post(`/queue/cancelItem?id=${id}`)
  }

  // ─── Health Check ─────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      await this.requestSimple('/api/json?tree=mode')
      return true
    } catch {
      return false
    }
  }
}
