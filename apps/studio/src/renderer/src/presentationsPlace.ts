// ─── The Presentations place of the activity rail ───────────────────────────
// ADR "Presentations are a place of the rail": the presentations and their
// slides show in the left panel, in place of the sections, and the slide
// picked on the canvas. While it is open the store is in its sandbox
// (appMode 'presenter', as the Presenter perspective was): a slide shows
// its view, milestone and model, and nothing of the model is saved. It is
// opened over Designer or Viewer, and closing it goes back to that one.

import { create } from 'zustand'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { toggleInspector, useInspectorNav } from './navigation'
import { setLeftCollapsed } from './leftPanelFold'

type From = 'designer' | 'viewer'

const FROM_KEY = 'radical-presentations-from'

/** The perspective the place was opened over, kept for this tab so a
 *  reload stays where it was; a link opened anew (/m/presenter) has Viewer
 *  under it, where presentations are only looked through and played. */
export const usePresentationsFrom = create<{ from: From }>(() => {
  try {
    return { from: sessionStorage.getItem(FROM_KEY) === 'designer' ? 'designer' : 'viewer' }
  } catch {
    return { from: 'viewer' }
  }
})
usePresentationsFrom.subscribe(({ from }) => {
  try { sessionStorage.setItem(FROM_KEY, from) } catch { /* no storage */ }
})

/** Whether the place is open: its sandbox, with the Inspector not over it
 *  and no presentation playing. */
export function usePresentationsOpen(): boolean {
  const presenter = useDiagramStore((s) => s.appMode === 'presenter' && !s.presentationActive)
  const inspector = useInspectorNav((s) => s.open)
  return presenter && !inspector
}

/** Opens the place over the perspective shown, with the left panel open. */
export function openPresentations(): void {
  const s = useDiagramStore.getState()
  if (s.appMode === 'designer' || s.appMode === 'viewer') usePresentationsFrom.setState({ from: s.appMode })
  if (useInspectorNav.getState().open) toggleInspector(false)
  if (s.appMode !== 'presenter') s.setAppMode('presenter')
  setLeftCollapsed(false)
}

/** A click on Designer or Viewer: with the place open it stays open, now
 *  over that perspective (made over Designer, played over Viewer), as the
 *  Inspector stays open across perspectives; else that perspective. */
export function switchPerspective(mode: From): void {
  const s = useDiagramStore.getState()
  if (s.appMode === 'presenter' && !s.presentationActive && !useInspectorNav.getState().open) {
    usePresentationsFrom.setState({ from: mode })
    return
  }
  s.setAppMode(mode)
}

/** Goes back to the perspective the place was opened over. */
export function closePresentations(): void {
  const s = useDiagramStore.getState()
  if (s.appMode === 'presenter') s.setAppMode(usePresentationsFrom.getState().from)
}
