// ─── Selectors that ignore node geometry ────────────────────────────────────
// The live layout moves nodes every frame, which replaces c4Nodes and every
// moved node. Components that show content, not positions, subscribe through
// these so they re-render only when what they show changes.

import { useStoreWithEqualityFn } from 'zustand/traditional'
import type { C4Node } from '@radical/common/c4'
import { useDiagramStore } from './diagramStore'

const GEOMETRY = new Set(['x', 'y', 'width', 'height'])

/** Equal unless something other than the node's geometry changed. */
export function sameContent(a: C4Node | undefined, b: C4Node | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ra = a as unknown as Record<string, unknown>
  const rb = b as unknown as Record<string, unknown>
  for (const key in ra) if (!GEOMETRY.has(key) && ra[key] !== rb[key]) return false
  for (const key in rb) if (!GEOMETRY.has(key) && !(key in ra)) return false
  return true
}

/** The model node, ignoring moves and resizes. */
export function useNodeContent(id: string): C4Node | undefined {
  return useStoreWithEqualityFn(useDiagramStore, (s) => s.c4Nodes[id], sameContent)
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((x, i) => x === b[i]))
}

const NO_IDS: readonly string[] = []
const childIndexCache = new WeakMap<Record<string, C4Node>, Map<string, string[]>>()

/** parent id ('' for the root) → child ids, once per c4Nodes object. */
function childIndex(nodes: Record<string, C4Node>): Map<string, string[]> {
  let index = childIndexCache.get(nodes)
  if (!index) {
    index = new Map()
    for (const n of Object.values(nodes)) {
      const key = n.parentId ?? ''
      const list = index.get(key)
      if (list) list.push(n.id)
      else index.set(key, [n.id])
    }
    childIndexCache.set(nodes, index)
  }
  return index
}

/** Ids of a node's children, in model order. */
export function useChildIds(parentId: string): readonly string[] {
  return useStoreWithEqualityFn(useDiagramStore, (s) => childIndex(s.c4Nodes).get(parentId) ?? NO_IDS, sameList)
}

const labelCache = new WeakMap<Record<string, C4Node>, Map<string, string>>()

function sameLabels(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const [id, label] of a) if (b.get(id) !== label) return false
  return true
}

/** id → label of every node. */
export function useNodeLabels(): Map<string, string> {
  return useStoreWithEqualityFn(useDiagramStore, (s) => {
    let labels = labelCache.get(s.c4Nodes)
    if (!labels) {
      labels = new Map(Object.values(s.c4Nodes).map((n) => [n.id, n.label]))
      labelCache.set(s.c4Nodes, labels)
    }
    return labels
  }, sameLabels)
}
