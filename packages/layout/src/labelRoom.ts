/**
 * Room for relation labels between nodes.
 *
 * Layout keeps ROOT_GAP / CHILD_GAP between siblings, far less than a
 * relation's label (a line of text is ~32 px tall, a label up to 200 px
 * wide), so the label of a relation between neighbours had nowhere to go
 * but over a node. These are the gaps two siblings need for the labels of
 * the relations between them, or between their descendants: the label's
 * height when one sits above the other, its width when they sit side by
 * side.
 */
import type { C4Node, C4Relation } from '@radical/common/c4'
import { relationLabelSize, type LabelSize } from './edgeLabels'

/** Clear space kept on both sides of a label, along its edge. */
export const LABEL_MARGIN = 10

/** Minimum clear space between two siblings, per axis. */
export interface PairGap {
  /** When they sit side by side. */
  x: number
  /** When one sits above the other. */
  y: number
}

/** Pair gaps keyed by pairKey. */
export type LabelGaps = Map<string, PairGap>

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}\n${b}` : `${b}\n${a}`
}

const sizes = new WeakMap<C4Relation, LabelSize | null>()

/** A relation's label size, cached per relation object (scoring asks often). */
export function labelSizeOf(r: C4Relation): LabelSize | null {
  let size = sizes.get(r)
  if (size === undefined) {
    size = relationLabelSize(r)
    sizes.set(r, size)
  }
  return size
}

/** The space a label needs along its edge, margins included. */
export function labelNeed(size: LabelSize): PairGap {
  return { x: size.w + 2 * LABEL_MARGIN, y: size.h + 2 * LABEL_MARGIN }
}

/**
 * Gaps between the siblings that labelled relations join: for a relation,
 * the two ancestors-or-self of its ends that share a parent (or are both
 * roots). Relations from a node to its own ancestor need none.
 */
export function labelGaps(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): LabelGaps {
  const chain = (id: string): string[] => {
    const out: string[] = []
    for (let cur: C4Node | undefined = nodes[id]; cur; cur = cur.parentId ? nodes[cur.parentId] : undefined) {
      if (out.includes(cur.id)) break
      out.push(cur.id)
    }
    return out
  }
  const gaps: LabelGaps = new Map()
  for (const r of Object.values(relations)) {
    if (!nodes[r.sourceId] || !nodes[r.targetId] || r.sourceId === r.targetId) continue
    const size = labelSizeOf(r)
    if (!size) continue
    const s = chain(r.sourceId)
    const t = chain(r.targetId)
    const onT = new Set(t)
    const common = s.find((id) => onT.has(id))
    if (common === r.sourceId || common === r.targetId) continue
    const a = common ? s[s.indexOf(common) - 1] : s[s.length - 1]
    const b = common ? t[t.indexOf(common) - 1] : t[t.length - 1]
    const key = pairKey(a, b)
    const need = labelNeed(size)
    const prev = gaps.get(key)
    gaps.set(key, prev ? { x: Math.max(prev.x, need.x), y: Math.max(prev.y, need.y) } : need)
  }
  return gaps
}
