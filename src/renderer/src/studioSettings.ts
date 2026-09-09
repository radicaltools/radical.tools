// ─── Studio-wide app settings ────────────────────────────────────────────────
// Global preferences that apply across every document, persisted in this
// browser's localStorage (not embedded in the .radical file itself) — mirrors
// the pattern in ai/settings.ts, including the change-broadcast event so any
// mounted view can pick up a live update without a full reload.

export const STUDIO_SETTINGS_KEY = 'radical-studio-settings'
export const STUDIO_SETTINGS_CHANGED_EVENT = 'radical:studio-settings-changed'

export const WIKI_MULTI_PAGE_DEPTH_MIN = 1
export const WIKI_MULTI_PAGE_DEPTH_MAX = 5

export interface StudioSettings {
  /** Wiki "Multi page" mode: how many levels of children get their full
   *  page content embedded inline before falling back to preview cards.
   *  1 = parent + direct children only (the original, fixed behaviour). */
  wikiMultiPageDepth: number
}

export function defaultStudioSettings(): StudioSettings {
  return { wikiMultiPageDepth: WIKI_MULTI_PAGE_DEPTH_MIN }
}

export function normalizeStudioSettings(raw: unknown): StudioSettings {
  const base = defaultStudioSettings()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<StudioSettings>
  const depth = typeof r.wikiMultiPageDepth === 'number' && Number.isFinite(r.wikiMultiPageDepth)
    ? Math.floor(r.wikiMultiPageDepth)
    : base.wikiMultiPageDepth
  return {
    wikiMultiPageDepth: Math.min(WIKI_MULTI_PAGE_DEPTH_MAX, Math.max(WIKI_MULTI_PAGE_DEPTH_MIN, depth)),
  }
}

interface MinimalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getStorage(): MinimalStorage | null {
  try {
    const ls = (globalThis as { localStorage?: MinimalStorage }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

export function loadStudioSettings(storage?: MinimalStorage | null): StudioSettings {
  const ls = storage === undefined ? getStorage() : storage
  if (!ls) return defaultStudioSettings()
  try {
    const raw = ls.getItem(STUDIO_SETTINGS_KEY)
    if (!raw) return defaultStudioSettings()
    return normalizeStudioSettings(JSON.parse(raw))
  } catch {
    return defaultStudioSettings()
  }
}

export function saveStudioSettings(settings: StudioSettings, storage?: MinimalStorage | null): void {
  const ls = storage === undefined ? getStorage() : storage
  if (!ls) return
  try {
    ls.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* quota or similar — silently ignore */
  }
}
