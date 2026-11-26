// ─── Going to an element ─────────────────────────────────────────────────────
//
// Where Studio shows an element when something outside the canvas points at
// it (Quick Search, the Inspector panel): the view it opens, the containers it
// expands, the selection and the camera.

import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { isViewGroup } from '@radical/common/model'
import { create } from 'zustand'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { focusWhenDrawn, openCard, showOnPage } from '@radical/ui/store/showInView'

export { showOnPage }

/** The Inspector's tabs. Its Settings are Inspector settings… in the Settings
 *  menu now (CheckSettingsDialog). */
export type InspectorTab = 'overview' | 'model' | 'implementation' | 'measurements' | 'debt' | 'branch'
export const INSPECTOR_TABS: readonly InspectorTab[] = ['overview', 'model', 'implementation', 'measurements', 'debt', 'branch']

/** The tab a link names: its own name, or the name it had before (Changes
 *  is This branch now); undefined for none. */
export function inspectorTabOf(name: string | undefined): InspectorTab | undefined {
  if (name === 'changes') return 'branch'
  return (INSPECTOR_TABS as readonly string[]).includes(name ?? '') ? (name as InspectorTab) : undefined
}

const LS_INSPECTOR = 'radical-inspector-panel'

interface InspectorNav {
  /** The panel is open: slid up from the status bar over the whole view
   *  area (in Designer, Viewer and Presenter). */
  open: boolean
  /** The tab picked (null: its first, Overview). Part of the route while open. */
  tab: InspectorTab | null
  /** The element whose verification path it shows. Part of the route while open. */
  trace: string | null
}

function loadOpen(): boolean {
  try {
    return (JSON.parse(localStorage.getItem(LS_INSPECTOR) ?? '{}') as { open?: unknown }).open === true
  } catch {
    return false
  }
}

/** Where the Inspector panel is: open or folded, its tab and the
 *  verification path on screen. Open or folded is kept across perspectives
 *  and reloads, as the left panel is. */
export const useInspectorNav = create<InspectorNav>(() => ({ open: loadOpen(), tab: null, trace: null }))

if (typeof window !== 'undefined') {
  useInspectorNav.subscribe((s, p) => {
    if (s.open === p.open) return
    try { localStorage.setItem(LS_INSPECTOR, JSON.stringify({ open: s.open })) } catch { /* private window */ }
  })
}

/** Opens or closes the Inspector panel. */
export function toggleInspector(open = !useInspectorNav.getState().open): void {
  useInspectorNav.setState(open ? { open } : { open, trace: null })
}

/** For each view, the elements it shows (viewShownNodes): what its chain
 *  gives, or those it lists and their ancestors. A view that lists none and
 *  is not marked empty shows every element. A group of views per element
 *  has none: its views show them, and it is never a canvas of its own. */
export function viewNodeSets(views: Record<string, DiagramView>, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel: Metamodel | undefined): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {}
  for (const v of Object.values(views)) {
    if (isViewGroup(v, metamodel)) continue
    out[v.id] = viewShownNodes(v, nodes, relations) ?? new Set(Object.keys(nodes))
  }
  return out
}

/** A move that changes several things in turn (the perspective, the view,
 *  then the selection: showElement) is one place to go back from: while
 *  it is held, the address waits (route.ts). Show on canvas from an
 *  Inspector card made two Back steps. */
export const usePlaceHold = create<{ held: number }>(() => ({ held: 0 }))

/** How readily a view of this kind shows a picked element: a diagram (a
 *  structure view) first, then a table, wiki, hierarchy or Warnier view,
 *  then a matrix or flow. The smallest view had it, a matrix or flow too. */
export function pickRank(view: DiagramView): number {
  const kind = view.kind ?? 'static'
  if (kind === 'static') return 0
  if (kind === 'matrix' || kind === 'dynamic') return 2
  return 1
}

/** The view a Quick Search pick of `nodeId` opens: the active one when it
 *  shows it, else the first by pickRank, the smallest within a rank; null
 *  (All elements) when no view shows it or All elements is shown. For a
 *  relation, `nodeId` is both its ends: a view that shows only one does not
 *  draw it (item 245 opened one by its source alone). */
export function pickViewFor(nodeId: string | readonly string[], activeViewId: string | null, views: Record<string, DiagramView>, sets: Record<string, Set<string>>): string | null {
  // All elements (no active view) shows every element: stay on it.
  if (!activeViewId) return null
  const ids = typeof nodeId === 'string' ? [nodeId] : nodeId
  const shows = (set: Set<string> | undefined): boolean => !!set && ids.every((id) => set.has(id))
  if (shows(sets[activeViewId])) return activeViewId
  let best: { id: string; rank: number; size: number } | null = null
  for (const v of Object.values(views)) {
    const set = sets[v.id]
    if (!shows(set)) continue
    const rank = pickRank(v)
    if (!best || rank < best.rank || (rank === best.rank && set.size < best.size)) best = { id: v.id, rank, size: set.size }
  }
  return best?.id ?? null
}

/** A model just opened (from a file, a folder, a list, a Hub link) shows
 *  its first view in model order, rather than All elements, the table of
 *  everything, which it landed on. All elements stays when it has no view,
 *  when it has no element (a new model: the table offers its + row), or
 *  when a view is shown already (the address named one). */
export function openFirstView(): void {
  const store = useDiagramStore.getState()
  if (store.activeViewId || !Object.keys(store.c4Nodes).length) return
  const first = Object.values(store.views).find((v) => !isViewGroup(v, store.metamodel))
  if (first) store.setActiveView(first.id)
}

/** Shows `nodeId` in the perspective open, as a Quick Search pick does: on
 *  the active view when it shows it, else on the view pickViewFor picks (a
 *  canvas first), with it selected, its containers open, its properties
 *  card open and the camera on it. Presenter has no card: it goes to
 *  Viewer, which changes nothing either. The Inspector panel's links. False
 *  (said in a notice) when the model shown lacks it: a milestone shown. */
export function showElement(nodeId: string): boolean {
  const start = useDiagramStore.getState()
  if (!start.c4Nodes[nodeId]) {
    start.pushNotification('The milestone shown has no such element: it is the live model\'s. Go back to the current model to see it.', 'warning')
    return false
  }
  usePlaceHold.setState((h) => ({ held: h.held + 1 }))
  if (start.appMode !== 'designer' && start.appMode !== 'viewer') start.setAppMode('viewer')
  const store = useDiagramStore.getState()
  const { views, c4Nodes, c4Relations, metamodel, activeViewId } = store
  const target = pickViewFor(nodeId, activeViewId, views, viewNodeSets(views, c4Nodes, c4Relations, metamodel))
  const switching = store.activeViewId !== target
  if (switching) store.setActiveView(target)
  // After a view switch or a perspective change React Flow mounts its nodes
  // again: select once the store has settled, and move the camera once the
  // node is on the canvas, or it cannot find it.
  setTimeout(() => {
    const s = useDiagramStore.getState()
    try {
      s.expandAncestors(nodeId)
      showOnPage(target, nodeId)
      s.setSelectedNodeIds([nodeId])
      s.selectNode(nodeId)
      openCard()
    } finally {
      usePlaceHold.setState((h) => ({ held: Math.max(0, h.held - 1) }))
    }
    focusWhenDrawn(nodeId)
  }, switching ? 150 : 60)
  return true
}
