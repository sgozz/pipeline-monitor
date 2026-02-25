/**
 * Build status notifier.
 * Polls Jenkins for build state changes and sends desktop notifications
 * when builds transition to a terminal state (success, failure, unstable, aborted)
 * or when a pipeline is waiting for input.
 */

import { Notification, BrowserWindow, shell } from 'electron'
import { JenkinsAPI, JenkinsItem, JenkinsPendingInput } from './jenkins-api'
import { getSettings } from './store'

interface BuildState {
  color: string
  lastBuildNumber: number | null
}

/** Track previous states to detect changes */
const previousStates = new Map<string, BuildState>()

/** Track known pending inputs so we don't re-notify */
const notifiedInputs = new Set<string>()

let pollTimer: ReturnType<typeof setInterval> | null = null
let api: JenkinsAPI | null = null
let mainWindow: BrowserWindow | null = null

/** Callbacks for tray icon updates */
type StatusCallback = (status: 'green' | 'red' | 'yellow' | 'blue' | 'gray') => void
const stateChangeCallbacks: StatusCallback[] = []

export function onBuildStateChange(callback: StatusCallback): void {
  stateChangeCallbacks.push(callback)
}

function getApi(): JenkinsAPI | null {
  if (!api) {
    const settings = getSettings()
    if (!settings.jenkinsUrl || !settings.jenkinsUsername || !settings.jenkinsToken) {
      return null
    }
    api = new JenkinsAPI({
      url: settings.jenkinsUrl,
      username: settings.jenkinsUsername,
      token: settings.jenkinsToken
    })
  }
  return api
}

function showNotification(title: string, body: string): void {
  if (!getSettings().showNotifications) return
  const notification = new Notification({ title, body })
  notification.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  notification.show()
}

/** Play a system sound for failure alerts (cross-platform) */
function playFailureSound(): void {
  if (!getSettings().soundAlerts) return
  // Use shell.beep which works on all platforms
  shell.beep()
}

function buildResultLabel(color: string): string | null {
  const base = color?.replace('_anime', '') || ''
  if (color?.endsWith('_anime')) return null // still running, no notification
  switch (base) {
    case 'red':
      return 'FAILED'
    case 'yellow':
      return 'UNSTABLE'
    case 'aborted':
      return 'ABORTED'
    case 'blue':
    case 'green':
      return 'SUCCESS'
    default:
      return null
  }
}

function shortName(fullname: string): string {
  const parts = fullname.split('/')
  return parts.length > 1 ? parts.slice(-2).join('/') : fullname
}

/** Compute the global status from all known items for dynamic tray icon */
function computeGlobalStatus(items: JenkinsItem[]): 'green' | 'red' | 'yellow' | 'blue' | 'gray' {
  let hasRunning = false
  let hasFailed = false
  let hasUnstable = false
  let hasSuccess = false

  for (const item of items) {
    const color = item.color || 'notbuilt'
    const base = color.replace('_anime', '')
    if (color.endsWith('_anime')) hasRunning = true
    if (base === 'red') hasFailed = true
    else if (base === 'yellow') hasUnstable = true
    else if (base === 'blue' || base === 'green') hasSuccess = true
  }

  if (hasFailed) return 'red'
  if (hasRunning) return 'blue'
  if (hasUnstable) return 'yellow'
  if (hasSuccess) return 'green'
  return 'gray'
}

async function checkForChanges(): Promise<void> {
  const client = getApi()
  if (!client) return

  try {
    const items = await client.getAllItems()

    // Update tray icon based on global status
    const globalStatus = computeGlobalStatus(items)
    for (const cb of stateChangeCallbacks) {
      try { cb(globalStatus) } catch { /* ignore */ }
    }

    for (const item of items) {
      const key = item.fullname
      const prev = previousStates.get(key)
      const currentColor = item.color || 'notbuilt'
      const currentBuildNum = item.lastBuild?.number ?? null

      if (!prev) {
        // First time seeing this job — just record state, don't notify
        previousStates.set(key, { color: currentColor, lastBuildNumber: currentBuildNum })
        continue
      }

      // Detect state transition: a build finished (was running, now has result)
      const wasRunning = prev.color?.endsWith('_anime')
      const isNowDone = !currentColor.endsWith('_anime')
      const buildChanged = currentBuildNum !== null && currentBuildNum !== prev.lastBuildNumber

      if ((wasRunning && isNowDone) || (buildChanged && isNowDone)) {
        const resultLabel = buildResultLabel(currentColor)
        if (resultLabel) {
          const emoji =
            resultLabel === 'SUCCESS'
              ? '✅'
              : resultLabel === 'FAILED'
                ? '❌'
                : resultLabel === 'UNSTABLE'
                  ? '⚠️'
                  : '⏹️'
          showNotification(
            `${emoji} Build ${resultLabel}`,
            `${shortName(key)} #${currentBuildNum}`
          )
          // Play sound for failures
          if (resultLabel === 'FAILED' || resultLabel === 'UNSTABLE') {
            playFailureSound()
          }
        }
      }

      previousStates.set(key, { color: currentColor, lastBuildNumber: currentBuildNum })
    }

    // Also check for pending inputs on running builds
    await checkPendingInputs(items)
  } catch {
    // Silently ignore errors — we'll retry next cycle
  }
}

async function checkPendingInputs(items: JenkinsItem[]): Promise<void> {
  const client = getApi()
  if (!client) return

  // Only check builds that are currently paused (PAUSED_PENDING_INPUT shows as blue_anime or similar)
  const runningItems = items.filter((item) => item.color?.endsWith('_anime'))

  for (const item of runningItems) {
    if (!item.lastBuild) continue
    try {
      const inputs = await client.getPendingInputActions(item.fullname, item.lastBuild.number)
      for (const input of inputs) {
        const inputKey = `${item.fullname}:${item.lastBuild.number}:${input.id}`
        if (!notifiedInputs.has(inputKey)) {
          notifiedInputs.add(inputKey)
          showNotification(
            '⏸️ Input Required',
            `${shortName(item.fullname)} #${item.lastBuild.number}: ${input.message}`
          )
          // Notify renderer about pending input
          mainWindow?.webContents.send('jenkins:pending-input', {
            fullname: item.fullname,
            buildNumber: item.lastBuild.number,
            input
          })
        }
      }
    } catch {
      // Ignore — wfapi might not be available for this job
    }
  }
}

export function initNotifier(window: BrowserWindow): void {
  mainWindow = window

  // Start polling after a short delay
  setTimeout(() => {
    checkForChanges()
  }, 10_000)

  // Poll every 30 seconds
  pollTimer = setInterval(checkForChanges, 30_000)
}

export function refreshNotifierApi(): void {
  api = null // Will be re-created on next poll with fresh settings
  previousStates.clear() // Reset to avoid false notifications after config change
  notifiedInputs.clear()
}

export function stopNotifier(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
