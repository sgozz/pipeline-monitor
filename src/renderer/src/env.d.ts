/// <reference types="vite/client" />

interface JenkinsItem {
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

interface JenkinsBuild {
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

interface JenkinsStage {
  id: string
  name: string
  status: string
  startTimeMillis: number
  durationMillis: number
  pauseDurationMillis: number
}

interface JenkinsRunningBuild {
  number: number
  url: string
  timestamp: number
  building: boolean | null
}

interface JenkinsNode {
  displayName: string
  offline: boolean
  executors?: JenkinsExecutor[]
}

interface JenkinsExecutor {
  currentExecutable?: {
    url: string
    timestamp: number
    number: number
    fullDisplayName: string
  }
}

interface JenkinsQueueItem {
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

interface AppSettings {
  jenkinsUrl: string
  jenkinsUsername: string
  jenkinsToken: string
  refreshInterval: number
  showNotifications: boolean
}

interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
  version?: string
  progress?: number
  error?: string
}

declare global {
  interface Window {
    api: {
      jenkins: {
        getAllItems: () => Promise<JenkinsItem[]>
        getItem: (fullname: string) => Promise<JenkinsItem>
        queryItems: (pattern: string) => Promise<JenkinsItem[]>
        getBuild: (fullname: string, number?: number) => Promise<JenkinsBuild>
        getBuildHistory: (fullname: string, limit?: number) => Promise<JenkinsBuild[]>
        getConsoleOutput: (fullname: string, number?: number) => Promise<string>
        getTestReport: (fullname: string, number?: number) => Promise<Record<string, unknown> | null>
        getRunningBuilds: () => Promise<JenkinsRunningBuild[]>
        buildItem: (fullname: string, params?: Record<string, string>) => Promise<{ queueUrl: string }>
        stopBuild: (fullname: string, number: number) => Promise<void>
        getAllNodes: () => Promise<JenkinsNode[]>
        getNode: (name: string) => Promise<JenkinsNode>
        getQueueItems: () => Promise<JenkinsQueueItem[]>
        cancelQueueItem: (id: number) => Promise<void>
        getStages: (fullname: string, number?: number) => Promise<JenkinsStage[]>
      }
      settings: {
        get: () => Promise<AppSettings>
        set: (settings: Partial<AppSettings>) => Promise<AppSettings>
        isConfigured: () => Promise<boolean>
        testConnection: () => Promise<boolean>
      }
      favorites: {
        get: () => Promise<string[]>
        toggle: (fullname: string) => Promise<string[]>
      }
      updater: {
        getStatus: () => Promise<UpdateStatus>
        check: () => Promise<void>
        install: () => Promise<void>
        onStatus: (callback: (status: UpdateStatus) => void) => void
      }
      onNavigate: (callback: (page: string) => void) => void
    }
  }
}

export {}
