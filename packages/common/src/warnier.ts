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
 *  a chain of the types alone (processes and steps) draws the whole tree. */
export function warnierRows(view: DiagramView | undefined, ctx: PipelineContext): ChainRow[] {
  const result = runPipeline(view, ctx)
  if (result.rows && (pipelineOf(view)?.levels?.length ?? 0) > 1) return result.rows
  return containmentRows(result.rows ? result.nodes : result.source)
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
  const sortAll = (items: WarnierNode[]): WarnierNode[] => inOrder(items).map((item) => ({ ...item, children: sortAll(item.children) }))
  return sortAll(roots)
}
