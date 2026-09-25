// ─── Hub concept views → studio views ───────────────────────────────────────
// A concept file may carry named canvas views (`views`: static diagrams such
// as "Containers" or a screen flow, and dynamic views that play a sequence).
// The same translation is needed in three places — the Hub viewer (ids kept
// as-is) and both studio import paths (ids remapped to the freshly created
// nodes / relations / sequences) — so it lives here once.
//
// Canvas (static / dynamic), wiki and table views are taken over; the Hub
// adds its own all-elements wiki / table views on top. A view keeps only the elements that exist
// on the receiving side, so a partial blueprint import still gets sensible
// views, and a view left with no nodes is dropped. A dynamic view whose
// sequence did not survive falls back to a static view of the same nodes.
//
// Per-view positions are only meaningful where node ids and coordinates are
// the concept's own (the Hub viewer); an import re-ids nodes and re-centres
// them on the viewport, so it drops them and the view keeps the imported
// layout.

import type { DiagramView, NodePosition } from '../types/c4'

type Raw = Record<string, unknown>
type IdMap = (id: string) => string | undefined

export interface ConceptViewMaps {
  node: IdMap
  relation: IdMap
  sequence: IdMap
}

export interface ConceptViewOptions {
  /** New id for each view (import); omitted → keep the concept's view id. */
  newId?: () => string
  /** Prepended to each view name, e.g. the concept name on import. */
  namePrefix?: string
  /** Keep the view's stored node positions (only when ids are unchanged). */
  keepPositions?: boolean
}

function mapPositions(raw: unknown, map: IdMap): Record<string, NodePosition> {
  const out: Record<string, NodePosition> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, p] of Object.entries(raw as Record<string, unknown>)) {
    const mapped = map(id)
    const pos = p as Record<string, unknown> | null
    if (!mapped || !pos) continue
    const { x, y, width, height } = pos
    // applyPositions overwrites width/height too, so an entry without them
    // would blank the node's size — skip anything incomplete.
    if ([x, y, width, height].every((v) => typeof v === 'number')) {
      out[mapped] = { x, y, width, height } as NodePosition
    }
  }
  return out
}

function mapIds(raw: unknown, map: IdMap): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string') continue
    const mapped = map(id)
    if (mapped) out.push(mapped)
  }
  return out
}

export function conceptViewsToDiagram(
  rawViews: Raw[] | undefined,
  maps: ConceptViewMaps,
  opts: ConceptViewOptions = {},
): DiagramView[] {
  const out: DiagramView[] = []
  for (const [i, raw] of (rawViews ?? []).entries()) {
    const kind = raw.kind === undefined ? 'static'
      : raw.kind === 'static' || raw.kind === 'dynamic' || raw.kind === 'wiki' || raw.kind === 'table' ? raw.kind
      : null
    if (!kind) continue
    const nodeIds = mapIds(raw.nodeIds, maps.node)
    if (nodeIds.length === 0) continue
    const sequenceId = kind === 'dynamic' && typeof raw.sequenceId === 'string' ? maps.sequence(raw.sequenceId) : undefined
    const name = typeof raw.name === 'string' && raw.name ? raw.name : `View ${i + 1}`
    const view: DiagramView = {
      id: opts.newId ? opts.newId() : typeof raw.id === 'string' ? raw.id : `view-${i}`,
      name: opts.namePrefix ? `${opts.namePrefix} — ${name}` : name,
      kind: kind === 'dynamic' ? (sequenceId ? 'dynamic' : 'static') : kind,
      nodeIds,
      positions: opts.keepPositions ? mapPositions(raw.positions, maps.node) : {},
    }
    if (sequenceId) view.sequenceId = sequenceId
    if (kind === 'wiki') {
      const focus = typeof raw.wikiFocusId === 'string' ? maps.node(raw.wikiFocusId) : undefined
      view.wikiFocusId = focus ?? null
      if (raw.wikiPageMode === 'single' || raw.wikiPageMode === 'multi') view.wikiPageMode = raw.wikiPageMode
    }
    if (kind === 'table' && typeof raw.tableActiveTab === 'string') view.tableActiveTab = raw.tableActiveTab
    const collapsed = mapIds(raw.collapsedNodeIds, maps.node)
    if (collapsed.length) view.collapsedNodeIds = collapsed
    const expanded = mapIds(raw.expandedNodeIds, maps.node)
    if (expanded.length) view.expandedNodeIds = expanded
    const hidden = mapIds(raw.hiddenRelationIds, maps.relation)
    if (hidden.length) view.hiddenRelationIds = hidden
    out.push(view)
  }
  return out
}
