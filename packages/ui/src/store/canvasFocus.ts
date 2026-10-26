// ─── Selection focus ────────────────────────────────────────────────────────
// A node selected on the canvas brings its relations forward: the node, the
// relations drawn from or to it (or to anything inside it) and the elements at
// their other ends stay as they are, and the rest of the canvas is dimmed, as
// in the metamodel diagram. A selected relation focuses itself and its two
// ends. Containers of a focused element stay undimmed, so it is clear where
// the element lives. Focus, a switch on the canvas, turns it off.

import type { Edge, Node } from 'reactflow'

/** What the focus reads from the diagram store. */
interface FocusState {
  rfNodes: readonly Node[]
  rfEdges: readonly Edge[]
  selectedNodeIds: readonly string[]
  selectedEdgeId: string | null
  /** Focus, the switch on the canvas: off, a selection focuses nothing. */
  selectionFocus?: boolean
  /** An export is being drawn: it shows the diagram, nothing dimmed. */
  drawnForExport?: boolean
}

export interface CanvasFocus {
  /** Canvas node ids drawn as they are; the others are dimmed. */
  nodes: Set<string>
  /** Canvas edge ids drawn as they are. */
  edges: Set<string>
  /** What the camera frames: the focused nodes without the containers they
   *  were added for. */
  frame: Set<string>
}

export function canvasFocus(
  nodes: readonly Node[],
  edges: readonly Edge[],
  selectedNodeIds: readonly string[],
  selectedEdgeId: string | null,
): CanvasFocus | null {
  // Only what the canvas shows: a view hides the rest of the model.
  nodes = nodes.filter((n) => !n.hidden)
  edges = edges.filter((e) => !e.hidden)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const focusNodes = new Set<string>()
  const focusEdges = new Set<string>()

  const selected = selectedNodeIds.filter((id) => byId.has(id))
  if (selected.length > 0) {
    // The selection and everything inside it.
    const children = new Map<string, string[]>()
    for (const n of nodes) {
      if (!n.parentNode) continue
      const list = children.get(n.parentNode)
      if (list) list.push(n.id)
      else children.set(n.parentNode, [n.id])
    }
    const inside = new Set<string>()
    const stack = [...selected]
    while (stack.length) {
      const id = stack.pop()!
      if (inside.has(id)) continue
      inside.add(id)
      stack.push(...(children.get(id) ?? []))
    }
    for (const id of inside) focusNodes.add(id)
    for (const e of edges) {
      if (!inside.has(e.source) && !inside.has(e.target)) continue
      focusEdges.add(e.id)
      focusNodes.add(e.source)
      focusNodes.add(e.target)
    }
  } else {
    const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined
    if (!edge) return null
    focusEdges.add(edge.id)
    focusNodes.add(edge.source)
    focusNodes.add(edge.target)
  }

  const frame = new Set(focusNodes)
  for (const id of frame) {
    for (let p = byId.get(id)?.parentNode; p && !focusNodes.has(p); p = byId.get(p)?.parentNode) focusNodes.add(p)
  }
  return { nodes: focusNodes, edges: focusEdges, frame }
}

let last: {
  nodes: readonly Node[]
  edges: readonly Edge[]
  selectedNodeIds: readonly string[]
  selectedEdgeId: string | null
  focus: CanvasFocus | null
} | null = null

/** The focus of the canvas now, computed once per change of what it reads. */
export function selectCanvasFocus(s: FocusState): CanvasFocus | null {
  if (s.selectionFocus === false || s.drawnForExport) return null
  if (
    !last ||
    last.nodes !== s.rfNodes ||
    last.edges !== s.rfEdges ||
    last.selectedNodeIds !== s.selectedNodeIds ||
    last.selectedEdgeId !== s.selectedEdgeId
  ) {
    last = {
      nodes: s.rfNodes,
      edges: s.rfEdges,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeId: s.selectedEdgeId,
      focus: canvasFocus(s.rfNodes, s.rfEdges, s.selectedNodeIds, s.selectedEdgeId),
    }
  }
  return last.focus
}

/** How the focus draws a canvas edge: brought forward, dimmed, or as usual
 *  when nothing is selected. */
export function edgeFocus(s: FocusState, id: string): 'focus' | 'dim' | undefined {
  const focus = selectCanvasFocus(s)
  if (!focus) return undefined
  return focus.edges.has(id) ? 'focus' : 'dim'
}
