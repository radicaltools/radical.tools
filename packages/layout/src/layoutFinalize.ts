/**
 * Turns a raw layout into what the canvas will actually show, so Smart
 * Layout scores the final picture instead of an intermediate one:
 *
 *   1. Deepest compounds first: push overlapping children apart, then fit
 *      the parent around them (children shifted to the padding origin,
 *      parent resized, never below its type's minimum size).
 *   2. Finally push overlapping root nodes apart.
 *
 * Separation is deterministic: pairs are visited in a fixed order and each
 * overlap is resolved along its axis of least penetration, split evenly.
 */
import { C4Node, NODE_SIZES, PositionMap } from '@radical/common/c4'
import { compoundPadding } from './geometry'

/** Minimum clear space between root-level nodes. */
export const ROOT_GAP = 40
/** Minimum clear space between siblings inside a compound. */
export const CHILD_GAP = 20

type Box = { x: number; y: number; width: number; height: number }

function boxOf(nodes: Record<string, C4Node>, positions: PositionMap, id: string): Box {
  const p = positions[id]
  const n = nodes[id]
  return {
    x: p?.x ?? n.x,
    y: p?.y ?? n.y,
    width: p?.width ?? n.width,
    height: p?.height ?? n.height,
  }
}

function childrenByParent(nodes: Record<string, C4Node>): Map<string, string[]> {
  const byParent = new Map<string, string[]>()
  for (const n of Object.values(nodes)) {
    if (!n.parentId || !nodes[n.parentId]) continue
    const list = byParent.get(n.parentId)
    if (list) list.push(n.id)
    else byParent.set(n.parentId, [n.id])
  }
  return byParent
}

function depthOf(nodes: Record<string, C4Node>, id: string): number {
  let d = 0
  let cur: C4Node | undefined = nodes[id]
  while (cur?.parentId) { d++; cur = nodes[cur.parentId] }
  return d
}

/** Push boxes apart until no pair is closer than `gap`. Mutates `boxes`. */
export function separateBoxes(boxes: Box[], gap: number, maxPasses = 200): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]
        const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap
        if (ox <= 0) continue
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap
        if (oy <= 0) continue
        moved = true
        if (ox <= oy) {
          const dir = a.x + a.width / 2 <= b.x + b.width / 2 ? 1 : -1
          a.x -= (dir * ox) / 2
          b.x += (dir * ox) / 2
        } else {
          const dir = a.y + a.height / 2 <= b.y + b.height / 2 ? 1 : -1
          a.y -= (dir * oy) / 2
          b.y += (dir * oy) / 2
        }
      }
    }
    if (!moved) return
  }
}

/** Separate overlapping siblings at every level, fit parents, separate roots. */
export function finalizeLayout(nodes: Record<string, C4Node>, positions: PositionMap): PositionMap {
  return finalize(nodes, positions, true)
}

function finalize(nodes: Record<string, C4Node>, positions: PositionMap, separate: boolean): PositionMap {
  const out: PositionMap = {}
  for (const id of Object.keys(nodes)) out[id] = boxOf(nodes, positions, id)

  const byParent = childrenByParent(nodes)
  const parentIds = [...byParent.keys()].sort((a, b) => depthOf(nodes, b) - depthOf(nodes, a))

  for (const pid of parentIds) {
    const childIds = byParent.get(pid)!
    const boxes = childIds.map((id) => out[id] as Box)
    if (separate) separateBoxes(boxes, CHILD_GAP)

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const b of boxes) {
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    }
    const parent = nodes[pid]
    const pad = compoundPadding(parent.type)
    const dx = pad.side - minX
    const dy = pad.top - minY
    for (const b of boxes) { b.x += dx; b.y += dy }

    const min = NODE_SIZES[parent.type] ?? { width: 0, height: 0 }
    const p = out[pid] as Box
    p.width = Math.max(maxX - minX + 2 * pad.side, min.width)
    p.height = Math.max(maxY - minY + pad.top + pad.bottom, min.height)
  }

  if (separate) {
    const roots = Object.values(nodes).filter((n) => !n.parentId || !nodes[n.parentId]).map((n) => out[n.id] as Box)
    separateBoxes(roots, ROOT_GAP)
  }
  return out
}
