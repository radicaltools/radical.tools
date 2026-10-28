// ─── Theme ──────────────────────────────────────────────────────────────────
// Light, Dark or System (the operating system's appearance, followed as it
// changes), kept in this browser's localStorage under `radical-theme`. The
// Settings menu and the Setup wizard both write it; every reader hears the
// change through THEME_CHANGED_EVENT. Inside VS Code the editor's theme wins
// (Toolbar), and nothing is stored.

import { useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const LS_THEME = 'radical-theme'
export const THEME_CHANGED_EVENT = 'radical:theme-changed'

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(LS_THEME)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePref(pref: ThemePref): void {
  try { localStorage.setItem(LS_THEME, pref) } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT))
}

const LIGHT_QUERY = '(prefers-color-scheme: light)'

export function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark'
}

/** The theme chosen and the one it draws now; follows the system for System. */
export function useThemePref(): { pref: ThemePref; theme: Theme } {
  const [pref, setPref] = useState<ThemePref>(loadThemePref)
  const [system, setSystem] = useState<Theme>(systemTheme)
  useEffect(() => {
    const reload = (): void => setPref(loadThemePref())
    window.addEventListener(THEME_CHANGED_EVENT, reload)
    const mq = window.matchMedia?.(LIGHT_QUERY)
    const onSystem = (): void => setSystem(systemTheme())
    mq?.addEventListener('change', onSystem)
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, reload)
      mq?.removeEventListener('change', onSystem)
    }
  }, [])
  return { pref, theme: pref === 'system' ? system : pref }
}
