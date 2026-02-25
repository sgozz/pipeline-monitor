import { useEffect, useCallback } from 'react'

export interface ShortcutHandlers {
  onSearch?: () => void
  onRefresh?: () => void
  onBack?: () => void
  onGoToDashboard?: () => void
  onGoToNodes?: () => void
  onGoToQueue?: () => void
  onGoToSettings?: () => void
}

/**
 * Global keyboard shortcuts hook.
 * - Cmd/Ctrl+K: Focus search (onSearch)
 * - Cmd/Ctrl+R: Refresh current view (onRefresh)
 * - Escape: Go back (onBack)
 * - Cmd/Ctrl+1: Dashboard
 * - Cmd/Ctrl+2: Nodes
 * - Cmd/Ctrl+3: Queue
 * - Cmd/Ctrl+,: Settings
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'

      if (mod && e.key === 'k') {
        e.preventDefault()
        handlers.onSearch?.()
        return
      }

      if (mod && e.key === 'r') {
        e.preventDefault()
        handlers.onRefresh?.()
        return
      }

      if (e.key === 'Escape' && !isInput) {
        e.preventDefault()
        handlers.onBack?.()
        return
      }

      if (mod && e.key === '1') {
        e.preventDefault()
        handlers.onGoToDashboard?.()
        return
      }

      if (mod && e.key === '2') {
        e.preventDefault()
        handlers.onGoToNodes?.()
        return
      }

      if (mod && e.key === '3') {
        e.preventDefault()
        handlers.onGoToQueue?.()
        return
      }

      if (mod && e.key === ',') {
        e.preventDefault()
        handlers.onGoToSettings?.()
        return
      }
    },
    [handlers]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
