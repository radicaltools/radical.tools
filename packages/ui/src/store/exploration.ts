/**
 * Explore from here: what an exploration is and how it grows, folds and is
 * laid out, without the store. The store (diagramStore.ts) keeps the one
 * open in `exploration`, never in `views`, and draws it while it is shown.
 *
 * An exploration is flat: each element it lists is drawn on its own, a
 * child apart from its parent (no frame), and while it is shown the
 * listed elements' places on the nodes are where they are drawn, not
 * relative to their parents. Its elements sit on levels: the start on 0,
 * what the + of an element on level k added on k + 1, kept as added. It
 * draws only the relations (and containment lines) between an element and
 * one on the next level that the expansion which added the deeper one
 * chose.
 */
import type { C4Node, C4Relation, DiagramView, NodePosition } from '@radical/common/c4'
import { compoundPadding, drawnSize } from '@radical/layout/geometry'
import { labelNeed, labelSizeOf } from '@radical/layout/labelRoom'

/** An exploration's view id begins with it: no view of a document's does. */
export const EXPLORATION_ID = 'explore:'

/** The most elements in one row of a level: a level with more wraps. */
export const EXPLORATION_ROW = 8

/** Gaps on an exploration's canvas: between elements of a row, between the
 *  rows of a level, and (at least) between levels. */
const IN_ROW = 60
const BETWEEN_ROWS = 40
const BETWEEN_LEVELS = 80

/** One row of an element's + menu: relations of one kind (relationKey)
 *  running one way from the element. */
export interface ExploreRow {
  key: string
  direction: 'out' | 'in'
}

/** What a + adds: the neighbours along the relations of `rows`, and the
 *  element's parent (it is contained in it) and children (it contains
 *  them) when asked. All of them when omitted. */
export interface ExploreChoice {
  rows?: ExploreRow[] | null
  parent?: boolean
  children?: boolean
}

/** One use of an element's +: what it chose. */
export interface ExplorationExpansion {
  id: string
  from: string
  /** null: every relation, either way. */
  rows: ExploreRow[] | null
  parent: boolean
  children: boolean
}

/** An exploration: the structure view it draws, the level each element
 *  was added on, and which expansion added it. */
export type Exploration = DiagramView & {
  levels: Record<string, number>
  /** Element id → the expansion that added it (none for the start, or for
   *  one added from the palette). */
  addedBy: Record<string, string>
  expansions: Record<string, ExplorationExpansion>
}

/** How an element is joined to a neighbour it does not list yet. */
export interface ExploreLink {
  id: string
  via: 'relation' | 'parent' | 'child'
  /** A relation's kind (relationKey). */
  type?: string
  /** Which way it runs from the element (containment: its parent comes
   *  in, its children go out). */
  direction: 'out' | 'in'
}

/** What the + menu groups relations by: their type, or for one with no
 *  type its label (the bookstore's "reads/writes", "calls"). */
export function relationKey(r: C4Relation): string {
  return r.relationType ? `t:${r.relationType}` : `l:${r.label ?? ''}`
}

export const isExplorationId = (id: string | null | undefined): boolean => !!id && id.startsWith(EXPLORATION_ID)

/** An exploration of `nodeId` alone. */
export function newExploration(id: string, node: C4Node): Exploration {
  return { id: EXPLORATION_ID + id, name: `Explore: ${node.label || 'element'}`, kind: 'static', nodeIds: [node.id], positions: {}, levels: { [node.id]: 0 }, addedBy: {}, expansions: {} }
}

/** The elements it lists that the model has. */
export function listedIds(x: Exploration, nodes: Record<string, C4Node>): string[] {
  return x.nodeIds.filter((id) => !!nodes[id])
}

/** The level of each element (one with none: under the rest). */
export function levelOf(x: Exploration): (id: string) => number {
  const last = Math.max(0, ...Object.values(x.levels))
  return (id) => x.levels[id] ?? last + 1
}

/** For each element it lists, how it is joined to each neighbour it does
 *  not list yet: a relation either way, its parent, its children. */
export function explorationLinks(x: Exploration, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Map<string, ExploreLink[]> {
  const listed = new Set(listedIds(x, nodes))
  const out = new Map<string, ExploreLink[]>()
  const add = (from: string, link: ExploreLink): void => {
    if (!listed.has(from) || listed.has(link.id) || from === link.id || !nodes[link.id]) return
    const list = out.get(from)
    if (list) list.push(link)
    else out.set(from, [link])
  }
  for (const r of Object.values(relations)) {
    add(r.sourceId, { id: r.targetId, via: 'relation', type: relationKey(r), direction: 'out' })
    add(r.targetId, { id: r.sourceId, via: 'relation', type: relationKey(r), direction: 'in' })
  }
  for (const n of Object.values(nodes)) {
    if (!n.parentId || !nodes[n.parentId]) continue
    // Containment is the relation "contains", from parent to child: the
    // parent comes in, the children go out.
    add(n.id, { id: n.parentId, via: 'parent', direction: 'in' })
    add(n.parentId, { id: n.id, via: 'child', direction: 'out' })
  }
  return out
}

/** How many neighbours each element does not show yet (its + count). */
export function linkCounts(links: Map<string, ExploreLink[]>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, list] of links) out[id] = new Set(list.map((l) => l.id)).size
  return out
}

/** A row of an element's + menu: relations of one kind one way (`key`,
 *  relationKey), or containment ('children' going out, 'parent' coming
 *  in), with how many neighbours it adds and the choice that adds them. */
export interface MenuRow {
  id: string
  key: string
  n: number
  choice: ExploreChoice
}

/** The two columns of an element's + menu (from its `links`): what goes
 *  out from it (relations by kind, then its children: it contains them)
 *  and what comes in (then its parent: it is contained in it). */
export function menuRows(links: ExploreLink[]): { out: MenuRow[]; in: MenuRow[] } {
  const distinct = (list: ExploreLink[]): number => new Set(list.map((l) => l.id)).size
  const column = (direction: 'out' | 'in'): MenuRow[] => {
    const rel = links.filter((l) => l.via === 'relation' && l.direction === direction)
    const rows: MenuRow[] = [...new Set(rel.map((l) => l.type!))].sort()
      .map((key) => ({ id: `${direction}:${key}`, key, n: distinct(rel.filter((l) => l.type === key)), choice: { rows: [{ key, direction }], parent: false, children: false } }))
    const containment = links.filter((l) => l.via === (direction === 'out' ? 'child' : 'parent'))
    if (containment.length) {
      rows.push(direction === 'out'
        ? { id: 'out:children', key: 'children', n: distinct(containment), choice: { rows: [], parent: false, children: true } }
        : { id: 'in:parent', key: 'parent', n: distinct(containment), choice: { rows: [], parent: true, children: false } })
    }
    return rows
  }
  return { out: column('out'), in: column('in') }
}

/** A choice, with what it leaves out filled in: All. */
export function fullChoice(choice?: ExploreChoice): Omit<ExplorationExpansion, 'id' | 'from'> {
  return {
    rows: choice?.rows === undefined ? null : choice.rows,
    parent: choice ? !!choice.parent : true,
    children: choice ? !!choice.children : true,
  }
}

/** Whether a choice takes a link. */
export function chooses(choice: Omit<ExplorationExpansion, 'id' | 'from'>, link: ExploreLink): boolean {
  if (link.via === 'parent') return choice.parent
  if (link.via === 'child') return choice.children
  return !choice.rows || choice.rows.some((row) => row.key === link.type && row.direction === link.direction)
}

/** The exploration with what the + of `from` chose added, one level below
 *  it; null when it adds nothing. */
export function grown(x: Exploration, from: string, links: ExploreLink[], choice: ExploreChoice | undefined, expansionId: string): Exploration | null {
  const chosen = fullChoice(choice)
  const added = [...new Set(links.filter((l) => chooses(chosen, l)).map((l) => l.id))].filter((id) => !x.nodeIds.includes(id))
  if (!added.length) return null
  const level = levelOf(x)(from) + 1
  const expansion: ExplorationExpansion = { id: expansionId, from, ...chosen }
  return {
    ...x,
    nodeIds: [...x.nodeIds, ...added],
    levels: { ...x.levels, ...Object.fromEntries(added.map((id) => [id, level])) },
    addedBy: { ...x.addedBy, ...Object.fromEntries(added.map((id) => [id, expansionId])) },
    expansions: { ...x.expansions, [expansionId]: expansion },
  }
}

/** The elements whose + added something still listed: their −. */
export function foldable(x: Exploration, nodes: Record<string, C4Node>): Record<string, true> {
  const out: Record<string, true> = {}
  for (const id of listedIds(x, nodes)) {
    const by = x.addedBy[id] ? x.expansions[x.addedBy[id]] : undefined
    if (by && nodes[by.from]) out[by.from] = true
  }
  return out
}

/** The exploration without what the + of `from` added, and all that was
 *  added from those since (the − of `from`). */
export function folded(x: Exploration, from: string): Exploration {
  return withoutExpansions(x, Object.values(x.expansions).filter((e) => e.from === from).map((e) => e.id))
}

/** The exploration without what the expansions `ids` added, and all that
 *  was added from those since (Undo of a + after the exploration changed
 *  outside the history: in Viewer). */
export function withoutExpansions(x: Exploration, ids: string[]): Exploration {
  const gone = new Set<string>()
  const expansionsGone = new Set<string>()
  const drop = (expansion: string): void => {
    if (expansionsGone.has(expansion) || !x.expansions[expansion]) return
    expansionsGone.add(expansion)
    for (const [el, by] of Object.entries(x.addedBy)) {
      if (by !== expansion || gone.has(el) || el === x.nodeIds[0]) continue
      gone.add(el)
      for (const e of Object.values(x.expansions)) if (e.from === el) drop(e.id)
    }
  }
  for (const id of ids) drop(id)
  const keep = <T,>(record: Record<string, T>, drop: Set<string>): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([k]) => !drop.has(k)))
  return {
    ...x,
    nodeIds: x.nodeIds.filter((id) => !gone.has(id)),
    positions: keep(x.positions, gone),
    levels: keep(x.levels, gone),
    addedBy: keep(x.addedBy, gone),
    expansions: keep(x.expansions, expansionsGone),
  }
}

/** What it draws between its elements: the relations, and the containment
 *  lines (parent, child), between an element and one on the next level
 *  that the expansion which added the deeper one chose (any, for one no +
 *  added); the other relations between its elements are `hidden`. */
export function explorationLines(x: Exploration, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): {
  relations: string[]; hidden: string[]; containment: Array<{ parent: string; child: string }>
} {
  const listed = new Set(listedIds(x, nodes))
  const level = levelOf(x)
  const all = fullChoice()
  const choiceOf = (deeper: string): Omit<ExplorationExpansion, 'id' | 'from'> => x.expansions[x.addedBy[deeper]] ?? all
  const drawn: string[] = []
  const hidden: string[] = []
  for (const r of Object.values(relations)) {
    if (!listed.has(r.sourceId) || !listed.has(r.targetId) || r.sourceId === r.targetId) continue
    const ls = level(r.sourceId)
    const lt = level(r.targetId)
    let ok = Math.abs(ls - lt) === 1
    if (ok) {
      // From the nearer end, as its + saw it.
      const near = ls < lt ? r.sourceId : r.targetId
      const far = near === r.sourceId ? r.targetId : r.sourceId
      ok = chooses(choiceOf(far), { id: far, via: 'relation', type: relationKey(r), direction: near === r.sourceId ? 'out' : 'in' })
    }
    ;(ok ? drawn : hidden).push(r.id)
  }
  const containment: Array<{ parent: string; child: string }> = []
  for (const child of listed) {
    const parent = nodes[child].parentId
    if (!parent || !listed.has(parent)) continue
    const lc = level(child)
    const lp = level(parent)
    if (lc === lp + 1 && chooses(choiceOf(child), { id: child, via: 'child', direction: 'out' })) containment.push({ parent, child })
    else if (lp === lc + 1 && chooses(choiceOf(parent), { id: parent, via: 'parent', direction: 'in' })) containment.push({ parent, child })
  }
  return { relations: drawn, hidden, containment }
}

/** The nodes as the exploration draws them: what it lists on its own,
 *  without its parent. */
export function flatNodes(x: Exploration, nodes: Record<string, C4Node>): Record<string, C4Node> {
  const out: Record<string, C4Node> = { ...nodes }
  for (const id of listedIds(x, nodes)) if (nodes[id].parentId) out[id] = { ...nodes[id], parentId: undefined }
  return out
}

/**
 * Places for every element it lists, laid out again as a whole: levels
 * top-down, a level of more than EXPLORATION_ROW elements in rows of that
 * many, each element in its level below the element whose + added it
 * (ordered by where that one stands, then as added), as far apart as the
 * canvas keeps elements and the labels of the lines drawn between levels
 * need. Places are where the elements are drawn (not relative to a parent:
 * it is flat), with the start at `startAt` when given. No engine: rows and
 * widths are worked out directly, in O(n log n).
 */
export function laidOut(x: Exploration, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, startAt?: { x: number; y: number }): Record<string, NodePosition> {
  const ids = listedIds(x, nodes)
  if (!ids.length) return {}
  const level = levelOf(x)
  const order = new Map(ids.map((id, i) => [id, i]))
  const size = new Map(ids.map((id) => [id, drawnSize(nodes[id], false)]))
  // The room the label of a line between two levels needs.
  const lines = explorationLines(x, nodes, relations)
  let between = BETWEEN_LEVELS
  for (const rid of lines.relations) {
    const label = labelSizeOf(relations[rid], nodes)
    if (label) between = Math.max(between, labelNeed(label).y)
  }
  const byLevel = new Map<number, string[]>()
  for (const id of ids) {
    const l = level(id)
    const list = byLevel.get(l)
    if (list) list.push(id)
    else byLevel.set(l, [id])
  }
  const centre = new Map<string, number>()
  const places: Record<string, NodePosition> = {}
  let y = 0
  for (const l of [...byLevel.keys()].sort((a, b) => a - b)) {
    // Below the element that added each, where that one stands; then as added.
    const key = (id: string): number => {
      const by = x.expansions[x.addedBy[id]]
      return by && centre.has(by.from) ? centre.get(by.from)! : Infinity
    }
    const list = byLevel.get(l)!.map((id) => ({ id, key: key(id) }))
      .sort((a, b) => (a.key === b.key ? 0 : a.key === Infinity ? 1 : b.key === Infinity ? -1 : a.key - b.key) || order.get(a.id)! - order.get(b.id)!)
    for (let start = 0; start < list.length; start += EXPLORATION_ROW) {
      const row = list.slice(start, start + EXPLORATION_ROW)
      const width = row.reduce((sum, e) => sum + size.get(e.id)!.width, 0) + IN_ROW * (row.length - 1)
      const height = Math.max(...row.map((e) => size.get(e.id)!.height))
      // Centred under the elements it came from.
      const keyed = row.filter((e) => e.key !== Infinity)
      const middle = keyed.length ? keyed.reduce((sum, e) => sum + e.key, 0) / keyed.length : 0
      let left = middle - width / 2
      for (const e of row) {
        const s = size.get(e.id)!
        const n = nodes[e.id]
        places[e.id] = { x: left, y, width: n.width, height: n.height }
        centre.set(e.id, left + s.width / 2)
        left += s.width + IN_ROW
      }
      y += height + (start + EXPLORATION_ROW < list.length ? BETWEEN_ROWS : between)
    }
  }
  const start = ids[0]
  if (startAt && places[start]) {
    const dx = startAt.x - places[start].x
    const dy = startAt.y - places[start].y
    for (const p of Object.values(places)) { p.x += dx; p.y += dy }
  }
  return places
}

/** Where `id` is drawn when its places are relative to its parents. */
function absolute(id: string, nodes: Record<string, C4Node>): { x: number; y: number } {
  let x = 0
  let y = 0
  for (let n: C4Node | undefined = nodes[id]; n; n = n.parentId ? nodes[n.parentId] : undefined) { x += n.x; y += n.y }
  return { x, y }
}

/** Where its start is drawn on a canvas whose places are relative. */
export function drawnAt(id: string, nodes: Record<string, C4Node>): { x: number; y: number } {
  return absolute(id, nodes)
}

/** Its places as a structure view keeps them (relative to the parents, a
 *  view's containers round what they hold): for Save as view. A child it
 *  listed with its parent is nested in it there, where the view places it. */
export function viewPlaces(x: Exploration, flat: Record<string, NodePosition>, nodes: Record<string, C4Node>): Record<string, NodePosition> {
  const listed = new Set(listedIds(x, nodes))
  const abs = new Map<string, { x: number; y: number; w: number; h: number }>()
  for (const id of listed) {
    const p = flat[id]
    if (p) abs.set(id, { x: p.x, y: p.y, w: drawnSize(nodes[id], false).width, h: drawnSize(nodes[id], false).height })
  }
  // The containers it does not list, round what they hold, deepest first.
  const depth = (id: string): number => {
    let d = 0
    for (let p = nodes[id]?.parentId; p && d < 64; p = nodes[p]?.parentId) d++
    return d
  }
  const frames = new Set<string>()
  for (const id of listed) for (let p = nodes[id].parentId; p && nodes[p] && !listed.has(p); p = nodes[p].parentId) frames.add(p)
  for (const id of [...frames].sort((a, b) => depth(b) - depth(a))) {
    const inside = [...abs.entries()].filter(([child]) => nodes[child]?.parentId === id).map(([, b]) => b)
    if (!inside.length) continue
    const pad = compoundPadding(nodes[id].type)
    const minX = Math.min(...inside.map((b) => b.x))
    const minY = Math.min(...inside.map((b) => b.y))
    const maxX = Math.max(...inside.map((b) => b.x + b.w))
    const maxY = Math.max(...inside.map((b) => b.y + b.h))
    abs.set(id, { x: minX - pad.side, y: minY - pad.top, w: maxX - minX + 2 * pad.side, h: maxY - minY + pad.top + pad.bottom })
  }
  const out: Record<string, NodePosition> = {}
  for (const [id, b] of abs) {
    const n = nodes[id]
    const parent = n.parentId ? abs.get(n.parentId) : undefined
    out[id] = { x: b.x - (parent?.x ?? 0), y: b.y - (parent?.y ?? 0), width: frames.has(id) ? b.w : n.width, height: frames.has(id) ? b.h : n.height }
  }
  return out
}

/** The exploration read again with the model `nodes` (an outside change):
 *  what is gone is gone from it too; none when nothing it listed is left. */
export function prunedExploration(x: Exploration | null, nodes: Record<string, C4Node>): Exploration | null {
  if (!x) return null
  const nodeIds = listedIds(x, nodes)
  if (!nodeIds.length) return null
  const has = ([id]: [string, unknown]): boolean => !!nodes[id]
  return {
    ...x,
    nodeIds,
    positions: Object.fromEntries(Object.entries(x.positions).filter(has)),
    levels: Object.fromEntries(Object.entries(x.levels).filter(has)),
    addedBy: Object.fromEntries(Object.entries(x.addedBy).filter(has)),
    ...(x.collapsedNodeIds ? { collapsedNodeIds: x.collapsedNodeIds.filter((id) => !!nodes[id]) } : {}),
    ...(x.expandedNodeIds ? { expandedNodeIds: x.expandedNodeIds.filter((id) => !!nodes[id]) } : {}),
  }
}
