import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
  version?: string
  progress?: number
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

  // Configuration
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Events
  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({
      status: 'downloading',
      progress: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendStatus({ status: 'ready', version: info.version })
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

export function installUpdate(): void {
  // Set isQuitting so the close handler doesn't intercept and hide to tray
  app.isQuitting = true
  // Clear window reference before closing to prevent 'destroyed' errors
  mainWindow = null
  // Force-close all windows so nothing blocks the quit
  for (const win of BrowserWindow.getAllWindows()) {
    win.removeAllListeners('close')
    win.close()
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
}
