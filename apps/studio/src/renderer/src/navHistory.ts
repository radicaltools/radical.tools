// ─── Navigation history ──────────────────────────────────────────────────────
//
// Back and forward are the window's history of routes (route.ts pushes one
// for each place). A page cannot read that history, so Studio keeps beside
// it the routes it pushed, with what they show, to name the places in the
// tooltips of ‹ › and in the History list. Each history entry carries its
// index in this list (`history.state.navIndex`), so going back or forward,
// by any means, moves the list's index with it. The list lives in the
// window's sessionStorage: it survives a reload and goes with the tab, and
// never reaches the model.

import { create } from 'zustand'

/** One place in the history, as the History list shows it. */
export interface NavEntry {
  hash: string
  /** The view, or the Inspector's tab: "Architecture", "Inspector › Changes". */
  where: string
  /** The perspective: Designer, Viewer, Presenter, Metamodel, Inspector. */
  mode: string
  /** The element selected there, or whose card is open. */
  element?: { label: string; type: string; color?: string }
  /** When the place was first shown (ms). */
  at: number
}

export interface NavState {
  entries: NavEntry[]
  /** The entry on screen. */
  index: number
}

/** At most this many places are kept, the oldest going first: as many as
 *  Chrome and Firefox keep in a tab's history, so every place listed can
 *  still be gone back to. */
export const MAX_ENTRIES = 50

/** `entry` after the current place: what was ahead of it goes. */
export function pushEntry(state: NavState, entry: NavEntry): NavState {
  const kept = state.entries.slice(0, state.index + 1)
  kept.push(entry)
  const over = Math.max(0, kept.length - MAX_ENTRIES)
  return { entries: kept.slice(over), index: kept.length - 1 - over }
}

/** `entry` in place of the current one (the same place, written again). */
export function replaceEntry(state: NavState, entry: NavEntry): NavState {
  if (!state.entries.length) return { entries: [entry], index: 0 }
  const entries = state.entries.slice()
  // Keep when the place was first shown.
  entries[state.index] = { ...entry, at: entries[state.index].at }
  return { entries, index: state.index }
}

/** The list once the history is at entry `index` (back, forward, or a pick). */
export function moveTo(state: NavState, index: number): NavState {
  if (index < 0 || index >= state.entries.length) return state
  return { entries: state.entries, index }
}

export const useNavHistory = create<NavState>(() => ({ entries: [], index: 0 }))

/** One step back or forward, or to entry `index`: the window's history does
 *  it, and the route it lands on is applied by route.ts. */
export function goBack(): void {
  if (useNavHistory.getState().index > 0) history.back()
}

export function goForward(): void {
  const { index, entries } = useNavHistory.getState()
  if (index < entries.length - 1) history.forward()
}

export function goTo(index: number): void {
  const delta = index - useNavHistory.getState().index
  if (delta) history.go(delta)
}

/** "2 min ago", for the History list. */
export function sinceText(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 10) return 'now'
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

const STORAGE_KEY = 'radical-nav-history'

/** Keeps the list for a reload of this window. */
export function saveNav(state: NavState, storage: Pick<Storage, 'setItem'> | undefined = sessionStorageOrUndefined()): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* private mode, quota: the list goes with the page */ }
}

/** The list kept before a reload, at the entry the history is on (`index`,
 *  from history.state), when that entry is still the address shown. */
export function restoreNav(hash: string, index: number | undefined, storage: Pick<Storage, 'getItem'> | undefined = sessionStorageOrUndefined()): NavState | null {
  let saved: NavState | null = null
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null') as NavState | null } catch { return null }
  if (!saved || !Array.isArray(saved.entries) || index === undefined || index < 0 || index >= saved.entries.length) return null
  if (saved.entries[index]?.hash !== hash) return null
  return { entries: saved.entries, index }
}

function sessionStorageOrUndefined(): Storage | undefined {
  try { return typeof sessionStorage === 'undefined' ? undefined : sessionStorage } catch { return undefined }
}
