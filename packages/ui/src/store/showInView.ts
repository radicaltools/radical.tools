// ─── Showing an element on a view ────────────────────────────────────────────
//
// What opening a view for an element does (Quick Search, the properties
// card's Views, the Inspector): the view, the element's page on it, its
// containers open, the selection and the camera.

import { create } from 'zustand'
import { useDiagramStore } from './diagramStore'

/** The last time an element was asked to be shown: the views that are lists
 *  (table, wiki, Warnier) scroll it into sight on each ask, also when the
 *  view and the selection stay as they were (a second click on the open
 *  view in the card's Views). */
export const useShowRequest = create<{ nodeId: string | null; seq: number }>()(() => ({ nodeId: null, seq: 0 }))

/** The properties card: `requested` once it is asked for (a double-click on
 *  an element, a relation or a row; Quick Search, the Inspector, a wiki
 *  page's [properties]), until ✕ or nothing is selected; a click only
 *  selects, and an open card follows it. `open` says whether it is open
 *  over the view (RightPanel sets it): a wiki takes an open card along to
 *  the page read, and leaves a closed one closed. */
export const useCardOpen = create<{ open: boolean; requested: boolean }>()(() => ({ open: false, requested: false }))

/** Opens the properties card on what is selected. */
export function openCard(): void {
  useCardOpen.setState({ requested: true })
}

/** Puts `nodeId` in sight on a view picked for it: the wiki shows its page,
 *  the hierarchy the level that draws it, a table or Warnier scrolls to it.
 *  A pick there selected the element and stayed on the Overview, or on a
 *  level that did not draw it. */
export function showOnPage(viewId: string | null, nodeId: string): void {
  useShowRequest.setState((r) => ({ nodeId, seq: r.seq + 1 }))
  const store = useDiagramStore.getState()
  const view = viewId ? store.views[viewId] : undefined
  if (!view) return
  if (view.kind === 'wiki') {
    if (store.slideWikiPage) useDiagramStore.setState({ slideWikiPage: null })
    if ((view.wikiFocusId ?? null) !== nodeId) store.setWikiFocus(view.id, nodeId)
    return
  }
  if (view.kind !== 'treemap') return
  const nodes = store.c4Nodes
  const focusId = store.slideTreemapFocus?.viewId === view.id ? store.slideTreemapFocus.focusId : (view.treemapFocusId ?? null)
  const maxDepth = view.treemapMaxDepth === null ? Infinity : (typeof view.treemapMaxDepth === 'number' && view.treemapMaxDepth > 0 ? view.treemapMaxDepth : 2)
  // How many levels below the focus the element is (Infinity: not under it).
  let depth = 0
  let cur: string | undefined = nodeId
  while (cur && cur !== focusId) { cur = nodes[cur]?.parentId; depth++ }
  if (focusId !== null && cur !== focusId) depth = Infinity
  if (depth >= 1 && depth <= maxDepth) return
  if (store.slideTreemapFocus) useDiagramStore.setState({ slideTreemapFocus: null })
  store.setTreemapFocus(view.id, nodes[nodeId]?.parentId ?? null)
}

type FocusFn = (id: string, opts?: { zoom?: number; duration?: number }) => void
const FOCUS_ZOOM = 1.2

/** Moves the camera onto `nodeId` once the canvas draws it. The canvas
 *  registers its camera function when it mounts, so right after a view
 *  switch the one on window may still be the unmounted canvas's: it tries
 *  again until the camera is there. A view that is no canvas never draws
 *  it, and it gives up after a few seconds. */
export function focusWhenDrawn(nodeId: string): void {
  if (typeof document === 'undefined') return
  const w = window as unknown as { __rfFocusNode?: FocusFn; __rfCurrentViewport?: { zoom: number } }
  const started = Date.now()
  const focus = (): void => {
    const drawn = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
    if (drawn && w.__rfFocusNode) w.__rfFocusNode(nodeId, { zoom: FOCUS_ZOOM, duration: 400 })
    if (Date.now() - started > 4000) return
    setTimeout(() => {
      if (Math.abs((w.__rfCurrentViewport?.zoom ?? 0) - FOCUS_ZOOM) > 0.01) focus()
    }, drawn ? 500 : 100)
  }
  requestAnimationFrame(focus)
}

/** Opens view `viewId` (null: All elements) with `nodeId` selected, its
 *  containers open, its page shown and the camera on it, in the mode the
 *  app is in. A view switch clears the selection, so it selects after it. */
export function showNodeInView(nodeId: string, viewId: string | null): void {
  const store = useDiagramStore.getState()
  if (store.activeViewId !== viewId) store.setActiveView(viewId)
  const s = useDiagramStore.getState()
  s.expandAncestors(nodeId)
  showOnPage(viewId, nodeId)
  s.setSelectedNodeIds([nodeId])
  s.selectNode(nodeId)
  focusWhenDrawn(nodeId)
}
