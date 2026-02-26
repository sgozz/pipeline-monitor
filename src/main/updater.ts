import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'error'
  version?: string
  downloadUrl?: string
  error?: string
}

let currentStatus: UpdateStatus = { status: 'idle' }
let mainWindow: BrowserWindow | null = null

function sendStatus(status: UpdateStatus): void {
  currentStatus = status
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', status)
    }
  } catch {
    // Window may have been destroyed during quit — ignore
  }
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  // Don't check for updates in dev mode
  if (is.dev) {
    return
  }

  // Disable auto-download — we just notify the user
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // Events
  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const downloadUrl = `https://github.com/sgozz/pipeline-monitor/releases/tag/v${info.version}`
    sendStatus({ status: 'available', version: info.version, downloadUrl })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('error', (err) => {
    sendStatus({ status: 'error', error: err.message })
  })

  // Check on startup (after a short delay to not block the UI)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // Check periodically (every 30 minutes)
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    30 * 60 * 1000
  )
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch(() => {})
}

export function openDownloadPage(): void {
  if (currentStatus.downloadUrl) {
    shell.openExternal(currentStatus.downloadUrl)
  } else {
    shell.openExternal('https://github.com/sgozz/pipeline-monitor/releases/latest')
  }
}
