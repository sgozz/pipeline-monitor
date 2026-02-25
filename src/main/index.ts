import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { isConfigured, getSettings } from './store'
import { initAutoUpdater } from './updater'
import { initNotifier, onBuildStateChange } from './notifier'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Notify renderer when window visibility changes (for polling pause)
  mainWindow.on('show', () => {
    mainWindow?.webContents.send('app:visibility', true)
  })
  mainWindow.on('hide', () => {
    mainWindow?.webContents.send('app:visibility', false)
  })
  mainWindow.on('minimize', () => {
    mainWindow?.webContents.send('app:visibility', false)
  })
  mainWindow.on('restore', () => {
    mainWindow?.webContents.send('app:visibility', true)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTrayIcon(): nativeImage {
  // In production: extraResources are in process.resourcesPath
  // In dev: use the build directory directly
  const trayPath = is.dev
    ? join(__dirname, '../../build/trayTemplate.png')
    : join(process.resourcesPath, 'trayTemplate.png')
  const image = nativeImage.createFromPath(trayPath)
  image.setTemplateImage(true)
  return image
}

/**
 * Create a colored circle icon for the tray (16x16).
 * Used for dynamic tray icon based on global build status.
 */
function createColoredTrayIcon(color: 'green' | 'red' | 'yellow' | 'blue' | 'gray'): nativeImage {
  const colorMap: Record<string, string> = {
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    blue: '#3b82f6',
    gray: '#64748b'
  }
  const hex = colorMap[color] || colorMap.gray
  // Create a simple 16x16 data URL with a colored circle
  const size = 16
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${hex}"/></svg>`
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const img = nativeImage.createFromDataURL(dataUrl)
  return img
}

let lastTrayStatus: string = ''

function updateTrayIcon(status: 'green' | 'red' | 'yellow' | 'blue' | 'gray'): void {
  if (!tray || status === lastTrayStatus) return
  lastTrayStatus = status
  if (process.platform === 'darwin') {
    // On macOS, use template images for dark/light menu bar
    // Colored icons don't look great as template, so we set them non-template
    const icon = createColoredTrayIcon(status)
    icon.setTemplateImage(false)
    tray.setImage(icon)
  } else {
    tray.setImage(createColoredTrayIcon(status))
  }
}

function createTray(): void {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('Jenkins UI')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: (): void => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Open Jenkins',
      click: (): void => {
        const settings = getSettings()
        if (settings.jenkinsUrl) {
          shell.openExternal(settings.jenkinsUrl)
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Show window on tray click (macOS)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cosmica.jenkins-ui')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()
  createTray()
  initAutoUpdater(mainWindow!)
  initNotifier(mainWindow!)

  // Dynamic tray icon: listen for build state changes
  onBuildStateChange((globalStatus) => {
    updateTrayIcon(globalStatus)
  })

  // If not configured, show settings immediately
  if (!isConfigured()) {
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('navigate', 'settings')
    })
  }

  app.on('activate', () => {
    mainWindow?.show()
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  // Keep running in tray
})

// Extend app types for isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
