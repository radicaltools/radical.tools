// ─── Warnier–Orr diagrams ────────────────────────────────────────────────────
//
// A view of kind `warnier` draws what it shows as a Warnier–Orr diagram: each
// element with what is under it to its right, in a brace. Any hierarchy reads
// that way; a process reads with its notation: how often a step runs
// ((1,n) for each order line), alternatives (⊕) and parts that run at once
// (+). A state machine's states read the same way: a compound state's
// children are alternatives, a parallel state's regions run at once.
//
// Pure: the tree is built here, so Studio's view and any later export draw
// the same.

import type { C4Node, DiagramView } from './c4'
import { containmentRows, pipelineOf, runPipeline, type ChainRow, type PipelineContext } from './viewPipeline'

/** How an element's children run. */
export type WarnierMode = 'sequence' | 'choice' | 'concurrent'

export interface WarnierNode {
  /** Unique in the tree: the row's path. */
  key: string
  node: C4Node
  /** How often it happens, "(1,n)", "(0,1)", "(0,n)"; null when once. */
  repeat: string | null
  /** What it happens for: "for each order line". */
  condition: string | null
  /** How its children run. */
  mode: WarnierMode
  children: WarnierNode[]
  /** Under how many other parents it shows too (a chain can list an element twice). */
  alsoIn: number
}

const REPEAT_LABELS: Record<string, string> = { '0..1': '(0,1)', '1..n': '(1,n)', '0..n': '(0,n)' }
/** How often an alternative happens. */
export const ALTERNATIVE = '(0,1)'

const field = (node: C4Node, key: string): unknown => (node as unknown as Record<string, unknown>)[key]

/** "(1,n)" for a step that repeats, null for one that runs once. */
export function repeatLabel(node: C4Node): string | null {
  const repeat = field(node, 'repeat')
  return typeof repeat === 'string' ? REPEAT_LABELS[repeat] ?? null : null
}

/** How the element's children run: what it says (`children`), a parallel
 *  state's regions at once, a machine's or compound state's states one of
 *  them, else in sequence. */
export function warnierMode(node: C4Node): WarnierMode {
  const children = field(node, 'children')
  if (children === 'choice' || children === 'concurrent') return children
  if (node.type === 'state' && field(node, 'kind') === 'parallel') return 'concurrent'
  if (node.type === 'state' || node.type === 'state-machine') return 'choice'
  return 'sequence'
}

/** The rows a Warnier view draws: the view's chain when it has levels to
 *  nest; with one level or none, the elements it shows by containment, so
 *  a chain of the types alone (processes and steps) draws the whole tree.
 *  There, `naming` (an element just added, its name being written) is drawn
 *  where it goes even when the filter leaves it out, so that the name that
 *  may let it through can be written. */
export function warnierRows(view: DiagramView | undefined, ctx: PipelineContext, naming?: string): ChainRow[] {
  const result = runPipeline(view, ctx)
  if (result.rows && (pipelineOf(view)?.levels?.length ?? 0) > 1) return result.rows
  const shown = result.rows ? result.nodes : result.source
  const extra = naming && ctx.nodes[naming] && !shown.some((n) => n.id === naming) ? [ctx.nodes[naming]] : []
  return containmentRows([...shown, ...extra])
}

/** Siblings with an order first, by it; the rest after them as they came. */
function inOrder(nodes: WarnierNode[]): WarnierNode[] {
  const orderOf = (n: WarnierNode): number | null => {
    const order = field(n.node, 'order')
    const value = typeof order === 'number' ? order : typeof order === 'string' && order.trim() ? Number(order) : NaN
    return Number.isFinite(value) ? value : null
  }
  return nodes
    .map((n, i) => ({ n, i, order: orderOf(n) }))
    .sort((a, b) => (a.order === null ? (b.order === null ? a.i - b.i : 1) : b.order === null ? -1 : a.order - b.order || a.i - b.i))
    .map(({ n }) => n)
}

/** The rows (depth first, as a chain or containment gives them) as a
 *  Warnier tree. Pseudostates are left out: a machine passes through them
 *  and rests in none. */
export function warnierTree(rows: ChainRow[]): WarnierNode[] {
  const roots: WarnierNode[] = []
  const stack: Array<{ depth: number; item: WarnierNode }> = []
  let skipBelow: number | null = null
  for (const row of rows) {
    if (skipBelow !== null && row.depth > skipBelow) continue
    skipBelow = null
    if (row.node.type === 'pseudostate') { skipBelow = row.depth; continue }
    const condition = field(row.node, 'condition')
    const item: WarnierNode = {
      key: row.path,
      node: row.node,
      repeat: repeatLabel(row.node),
      condition: typeof condition === 'string' && condition.trim() ? condition.trim() : null,
      mode: warnierMode(row.node),
      children: [],
      alsoIn: row.alsoIn,
    }
    while (stack.length && stack[stack.length - 1].depth >= row.depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.item.children.push(item)
    else roots.push(item)
    stack.push({ depth: row.depth, item })
  }
  // An alternative happens at most once: (0,1) under each child of a choice
  // that does not say how often it happens otherwise (Warnier–Orr notation).
  const sortAll = (items: WarnierNode[], choice = false): WarnierNode[] => inOrder(items).map((item) => ({
    ...item,
    ...(choice && !item.repeat ? { repeat: ALTERNATIVE } : {}),
    children: sortAll(item.children, item.mode === 'choice'),
  }))
  return sortAll(roots)
}

// ─── Editing the outline ─────────────────────────────────────────────────────
//
// Where the tree is containment (warnierEditable), the view edits it like an
// outline: add after or inside, indent under the element before, outdent
// after the parent, move up or down. Each plan says where the element goes
// and numbers the siblings it lands among, and the ones it left, 1, 2, 3, …
// in the order shown (`order`, for the types that have one: the folder keeps
// no order among siblings). The view applies a plan as one undo step.

/** Whether the view's Warnier tree is containment, which the view edits; a
 *  chain of two levels or more hangs elements by relations and is renamed only. */
export function warnierEditable(view: DiagramView | undefined): boolean {
  return (pipelineOf(view)?.levels?.length ?? 0) <= 1
}

export interface Located {
  item: WarnierNode
  /** Its parent in the tree; null for a root. */
  parent: WarnierNode | null
  siblings: WarnierNode[]
  index: number
}

/** The item with `key`, with its parent and siblings. */
export function locate(tree: WarnierNode[], key: string, parent: WarnierNode | null = null): Located | null {
  for (let index = 0; index < tree.length; index++) {
    const item = tree[index]
    if (item.key === key) return { item, parent, siblings: tree, index }
    const found = locate(item.children, key, item)
    if (found) return found
  }
  return null
}

/** Every item, depth first, as the view shows them top to bottom. */
export function flatten(tree: WarnierNode[]): WarnierNode[] {
  return tree.flatMap((item) => [item, ...flatten(item.children)])
}

/** order 1, 2, 3, … for the elements of `nodes` whose type has one. */
export function renumber(nodes: C4Node[], hasOrder: (type: string) => boolean): Record<string, number> {
  const orders: Record<string, number> = {}
  nodes.forEach((node, i) => { if (hasOrder(node.type)) orders[node.id] = i + 1 })
  return orders
}

export interface OutlinePlan {
  /** The element's new parent (null: the top of the model); absent when it stays. */
  parentId?: string | null
  /** The order of each element that gets one. */
  orders: Record<string, number>
}

export type OutlineMove = 'up' | 'down' | 'indent' | 'outdent'

const parentIdOf = (at: Located): string | null => (at.parent ? at.parent.node.id : at.item.node.parentId ?? null)
const without = (list: WarnierNode[], index: number): C4Node[] => list.filter((_, i) => i !== index).map((s) => s.node)

/** Where `move` takes the item with `key`, or null when it cannot go: the
 *  first sibling up or indented, the last down, a root outdented. */
export function outlinePlan(tree: WarnierNode[], key: string, move: OutlineMove, hasOrder: (type: string) => boolean): OutlinePlan | null {
  const at = locate(tree, key)
  if (!at) return null
  const { item, siblings, index } = at
  const nodes = siblings.map((s) => s.node)
  if (move === 'up' || move === 'down') {
    const to = move === 'up' ? index - 1 : index + 1
    if (to < 0 || to >= siblings.length) return null
    const reordered = [...nodes]
    reordered.splice(index, 1)
    reordered.splice(to, 0, item.node)
    return { orders: renumber(reordered, hasOrder) }
  }
  if (move === 'indent') {
    if (index === 0) return null
    const into = siblings[index - 1]
    return {
      parentId: into.node.id,
      orders: { ...renumber(without(siblings, index), hasOrder), ...renumber([...into.children.map((c) => c.node), item.node], hasOrder) },
    }
  }
  if (!at.parent) return null
  const parentAt = locate(tree, at.parent.key)!
  const landing = [...parentAt.siblings.map((s) => s.node)]
  landing.splice(parentAt.index + 1, 0, item.node)
  return { parentId: parentIdOf(parentAt), orders: { ...renumber(without(siblings, index), hasOrder), ...renumber(landing, hasOrder) } }
}

export interface InsertPlan {
  /** Where the new element goes (null: the top of the model). */
  parentId: string | null
  /** Its order, when its type has one. */
  order?: number
  /** The orders of the siblings it lands among. */
  orders: Record<string, number>
}

/** Where a new element of `type` goes, after the item with `key` or inside
 *  it at the end, and how its siblings are numbered then. */
export function insertPlan(tree: WarnierNode[], key: string, where: 'after' | 'inside', type: string, hasOrder: (type: string) => boolean): InsertPlan | null {
  const at = locate(tree, key)
  if (!at) return null
  const NEW = '\0new'
  const placeholder = { id: NEW, type } as C4Node
  const landing = where === 'after' ? at.siblings.map((s) => s.node) : at.item.children.map((c) => c.node)
  landing.splice(where === 'after' ? at.index + 1 : landing.length, 0, placeholder)
  const { [NEW]: order, ...orders } = renumber(landing, hasOrder)
  return { parentId: where === 'after' ? parentIdOf(at) : at.item.node.id, ...(order !== undefined ? { order } : {}), orders }
}

// ─── The flow of steps on a canvas ───────────────────────────────────────────

export interface FlowArrow {
  id: string
  sourceId: string
  targetId: string
}

/** The arrows a canvas draws between steps that follow each other: among
 *  the steps of each process or step whose children run in sequence, from
 *  each to the next by order (the rest after them, by name). The children of
 *  a choice or of a concurrent step have none: their parent's header says
 *  how they run. Nothing of it is stored. */
export function processFlow(nodes: Record<string, C4Node>): FlowArrow[] {
  const byParent = new Map<string, C4Node[]>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'step' || !node.parentId || !nodes[node.parentId]) continue
    const list = byParent.get(node.parentId)
    if (list) list.push(node)
    else byParent.set(node.parentId, [node])
  }
  const arrows: FlowArrow[] = []
  for (const [parentId, steps] of byParent) {
    if (warnierMode(nodes[parentId]) !== 'sequence') continue
    const items = steps
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((node, i) => ({ key: node.id, node, repeat: null, condition: null, mode: 'sequence', children: [], alsoIn: 0, i }) as WarnierNode)
    const ordered = inOrder(items).map((item) => item.node)
    for (let i = 1; i < ordered.length; i++) {
      arrows.push({ id: `flow:${ordered[i - 1].id}>${ordered[i].id}`, sourceId: ordered[i - 1].id, targetId: ordered[i].id })
    }
  }
  return arrows
}
