// ─── Theme ──────────────────────────────────────────────────────────────────
// Light, Dark or System (the operating system's appearance, followed as it
// changes), kept in this browser's localStorage under `radical-theme`. The
// Settings menu and the Setup wizard both write it; every reader hears the
// change through THEME_CHANGED_EVENT. Inside VS Code the editor's theme wins
// (useDrawnTheme), and nothing is stored.

import { useEffect, useState } from 'react'
import { host } from './platform/host'

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

/** VS Code's theme, from the classes it gives the webview's body. */
function vscodeTheme(): Theme {
  return document.body.classList.contains('vscode-light') ? 'light' : 'dark'
}

/** The theme Studio draws now: the editor's inside VS Code, which follows
 *  it as it changes, else the one chosen in this browser. */
export function useDrawnTheme(): Theme {
  const isVSCode = host().kind === 'vscode'
  const { theme: chosen } = useThemePref()
  const [editor, setEditor] = useState<Theme>(() => (isVSCode ? vscodeTheme() : 'dark'))
  useEffect(() => {
    if (!isVSCode) return
    const obs = new MutationObserver(() => setEditor(vscodeTheme()))
    obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] })
    return () => obs.disconnect()
  }, [isVSCode])
  return isVSCode ? editor : chosen
}

/** Draws Studio in its theme (html[data-theme]). App's own: it stays mounted
 *  while a presentation plays, where the toolbar, which set it before, is
 *  gone, and Studio stayed dark though the system had turned light. */
export function useApplyTheme(): void {
  const theme = useDrawnTheme()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
}
