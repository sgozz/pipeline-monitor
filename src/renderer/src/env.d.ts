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
  changeSets?: JenkinsChangeSet[]
}

interface JenkinsChangeSet {
  items: JenkinsCommit[]
}

interface JenkinsCommit {
  commitId: string
  msg: string
  author: { fullName: string }
  timestamp: number
}

interface JenkinsStage {
  id: string
  name: string
  status: string
  startTimeMillis: number
  durationMillis: number
  pauseDurationMillis: number
}

interface JenkinsInputParameter {
  name: string
  type: string
  description?: string
  defaultValue?: string
  choices?: string[]
}

interface JenkinsPendingInput {
  id: string
  message: string
  proceedText?: string
  abortUrl?: string
  proceedUrl?: string
  redirectApprovalUrl?: string
  parameters?: JenkinsInputParameter[]
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

// Test report types
interface JenkinsTestCase {
  name: string
  className: string
  status: string
  duration: number
  errorDetails?: string
  errorStackTrace?: string
}

interface JenkinsTestSuite {
  name: string
  duration: number
  cases: JenkinsTestCase[]
}

interface JenkinsTestReport {
  failCount: number
  passCount: number
  skipCount: number
  totalCount: number
  duration: number
  suites: JenkinsTestSuite[]
}

// Stage log
interface JenkinsStageLog {
  nodeId: string
  nodeStatus: string
  length: number
  hasMore: boolean
  text: string
  consoleUrl: string
}

// Jenkins View
interface JenkinsView {
  name: string
  url: string
  jobs?: { name: string; url: string; fullName?: string; color?: string }[]
}

// Build parameter definitions
interface JenkinsBuildParameterDef {
  name: string
  type: string
  description?: string
  defaultValue?: string
  choices?: string[]
}

interface ServerProfile {
  name: string
  url: string
  username: string
  token: string
}

interface AppSettings {
  jenkinsUrl: string
  jenkinsUsername: string
  jenkinsToken: string
  refreshInterval: number
  showNotifications: boolean
  theme: 'dark' | 'light'
  soundAlerts: boolean
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
        getItemsForFavorites: () => Promise<JenkinsItem[]>
        getItem: (fullname: string) => Promise<JenkinsItem>
        queryItems: (pattern: string) => Promise<JenkinsItem[]>
        getBuild: (fullname: string, number?: number) => Promise<JenkinsBuild>
        getBuildHistory: (fullname: string, limit?: number) => Promise<JenkinsBuild[]>
        getConsoleOutput: (fullname: string, number?: number) => Promise<string>
        getTestReport: (fullname: string, number?: number) => Promise<JenkinsTestReport | null>
        getRunningBuilds: () => Promise<JenkinsRunningBuild[]>
        buildItem: (fullname: string, params?: Record<string, string>) => Promise<{ queueUrl: string }>
        stopBuild: (fullname: string, number: number) => Promise<void>
        getAllNodes: () => Promise<JenkinsNode[]>
        getNode: (name: string) => Promise<JenkinsNode>
        getQueueItems: () => Promise<JenkinsQueueItem[]>
        cancelQueueItem: (id: number) => Promise<void>
        getStages: (fullname: string, number?: number) => Promise<JenkinsStage[]>
        getStageLog: (fullname: string, number: number, nodeId: string) => Promise<JenkinsStageLog>
        getPendingInputs: (fullname: string, number?: number) => Promise<JenkinsPendingInput[]>
        submitInput: (fullname: string, number: number, inputId: string, params?: Record<string, string>) => Promise<void>
        abortInput: (fullname: string, number: number, inputId: string) => Promise<void>
        getViews: () => Promise<JenkinsView[]>
        getBuildParameters: (fullname: string) => Promise<JenkinsBuildParameterDef[]>
      }
      settings: {
        get: () => Promise<AppSettings>
        set: (settings: Partial<AppSettings>) => Promise<AppSettings>
        isConfigured: () => Promise<boolean>
        testConnection: () => Promise<boolean>
        getPinnedFolders: () => Promise<string[]>
        setPinnedFolders: (folders: string[]) => Promise<string[]>
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
      profiles: {
        get: () => Promise<ServerProfile[]>
        save: (profile: ServerProfile) => Promise<ServerProfile[]>
        delete: (name: string) => Promise<ServerProfile[]>
        load: (name: string) => Promise<AppSettings | null>
      }
      onNavigate: (callback: (page: string) => void) => void
      onVisibilityChange: (callback: (visible: boolean) => void) => void
      onPendingInput: (callback: (data: { fullname: string; buildNumber: number; input: JenkinsPendingInput }) => void) => void
      getVersion: () => Promise<string>
    }
  }
}

export {}
