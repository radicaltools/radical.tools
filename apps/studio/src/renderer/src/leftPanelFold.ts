// ─── The left panel: open or folded ──────────────────────────────────────────
//
// Folded by the chevron on its edge, by a click on the rail's open section
// or on the Inspector's lit button, and opened again from the rail. Kept
// across reloads. A store, not App's state: the Inspector's button on the
// rail (Toolbar) folds and opens it as a section's tab does.

import { create } from 'zustand'

const LS_LEFT = 'radical-leftpanel-collapsed'

function load(): boolean {
  try { return localStorage.getItem(LS_LEFT) === '1' } catch { return false }
}

export const useLeftPanelFold = create<{ collapsed: boolean }>(() => ({ collapsed: typeof window !== 'undefined' ? load() : false }))

export function setLeftCollapsed(collapsed: boolean): void {
  if (useLeftPanelFold.getState().collapsed === collapsed) return
  try { localStorage.setItem(LS_LEFT, collapsed ? '1' : '0') } catch { /* private window */ }
  useLeftPanelFold.setState({ collapsed })
}

export function toggleLeftPanel(): void {
  setLeftCollapsed(!useLeftPanelFold.getState().collapsed)
}
