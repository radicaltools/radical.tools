// ─── Follow the agent ────────────────────────────────────────────────────────
//
// Switched on in the view of an agent's Forge run (AgentForgeModal). Each
// change made outside Studio opens a view that shows what the agent added or
// changed, and frames what its turn has done there. Only views that show some
// elements count, never All elements or a view of every element, where an
// element is one row among hundreds. An element no such view shows yet (a
// Forge stage files its elements into the views when it completes) waits
// until one does; until then Studio stays where it is. A turn is the agent's
// writes with less than AGENT_ACTIVE_MS between them. The user's own camera
// move or view switch pauses following until the next turn; it switches off
// when the run finishes or stops. Nothing is saved. Imported for its side
// effects by main.tsx (and by the test setup).

import { create } from 'zustand'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'
import { AGENT_ACTIVE_MS } from '@radical/common/formats/agentActivity'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { computeSnapDiff, useDiagramStore } from '@radical/ui/store/diagramStore'
import { onUserCamera } from '@radical/ui/store/userCamera'
import { loadingDocumentId, onOutsideEditLoaded } from './autosave'
import { agentForgePhase, useAgentForgeStore } from './agentForge'

interface FollowAgentState {
  on: boolean
}

export const useFollowAgentStore = create<FollowAgentState>(() => ({ on: false }))

let quietMs = AGENT_ACTIVE_MS

/** How long the agent must be quiet for its next write to start a new turn
 *  (tests shorten it). */
export function setFollowAgentQuiet(ms: number): void {
  quietMs = ms
}

/** What the agent's turn has added and changed: element ids. */
let turn = new Set<string>()
/** What the agent added or changed that no view has shown yet. */
let unseen = new Set<string>()
/** When the last outside change came in. */
let lastEdit = 0
/** The user took the camera or the view during this turn. */
let paused = false
/** The view switch is following's own, not the user's. */
let switching = false
/** The framing waiting for the canvas to draw the view. */
let frameTimer: ReturnType<typeof setTimeout> | null = null

export function setFollowAgent(on: boolean): void {
  turn = new Set()
  unseen = new Set()
  paused = false
  useFollowAgentStore.setState({ on })
}

const CANVAS_KINDS = new Set<DiagramView['kind']>([undefined, 'static', 'dynamic'])
const isCanvas = (view: DiagramView): boolean => CANVAS_KINDS.has(view.kind)

/** The view to follow `ids` to, with what it shows of them: the open one
 *  when it shows any, else the one that shows the most, a canvas before
 *  anything else; null when no view that shows some elements shows them. */
function viewFor(ids: string[], nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): { view: DiagramView; shown: Set<string> } | null {
  if (!ids.length) return null
  const s = useDiagramStore.getState()
  const views = Object.values(s.views)
  // A group of views is opened through its members.
  const groups = new Set(views.map((v) => v.partOf).filter(Boolean))
  let best: { view: DiagramView; shown: Set<string>; count: number } | null = null
  for (const view of views) {
    if (groups.has(view.id)) continue
    const all = viewShownNodes(view, nodes, relations)
    if (!all) continue
    const shown = new Set(ids.filter((id) => all.has(id)))
    if (!shown.size) continue
    if (view.id === s.activeViewId) return { view, shown }
    if (!best || shown.size > best.count || (shown.size === best.count && isCanvas(view) && !isCanvas(best.view))) {
      best = { view, shown, count: shown.size }
    }
  }
  return best
}

onOutsideEditLoaded((before) => {
  if (!useFollowAgentStore.getState().on) return
  const s = useDiagramStore.getState()
  if (s.activeSnapshotId || s.presentationActive) return
  const nodes = s.c4Nodes as Record<string, C4Node>
  const relations = s.c4Relations as Record<string, C4Relation>
  const now = Date.now()
  if (now - lastEdit >= quietMs) {
    turn = new Set()
    paused = false
  }
  lastEdit = now

  // The elements added or changed, and the ends of the relations that were.
  const touched: string[] = []
  for (const [id, kind] of Object.entries(computeSnapDiff(before.nodes, nodes, before.relations, relations))) {
    if (kind === 'removed') continue
    if (nodes[id]) touched.push(id)
    const rel = relations[id]
    if (rel) touched.push(...[rel.sourceId, rel.targetId].filter((end) => nodes[end]))
  }
  if (paused) return
  for (const id of touched) { turn.add(id); unseen.add(id) }
  for (const id of unseen) if (!nodes[id]) unseen.delete(id)

  // What is still to be shown; a change of views alone (Forge filing a
  // stage) may be what shows it.
  const target = viewFor([...unseen], nodes, relations)
  if (!target) return
  for (const id of target.shown) unseen.delete(id)
  if (target.view.id !== s.activeViewId) {
    switching = true
    try { s.setActiveView(target.view.id) } finally { switching = false }
  }
  if (!isCanvas(target.view)) return
  const all = viewShownNodes(target.view, nodes, relations)
  const ids = [...new Set([...turn, ...target.shown])].filter((id) => all?.has(id))
  // Once the canvas has drawn the view it may have just opened.
  if (frameTimer !== null) clearTimeout(frameTimer)
  frameTimer = setTimeout(() => {
    frameTimer = null
    if (useFollowAgentStore.getState().on && !paused) {
      ;(window as unknown as { __rfFocusNodes?: (ids: string[], opts?: { duration?: number }) => void }).__rfFocusNodes?.(ids, { duration: 600 })
    }
  }, 120)
})

/** The user takes the camera or the view: following waits for the next turn. */
function pause(): void {
  if (!useFollowAgentStore.getState().on) return
  paused = true
  if (frameTimer !== null) { clearTimeout(frameTimer); frameTimer = null }
}

onUserCamera(pause)
// A reload puts the open view back after loading the model: not the user's.
useDiagramStore.subscribe((s, prev) => {
  if (s.activeViewId !== prev.activeViewId && !switching && loadingDocumentId() === null) pause()
})

// Nothing more to follow once the run finishes or stops.
useAgentForgeStore.subscribe((s) => {
  if (!useFollowAgentStore.getState().on) return
  const phase = agentForgePhase(s.status)
  if (phase !== 'working' && phase !== 'waiting') setFollowAgent(false)
})
