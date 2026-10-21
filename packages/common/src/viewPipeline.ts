// ─── View pipeline ──────────────────────────────────────────────────────────
// What a view does with its elements (DiagramView.pipeline): a chain of
// levels, always among the elements the view shows (all of them for a view
// that lists none). The first level's elements are the roots; each next level's
// hang under an element of the level above, along a relation or as the
// children it contains: needs, under each the requirements refined from it,
// under each of those the scenarios that verify it. Every level keeps the
// elements of its types that pass its filters (joined with and, or in runs
// with or). An element under several parents shows under each. The table
// view and the Structure tree show the result. The suggest* functions offer
// the steps that fit, with how many elements each concerns.

import type { C4Node, C4Relation, ChainLevel, ChainVia, ChainWay, DiagramView, ViewFilter, ViewPipeline, ViewSort } from './c4'
import { viewShowsEveryNode } from './c4'
import type { Metamodel, PropertyDef } from './metamodel/types'
import type { WizardLink } from './metamodel/wizard'
import { inferRelationType, isParentAllowed, isPlacementAllowed } from './metamodel/lookup'

export interface PipelineContext {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation> | C4Relation[]
  metamodel: Metamodel
}

/** Relations by end and children by parent, for one context. */
interface RelationIndex {
  out: Map<string, C4Relation[]>
  in: Map<string, C4Relation[]>
  children: Map<string, string[]>
}

const indexCache = new WeakMap<object, { nodes: object; index: RelationIndex }>()

/** The index each context was answered with (relationIndex). */
const ctxIndex = new WeakMap<PipelineContext, RelationIndex>()

const readCache = new WeakMap<object, ViewPipeline | undefined>()

/** A view's chain as the engine reads it, whatever a file holds: a level
 *  written before levels had ways ({ types, via }) becomes one way, and what
 *  cannot be read (an older groupBy, a level that is not an object) is left
 *  out, so an old or hand-edited model opens. Read everything through this
 *  (pipelineOf), never `view.pipeline` itself. */
export function readPipeline(raw: unknown): ViewPipeline | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  if (readCache.has(raw)) return readCache.get(raw)
  const r = raw as Record<string, unknown>
  const levels: ChainLevel[] = []
  for (const l of Array.isArray(r.levels) ? r.levels : []) {
    if (!l || typeof l !== 'object') continue
    const level = l as Record<string, unknown>
    const ways = (Array.isArray(level.ways) ? level.ways : [{ types: level.types, via: level.via }])
      .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
      .map((w): ChainWay => {
        const way: ChainWay = {}
        if (Array.isArray(w.types) && w.types.length) way.types = w.types.filter((t): t is string => typeof t === 'string')
        const via = w.via as Record<string, unknown> | undefined
        if (via && via.contains === true) way.via = { contains: true }
        else if (via && via.anyRelation === true) way.via = { anyRelation: true }
        else if (via && typeof via.relationType === 'string' && (via.direction === 'in' || via.direction === 'out')) way.via = { relationType: via.relationType, direction: via.direction }
        return way
      })
    if (!ways.length) continue
    const filters = Array.isArray(level.filters) ? (level.filters as ViewFilter[]).filter((f) => !!f && typeof f === 'object' && typeof f.kind === 'string') : []
    levels.push(filters.length ? { ways, filters } : { ways })
  }
  const pipeline: ViewPipeline = {}
  if (levels.length) pipeline.levels = levels
  const sort = r.sort as ViewSort | undefined
  if (sort && typeof sort === 'object' && (sort.by === 'label' || sort.by === 'type' || sort.by === 'property')) pipeline.sort = sort
  if (r.edges === 'all') pipeline.edges = 'all'
  const read = Object.keys(pipeline).length ? pipeline : undefined
  readCache.set(raw, read)
  return read
}

/** `view`'s chain, read with readPipeline. */
export function pipelineOf(view: DiagramView | undefined): ViewPipeline | undefined {
  return readPipeline(view?.pipeline)
}

function relationIndex(ctx: PipelineContext): RelationIndex {
  // Once per context (one run of a chain asks it for every element), and
  // across runs for frozen data (Studio's store) only: a model changed in
  // place (the MCP server's) would be answered from the relations it had.
  const own = ctxIndex.get(ctx)
  if (own) return own
  const cacheable = Object.isFrozen(ctx.relations) && Object.isFrozen(ctx.nodes)
  const cached = cacheable ? indexCache.get(ctx.relations) : undefined
  if (cached && cached.nodes === ctx.nodes) {
    ctxIndex.set(ctx, cached.index)
    return cached.index
  }
  const index: RelationIndex = { out: new Map(), in: new Map(), children: new Map() }
  const list = Array.isArray(ctx.relations) ? ctx.relations : Object.values(ctx.relations)
  for (const r of list) {
    const o = index.out.get(r.sourceId)
    if (o) o.push(r)
    else index.out.set(r.sourceId, [r])
    const i = index.in.get(r.targetId)
    if (i) i.push(r)
    else index.in.set(r.targetId, [r])
  }
  for (const n of Object.values(ctx.nodes)) {
    if (!n.parentId) continue
    const c = index.children.get(n.parentId)
    if (c) c.push(n.id)
    else index.children.set(n.parentId, [n.id])
  }
  ctxIndex.set(ctx, index)
  if (cacheable) indexCache.set(ctx.relations, { nodes: ctx.nodes, index })
  return index
}

function typeLabel(ctx: PipelineContext, typeId: string): string {
  return ctx.metamodel.nodeTypes[typeId]?.label ?? typeId
}

// One collator for every comparison: localeCompare with options builds one
// per call, which made sorting a large view's elements take tens of ms.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const byLabel = (a: { label: string }, b: { label: string }) => collator.compare(a.label, b.label)

// ─── Filters ────────────────────────────────────────────────────────────────

function ancestorsOf(node: C4Node, ctx: PipelineContext): string[] {
  const out: string[] = []
  for (let p = node.parentId; p && ctx.nodes[p] && !out.includes(p); p = ctx.nodes[p].parentId) out.push(p)
  return out
}

function propertyValues(node: C4Node, key: string): string[] {
  const raw = (node as unknown as Record<string, unknown>)[key]
  if (raw === undefined || raw === null || raw === '') return []
  return (Array.isArray(raw) ? raw : [raw]).map((v) => String(v))
}

/** Whether `filter` lets `node` through. */
export function matchesFilter(filter: ViewFilter, node: C4Node, ctx: PipelineContext): boolean {
  switch (filter.kind) {
    case 'type': return filter.types.includes(node.type)
    case 'property': {
      const values = propertyValues(node, filter.key)
      if (filter.op === 'set') return values.length > 0
      if (filter.op === 'unset') return values.length === 0
      const hit = values.some((v) => filter.values?.includes(v))
      return filter.op === 'is' ? hit : !hit
    }
    case 'relation': {
      const index = relationIndex(ctx)
      const list = (filter.direction === 'out' ? index.out : index.in).get(node.id) ?? []
      return list.some((r) => r.relationType === filter.relationType) === filter.has
    }
    case 'within': return (!!filter.self && node.id === filter.nodeId) || ancestorsOf(node, ctx).includes(filter.nodeId)
    case 'text': {
      const q = filter.text.trim().toLowerCase()
      return !q || `${node.label} ${node.description ?? ''} ${node.technology ?? ''}`.toLowerCase().includes(q)
    }
  }
}

/** The runs of filters joined with or, in order: [[A], [B, C]] for "A and (B or C)". */
export function filterRuns(filters: ViewFilter[] | undefined): number[][] {
  const runs: number[][] = []
  ;(filters ?? []).forEach((f, i) => {
    if (i > 0 && f.join === 'or') runs[runs.length - 1].push(i)
    else runs.push([i])
  })
  return runs
}

/** The filters applied to `source`: each run of filters joined with or lets
 *  through what any of its filters (not switched off) does, and the runs
 *  follow each other. `counts[i]`: how many are left after filter i's run. */
export function applyFilters(source: C4Node[], filters: ViewFilter[] | undefined, ctx: PipelineContext): { nodes: C4Node[]; counts: number[] } {
  let nodes = source
  const counts: number[] = []
  for (const run of filterRuns(filters)) {
    const on = run.map((i) => filters![i]).filter((f) => !f.off)
    if (on.length) nodes = nodes.filter((n) => on.some((f) => matchesFilter(f, n, ctx)))
    for (const i of run) counts[i] = nodes.length
  }
  return { nodes, counts }
}

function relationName(relationType: string, direction: 'out' | 'in', ctx: PipelineContext): string {
  const def = ctx.metamodel.relationTypes[relationType]
  return direction === 'out'
    ? def?.forwardLabel ?? def?.label ?? relationType
    : def?.inverseLabel ?? `${def?.label ?? relationType} (back)`
}

function propertyLabel(key: string, ctx: PipelineContext): string {
  for (const t of Object.values(ctx.metamodel.nodeTypes)) {
    const p = t.properties?.find((d) => d.key === key)
    if (p) return p.label
  }
  return key
}

/** A filter in words: "Type is Requirement", "EARS type is not ubiquitous",
 *  "Has Derives from", "Inside Layout", "Text “fit”". */
export function filterLabel(filter: ViewFilter, ctx: PipelineContext): string {
  switch (filter.kind) {
    case 'type': return `Type is ${filter.types.map((t) => typeLabel(ctx, t)).join(' or ')}`
    case 'property': {
      const name = propertyLabel(filter.key, ctx)
      const shown = (filter.values ?? []).map((v) => ctx.nodes[v]?.label ?? v).join(' or ')
      if (filter.op === 'set') return `${name} is set`
      if (filter.op === 'unset') return `${name} is not set`
      return `${name} is ${filter.op === 'is-not' ? 'not ' : ''}${shown}`
    }
    case 'relation': return `${filter.has ? 'Has' : 'Has no'} ${relationName(filter.relationType, filter.direction, ctx)}`
    case 'within': return filter.self ? `${ctx.nodes[filter.nodeId]?.label ?? filter.nodeId} and what is inside it` : `Inside ${ctx.nodes[filter.nodeId]?.label ?? filter.nodeId}`
    case 'text': return `Text “${filter.text}”`
  }
}

export interface FilterSuggestion {
  filter: ViewFilter
  label: string
  /** How many of the rows it lets through. */
  count: number
}

/** Filters that would narrow `rows` (each lets some, not all, through):
 *  types, property values, relations, places. */
export function suggestFilters(rows: C4Node[], ctx: PipelineContext, typesHere: string[] = []): FilterSuggestion[] {
  const out: FilterSuggestion[] = []
  // The options of the enum properties of the level's types, also those no
  // element has yet (none, for a level built before its elements).
  const fromMetamodel = (): FilterSuggestion[] => {
    const held = new Set(out.map((o) => o.label))
    const extra: FilterSuggestion[] = []
    for (const t of typesHere) {
      for (const p of ctx.metamodel?.nodeTypes[t]?.properties ?? []) {
        if (p.type !== 'enum') continue
        for (const v of p.options ?? []) {
          const filter: ViewFilter = { kind: 'property', key: p.key, op: 'is', values: [String(v)] }
          const label = filterLabel(filter, ctx)
          if (held.has(label)) continue
          held.add(label)
          extra.push({ filter, label, count: rows.filter((n) => matchesFilter(filter, n, ctx)).length })
        }
      }
    }
    return extra
  }
  if (!rows.length) return fromMetamodel()
  const push = (filter: ViewFilter) => {
    const count = rows.filter((n) => matchesFilter(filter, n, ctx)).length
    if (count > 0 && count < rows.length) out.push({ filter, label: filterLabel(filter, ctx), count })
  }
  const types = [...new Set(rows.map((n) => n.type))]
  if (types.length > 1) for (const t of types) push({ kind: 'type', types: [t] })

  const props = new Map<string, PropertyDef>()
  for (const n of rows) {
    for (const p of ctx.metamodel.nodeTypes[n.type]?.properties ?? []) {
      if (p.type === 'enum' || p.type === 'boolean' || p.type === 'ref') props.set(p.key, p)
    }
  }
  for (const p of props.values()) {
    const values = new Set<string>()
    for (const n of rows) for (const v of propertyValues(n, p.key)) values.add(v)
    for (const v of values) push({ kind: 'property', key: p.key, op: 'is', values: [v] })
    push({ kind: 'property', key: p.key, op: 'unset' })
  }

  const index = relationIndex(ctx)
  const rels = new Set<string>()
  for (const n of rows) {
    for (const r of index.out.get(n.id) ?? []) if (r.relationType) rels.add(`out:${r.relationType}`)
    for (const r of index.in.get(n.id) ?? []) if (r.relationType) rels.add(`in:${r.relationType}`)
  }
  for (const k of rels) {
    const [direction, relationType] = k.split(/:(.*)/s) as ['out' | 'in', string]
    push({ kind: 'relation', relationType, direction, has: true })
    push({ kind: 'relation', relationType, direction, has: false })
  }

  // Places: the containers the rows lie in, two levels from the top.
  const places = new Set<string>()
  for (const n of rows) for (const id of ancestorsOf(n, ctx).reverse().slice(0, 2)) places.add(id)
  for (const id of places) push({ kind: 'within', nodeId: id })
  return [...out, ...fromMetamodel().filter((o) => o.count === 0)]
}

// ─── Sort ───────────────────────────────────────────────────────────────────

/** `nodes` in `sort`'s order (by name when none); ties by name. */
export function sortNodes(nodes: C4Node[], sort: ViewSort | undefined, ctx: PipelineContext): C4Node[] {
  const key = (n: C4Node): string =>
    !sort || sort.by === 'label' ? n.label
    : sort.by === 'type' ? typeLabel(ctx, n.type)
    : propertyValues(n, sort.key ?? '').map((v) => ctx.nodes[v]?.label ?? v).join(', ')
  // Each element's key once, not once per comparison.
  const keys = new Map(nodes.map((n) => [n, key(n)]))
  const cmp = (a: C4Node, b: C4Node) => {
    const ka = keys.get(a)!, kb = keys.get(b)!
    // Elements without the value go last, whichever way.
    if (!ka !== !kb) return ka ? -1 : 1
    const c = collator.compare(ka, kb)
    return (sort?.desc ? -c : c) || byLabel(a, b)
  }
  return [...nodes].sort(cmp)
}

/** The order in words: "Name", "EARS type, descending". */
export function sortLabel(sort: ViewSort | undefined, ctx: PipelineContext): string {
  const name = !sort || sort.by === 'label' ? 'Name' : sort.by === 'type' ? 'Type' : propertyLabel(sort.key ?? '', ctx)
  return sort?.desc ? `${name}, descending` : name
}

/** The orders `rows` can take: name, type (when mixed) and each property
 *  with values among them. */
export function suggestSorts(rows: C4Node[], ctx: PipelineContext): { sort: ViewSort; label: string }[] {
  const out: { sort: ViewSort; label: string }[] = [{ sort: { by: 'label' }, label: 'Name' }]
  if (new Set(rows.map((n) => n.type)).size > 1) out.push({ sort: { by: 'type' }, label: 'Type' })
  const keys = new Set<string>()
  for (const n of rows) {
    for (const p of ctx.metamodel.nodeTypes[n.type]?.properties ?? []) {
      if (p.type !== 'textarea' && propertyValues(n, p.key).length) keys.add(p.key)
    }
  }
  for (const key of keys) out.push({ sort: { by: 'property', key }, label: propertyLabel(key, ctx) })
  return out
}

// ─── The chain ──────────────────────────────────────────────────────────────

/** The elements `via` leads to from `node`. */
function followVia(node: C4Node, via: ChainVia, ctx: PipelineContext): C4Node[] {
  const index = relationIndex(ctx)
  if ('contains' in via) return (index.children.get(node.id) ?? []).map((id) => ctx.nodes[id]).filter(Boolean)
  const out: C4Node[] = []
  const seen = new Set<string>()
  if ('anyRelation' in via) {
    for (const r of index.out.get(node.id) ?? []) { const o = ctx.nodes[r.targetId]; if (o && o.id !== node.id && !seen.has(o.id)) { seen.add(o.id); out.push(o) } }
    for (const r of index.in.get(node.id) ?? []) { const o = ctx.nodes[r.sourceId]; if (o && o.id !== node.id && !seen.has(o.id)) { seen.add(o.id); out.push(o) } }
    return out
  }
  const list = (via.direction === 'out' ? index.out : index.in).get(node.id) ?? []
  for (const r of list) {
    if (r.relationType !== via.relationType) continue
    const other = ctx.nodes[via.direction === 'out' ? r.targetId : r.sourceId]
    if (other && !seen.has(other.id)) { seen.add(other.id); out.push(other) }
  }
  return out
}

/** How a level hangs under the one above, in words: "Refined into",
 *  "Verified by", "Contains". */
export function viaLabel(via: ChainVia, ctx: PipelineContext): string {
  return 'contains' in via ? 'Contains' : 'anyRelation' in via ? 'Any relation' : relationName(via.relationType, via.direction, ctx)
}

/** A way's elements in words: "Need", "Requirement or Need", "Any element". */
export function wayTypesLabel(way: ChainWay, ctx: PipelineContext): string {
  return way.types?.length ? way.types.map((t) => typeLabel(ctx, t)).join(' or ') : 'Any element'
}

/** A way in words: "Need", "Every element", "Refined into → Requirement",
 *  "Verified by → Any element". */
export function wayLabel(way: ChainWay, ctx: PipelineContext): string {
  if (!way.via) return way.types?.length ? wayTypesLabel(way, ctx) : 'Every element'
  return `${viaLabel(way.via, ctx)} → ${wayTypesLabel(way, ctx)}`
}

/** A level in words, its ways joined with or. */
export function levelLabel(level: ChainLevel, ctx: PipelineContext): string {
  return level.ways.map((w) => wayLabel(w, ctx)).join(' or ')
}

function ofTypes(way: ChainWay, n: C4Node): boolean {
  return !way.types?.length || way.types.includes(n.type)
}

/** The elements `way` reaches from `node` (none for a way without a relation). */
function followWay(node: C4Node, way: ChainWay, ctx: PipelineContext): C4Node[] {
  return way.via ? followVia(node, way.via, ctx).filter((n) => ofTypes(way, n)) : []
}

/** One row of a chain's result: an element at its depth in the tree. */
export interface ChainRow {
  /** Unique among the rows: the ids from the root down to this element. */
  path: string
  depth: number
  node: C4Node
  /** Under how many other parents the element shows too. */
  alsoIn: number
  /** Whether rows of the next level hang under it. */
  hasChildren: boolean
}

export interface LevelResult {
  /** Elements the level could take, of its types, before its filters (distinct). */
  candidates: number
  /** Those elements. */
  input: C4Node[]
  /** How many each filter's run leaves, as applyFilters counts. */
  counts: number[]
  /** Elements the level keeps (distinct), in order. */
  shown: C4Node[]
}

export interface PipelineResult {
  /** The elements the pipeline starts from. */
  source: C4Node[]
  /** The relations the chain follows from an element to one under it. */
  relationIds: Set<string>
  levels: LevelResult[]
  /** The tree, depth first; null when the chain has no level. */
  rows: ChainRow[] | null
  /** Every element the result shows, once, in order. */
  nodes: C4Node[]
}

/** Whether a pipeline does anything beyond showing the view's elements. */
export function pipelineActive(p: ViewPipeline | undefined): boolean {
  return !!p && (!!p.levels?.length || !!p.sort)
}

/** The elements `view`'s chain works among: the ones it lists, or every
 *  element for a view that lists none. */
export function pipelineSource(view: DiagramView | undefined, ctx: PipelineContext): C4Node[] {
  const all = Object.values(ctx.nodes)
  if (!view || viewShowsEveryNode(view)) return all
  const ids = new Set(view.nodeIds)
  return all.filter((n) => ids.has(n.id))
}

/** `pipeline` run from `source`. */
export function runChain(source: C4Node[], raw: ViewPipeline | undefined, ctx: PipelineContext): PipelineResult {
  const pipeline = readPipeline(raw)
  const levels = pipeline?.levels ?? []
  const sort = pipeline?.sort
  if (!levels.length) return { source, relationIds: new Set(), levels: [], rows: null, nodes: sortNodes(source, sort, ctx) }
  const inSource = new Set(source.map((n) => n.id))

  // Level by level: what each could take and what it keeps.
  const results: LevelResult[] = []
  const kept: Set<string>[] = []
  let above: C4Node[] = []
  levels.forEach((level, i) => {
    // What any of the level's ways reaches, once each.
    const seen = new Map<string, C4Node>()
    for (const way of level.ways) {
      if (i === 0) for (const n of source) { if (ofTypes(way, n)) seen.set(n.id, n) }
      else for (const parent of above) for (const n of followWay(parent, way, ctx)) { if (inSource.has(n.id)) seen.set(n.id, n) }
    }
    const candidates = [...seen.values()]
    const { nodes, counts } = applyFilters(candidates, level.filters, ctx)
    results.push({ candidates: candidates.length, input: candidates, counts, shown: sortNodes(nodes, sort, ctx) })
    kept.push(new Set(nodes.map((n) => n.id)))
    above = nodes
  })

  // The tree: each element under every parent it hangs from.
  const rows: ChainRow[] = []
  const occurrences = new Map<string, number>()
  const relationIds = new Set<string>()
  const index = relationIndex(ctx)
  const childrenOf = (node: C4Node, at: number): C4Node[] => {
    const kids = new Map<string, C4Node>()
    for (const way of levels[at]?.ways ?? []) {
      for (const n of followWay(node, way, ctx)) if (kept[at].has(n.id)) kids.set(n.id, n)
      // The relations this way follows to the kids it keeps.
      const via = way.via
      if (via && 'anyRelation' in via) {
        for (const r of index.out.get(node.id) ?? []) if (kids.has(r.targetId) && ofTypes(way, ctx.nodes[r.targetId])) relationIds.add(r.id)
        for (const r of index.in.get(node.id) ?? []) if (kids.has(r.sourceId) && ofTypes(way, ctx.nodes[r.sourceId])) relationIds.add(r.id)
      } else if (via && !('contains' in via)) {
        for (const r of (via.direction === 'out' ? index.out : index.in).get(node.id) ?? []) {
          const other = via.direction === 'out' ? r.targetId : r.sourceId
          if (r.relationType === via.relationType && kids.has(other) && ofTypes(way, ctx.nodes[other])) relationIds.add(r.id)
        }
      }
    }
    return sortNodes([...kids.values()], sort, ctx)
  }
  const walk = (node: C4Node, at: number, path: string, onPath: Set<string>) => {
    const kids = at + 1 < levels.length ? childrenOf(node, at + 1).filter((n) => !onPath.has(n.id)) : []
    rows.push({ path, depth: at, node, alsoIn: 0, hasChildren: kids.length > 0 })
    occurrences.set(node.id, (occurrences.get(node.id) ?? 0) + 1)
    for (const kid of kids) walk(kid, at + 1, `${path}/${kid.id}`, new Set(onPath).add(kid.id))
  }
  for (const root of results[0].shown) walk(root, 0, root.id, new Set([root.id]))
  for (const row of rows) row.alsoIn = (occurrences.get(row.node.id) ?? 1) - 1

  const nodes: C4Node[] = []
  const listed = new Set<string>()
  for (const row of rows) if (!listed.has(row.node.id)) { listed.add(row.node.id); nodes.push(row.node) }
  return { source, relationIds, levels: results, rows, nodes }
}

/** The view kinds that draw elements and the relations between them, and so
 *  take a chain's elements and relations: the canvas, the matrix and the
 *  hierarchy. The table and the wiki show the chain's rows instead. */
export function drawsChain(view: DiagramView | undefined): boolean {
  return !view?.kind || view.kind === 'static' || view.kind === 'matrix' || view.kind === 'treemap'
}

/** What a view that draws a chain (drawsChain) shows: the elements the chain
 *  gives, and the relations it follows (null: every relation between them, as
 *  `edges: 'all'` asks). Null for a view without a chain, or one of another
 *  kind. */
export function chainDrawn(view: DiagramView | undefined, ctx: PipelineContext): { nodeIds: Set<string>; relationIds: Set<string> | null } | null {
  const pipeline = pipelineOf(view)
  if (!pipeline?.levels?.length || !drawsChain(view)) return null
  const result = runPipeline(view, ctx)
  return { nodeIds: new Set(result.nodes.map((n) => n.id)), relationIds: pipeline.edges === 'all' ? null : result.relationIds }
}

/** What a view that draws a chain puts on a canvas: chainDrawn's elements
 *  with the containers they sit in, and its relations. */
export function chainCanvas(view: DiagramView | undefined, ctx: PipelineContext): { nodeIds: Set<string>; relationIds: Set<string> | null } | null {
  const drawn = chainDrawn(view, ctx)
  if (!drawn) return null
  const nodeIds = new Set<string>()
  for (const first of drawn.nodeIds) {
    for (let id: string | undefined = first; id && ctx.nodes[id] && !nodeIds.has(id); id = ctx.nodes[id].parentId) nodeIds.add(id)
  }
  return { nodeIds, relationIds: drawn.relationIds }
}

/** The type a new relation from `sourceId` to `targetId` takes so that
 *  `view`, which draws a chain (chainDrawn), shows it: the type the
 *  metamodel infers when the chain follows that, else the first relation
 *  type the chain follows that connects the two. `relationType` is
 *  undefined where the inferred relation has no type. Null when no relation
 *  between the two would be drawn: the view only draws the relations its
 *  chain follows, and a relation added there would be lost from sight. */
export function chainRelationFor(
  view: DiagramView | undefined,
  sourceId: string,
  targetId: string,
  ctx: PipelineContext,
): { relationType?: string } | null {
  const source = ctx.nodes[sourceId], target = ctx.nodes[targetId]
  if (!source || !target) return null
  const inferred = inferRelationType(ctx.metamodel, source.type, target.type)
  const candidates: (string | undefined)[] = [inferred]
  for (const level of pipelineOf(view)?.levels ?? []) {
    for (const way of level.ways) {
      const type = way.via && 'relationType' in way.via ? way.via.relationType : undefined
      if (!type || candidates.includes(type)) continue
      const def = ctx.metamodel?.relationTypes[type]
      if (def && (!def.allowedPairs.length || def.allowedPairs.some((p) => p.from === source.type && p.to === target.type))) candidates.push(type)
    }
  }
  const relations = Array.isArray(ctx.relations) ? Object.fromEntries(ctx.relations.map((r) => [r.id, r])) : ctx.relations
  const id = '\u0000new'
  for (const relationType of candidates) {
    const drawn = chainDrawn(view, { ...ctx, relations: { ...relations, [id]: { id, sourceId, targetId, ...(relationType ? { relationType } : {}) } } })
    if (!drawn) return relationType ? { relationType } : {}
    if (drawn.nodeIds.has(sourceId) && drawn.nodeIds.has(targetId) && (!drawn.relationIds || drawn.relationIds.has(id))) return relationType ? { relationType } : {}
  }
  return null
}

const NO_METAMODEL: Metamodel = { id: '', name: '', nodeTypes: {}, relationTypes: {} }

/** The elements a view shows, or undefined when it shows every element:
 *  what its chain gives, or without one the elements it lists — exactly
 *  those, on every kind of view: a canvas draws the containers they sit in
 *  only as invisible frames (withAncestors), and Filter, Structure and the
 *  canvas count the same. A flow view shows its sequence, and keeps its
 *  list. Everything that asks which elements a view shows (going to an
 *  element, queries, slides, layout) asks this, so a change to the chain or
 *  to the model reaches all of them. */
export function viewShownNodes(view: DiagramView | undefined, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Set<string> | undefined {
  if (!view) return undefined
  // Switching views saves the outgoing view's positions, which gives every
  // caller (the view cards' counts, Quick Search, the layout input) a new
  // views object: the answer is kept while what it depends on is the same.
  // Only for frozen data (Studio's store): the MCP server's model changes
  // in place, where the same objects say something else after an edit.
  const cacheable = Object.isFrozen(nodes) && Object.isFrozen(relations) && Object.isFrozen(view.nodeIds)
  if (cacheable) {
    const hit = shownCache.get(view.nodeIds)
    if (hit && hit.nodes === nodes && hit.relations === relations && hit.pipeline === view.pipeline && hit.kind === view.kind && hit.empty === view.empty) return hit.shown
  }
  const shown = computeShownNodes(view, nodes, relations)
  if (cacheable) shownCache.set(view.nodeIds, { nodes, relations, pipeline: view.pipeline, kind: view.kind, empty: view.empty, shown })
  return shown
}

/** What viewShownNodes answered for a view's node list, and from what. */
const shownCache = new WeakMap<readonly string[], {
  nodes: object; relations: object; pipeline: unknown; kind: DiagramView['kind']; empty: DiagramView['empty']; shown: Set<string> | undefined
}>()

function computeShownNodes(view: DiagramView, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Set<string> | undefined {
  if (pipelineOf(view)?.levels?.length && view.kind !== 'dynamic') {
    return new Set(runPipeline(view, { nodes, relations, metamodel: NO_METAMODEL }).nodes.map((n) => n.id))
  }
  if (viewShowsEveryNode(view)) return undefined
  return new Set(view.nodeIds.filter((id) => id in nodes))
}

/** What a view draws when its filter chain decides it (undefined when its
 *  list does, or it shows every node): for viewCanvasPositions, so that it
 *  keeps the positions of those elements only. */
export function viewDrawnIds(view: DiagramView | undefined, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): Set<string> | undefined {
  if (!view || !pipelineOf(view)?.levels?.length || view.kind === 'dynamic') return undefined
  return viewShownNodes(view, nodes, relations)
}

/** `ids` and every container they sit in. */
export function withAncestors(ids: Iterable<string>, nodes: Record<string, C4Node>): Set<string> {
  const out = new Set<string>()
  for (const first of ids) {
    for (let id: string | undefined = first; id && nodes[id] && !out.has(id); id = nodes[id].parentId) out.add(id)
  }
  return out
}

/** The elements' containment as rows like a chain's: each under its parent
 *  when the parent is among them, depth first, by name. */
export function containmentRows(nodes: C4Node[]): ChainRow[] {
  const ids = new Set(nodes.map((n) => n.id))
  const byParent = new Map<string | null, C4Node[]>()
  for (const n of nodes) {
    const key = n.parentId && ids.has(n.parentId) ? n.parentId : null
    const list = byParent.get(key)
    if (list) list.push(n)
    else byParent.set(key, [n])
  }
  for (const list of byParent.values()) list.sort(byLabel)
  const rows: ChainRow[] = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number, path: string) => {
    for (const n of byParent.get(parent) ?? []) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      const here = path ? `${path}/${n.id}` : n.id
      rows.push({ path: here, depth, node: n, alsoIn: 0, hasChildren: (byParent.get(n.id)?.length ?? 0) > 0 })
      walk(n.id, depth + 1, here)
    }
  }
  walk(null, 0, '')
  return rows
}

/** What a view shows, as a tree: its chain's, or, without a chain, its
 *  elements by containment (in a list, in its order, when it sets one). The
 *  table view and the Structure panel show it. */
export function structureRows(view: DiagramView | undefined, ctx: PipelineContext): ChainRow[] {
  const result = runPipeline(view, ctx)
  if (result.rows) return result.rows
  if (pipelineOf(view)?.sort) return result.nodes.map((node) => ({ path: node.id, depth: 0, node, alsoIn: 0, hasChildren: false }))
  return containmentRows(result.source)
}

/** `view`'s pipeline run on the model. */
export function runPipeline(view: DiagramView | undefined, ctx: PipelineContext): PipelineResult {
  return runChain(pipelineSource(view, ctx), pipelineOf(view), ctx)
}

// ─── Adding elements where the rows are ─────────────────────────────────────

/** An element the table can add: of `type`, inside `parentId` (none: at the
 *  top of the model), linked to the row it is added under by `link`. */
export interface AddChoice {
  type: string
  parentId?: string
  link?: WizardLink
  /** Values that let it through the level's filters ('' clears a default). */
  properties?: Record<string, string>
  /** The level's filters will not show it all the same (a text filter). */
  hidden?: true
  /** How it hangs under the row, in words: "Refined into", "Inside". */
  group: string
}

/** What a new element of `type` needs to pass `filters` (a level's): the
 *  values to give it and the element to put it in, or `excluded` when its
 *  type cannot pass. Each run of filters joined with or is met by its first
 *  filter that can be: a type it has, a property set to the first value
 *  named (or cleared of a default that fails it), inside the element named,
 *  the relation it gets anyway. A run none of whose filters can be met
 *  (a text the name must hold) leaves it `hidden`. */
function meetFilters(type: string, filters: ViewFilter[] | undefined, link: Omit<WizardLink, 'otherId'> | undefined, ctx: PipelineContext):
  { excluded: true } | { excluded?: false; properties: Record<string, string>; within?: string; hidden?: true } {
  const on = (filters ?? []).map((f, i) => ({ f, i })).filter(({ f }) => !f.off)
  const props = ctx.metamodel?.nodeTypes[type]?.properties ?? []
  const defaultOf = (key: string) => props.find((p) => p.key === key)?.default
  const properties: Record<string, string> = {}
  let within: string | undefined
  let hidden = false
  for (const run of filterRuns(on.map(({ f }) => f))) {
    const fs = run.map((i) => on[i].f)
    if (fs.every((f) => f.kind === 'type') && !fs.some((f) => f.kind === 'type' && f.types.includes(type))) return { excluded: true }
    const met = fs.some((f) => {
      switch (f.kind) {
        case 'type': return f.types.includes(type)
        case 'property': {
          const known = props.some((p) => p.key === f.key)
          const def = defaultOf(f.key)
          const hasDefault = def !== undefined && def !== ''
          if (f.op === 'is') { if (!known || !f.values?.length) return false; properties[f.key] = f.values[0]; return true }
          if (f.op === 'set') {
            if (hasDefault) return true
            const option = props.find((p) => p.key === f.key)?.options?.[0]
            if (!option) return false
            properties[f.key] = option
            return true
          }
          const fails = f.op === 'unset' ? hasDefault : hasDefault && !!f.values?.includes(String(def))
          if (fails) properties[f.key] = ''
          return true
        }
        case 'within': {
          const into = ctx.nodes[f.nodeId]
          if (!into || !isPlacementAllowed(ctx.metamodel, type, into, ctx.nodes)) return false
          within = into.id
          return true
        }
        case 'relation': {
          // From the new element: `out` is a relation it is the source of.
          const gets = !!link && link.relationType === f.relationType && link.direction === f.direction
          return gets === f.has
        }
        case 'text': return !f.text.trim()
      }
    })
    if (!met) hidden = true
  }
  return { properties, ...(within ? { within } : {}), ...(hidden ? { hidden: true as const } : {}) }
}

/** Where an element of `type` linked to `near` goes: beside it (in its
 *  parent), else at the top of the model, else inside it; undefined when
 *  none of these may hold it. */
function placeBeside(type: string, near: C4Node, ctx: PipelineContext): { parentId?: string } | undefined {
  const parent = near.parentId ? ctx.nodes[near.parentId] : undefined
  if (parent ? isPlacementAllowed(ctx.metamodel, type, parent, ctx.nodes) : isParentAllowed(ctx.metamodel, type, undefined)) {
    return parent ? { parentId: parent.id } : {}
  }
  if (isParentAllowed(ctx.metamodel, type, undefined)) return {}
  if (isPlacementAllowed(ctx.metamodel, type, near, ctx.nodes)) return { parentId: near.id }
  return undefined
}

/** Where a new top-level element of `type` goes: where most of the view's
 *  elements of that type are (inside one parent, or at the top of the
 *  model), else at the top of the model; undefined when it may not be
 *  there. */
function placeAtTop(type: string, source: C4Node[], ctx: PipelineContext): { parentId?: string } | undefined {
  const tally = new Map<string, number>()
  for (const n of source) if (n.type === type) tally.set(n.parentId ?? '', (tally.get(n.parentId ?? '') ?? 0) + 1)
  for (const [id] of [...tally].sort((a, b) => b[1] - a[1])) {
    if (!id) { if (isParentAllowed(ctx.metamodel, type, undefined)) return {}; continue }
    if (ctx.nodes[id] && isPlacementAllowed(ctx.metamodel, type, ctx.nodes[id], ctx.nodes)) return { parentId: id }
  }
  return isParentAllowed(ctx.metamodel, type, undefined) ? {} : undefined
}

/** The types `via` reaches from `from`: those a relation of its type
 *  allows on the other end, or the types a child of it may be. */
function typesAlong(via: ChainVia, from: C4Node, ctx: PipelineContext): string[] {
  const types = Object.keys(ctx.metamodel?.nodeTypes ?? {})
  if ('contains' in via) return types.filter((t) => isPlacementAllowed(ctx.metamodel, t, from, ctx.nodes))
  if ('anyRelation' in via) return types.filter((t) => relationBetween(via, from.type, t, ctx))
  const def = ctx.metamodel?.relationTypes[via.relationType]
  if (!def || !def.allowedPairs.length) return types
  return types.filter((t) => def.allowedPairs.some((p) => via.direction === 'out' ? p.from === from.type && p.to === t : p.from === t && p.to === from.type))
}

/** The link a new element of `type` gets to the element above along `via`
 *  (`out`: the element above is the source); undefined when none fits. */
function relationBetween(via: ChainVia, aboveType: string, type: string, ctx: PipelineContext): Omit<WizardLink, 'otherId'> | undefined {
  if ('contains' in via) return undefined
  if ('anyRelation' in via) {
    const out = inferRelationType(ctx.metamodel, aboveType, type)
    if (out) return { relationType: out, direction: 'in' }
    const back = inferRelationType(ctx.metamodel, type, aboveType)
    return back ? { relationType: back, direction: 'out' } : undefined
  }
  return { relationType: via.relationType, direction: via.direction === 'out' ? 'in' : 'out' }
}

function withFilters(meet: { properties: Record<string, string>; hidden?: true }): Pick<AddChoice, 'properties' | 'hidden'> {
  return { ...(Object.keys(meet.properties).length ? { properties: meet.properties } : {}), ...(meet.hidden ? { hidden: true as const } : {}) }
}

/** What the table of `view` can add: under the element of a row (`under`,
 *  at its depth in the chain), or at the top. In a chain an element goes on
 *  the next level, of its types, linked the way the level hangs under the
 *  one above (a requirement refined from the need it is added under) and
 *  placed beside it; at the top, of the first level's types. It is made to
 *  pass the level's filters where it can (meetFilters): a type they leave
 *  out is not offered. Without a
 *  chain the rows are the containment: under a row go the types it may
 *  hold, at the top those the top of the model may. */
export function addChoices(view: DiagramView | undefined, ctx: PipelineContext, under?: { node: C4Node; depth: number }): AddChoice[] {
  const levels = pipelineOf(view)?.levels ?? []
  const allTypes = Object.keys(ctx.metamodel?.nodeTypes ?? {})
  const out: AddChoice[] = []
  const seen = new Set<string>()
  const push = (c: AddChoice) => {
    const key = `${c.type}|${c.link?.relationType ?? ''}|${c.link?.direction ?? ''}`
    if (!seen.has(key)) { seen.add(key); out.push(c) }
  }
  if (!levels.length) {
    if (!under) for (const t of allTypes) { if (isParentAllowed(ctx.metamodel, t, undefined)) push({ type: t, group: 'Add' }) }
    else for (const t of typesAlong({ contains: true }, under.node, ctx)) push({ type: t, parentId: under.node.id, group: 'Inside' })
    return out
  }
  if (!under) {
    const source = pipelineSource(view, ctx)
    for (const way of levels[0].ways) {
      for (const t of way.types?.length ? way.types : allTypes) {
        const meet = meetFilters(t, levels[0].filters, undefined, ctx)
        if (meet.excluded) continue
        const place = meet.within ? { parentId: meet.within } : placeAtTop(t, source, ctx)
        if (place) push({ type: t, ...place, ...withFilters(meet), group: 'Add' })
      }
    }
    return out
  }
  const next = levels[under.depth + 1]
  if (!next) return out
  for (const way of next.ways) {
    if (!way.via) continue
    const via = way.via
    const reachable = typesAlong(via, under.node, ctx)
    const types = way.types?.length ? way.types.filter((t) => reachable.includes(t)) : reachable
    for (const t of types) {
      const link = relationBetween(via, under.node.type, t, ctx)
      if (!('contains' in via) && !link) continue
      const meet = meetFilters(t, next.filters, link, ctx)
      if (meet.excluded) continue
      if ('contains' in via) { push({ type: t, parentId: under.node.id, ...withFilters(meet), group: viaLabel(via, ctx) }); continue }
      const place = meet.within ? { parentId: meet.within } : placeBeside(t, under.node, ctx)
      if (place) push({ type: t, ...place, link: { ...link!, otherId: under.node.id }, ...withFilters(meet), group: viaLabel(via, ctx) })
    }
  }
  return out
}

/** What a new element of `type` needs to pass the filters of the level it
 *  goes on in `view`'s chain (meetFilters): the first level, or, `under` an
 *  element, the level after the one that element is on; a chain of one
 *  level holds what lies inside its elements too, as a Warnier view draws
 *  it. `hidden` when the view will not show it all the same: its type does
 *  not pass, there is no level for it, or a filter cannot be met (a text the
 *  name must hold). Null for a view without a chain. Views that add their
 *  own way (Warnier, the wiki) give it these values, as the table does. */
export function newElementFilters(
  view: DiagramView | undefined,
  ctx: PipelineContext,
  type: string,
  under?: { node: C4Node; link?: Omit<WizardLink, 'otherId'> },
): { properties: Record<string, string>; hidden?: true } | null {
  const levels = pipelineOf(view)?.levels ?? []
  if (!levels.length) return null
  let at = 0
  if (under && levels.length > 1) {
    const row = runPipeline(view, ctx).rows?.find((r) => r.node.id === under.node.id)
    at = row ? row.depth + 1 : levels.length
  }
  const level = levels[at]
  if (!level || !level.ways.some((w) => !w.types?.length || w.types.includes(type))) return { properties: {}, hidden: true }
  const meet = meetFilters(type, level.filters, under?.link, ctx)
  if (meet.excluded) return { properties: {}, hidden: true }
  return { properties: meet.properties, ...(meet.hidden ? { hidden: true as const } : {}) }
}

// ─── Suggestions for levels ─────────────────────────────────────────────────

export interface WaySuggestion {
  way: ChainWay
  label: string
  /** How many elements the way would reach. */
  count: number
}

/** Ways to the first level: every element, then each type among `source`,
 *  most elements first, besides those `taken` already. */
export function suggestStartWays(source: C4Node[], ctx: PipelineContext, taken: ChainWay[] = []): WaySuggestion[] {
  if (taken.some((w) => !w.types?.length)) return []
  const counts = new Map<string, number>()
  for (const n of source) counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
  const held = new Set(taken.flatMap((w) => w.types ?? []))
  const every: WaySuggestion[] = source.length ? [{ way: {}, label: 'Every element', count: source.length }] : []
  // Then the metamodel's types that have no element yet, for a chain built before its elements.
  for (const t of Object.keys(ctx.metamodel?.nodeTypes ?? {})) if (!counts.has(t)) counts.set(t, 0)
  return [...every, ...[...counts.entries()]
    .filter(([t]) => !held.has(t))
    .sort((a, b) => b[1] - a[1] || typeLabel(ctx, a[0]).localeCompare(typeLabel(ctx, b[0])))
    .map(([t, count]) => ({ way: { types: [t] }, label: typeLabel(ctx, t), count }))]
}

/** The types a level can hold: those its ways name, or every type of the
 *  metamodel when a way takes any element. */
export function levelTypes(level: ChainLevel | undefined, ctx: PipelineContext): string[] {
  const all = Object.keys(ctx.metamodel?.nodeTypes ?? {})
  if (!level || level.ways.some((w) => !w.types?.length)) return all
  return [...new Set(level.ways.flatMap((w) => w.types ?? []))]
}

/** The ways the metamodel allows from elements of `aboveTypes`: along each
 *  relation type that names its pairs (either way), and as children, each
 *  to the types at the other end. */
function metamodelWays(aboveTypes: string[], ctx: PipelineContext): Array<{ via: ChainVia; type: string }> {
  const out: Array<{ via: ChainVia; type: string }> = []
  const above = new Set(aboveTypes)
  for (const rt of Object.values(ctx.metamodel?.relationTypes ?? {})) {
    for (const pair of rt.allowedPairs) {
      if (above.has(pair.from)) out.push({ via: { relationType: rt.id, direction: 'out' }, type: pair.to })
      if (above.has(pair.to)) out.push({ via: { relationType: rt.id, direction: 'in' }, type: pair.from })
    }
  }
  for (const [t, def] of Object.entries(ctx.metamodel?.nodeTypes ?? {})) {
    if ((def.allowedParents ?? []).some((p) => above.has(p))) out.push({ via: { contains: true }, type: t })
  }
  return out
}

/** Ways to a level under `above`: every relation (either way) and
 *  containment leading from them to elements of `source`, split by the type
 *  found at the other end, most elements first, besides those `taken`. */
export function suggestNextWays(above: C4Node[], source: C4Node[], ctx: PipelineContext, taken: ChainWay[] = [], aboveTypes: string[] = []): WaySuggestion[] {
  const inSource = new Set(source.map((n) => n.id))
  const index = relationIndex(ctx)
  const found = new Map<string, { via: ChainVia; type: string; ids: Set<string> }>()
  const add = (via: ChainVia, n: C4Node) => {
    if (!inSource.has(n.id)) return
    const key = `${JSON.stringify(via)}|${n.type}`
    const f = found.get(key)
    if (f) f.ids.add(n.id)
    else found.set(key, { via, type: n.type, ids: new Set([n.id]) })
  }
  for (const a of above) {
    for (const r of index.out.get(a.id) ?? []) {
      const n = ctx.nodes[r.targetId]
      if (n && r.relationType) add({ relationType: r.relationType, direction: 'out' }, n)
    }
    for (const r of index.in.get(a.id) ?? []) {
      const n = ctx.nodes[r.sourceId]
      if (n && r.relationType) add({ relationType: r.relationType, direction: 'in' }, n)
    }
    for (const id of index.children.get(a.id) ?? []) if (ctx.nodes[id]) add({ contains: true }, ctx.nodes[id])
  }
  const held = new Set(taken.flatMap((w) => (w.types?.length ? w.types : ['*']).map((t) => `${JSON.stringify(w.via)}|${t}`)))
  const byType = [...found.entries()]
    .filter(([key]) => !held.has(key) && !held.has(`${key.slice(0, key.lastIndexOf('|'))}|*`))
    .map(([, { via, type, ids }]) => {
      const way: ChainWay = { via, types: [type] }
      return { way, label: wayLabel(way, ctx), count: ids.size }
    })
  // Each relation that reaches more than one type also as "→ any element".
  const byVia = new Map<string, { via: ChainVia; ids: Set<string>; types: number }>()
  for (const { via, ids } of found.values()) {
    const key = JSON.stringify(via)
    const v = byVia.get(key) ?? { via, ids: new Set<string>(), types: 0 }
    for (const id of ids) v.ids.add(id)
    v.types++
    byVia.set(key, v)
  }
  const any = [...byVia.entries()]
    .filter(([key, v]) => v.types > 1 && !held.has(`${key}|*`))
    .map(([, { via, ids }]) => {
      const way: ChainWay = { via }
      return { way, label: wayLabel(way, ctx), count: ids.size }
    })
  // Any relation either way: to each type it reaches, and to any element.
  const anyVia: ChainVia = { anyRelation: true }
  const anyByType = new Map<string, Set<string>>()
  for (const a of above) {
    for (const n of followVia(a, anyVia, ctx)) {
      if (!inSource.has(n.id)) continue
      const ids = anyByType.get(n.type) ?? new Set<string>()
      ids.add(n.id)
      anyByType.set(n.type, ids)
    }
  }
  const anyKey = JSON.stringify(anyVia)
  const anyRelation: WaySuggestion[] = []
  // Only where more than one relation leads: else it is that relation.
  const relationsTo = new Map<string, number>()
  for (const { via, type } of found.values()) if (!('contains' in via)) relationsTo.set(type, (relationsTo.get(type) ?? 0) + 1)
  const relationCount = new Set([...found.values()].filter((f) => !('contains' in f.via)).map((f) => JSON.stringify(f.via))).size
  if (anyByType.size && relationCount > 1 && !held.has(`${anyKey}|*`)) {
    const all = new Set([...anyByType.values()].flatMap((ids) => [...ids]))
    anyRelation.push({ way: { via: anyVia }, label: wayLabel({ via: anyVia }, ctx), count: all.size })
    for (const [type, ids] of [...anyByType.entries()].sort((a, b) => b[1].size - a[1].size)) {
      if (held.has(`${anyKey}|${type}`) || (relationsTo.get(type) ?? 0) < 2) continue
      const way: ChainWay = { via: anyVia, types: [type] }
      anyRelation.push({ way, label: wayLabel(way, ctx), count: ids.size })
    }
  }
  // Then what the metamodel allows from the level above that no element
  // takes yet: a chain can be built before its elements.
  const fromMetamodel: WaySuggestion[] = []
  for (const { via, type } of metamodelWays(aboveTypes, ctx)) {
    const key = `${JSON.stringify(via)}|${type}`
    if (found.has(key) || held.has(key) || held.has(`${JSON.stringify(via)}|*`)) continue
    found.set(key, { via, type, ids: new Set() })
    const way: ChainWay = { via, types: [type] }
    fromMetamodel.push({ way, label: wayLabel(way, ctx), count: 0 })
  }
  fromMetamodel.sort((a, b) => a.label.localeCompare(b.label))
  return [...[...byType, ...any].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)), ...anyRelation, ...fromMetamodel]
}

// ─── Choices for editing a step ─────────────────────────────────────────────

export interface Choice<T> { value: T; label: string; count: number }

/** The types among `nodes`, most first; then `more` (the metamodel's), with none. */
export function typeChoices(nodes: C4Node[], ctx: PipelineContext, more: string[] = []): Choice<string>[] {
  const counts = new Map<string, number>()
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
  for (const t of more) if (!counts.has(t)) counts.set(t, 0)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, count]) => ({ value: t, label: typeLabel(ctx, t), count }))
}

/** The properties `nodes`' types and `types` have (and their id), each with
 *  the values found on them, or the options an enum offers. */
export function propertyChoices(nodes: C4Node[], ctx: PipelineContext, types: string[] = []): Array<{ key: string; label: string; values: Choice<string>[] }> {
  const defs = new Map<string, PropertyDef>()
  for (const t of [...new Set([...nodes.map((n) => n.type), ...types])]) for (const p of ctx.metamodel.nodeTypes[t]?.properties ?? []) if (!defs.has(p.key)) defs.set(p.key, p)
  const keys = [...defs.keys(), 'id']
  return keys.map((key) => {
    const counts = new Map<string, number>()
    for (const n of nodes) for (const v of propertyValues(n, key)) counts.set(v, (counts.get(v) ?? 0) + 1)
    for (const o of defs.get(key)?.options ?? []) if (!counts.has(String(o))) counts.set(String(o), 0)
    const values = [...counts.entries()]
      .map(([v, count]) => ({ value: v, label: ctx.nodes[v]?.label ?? v, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    return { key, label: key === 'id' ? 'Element' : propertyLabel(key, ctx), values }
  }).filter((c) => c.values.length)
}

/** The relations `nodes` have, each way, as filters would name them. */
export function relationChoices(nodes: C4Node[], ctx: PipelineContext): Choice<{ relationType: string; direction: 'out' | 'in' }>[] {
  const index = relationIndex(ctx)
  const counts = new Map<string, number>()
  for (const n of nodes) {
    const here = new Set<string>()
    for (const r of index.out.get(n.id) ?? []) if (r.relationType) here.add(`out:${r.relationType}`)
    for (const r of index.in.get(n.id) ?? []) if (r.relationType) here.add(`in:${r.relationType}`)
    for (const k of here) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const t of Object.keys(ctx.metamodel.relationTypes)) for (const d of ['out', 'in']) if (!counts.has(`${d}:${t}`)) counts.set(`${d}:${t}`, 0)
  return [...counts.entries()].map(([k, count]) => {
    const [direction, relationType] = k.split(/:(.*)/s) as ['out' | 'in', string]
    return { value: { relationType, direction }, label: relationName(relationType, direction, ctx), count }
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** The containers `nodes` lie in, in tree order, each indented by depth. */
export function placeChoices(nodes: C4Node[], ctx: PipelineContext): Choice<string>[] {
  const counts = new Map<string, number>()
  for (const n of nodes) for (const id of ancestorsOf(n, ctx)) if (ctx.nodes[id]) counts.set(id, (counts.get(id) ?? 0) + 1)
  // Each container's path of names from the top, to sort in tree order.
  const path = (id: string) => [...ancestorsOf(ctx.nodes[id], ctx)].reverse().map((a) => ctx.nodes[a]?.label ?? a).concat(ctx.nodes[id].label)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, path: path(id) }))
    .sort((a, b) => a.path.join('\u0000').localeCompare(b.path.join('\u0000')))
    .map(({ id, count, path: p }) => ({ value: id, label: `${'\u00a0\u00a0'.repeat(p.length - 1)}${ctx.nodes[id].label}`, count }))
}

/** The ways a level under `above` can hang there: each relation either way,
 *  any relation, and containment — each with the types it reaches. */
export function viaChoices(above: C4Node[], source: C4Node[], ctx: PipelineContext, aboveTypes: string[] = []): Array<{ via: ChainVia; label: string; types: Choice<string>[] }> {
  const inSource = new Set(source.map((n) => n.id))
  const index = relationIndex(ctx)
  const vias = new Map<string, ChainVia>()
  for (const a of above) {
    for (const r of index.out.get(a.id) ?? []) if (r.relationType) vias.set(`out:${r.relationType}`, { relationType: r.relationType, direction: 'out' })
    for (const r of index.in.get(a.id) ?? []) if (r.relationType) vias.set(`in:${r.relationType}`, { relationType: r.relationType, direction: 'in' })
  }
  // And the relations the metamodel allows from the level above, with the types at their other end.
  const allowed = new Map<string, string[]>()
  for (const { via, type } of metamodelWays(aboveTypes, ctx)) {
    const key = 'contains' in via ? 'contains' : 'relationType' in via ? `${via.direction}:${via.relationType}` : 'any'
    if (key !== 'contains' && !vias.has(key)) vias.set(key, via)
    allowed.set(key, [...(allowed.get(key) ?? []), type])
  }
  const list: ChainVia[] = [...vias.values(), { anyRelation: true }, { contains: true }]
  return list.map((via) => {
    const reached = new Map<string, C4Node>()
    for (const a of above) for (const n of followVia(a, via, ctx)) if (inSource.has(n.id)) reached.set(n.id, n)
    const key = 'contains' in via ? 'contains' : 'relationType' in via ? `${via.direction}:${via.relationType}` : 'any'
    return { via, label: viaLabel(via, ctx), types: typeChoices([...reached.values()], ctx, allowed.get(key)) }
  }).filter((c, i, all) => c.types.length || i >= all.length - 2)
}
