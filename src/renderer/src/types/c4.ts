// ─── C4 domain types ────────────────────────────────────────────────────────

import { builtInGovernanceMetamodel, type Metamodel, type NodeTypeDef } from './metamodel'

export type C4ElementType = 'person' | 'system' | 'container' | 'component' | 'database' | 'webapp' | 'queue' | 'domain' | 'group' | 'adr' | 'fitness-fn' | 'requirement' | 'scenario' | 'blueprint'

/** Types that act as containers (can hold children, collapse, auto-resize). */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  'system', 'container', 'domain', 'group', 'blueprint',
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

export interface DiagramView {
  id: string
  name: string
  /**
   * 'static' (default) = ordinary filtered view.
   * 'dynamic' = shows step-number badges on edges from the linked sequence.
   * 'treemap' = renders the element hierarchy as nested coloured rectangles.
   * 'table'   = governance-aware spreadsheet view of nodes and relations.
   * 'wiki'    = documentation-style pages per element with inline editing.
   */
  kind?: 'static' | 'dynamic' | 'treemap' | 'table' | 'matrix' | 'wiki'
  /** ID of the DiagramSequence to visualise when kind='dynamic' */
  sequenceId?: string
  /** C4 node IDs included in this view. Ancestors are auto-included. */
  nodeIds: string[]
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
  /**
   * Table-only: id of the currently-selected tab ('all', 'relations', or a
   * node-type id). `undefined` = "All Nodes". Persisted per view so
   * switching away and back (or reopening the view) restores the tab.
   */
  tableActiveTab?: string
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
}

/** Saved positions + collapsed state for every node on the canvas */
export interface SlideCanvasState {
  nodes: Record<string, { x: number; y: number; width: number; height: number; collapsed: boolean }>
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
  hubTemplates?: Record<string, import('../store/hubStore').HubImportRecord>
  /** Radical Hub catalogue metadata — present only in concept files published to the hub. */
  hub?: import('../hub/hubFormat').HubConceptMeta
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
// built-in type (C4 + DDD + Governance), so the flat lookup tables below —
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

export const COLLAPSED_HEIGHT: Record<C4ElementType, number> =
  pluckPerType(def => def.collapsedHeight ?? def.height)

export const COLLAPSED_WIDTH: Record<C4ElementType, number> =
  pluckPerType(def => def.collapsedWidth ?? def.width)

export const NODE_COLORS: Record<C4ElementType, string> = pluckPerType(def => def.color)

export const NODE_FG: Record<C4ElementType, string> = pluckPerType(def => def.fg)

export const TYPE_LABELS: Record<C4ElementType, string> = pluckPerType(def => def.label)

/** SVG path data for each C4 element type (viewBox 0 0 16 16) */
export const TYPE_ICON_PATHS: Record<C4ElementType, string> = pluckPerType(def => def.iconPath)
