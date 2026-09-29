// Layout invariants checked on the rendered canvas (screen-space boxes, so
// they hold at any zoom). A layout that breaks one of these is visibly wrong
// whatever its score: nodes on top of each other, or children spilling out
// of the boundary that is supposed to contain them.

export interface Box { x: number; y: number; width: number; height: number }

/** Sub-pixel rounding in transforms; anything above this is a real overlap. */
const EPS = 1

function intersects(a: Box, b: Box): boolean {
  return a.x + a.width - EPS > b.x && b.x + b.width - EPS > a.x &&
         a.y + a.height - EPS > b.y && b.y + b.height - EPS > a.y
}

function contains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x - EPS && inner.y >= outer.y - EPS &&
         inner.x + inner.width <= outer.x + outer.width + EPS &&
         inner.y + inner.height <= outer.y + outer.height + EPS
}

/**
 * Pairs of sibling nodes (same parent, both rendered) whose boxes overlap,
 * and nodes that are not fully inside their rendered parent.
 */
export function layoutViolations(
  boxes: Record<string, Box>,
  parentOf: Record<string, string | undefined>,
): string[] {
  const ids = Object.keys(boxes)
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j]
      if (visibleParent(a, boxes, parentOf) !== visibleParent(b, boxes, parentOf)) continue
      if (intersects(boxes[a], boxes[b])) out.push(`overlap: ${a} ↔ ${b}`)
    }
  }
  for (const id of ids) {
    const p = visibleParent(id, boxes, parentOf)
    if (p && !contains(boxes[p], boxes[id])) out.push(`outside parent: ${id} ⊄ ${p}`)
  }
  return out
}

/** Nearest ancestor that is rendered in this view (views may skip levels). */
function visibleParent(id: string, boxes: Record<string, Box>, parentOf: Record<string, string | undefined>): string | undefined {
  let p = parentOf[id]
  while (p && !boxes[p]) p = parentOf[p]
  return p
}
