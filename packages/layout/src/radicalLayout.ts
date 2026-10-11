/**
 * Radical Layout — C4-semantic layered layout algorithm.
 *
 * Produces human-quality layouts by understanding C4 model semantics:
 *   1. Every compound is laid out bottom-up. Leaf children of a container
 *      stack in a column (two columns past three); any other children run
 *      in a row ordered by data flow, wrapping when there are many.
 *   2. Internal root nodes are layered by dependency depth from the user
 *      entry points. Cycles are broken first, from the entry points, so a
 *      call-back never pushes the entry system below the one it calls.
 *   3. Persons centred above what they use.
 *   4. External nodes in a right column, aligned with their callers.
 *   5. Downstream nodes centred below their upstream sources.
 *
 * This is NOT a generic graph layout — it understands C4 hierarchy.
 */

import { C4Node, C4Relation, PositionMap, NODE_SIZES } from '@radical/common/c4'
import { effectiveWidth, effectiveHeight, compoundPadding, projectToVisibleGraph } from './geometry'

// ─── Configuration ───────────────────────────────────────────────────────────

const CHILD_GAP           = 20   // gap between siblings inside a compound
const SYSTEM_GAP          = 40   // horizontal gap between root nodes in the same layer
const PERSON_GAP          = 40   // horizontal gap between persons
const PERSON_SYS_GAP      = 40   // vertical gap: person row → first system layer
const SYSTEM_LAYER_GAP    = 60   // vertical gap between system layers
const EXTERNAL_COL_GAP    = 60   // gap: right edge of internal layout → external column
const EXTERNAL_ROW_GAP    = 40   // vertical gap between external nodes
const GRID_SIZE           = 20   // snap unit
/** Leaf children of a container stay in one column up to this many. */
const MAX_SINGLE_COLUMN   = 3
/** Other children stay in one row up to this many, then wrap into a grid. */
const MAX_SINGLE_ROW      = 4

type Dag = Map<string, Set<string>>

interface Ctx {
  nodes: Record<string, C4Node>
  relations: C4Relation[]
  children: Map<string, C4Node[]>
  result: PositionMap
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

/** The root-level ancestor of a node (the node itself when it is a root). */
function rootOf(id: string, nodes: Record<string, C4Node>): string {
  let cur = nodes[id]
  while (cur?.parentId && nodes[cur.parentId]) cur = nodes[cur.parentId]
  return cur?.id ?? id
}

/** The ancestor-or-self of `id` that is a direct child of `parentId`. */
function childUnder(id: string, parentId: string, nodes: Record<string, C4Node>): string | undefined {
  let cur: C4Node | undefined = nodes[id]
  while (cur) {
    if (cur.parentId === parentId) return cur.id
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return undefined
}

/**
 * What a relation endpoint visually attaches to at root level: the
 * top-level block inside its root (e.g. the container of a component), or
 * the root itself.
 */
function anchorOf(id: string, nodes: Record<string, C4Node>): string {
  const root = rootOf(id, nodes)
  if (id === root) return id
  return childUnder(id, root, nodes) ?? root
}

/** Absolute coordinate, walking up the parent chain. Null if any link is unplaced. */
function absolutePos(id: string, axis: 'x' | 'y', nodes: Record<string, C4Node>, result: PositionMap): number | null {
  let val = 0
  let cur: C4Node | undefined = nodes[id]
  while (cur) {
    const pos = result[cur.id]
    if (!pos) return null
    val += pos[axis]
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return val
}

function sizeOf(id: string, ctx: Ctx): { width: number; height: number } {
  const p = ctx.result[id]
  const n = ctx.nodes[id]
  return { width: p?.width ?? effectiveWidth(n), height: p?.height ?? effectiveHeight(n) }
}

// ─── DAG utilities ───────────────────────────────────────────────────────────

/** Kahn's algorithm with deterministic tie-breaking by id. */
function topoSort(dag: Dag): string[] {
  const inDeg = new Map<string, number>()
  for (const [id] of dag) inDeg.set(id, 0)
  for (const [, targets] of dag) {
    for (const t of targets) inDeg.set(t, (inDeg.get(t) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id)

  const ordered: string[] = []
  while (queue.length > 0) {
    queue.sort()
    const id = queue.shift()!
    ordered.push(id)
    for (const t of dag.get(id) ?? []) {
      const nd = (inDeg.get(t) ?? 0) - 1
      inDeg.set(t, nd)
      if (nd === 0) queue.push(t)
    }
  }

  // Only reachable with a cyclic input — keep every node anyway.
  const placed = new Set(ordered)
  for (const [id] of dag) if (!placed.has(id)) ordered.push(id)
  return ordered
}

/**
 * Drop the edges that close a cycle, found by depth-first search from
 * `starts` first, then from every other node by id. Searching from the
 * entry points keeps the natural direction: with A↔B and users entering at
 * A, it is B→A that gets dropped.
 */
function breakCycles(dag: Dag, starts: string[]): Dag {
  const out: Dag = new Map()
  for (const [id] of dag) out.set(id, new Set())
  const state = new Map<string, 'active' | 'done'>()
  const visit = (id: string): void => {
    state.set(id, 'active')
    for (const t of [...(dag.get(id) ?? [])].sort()) {
      const st = state.get(t)
      if (st === 'active') continue
      out.get(id)!.add(t)
      if (st === undefined) visit(t)
    }
    state.set(id, 'done')
  }
  for (const id of [...starts, ...[...dag.keys()].sort()]) {
    if (dag.has(id) && !state.has(id)) visit(id)
  }
  return out
}

/** Longest-path layer of every node of an acyclic DAG (sources at 0). */
function longestPathLayers(dag: Dag): Map<string, number> {
  const layers = new Map<string, number>()
  for (const id of topoSort(dag)) {
    const l = layers.get(id) ?? 0
    layers.set(id, l)
    for (const t of dag.get(id) ?? []) layers.set(t, Math.max(layers.get(t) ?? 0, l + 1))
  }
  return layers
}

// ─── Phase 1: Bottom-up compound layout ──────────────────────────────────────

/**
 * Lay out the subtree under `id`, writing children positions (relative to
 * their parent) and every compound's size into `ctx.result`.
 */
function layoutCompound(id: string, ctx: Ctx): void {
  const node = ctx.nodes[id]
  const kids = ctx.children.get(id) ?? []
  if (kids.length === 0) {
    ctx.result[id] = { x: 0, y: 0, width: effectiveWidth(node), height: effectiveHeight(node) }
    return
  }
  for (const k of kids) layoutCompound(k.id, ctx)

  // Order children by data flow between them (relations of any descendant
  // count for the child that contains it).
  const dag: Dag = new Map(kids.map((k) => [k.id, new Set<string>()]))
  for (const r of ctx.relations) {
    const a = childUnder(r.sourceId, id, ctx.nodes)
    const b = childUnder(r.targetId, id, ctx.nodes)
    if (a && b && a !== b) dag.get(a)!.add(b)
  }
  const order = topoSort(breakCycles(dag, []))

  const allLeaves = kids.every((k) => !ctx.children.has(k.id))
  const cols = (node.type === 'container' || node.type === 'webapp') && allLeaves
    ? (order.length > MAX_SINGLE_COLUMN ? 2 : 1)
    : (order.length > MAX_SINGLE_ROW ? Math.ceil(Math.sqrt(order.length * 1.6)) : order.length)
  const rows = Math.ceil(order.length / cols)

  const colW = new Array<number>(cols).fill(0)
  const rowH = new Array<number>(rows).fill(0)
  order.forEach((cid, i) => {
    const s = sizeOf(cid, ctx)
    colW[i % cols] = Math.max(colW[i % cols], s.width)
    rowH[Math.floor(i / cols)] = Math.max(rowH[Math.floor(i / cols)], s.height)
  })

  const pad = compoundPadding(node.type)
  const colX: number[] = []
  const rowY: number[] = []
  for (let c = 0; c < cols; c++) colX.push(c === 0 ? pad.side : colX[c - 1] + colW[c - 1] + CHILD_GAP)
  for (let r = 0; r < rows; r++) rowY.push(r === 0 ? pad.top : rowY[r - 1] + rowH[r - 1] + CHILD_GAP)

  order.forEach((cid, i) => {
    const p = ctx.result[cid]
    p.x = colX[i % cols]
    p.y = rowY[Math.floor(i / cols)]
  })

  const min = NODE_SIZES[node.type] ?? { width: 0, height: 0 }
  ctx.result[id] = {
    x: 0,
    y: 0,
    width: Math.max(colX[cols - 1] + colW[cols - 1] + pad.side, min.width),
    height: Math.max(rowY[rows - 1] + rowH[rows - 1] + pad.bottom, min.height),
  }
}

// ─── Barycenter sort (Sugiyama crossing-reduction) ───────────────────────────

/**
 * Reorder nodes within each layer using barycenter heuristic.
 * Iteratively sweeps down (using upstream neighbors as anchor) and up
 * (using downstream neighbors), settling into a low-crossing ordering.
 *
 * Mutates layerGroups in-place. Persons and externals are not part of
 * `layerGroups` — they are placed by weighted average AFTER systems, so
 * they follow this ordering automatically.
 */
function barycenterSort(
  layerGroups: Map<number, C4Node[]>,
  rootDAG: Dag,
  iterations: number = 4
): void {
  if (layerGroups.size === 0) return
  const maxLayer = Math.max(...Array.from(layerGroups.keys()))
  if (maxLayer < 1) return // nothing to reorder against

  const reverseDAG: Dag = new Map()
  for (const [src, targets] of rootDAG) {
    if (!reverseDAG.has(src)) reverseDAG.set(src, new Set())
    for (const t of targets) {
      if (!reverseDAG.has(t)) reverseDAG.set(t, new Set())
      reverseDAG.get(t)!.add(src)
    }
  }

  const posOf = new Map<string, number>()
  for (const [, nodes] of layerGroups) nodes.forEach((n, i) => posOf.set(n.id, i))

  const sortLayer = (L: number, neighborsOf: Dag): boolean => {
    const nodes = layerGroups.get(L)
    if (!nodes || nodes.length < 2) return false
    const scored = nodes.map((n) => {
      const neigh = neighborsOf.get(n.id)
      let sum = 0, count = 0
      if (neigh) {
        for (const id of neigh) {
          const p = posOf.get(id)
          if (p !== undefined) { sum += p; count++ }
        }
      }
      return { n, bc: count > 0 ? sum / count : posOf.get(n.id) ?? 0 }
    })
    scored.sort((a, b) => {
      if (a.bc !== b.bc) return a.bc - b.bc
      return (posOf.get(a.n.id) ?? 0) - (posOf.get(b.n.id) ?? 0)
    })
    const sorted = scored.map((s) => s.n)
    let changed = false
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].id !== nodes[i].id) { changed = true; break }
    }
    layerGroups.set(L, sorted)
    sorted.forEach((n, i) => posOf.set(n.id, i))
    return changed
  }

  for (let iter = 0; iter < iterations; iter++) {
    let anyChange = false
    for (let L = 1; L <= maxLayer; L++) if (sortLayer(L, reverseDAG)) anyChange = true
    for (let L = maxLayer - 1; L >= 0; L--) if (sortLayer(L, rootDAG)) anyChange = true
    if (!anyChange) break
  }
}

// ─── Phase 2: Root placement ─────────────────────────────────────────────────

export function applyRadicalLayout(
  inputNodes: Record<string, C4Node>,
  inputRelations: Record<string, C4Relation>
): PositionMap {
  const { nodes, relations: relationMap } = projectToVisibleGraph(inputNodes, inputRelations)
  const relations = Object.values(relationMap)
  const children = new Map<string, C4Node[]>()
  for (const n of Object.values(nodes)) {
    if (!n.parentId || !nodes[n.parentId]) continue
    const list = children.get(n.parentId)
    if (list) list.push(n)
    else children.set(n.parentId, [n])
  }
  const result: PositionMap = {}
  const ctx: Ctx = { nodes, relations, children, result }

  const roots = Object.values(nodes).filter((n) => !n.parentId || !nodes[n.parentId])
  for (const r of roots) layoutCompound(r.id, ctx)

  const persons = roots.filter((n) => n.type === 'person' && !n.external)
  const externalNodes = roots.filter((n) => n.external)
  const internalNodes = roots.filter((n) => !n.external && n.type !== 'person')

  // ── Root-level DAG ─────────────────────────────────────────────────────
  const rootDAG: Dag = new Map(roots.map((n) => [n.id, new Set<string>()]))
  for (const rel of relations) {
    const s = rootOf(rel.sourceId, nodes)
    const t = rootOf(rel.targetId, nodes)
    if (s !== t) rootDAG.get(s)?.add(t)
  }

  // ── Layer assignment (internal nodes only) ─────────────────────────────
  const internalIds = new Set(internalNodes.map((n) => n.id))
  const internalDAG: Dag = new Map()
  for (const id of internalIds) {
    internalDAG.set(id, new Set([...rootDAG.get(id)!].filter((t) => internalIds.has(t))))
  }
  const entries = [...new Set(persons.flatMap((p) => [...rootDAG.get(p.id)!].filter((t) => internalIds.has(t))))].sort()
  const nodeLayers = longestPathLayers(breakCycles(internalDAG, entries))

  const layerGroups = new Map<number, C4Node[]>()
  for (const node of internalNodes) {
    const layer = nodeLayers.get(node.id) ?? 0
    if (!layerGroups.has(layer)) layerGroups.set(layer, [])
    layerGroups.get(layer)!.push(node)
  }
  barycenterSort(layerGroups, rootDAG)

  // ── Place internal nodes layer by layer ────────────────────────────────
  const personRowH = persons.reduce((m, p) => Math.max(m, sizeOf(p.id, ctx).height), 0)
  let currentY = personRowH > 0 ? personRowH + PERSON_SYS_GAP : 0
  const placedRoots = new Set<string>()
  const maxLayer = layerGroups.size > 0 ? Math.max(...Array.from(layerGroups.keys())) : -1

  for (let layer = 0; layer <= maxLayer; layer++) {
    const systems = layerGroups.get(layer) ?? []
    if (systems.length === 0) continue

    if (layer === 0) {
      let x = 0
      for (const sys of systems) {
        result[sys.id].x = snap(x)
        result[sys.id].y = snap(currentY)
        x += sizeOf(sys.id, ctx).width + SYSTEM_GAP
      }
    } else {
      // Centre below already-placed upstream sources, then resolve overlaps.
      for (const sys of systems) {
        const sourceCentersX: number[] = []
        for (const rel of relations) {
          if (rootOf(rel.targetId, nodes) !== sys.id) continue
          const srcRoot = rootOf(rel.sourceId, nodes)
          if (srcRoot === sys.id || !placedRoots.has(srcRoot)) continue
          const anchor = anchorOf(rel.sourceId, nodes)
          const absX = absolutePos(anchor, 'x', nodes, result)
          if (absX !== null) sourceCentersX.push(absX + sizeOf(anchor, ctx).width / 2)
        }
        const sysW = sizeOf(sys.id, ctx).width
        const sysX = sourceCentersX.length > 0
          ? sourceCentersX.reduce((a, b) => a + b, 0) / sourceCentersX.length - sysW / 2
          : 0
        result[sys.id].x = snap(Math.max(0, sysX))
        result[sys.id].y = snap(currentY)
      }

      const sorted = [...systems].sort((a, b) => result[a.id].x - result[b.id].x)
      for (let i = 1; i < sorted.length; i++) {
        const prev = result[sorted[i - 1].id]
        const cur = result[sorted[i].id]
        const minX = prev.x + sizeOf(sorted[i - 1].id, ctx).width + SYSTEM_GAP
        if (cur.x < minX) cur.x = snap(minX)
      }
    }

    for (const sys of systems) placedRoots.add(sys.id)
    const maxH = systems.reduce((m, s) => Math.max(m, sizeOf(s.id, ctx).height), 0)
    currentY += maxH + SYSTEM_LAYER_GAP
  }

  // ── Persons centred above what they use ────────────────────────────────
  if (persons.length > 0) {
    const pps: { person: C4Node; targetX: number }[] = []
    for (const p of persons) {
      const personW = sizeOf(p.id, ctx).width
      let sumX = 0, count = 0
      for (const rel of relations) {
        const other = rel.sourceId === p.id ? rel.targetId : rel.targetId === p.id ? rel.sourceId : null
        if (!other || !placedRoots.has(rootOf(other, nodes))) continue
        const anchor = anchorOf(other, nodes)
        const absX = absolutePos(anchor, 'x', nodes, result)
        if (absX === null) continue
        sumX += absX + sizeOf(anchor, ctx).width / 2
        count++
      }
      pps.push({ person: p, targetX: count > 0 ? sumX / count - personW / 2 : 0 })
    }

    pps.sort((a, b) => a.targetX - b.targetX)
    for (const pp of pps) {
      result[pp.person.id].x = snap(pp.targetX)
      result[pp.person.id].y = 0
    }
    for (let i = 1; i < pps.length; i++) {
      const prev = result[pps[i - 1].person.id]
      const cur = result[pps[i].person.id]
      const minX = prev.x + sizeOf(pps[i - 1].person.id, ctx).width + PERSON_GAP
      if (cur.x < minX) cur.x = snap(minX)
    }
    for (const pp of pps) placedRoots.add(pp.person.id)
  }

  // ── External nodes in a right column ───────────────────────────────────
  if (externalNodes.length > 0) {
    let maxRight = 0
    for (const id of placedRoots) maxRight = Math.max(maxRight, result[id].x + sizeOf(id, ctx).width)
    const extX = snap(maxRight + EXTERNAL_COL_GAP)

    const scored = externalNodes.map((ext) => {
      let sumY = 0, count = 0
      for (const rel of relations) {
        const other = rel.targetId === ext.id ? rel.sourceId : rel.sourceId === ext.id ? rel.targetId : null
        if (!other || !placedRoots.has(rootOf(other, nodes))) continue
        const anchor = anchorOf(other, nodes)
        const absY = absolutePos(anchor, 'y', nodes, result)
        if (absY === null) continue
        sumY += absY + sizeOf(anchor, ctx).height / 2
        count++
      }
      return { node: ext, callerAbsY: count > 0 ? sumY / count : Infinity }
    })
    scored.sort((a, b) => a.callerAbsY - b.callerAbsY)

    for (const s of scored) {
      const h = sizeOf(s.node.id, ctx).height
      const targetY = isFinite(s.callerAbsY) ? s.callerAbsY - h / 2 : 0
      result[s.node.id].x = extX
      result[s.node.id].y = snap(Math.max(0, targetY))
    }
    for (let i = 1; i < scored.length; i++) {
      const prev = result[scored[i - 1].node.id]
      const cur = result[scored[i].node.id]
      const minY = prev.y + sizeOf(scored[i - 1].node.id, ctx).height + EXTERNAL_ROW_GAP
      if (cur.y < minY) cur.y = snap(minY)
    }
  }

  // ── Final grid snap ────────────────────────────────────────────────────
  for (const p of Object.values(result)) {
    p.x = snap(p.x)
    p.y = snap(p.y)
  }
  return result
}
