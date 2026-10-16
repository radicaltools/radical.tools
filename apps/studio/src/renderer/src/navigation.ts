// ─── Going to an element ─────────────────────────────────────────────────────
//
// Where Studio shows an element when something outside the canvas points at
// it (Quick Search, the Inspector): the view it opens, the containers it
// expands, the selection and the camera.

import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { useDiagramStore } from '@radical/ui/store/diagramStore'

/** For each view, the elements it shows (viewShownNodes): what its chain
 *  gives, or those it lists and their ancestors. A view that lists none and
 *  is not marked empty shows every element. */
export function viewNodeSets(views: Record<string, DiagramView>, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {}
  for (const v of Object.values(views)) out[v.id] = viewShownNodes(v, nodes, relations) ?? new Set(Object.keys(nodes))
  return out
}

const isCanvas = (v: DiagramView): boolean => !v.kind || v.kind === 'static'

/** The canvas to show `nodeId` on: the active view when it is a canvas that
 *  shows it, else the smallest canvas view that does, else All elements (null). */
export function canvasViewFor(nodeId: string): string | null {
  const { views, c4Nodes, c4Relations, activeViewId } = useDiagramStore.getState()
  const sets = viewNodeSets(views, c4Nodes, c4Relations)
  const active = activeViewId ? views[activeViewId] : undefined
  if (active && isCanvas(active) && sets[active.id]?.has(nodeId)) return active.id
  let best: { id: string; size: number } | null = null
  for (const v of Object.values(views)) {
    if (!isCanvas(v) || !sets[v.id]?.has(nodeId)) continue
    if (!best || sets[v.id].size < best.size) best = { id: v.id, size: sets[v.id].size }
  }
  return best?.id ?? null
}

/** Every canvas view that shows `nodeId`, the smallest first, with how
 *  many elements it shows: the views to choose from. */
export function canvasViewsFor(nodeId: string): Array<{ id: string; name: string; size: number }> {
  const { views, c4Nodes, c4Relations } = useDiagramStore.getState()
  const sets = viewNodeSets(views, c4Nodes, c4Relations)
  return Object.values(views)
    .filter((v) => isCanvas(v) && sets[v.id]?.has(nodeId))
    .map((v) => ({ id: v.id, name: v.name, size: sets[v.id].size }))
    .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name))
}

/** A wiki view with a page for `nodeId`, or null when the model has none. */
export function wikiViewFor(nodeId: string): string | null {
  const { views, c4Nodes, c4Relations } = useDiagramStore.getState()
  const sets = viewNodeSets(views, c4Nodes, c4Relations)
  const wikis = Object.values(views).filter((v) => v.kind === 'wiki' && sets[v.id]?.has(nodeId))
  wikis.sort((a, b) => sets[a.id].size - sets[b.id].size)
  return wikis[0]?.id ?? null
}

type FocusFn = (id: string, opts?: { zoom?: number; duration?: number }) => void
const FOCUS_ZOOM = 1.2

/** Designer, on the canvas that shows `nodeId` (or on `viewId`, one the
 *  user chose; null for All elements), with it selected, its containers
 *  open and the camera on it. */
export function revealOnCanvas(nodeId: string, viewId?: string | null): void {
  if (useDiagramStore.getState().appMode !== 'designer') useDiagramStore.getState().setAppMode('designer')
  const target = viewId !== undefined ? viewId : canvasViewFor(nodeId)
  const store = useDiagramStore.getState()
  const switching = store.activeViewId !== target
  if (switching) store.setActiveView(target)
  // After a view switch or a perspective change React Flow mounts its nodes
  // again: select once the store has settled, and move the camera once the
  // node is on the canvas, or it cannot find it.
  setTimeout(() => {
    const s = useDiagramStore.getState()
    s.expandAncestors(nodeId)
    s.setSelectedNodeIds([nodeId])
    s.selectNode(nodeId)
    ;(window as unknown as { __radicalExpandRightPanel?: () => void }).__radicalExpandRightPanel?.()
    // The canvas registers its camera function when it mounts, so right
    // after the switch the one on window may still be the unmounted
    // canvas's: try again until the camera is there.
    const w = window as unknown as { __rfFocusNode?: FocusFn; __rfCurrentViewport?: { zoom: number } }
    const started = Date.now()
    const focus = (): void => {
      if (typeof document === 'undefined') return
      const drawn = document.querySelector(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
      if (drawn && w.__rfFocusNode) w.__rfFocusNode(nodeId, { zoom: FOCUS_ZOOM, duration: 400 })
      if (Date.now() - started > 4000) return
      setTimeout(() => {
        if (Math.abs((w.__rfCurrentViewport?.zoom ?? 0) - FOCUS_ZOOM) > 0.01) focus()
      }, drawn ? 500 : 100)
    }
    requestAnimationFrame(focus)
  }, switching ? 150 : 60)
}

/** Designer, on the page of `nodeId` in a wiki view; false when no wiki
 *  view has one. */
export function openWikiPage(nodeId: string): boolean {
  const viewId = wikiViewFor(nodeId)
  if (!viewId) return false
  if (useDiagramStore.getState().appMode !== 'designer') useDiagramStore.getState().setAppMode('designer')
  const store = useDiagramStore.getState()
  store.setActiveView(viewId)
  store.setWikiFocus(viewId, nodeId)
  store.selectNode(nodeId)
  return true
}
