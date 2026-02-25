import { useState, useEffect, useCallback, createContext, useContext } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggle: () => {}
})

export function useThemeProvider(): ThemeContextValue {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    window.api.settings.get().then((s) => {
      const t = s.theme || 'dark'
      setThemeState(t)
      applyTheme(t)
    })
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    window.api.settings.set({ theme: t })
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  if (theme === 'light') {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  } else {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }
}

export { ThemeContext }

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
