import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { isConfigured } from './store'
import { initAutoUpdater } from './updater'

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
  // Create a simple tray icon (16x16 for macOS)
  // Using a template image for proper dark/light mode support on macOS
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)

  // Draw a simple "J" shape in white
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      let alpha = 0

      // Top bar of J (y: 2-4, x: 3-12)
      if (y >= 2 && y <= 4 && x >= 3 && x <= 12) alpha = 255
      // Vertical bar (y: 2-11, x: 8-10)
      if (y >= 2 && y <= 11 && x >= 8 && x <= 10) alpha = 255
      // Bottom curve (y: 10-13, x: 3-10)
      if (y >= 10 && y <= 12 && x >= 3 && x <= 10) alpha = 255
      // Left edge of curve (y: 8-11, x: 3-5)
      if (y >= 8 && y <= 11 && x >= 3 && x <= 5) alpha = 255

      canvas[idx] = 0 // R
      canvas[idx + 1] = 0 // G
      canvas[idx + 2] = 0 // B
      canvas[idx + 3] = alpha // A
    }
  }

  const image = nativeImage.createFromBuffer(canvas, { width: size, height: size })
  image.setTemplateImage(true)
  return image
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
        const { getSettings } = require('./store')
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
