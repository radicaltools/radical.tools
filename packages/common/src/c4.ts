// ─── C4 domain types ────────────────────────────────────────────────────────

import { builtInGovernanceMetamodel, type Metamodel, type NodeTypeDef } from './metamodel'

export type C4ElementType = 'person' | 'system' | 'container' | 'component' | 'database' | 'webapp' | 'queue' | 'domain' | 'group' | 'adr' | 'fitness-fn' | 'need' | 'requirement' | 'scenario' | 'blueprint' | 'mockup' | 'state-machine' | 'state' | 'pseudostate' | 'event' | 'entity' | 'process' | 'step'

/** Types that act as containers (can hold children, collapse, auto-resize). */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  'system', 'container', 'webapp', 'domain', 'group', 'blueprint', 'state-machine', 'state', 'process', 'step',
])

/** True when the given node-type id behaves as a parent container. */
export function isContainerType(type: string | undefined): boolean {
  return !!type && CONTAINER_TYPES.has(type)
}

export interface C4Node {
  id: string
  type: C4ElementType
  label: string
  description?: string
  technology?: string
  /** id of the parent C4Node (Container inside System, Component inside Container) */
  parentId?: string
  /** Is this node collapsed (only meaningful for system / container) */
  collapsed: boolean
  /** external actor / system flag */
  external?: boolean
  x: number
  y: number
  width: number
  height: number
}

export interface C4Relation {
  id: string
  sourceId: string
  targetId: string
  /** Metamodel relation-type id (e.g. 'interacts', 'constrains', 'supersedes'). */
  relationType?: string
  label?: string
  technology?: string
}

export interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * A named, ordered interaction sequence — a model-level artefact that can be
 * referenced by one or more dynamic views.
 * Examples: "User Login Journey", "Payment Flow"
 */
export interface DiagramSequence {
  id: string
  name: string
  /** Ordered list of C4Relation IDs that form the interaction steps */
  relationIds: string[]
  /**
   * Per-step description overrides, parallel to relationIds.
   * When set for index i, the SequenceView shows this text on the arrow
   * instead of (or in addition to) the underlying relation label.
   * Optional for backwards compat with persisted sequences.
   */
  stepDescriptions?: (string | undefined)[]
}

/** How a canvas draws relations: smooth curves, or horizontal and vertical
 *  segments with rounded corners. Each style keeps to itself when a
 *  relation has to go around an element. */
export type EdgeStyle = 'curved' | 'orthogonal'

/** One filter of a view's pipeline; `off` keeps it without applying it.
 *  `join: 'or'` joins it to the filter before: a run of filters joined with
 *  or lets through what any of them lets through, and every run must let an
 *  element through (and between runs). */
export type ViewFilter = (
  | { kind: 'type'; types: string[] }
  /** `is`/`is-not`: the value is (not) one of `values`; `set`/`unset`: it has (no) value. */
  | { kind: 'property'; key: string; op: 'is' | 'is-not' | 'set' | 'unset'; values?: string[] }
  /** The element has (`has`) or lacks a relation of this type, this way. */
  | { kind: 'relation'; relationType: string; direction: 'out' | 'in'; has: boolean }
  /** The element lies inside this one, at any depth; with `self`, or is it. */
  | { kind: 'within'; nodeId: string; self?: true }
  /** Its name, description or technology holds this text. */
  | { kind: 'text'; text: string }
) & { off?: true; join?: 'or' }

/** The order of a view's rows within their groups. */
export interface ViewSort {
  by: 'label' | 'type' | 'property'
  key?: string
  desc?: true
}

/** How a chain level's elements hang under the level above: along a
 *  relation (`out`: the element above is its source, so its targets come
 *  next; `in`: its sources), along any relation of any type either way, or
 *  as the children it contains. */
export type ChainVia =
  | { relationType: string; direction: 'out' | 'in' }
  | { anyRelation: true }
  | { contains: true }

/** One way to a chain level's elements: of these types (none: any),
 *  reached along `via` from the level above (none on the first level). */
export interface ChainWay {
  via?: ChainVia
  types?: string[]
}

/** One level of a view's chain: the elements any of its ways reaches (or
 *  between them: needs or ADRs; refined into requirements or verified by
 *  scenarios) that pass its filters. */
export interface ChainLevel {
  ways: ChainWay[]
  filters?: ViewFilter[]
}

/** What a view does with its elements (viewPipeline.ts): a chain of levels, each under the one above (needs, the
 *  requirements refined from each, the scenarios verifying each of those),
 *  and the order within a level. The table view and the Nodes tree show
 *  the result; a canvas draws its own elements. */
export interface ViewPipeline {
  levels?: ChainLevel[]
  sort?: ViewSort
  /** On a canvas: 'all' draws every relation between the elements shown;
   *  none, only the relations the chain follows. */
  edges?: 'all'
}

export interface DiagramView {
  id: string
  name: string
  /**
   * 'static' (default) = ordinary filtered view.
   * 'dynamic' = shows step-number badges on edges from the linked sequence.
   * 'treemap' = renders the element hierarchy as nested coloured rectangles.
   * 'table'   = governance-aware spreadsheet view of nodes and relations.
   * 'wiki'    = documentation-style pages per element with inline editing.
   * 'warnier' = the hierarchy as a Warnier–Orr diagram (braces, left to right).
   */
  kind?: 'static' | 'dynamic' | 'treemap' | 'table' | 'matrix' | 'wiki' | 'warnier'
  /** The metamodel's viewpoint (ViewpointDef id) the view is of: its kind
   *  and chain are the viewpoint's, kept in step when the viewpoint changes. Set
   *  another kind or chain and the view is of no viewpoint any more. */
  viewpoint?: string
  /** The element a view of a viewpoint that draws one element is of
   *  (ViewpointDef.subject): its chain is the viewpoint's kept to it and what
   *  lies inside it (scopedChain). */
  subject?: string
  /** The group this view of one element is in: a view of a viewpoint that
   *  draws one element holds a view of each such element (model.ts,
   *  syncViewGroups), made and removed with the elements. */
  partOf?: string
  /** Where the view sits in the list of views: a folder path such as
   *  "C4/Components" (segments split by "/"). No folder: at the top. */
  folder?: string
  /** How the view draws relations; none: the model's (DiagramData.defaultEdgeStyle). */
  edgeStyle?: EdgeStyle
  /** ID of the DiagramSequence to visualise when kind='dynamic' */
  sequenceId?: string
  /** C4 node IDs included in this view. Ancestors are auto-included. An
   *  empty list shows every node, unless `empty` says the view lists none. */
  nodeIds: string[]
  /** The view lists no node: what it listed was deleted or hidden. Its
   *  empty list would otherwise show every node (deleting the elements a
   *  view listed turned it into one of the whole model). */
  empty?: true
  /**
   * Relation IDs explicitly hidden from this view, even though both their
   * endpoints (or visible ancestors) are present. Optional for backwards
   * compatibility with older persisted views.
   */
  hiddenRelationIds?: string[]
  /** Per-node positions for this view */
  positions: Record<string, NodePosition>
  /**
   * Per-view camera state (pan + zoom). Restored on view activation so each
   * view ("System Context", "Container View") keeps its own framing.
   * Optional for backwards compat with persisted views.
   */
  viewport?: { x: number; y: number; zoom: number }
  /**
   * Auto-layout strategy used when the user invokes "Smart Layout" while
   * this view is active.
   *  - 'auto' (default, undefined) — current behaviour: ensemble Smart Layout.
   *  - 'tree'                      — hierarchical nested tree layout (ELK
   *                                  mrtree per container, top-down).
   * Useful for views populated mostly with domain objects, where a clean
   * containment-tree visualisation is preferable to a force/layered graph.
   */
  layoutMode?: 'auto' | 'tree'
  /**
   * Treemap-only: id of the node currently used as the drill-down root.
   * `null`/`undefined` = top of the hierarchy ("All").
   * Persisted so reopening the view restores the user's location.
   */
  treemapFocusId?: string | null
  /**
   * Treemap-only: how to size rectangles.
   *  - 'leaves'    (default) — every leaf counts as 1; parents = sum of leaves.
   *                Pure hierarchy: rectangle area ∝ number of descendants.
   *  - 'uniform'   — siblings always equal-sized.
   *  - 'relations' — legacy behaviour: leaf value = relation count + 1.
   */
  treemapSizeBy?: 'leaves' | 'uniform' | 'relations'
  /**
   * Treemap-only: maximum number of descendant levels rendered below the
   * current focus. `1` = direct children only, `2` = + grandchildren, …
   * `null`/`undefined` = unlimited (whole subtree). Persisted per view.
   * Nodes that have children hidden by this limit still render as drillable.
   */
  treemapMaxDepth?: number | null
  /**
   * Wiki-only: id of the element whose page is currently shown.
   * `null`/`undefined` = Overview (table of contents). Persisted per view so
   * reopening the view restores the user's location.
   */
  wikiFocusId?: string | null
  /**
   * Wiki-only: how an element's page renders its children.
   * 'single' (default) — today's behaviour: children show as short preview
   * cards you click through to, one element's page at a time.
   * 'multi' — the focused element's own page is followed, inline on the
   * same scrollable page, by each direct child's full page content
   * (recursion stops there — a child's own children still show as preview
   * cards, so the page stays bounded to one extra level).
   * Persisted per view so reopening the view restores the chosen mode.
   */
  wikiPageMode?: 'single' | 'multi'
  /** Wiki-only: how many levels of children Multi page writes out as
   *  chapters before the rest show as preview cards
   *  (WIKI_DEPTH_MIN..WIKI_DEPTH_MAX, default WIKI_DEPTH_MIN). Set in the
   *  view's properties. */
  wikiDepth?: number
  /**
   * Table-only: id of the currently-selected tab ('all', 'relations', or a
   * node-type id). `undefined` = "All Nodes". Persisted per view so
   * switching away and back (or reopening the view) restores the tab.
   */
  tableActiveTab?: string
  /** The steps from the model to what the view's table and Nodes tree show;
   *  none: the view's elements as they are. */
  pipeline?: ViewPipeline
  /**
   * Node IDs explicitly collapsed by the user in this named view.
   * Independent of the model-level `node.collapsed` flag — collapsing in one
   * view does not affect other views or the default "all nodes" view.
   */
  collapsedNodeIds?: string[]
  /**
   * Node IDs explicitly expanded in this named view, overriding a model-level
   * `node.collapsed = true`. Lets the user expand a node in one view without
   * affecting other views or the default "all nodes" view.
   */
  expandedNodeIds?: string[]
  /**
   * Layout rules the user set for this view's canvas; every layout (live
   * physics, Smart Layout, MCP) keeps them. Optional for backwards compat.
   */
  layoutConstraints?: LayoutConstraint[]
}

/**
 * A layout rule that holds on one canvas whatever moves: drags, the live
 * physics, Smart Layout. Members hidden on the canvas (outside the view,
 * under a collapsed parent) are skipped; a line left with fewer than two
 * members rests.
 */
export type LayoutConstraint = AlignConstraint | GridConstraint | PinConstraint

/**
 * Keeps the centres of `nodeIds` on one line — a row (`axis: 'horizontal'`,
 * equal centre y) or a column (`axis: 'vertical'`, equal centre x). With
 * `ordered`, the members also keep the order of `nodeIds` along that line:
 * left to right in a row, top to bottom in a column.
 */
export interface AlignConstraint {
  id: string
  type: 'align'
  axis: 'horizontal' | 'vertical'
  nodeIds: string[]
  ordered?: boolean
}

/**
 * Keeps `nodeIds` in a grid of `columns` columns, filled row by row in the
 * order of `nodeIds`: every row is an ordered row, every column an ordered
 * column (gridCells).
 */
export interface GridConstraint {
  id: string
  type: 'grid'
  columns: number
  nodeIds: string[]
}

/**
 * Keeps `nodeIds` where they stand: the live physics does not move them (a
 * drag still does). A canvas has at most one; dropping an element after a
 * drag adds it. A layout of the whole canvas (Smart Layout) places every
 * element anew and removes it.
 */
export interface PinConstraint {
  id: string
  type: 'pin'
  nodeIds: string[]
}

/** The elements pinned on a canvas with these rules. */
export function pinnedNodeIds(constraints: readonly LayoutConstraint[] | undefined): string[] {
  return constraints?.find((c): c is PinConstraint => c.type === 'pin')?.nodeIds ?? []
}

/** Columns for a grid of `count` elements when none are asked for: about square. */
export function defaultGridColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)))
}

/** A landscape grid keeps up to this many columns per row. */
const LANDSCAPE_WIDTH = 2

/**
 * Cell `index` of a grid that grows wider than tall: it adds a column while
 * it has fewer than twice as many columns as rows, otherwise a row, and fills
 * the new column or row before growing again. Cells already handed out never
 * move, so elements placed one by one end up in a landscape block rather than
 * a tall column or an endless row.
 */
export function landscapeSlot(index: number): { column: number; row: number } {
  if (index <= 0) return { column: 0, row: 0 }
  let columns = 1
  let rows = 1
  let filled = 1
  for (;;) {
    if (columns < LANDSCAPE_WIDTH * rows) {
      if (index < filled + rows) return { column: columns, row: index - filled }
      filled += rows
      columns++
    } else {
      if (index < filled + columns) return { column: index - filled, row: rows }
      filled += columns
      rows++
    }
  }
}

/** Columns of the landscape grid (landscapeSlot) that holds `count` elements. */
export function landscapeGridColumns(count: number): number {
  let columns = 1
  for (let i = 0; i < count; i++) columns = Math.max(columns, landscapeSlot(i).column + 1)
  return columns
}

/** A grid's rows and columns, each listed in order. */
export function gridCells(c: Pick<GridConstraint, 'columns' | 'nodeIds'>): { rows: string[][]; columns: string[][] } {
  const cols = Math.max(1, Math.min(Math.floor(c.columns), c.nodeIds.length))
  const rows: string[][] = []
  for (let i = 0; i < c.nodeIds.length; i += cols) rows.push(c.nodeIds.slice(i, i + cols))
  const columns: string[][] = []
  for (let k = 0; k < cols; k++) columns.push(c.nodeIds.filter((_, i) => i % cols === k))
  return { rows, columns }
}

/** Every rule as the lines it keeps: alignments as they are, a grid as its
 *  ordered rows and columns, a pin none. */
export function constraintLines(constraints: readonly LayoutConstraint[]): AlignConstraint[] {
  return constraints.flatMap((c): AlignConstraint[] => {
    if (c.type === 'align') return [c]
    if (c.type === 'pin') return []
    const { rows, columns } = gridCells(c)
    return [
      ...rows.map((ids, r): AlignConstraint => ({ id: `${c.id}:row${r}`, type: 'align', axis: 'horizontal', nodeIds: ids, ordered: true })),
      ...columns.map((ids, k): AlignConstraint => ({ id: `${c.id}:col${k}`, type: 'align', axis: 'vertical', nodeIds: ids, ordered: true })),
    ]
  })
}

/** Named snapshot (version) of the diagram state */
export interface DiagramSnapshot {
  id: string
  name: string
  timestamp: number
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  /** Sequences captured at this point in time (optional for backward compat). */
  sequences?: Record<string, DiagramSequence>
  /** The views this milestone shows its own way (by view id): what was done
   *  on them in it (a fold, Hide from view, an alignment, a filter) and
   *  kept by Save as new. Without their places, camera and name: those are
   *  the view's for every milestone. Every other view is shown as the live
   *  model has it. */
  views?: Record<string, DiagramView>
}

/** Saved positions + collapsed state for every node on the canvas */
export interface SlideCanvasState {
  nodes: Record<string, { x: number; y: number; width: number; height: number; collapsed: boolean }>
  /** A slide of a view: what the view folded and opened over the model's
   *  fold when it was captured (its collapsedNodeIds / expandedNodeIds). */
  collapsedNodeIds?: string[]
  expandedNodeIds?: string[]
}

/** A single presentation slide — captures viewport + optional snapshot */
export interface PresentationSlide {
  id: string
  name: string
  /** null = use whatever is currently on canvas (no snapshot restore) */
  snapshotId: string | null
  /** null = show all nodes; string = activate this view when navigating to slide */
  viewId?: string | null
  viewport: { x: number; y: number; zoom: number }
  /**
   * Elements the slide zooms onto when it has no captured viewport: the
   * camera frames just these, so several slides can show parts of one view.
   */
  focusNodeIds?: string[]
  /** A slide of a hierarchy view: the element it was drilled into. */
  treemapFocusId?: string | null
  /** A slide of a wiki view: the element whose page it shows (null: the
   *  Overview), and how that page is written. */
  wikiFocusId?: string | null
  wikiPageMode?: 'single' | 'multi'
  /** Full node positions + collapsed flags at the time the slide was created/captured */
  canvasState?: SlideCanvasState
  /**
   * Inline snapshot of the full model (nodes + relations) at slide-creation time.
   * Used as the source of truth on goToSlide — guarantees the slide shows
   * exactly what was on screen when "Add slide" was pressed, regardless of
   * later edits to the live model. Takes precedence over `snapshotId`.
   */
  modelSnapshot?: {
    nodes: Record<string, C4Node>
    relations: Record<string, C4Relation>
  }
}

/** A named presentation — collection of slides */
export interface Presentation {
  id: string
  name: string
  slides: PresentationSlide[]
}

export interface DiagramData {
  nodes: C4Node[]
  relations: C4Relation[]
  sequences?: DiagramSequence[]
  views?: DiagramView[]
  /** Positions for the "All" (default) view */
  defaultPositions?: Record<string, NodePosition>
  /** Camera state (pan + zoom) for the "All" (default) view */
  defaultViewport?: { x: number; y: number; zoom: number } | null
  /** Layout constraints of the "All" (default) view; a named view keeps its own. */
  defaultLayoutConstraints?: LayoutConstraint[]
  /** How All elements, and every view without its own, draw relations
   *  (curved when none). */
  defaultEdgeStyle?: EdgeStyle
  /** Named snapshots (versions) */
  snapshots?: DiagramSnapshot[]
  /** Multiple named presentations */
  presentations?: Presentation[]
  /** @deprecated legacy single-presentation slides — auto-migrated into a "Main" presentation */
  presentationSlides?: PresentationSlide[]
  /** Per-document metamodel (object types + allowed relations + constraints).
   *  When absent, the built-in C4 preset is used. */
  metamodel?: Metamodel
  /** Hub import template records — allows reconfiguring template values after import. */
  hubTemplates?: Record<string, import('./hubFormat').HubImportRecord>
  /** Radical Hub catalogue metadata — present only in concept files published to the hub. */
  hub?: import('./hubFormat').HubConceptMeta
}

// ─── React Flow data shapes ──────────────────────────────────────────────────

export interface C4NodeRFData {
  c4id: string
  type: C4ElementType
  label: string
  description?: string
  technology?: string
  parentId?: string
  collapsed: boolean
  external?: boolean
  width: number
  height: number
  hasChildren: boolean
}

export interface C4EdgeRFData {
  originalSourceId: string
  originalTargetId: string
  label?: string
  technology?: string
  relationType?: string
  isVirtual: boolean
  /** An arrow from a step to the next (warnier.ts, processFlow): no
   *  relation of the model, drawn dashed, never selected. */
  flow?: boolean
  /** 1-based step indices when this edge is part of the active dynamic view sequence.
   *  Array because the same relation can appear multiple times in one sequence. */
  sequenceStep?: number[]
}

// ─── Layout position map ─────────────────────────────────────────────────────

export type PositionMap = Record<string, { x: number; y: number; width?: number; height?: number }>

// ─── Node visuals + default sizes ────────────────────────────────────────────
//
// The actual label/color/icon/size data for each built-in type lives with
// the metamodel preset that introduces it (`types/metamodel/presets/*`),
// not here. `builtInGovernanceMetamodel()` is the superset of every
// built-in type (Radical metamodel), so the flat lookup tables below —
// kept for the many call sites that index by type without carrying a
// `Metamodel` around — are generated from it rather than hand-duplicated.

const BUILTIN_NODE_TYPES = builtInGovernanceMetamodel().nodeTypes as Record<C4ElementType, NodeTypeDef>

function pluckPerType<T>(fn: (def: NodeTypeDef) => T): Record<C4ElementType, T> {
  const out = {} as Record<C4ElementType, T>
  for (const [id, def] of Object.entries(BUILTIN_NODE_TYPES)) {
    out[id as C4ElementType] = fn(def)
  }
  return out
}

export const NODE_SIZES: Record<C4ElementType, { width: number; height: number }> =
  pluckPerType(def => ({ width: def.width, height: def.height }))

/** Size of a new node of `type`: the active metamodel's type first (custom
 *  types are only there), then the built-in size, then a default. */
export function nodeTypeSize(type: string, metamodel?: Metamodel | null): { width: number; height: number } {
  const def = metamodel?.nodeTypes[type]
  const builtIn = NODE_SIZES[type as C4ElementType] as { width: number; height: number } | undefined
  return {
    width: def?.width ?? builtIn?.width ?? 160,
    height: def?.height ?? builtIn?.height ?? 90,
  }
}

export const COLLAPSED_HEIGHT: Record<C4ElementType, number> =
  pluckPerType(def => def.collapsedHeight ?? def.height)

export const COLLAPSED_WIDTH: Record<C4ElementType, number> =
  pluckPerType(def => def.collapsedWidth ?? def.width)

export const NODE_COLORS: Record<C4ElementType, string> = pluckPerType(def => def.color)

export const NODE_FG: Record<C4ElementType, string> = pluckPerType(def => def.fg)

export const TYPE_LABELS: Record<C4ElementType, string> = pluckPerType(def => def.label)

/** SVG path data for each C4 element type (viewBox 0 0 16 16) */
export const TYPE_ICON_PATHS: Record<C4ElementType, string> = pluckPerType(def => def.iconPath)

/** A folder path as views keep it: segments trimmed, empty ones dropped,
 *  joined by "/". "" for no folder. */
export function normalizeViewFolder(folder: string | null | undefined): string {
  return (folder ?? '').split('/').map((part) => part.trim()).filter(Boolean).join('/')
}

/** One folder of the list of views: its subfolders, then its views. */
export interface ViewFolder<V extends Pick<DiagramView, 'folder'> = DiagramView> {
  /** The whole path ("C4/Components"); "" for the top of the list. */
  path: string
  /** The last segment ("Components"); "" for the top. */
  name: string
  folders: ViewFolder<V>[]
  /** In the order the model keeps them. */
  views: V[]
  /** Its folders and views together, in the model's order: a folder
   *  stands where its first view does. */
  entries: Array<{ folder: ViewFolder<V> } | { view: V }>
  /** Views in this folder and all below it. */
  count: number
}

/** The list of views as a tree of folders, by each view's `folder` path.
 *  Folders and views keep the model's order: a folder stands where its
 *  first view does (moveViewFolder changes it). */
export function viewFolderTree<V extends Pick<DiagramView, 'folder'>>(views: V[]): ViewFolder<V> {
  const root: ViewFolder<V> = { path: '', name: '', folders: [], views: [], entries: [], count: 0 }
  const byPath = new Map<string, ViewFolder<V>>([['', root]])
  const folderAt = (path: string): ViewFolder<V> => {
    const known = byPath.get(path)
    if (known) return known
    const cut = path.lastIndexOf('/')
    const parent = folderAt(cut < 0 ? '' : path.slice(0, cut))
    const folder: ViewFolder<V> = { path, name: path.slice(cut + 1), folders: [], views: [], entries: [], count: 0 }
    parent.folders.push(folder)
    parent.entries.push({ folder })
    byPath.set(path, folder)
    return folder
  }
  for (const view of views) {
    const path = normalizeViewFolder(view.folder)
    const folder = folderAt(path)
    folder.views.push(view)
    folder.entries.push({ view })
    for (let p = path; ; p = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') {
      byPath.get(p)!.count++
      if (!p) break
    }
  }
  return root
}

/** Where renaming the folder `path` to `name` takes it: the new path, or
 *  null for an empty name, a name with "/" or a folder no view is in. */
export function viewFolderRenameTarget(views: Pick<DiagramView, 'folder'>[], path: string, name: string): string | null {
  const from = normalizeViewFolder(path)
  const leaf = name.trim()
  if (!from || !leaf || leaf.includes('/')) return null
  if (!views.some((view) => isInViewFolder(view, from))) return null
  const cut = from.lastIndexOf('/')
  return cut < 0 ? leaf : `${from.slice(0, cut)}/${leaf}`
}

/** Whether a view sits in the folder `path` or in a folder below it. */
export function isInViewFolder(view: Pick<DiagramView, 'folder'>, path: string): boolean {
  const folder = normalizeViewFolder(view.folder)
  return folder === path || folder.startsWith(`${path}/`)
}

/** Every folder path in use, parents included, sorted. */
export function viewFolderPaths(views: Pick<DiagramView, 'folder'>[]): string[] {
  const paths = new Set<string>()
  for (const view of views) {
    const parts = normalizeViewFolder(view.folder).split('/').filter(Boolean)
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/'))
  }
  return [...paths].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

export const WIKI_DEPTH_MIN = 1
export const WIKI_DEPTH_MAX = 5

/** How many levels of children a wiki view's Multi page writes out as
 *  chapters: its `wikiDepth`, kept within WIKI_DEPTH_MIN..WIKI_DEPTH_MAX. */
export function wikiDepthOf(view: Pick<DiagramView, 'wikiDepth'> | null | undefined): number {
  const d = view?.wikiDepth
  if (typeof d !== 'number' || !Number.isFinite(d)) return WIKI_DEPTH_MIN
  return Math.min(WIKI_DEPTH_MAX, Math.max(WIKI_DEPTH_MIN, Math.floor(d)))
}

/** Whether a view shows every node of the model: it lists none and was not
 *  emptied (`empty`). */
export function viewShowsEveryNode(view: Pick<DiagramView, 'nodeIds' | 'empty'>): boolean {
  return view.nodeIds.length === 0 && !view.empty
}

/**
 * The positions a view keeps of `positions` (where the canvas had the nodes):
 * those of the nodes it draws, its listed nodes and their ancestors; all of
 * them when it shows every node. The canvas keeps one set of positions in
 * the nodes, so it used to store every node's into each view: 99% of a
 * large model's views.json. A view shown as a table, wiki, matrix or flow
 * draws no positions: it keeps those it had on its canvas (`view.positions`,
 * of the nodes it draws), for when its type goes back to Structure, and the
 * canvas shown with it is not its own.
 */
export function viewCanvasPositions<P>(
  view: Pick<DiagramView, 'kind' | 'nodeIds' | 'empty'> & { positions?: Record<string, P> },
  nodes: Record<string, Pick<C4Node, 'parentId'>>,
  positions: Record<string, P>,
  /** What the view draws when its filter chain decides it (viewDrawnIds in
   *  viewPipeline.ts): a view that lists no nodes but has a chain draws only
   *  what the chain gives, not every node. */
  drawn?: Iterable<string>,
): Record<string, P> {
  if (view.kind && view.kind !== 'static') positions = view.positions ?? {}
  const ids = drawn ?? (viewShowsEveryNode(view) ? undefined : view.nodeIds)
  if (!ids) return positions
  const kept: Record<string, P> = {}
  const seen = new Set<string>()
  for (const id of ids) {
    for (let cur: string | undefined = id; cur && nodes[cur] && !seen.has(cur); cur = nodes[cur].parentId) {
      seen.add(cur)
      if (cur in positions) kept[cur] = positions[cur]
    }
  }
  return kept
}

/** Views with only the positions they draw (viewCanvasPositions, `drawnOf`
 *  what a view's chain draws); a view that keeps no more than that is
 *  returned as it is. */
export function withCanvasPositions<V extends DiagramView>(
  views: V[], nodes: Record<string, Pick<C4Node, 'parentId'>>, drawnOf?: (view: V) => Iterable<string> | undefined,
): V[] {
  return views.map((view) => {
    const kept = viewCanvasPositions(view, nodes, view.positions ?? {}, drawnOf?.(view))
    // A view written without `positions` (by hand, by another tool) has
    // none: it is not laid out yet.
    return view.positions && Object.keys(kept).length === Object.keys(view.positions).length ? view : { ...view, positions: kept }
  })
}

/** Removes ids from a view's list; a list emptied this way lists nothing
 *  (`empty`), not every node. Mutates the view. */
export function removeFromViewList(view: DiagramView, removed: { has(id: string): boolean }): void {
  if (view.nodeIds.length === 0) return
  view.nodeIds = view.nodeIds.filter((nid) => !removed.has(nid))
  if (view.nodeIds.length === 0) view.empty = true
}

/** Adds ids to a view that lists its nodes (or lists none): a view that
 *  shows every node already shows them. Mutates the view. */
export function addToViewList(view: DiagramView, ids: string[]): void {
  if (viewShowsEveryNode(view)) return
  for (const id of ids) if (!view.nodeIds.includes(id)) view.nodeIds.push(id)
  if (view.nodeIds.length > 0) delete view.empty
}
