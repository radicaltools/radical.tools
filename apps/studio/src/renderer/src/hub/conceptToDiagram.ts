// ─── Hub concept → DiagramData ───────────────────────────────────────────────
//
// Turns a catalogue concept (the raw `nodes` / `relations` arrays from
// hub-data.json) into a self-contained `DiagramData` the embedded viewer can
// `loadDiagram()`. Ids are kept as-is (there is no model to collide with), the
// governance metamodel is attached so ADR / requirement / fitness-fn nodes
// render with their full property sets, and two synthetic views (wiki, table)
// are provided so the viewer can switch presentation without any store
// mutations beyond `setActiveView`.

import type { C4Node, C4Relation, C4ElementType, DiagramData, DiagramSequence, DiagramView } from '../types/c4'
import { NODE_SIZES } from '../types/c4'
import { builtInGovernanceMetamodel } from '../types/metamodel'
import type { HubConcept, TemplateParam } from '../store/hubStore'
import { conceptViewsToDiagram } from './conceptViews'

export const HUB_WIKI_VIEW_ID = 'hub-wiki'
export const HUB_TABLE_VIEW_ID = 'hub-table'

export type HubViewKind = 'canvas' | 'wiki' | 'table'

/** View a concept opens in by default: single-element governance concepts
 *  read best as a document page, multi-element bundles as a diagram. */
export function defaultViewKind(concept: HubConcept): HubViewKind {
  if (concept.nodes.length > 1) return 'canvas'
  return concept.category === 'pattern' || concept.category === 'blueprint' ? 'canvas' : 'wiki'
}

export function viewIdForKind(kind: HubViewKind): string | null {
  if (kind === 'wiki') return HUB_WIKI_VIEW_ID
  if (kind === 'table') return HUB_TABLE_VIEW_ID
  return null
}

/** Mode a view belongs to. Pass the loaded views so the concept's own named
 *  wiki / table views are recognised (everything else is a canvas view). */
export function kindForViewId(viewId: string | null, views?: Record<string, DiagramView>): HubViewKind {
  if (viewId === HUB_WIKI_VIEW_ID) return 'wiki'
  if (viewId === HUB_TABLE_VIEW_ID) return 'table'
  const kind = viewId ? views?.[viewId]?.kind : undefined
  if (kind === 'wiki') return 'wiki'
  if (kind === 'table') return 'table'
  return 'canvas'
}

/** True for the viewer's synthetic all-elements wiki / table views. */
export function isSyntheticViewId(viewId: string | null): boolean {
  return viewId === HUB_WIKI_VIEW_ID || viewId === HUB_TABLE_VIEW_ID
}

/** Fill `{{KEY}}` placeholders with each parameter's default, but keep the
 *  `{{…}}` wrapper around the substituted value (rather than dropping it) so
 *  a reader browsing the hub can still tell which words in the prose are a
 *  fill-in-the-blank parameter and which are fixed text — otherwise "at or
 *  below $0.05" reads as an authored fact, not a customisable default. Keys
 *  without any default/hint stay as the raw `{{KEY}}` token, already visible. */
export function substituteTemplateDefaults(str: string, params: TemplateParam[] | undefined): string {
  if (!params?.length) return str
  const defaults = new Map(params.map((p) => [p.key, p.defaultValue ?? p.hint]))
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key: string) => {
    const v = defaults.get(key)
    return v !== undefined ? `{{${v}}}` : m
  })
}

/** `layoutFrom`: id of one of the concept's views whose stored positions
 *  replace the node coordinates — the Hub viewer runs in explore mode, where
 *  switching the active view deliberately keeps the current layout, so it
 *  reloads the concept laid out for the chosen view instead. */
export function conceptToDiagramData(concept: HubConcept, opts: { layoutFrom?: string | null } = {}): DiagramData {
  const ids = new Set(concept.nodes.map((n) => String(n.id)))
  const params = concept.templateParams

  const nodes: C4Node[] = concept.nodes.map((raw) => {
    const type = ((raw.type as string) ?? 'component') as C4ElementType
    const size = NODE_SIZES[type] ?? { width: 200, height: 120 }
    const node: Record<string, unknown> = { ...raw }
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') node[k] = substituteTemplateDefaults(v, params)
    }
    delete node.templateParams
    const parentId = typeof raw.parentId === 'string' && ids.has(raw.parentId) ? raw.parentId : undefined
    return {
      ...node,
      id: String(raw.id),
      type,
      label: (node.label as string) ?? concept.name,
      parentId,
      collapsed: Boolean(raw.collapsed),
      x: typeof raw.x === 'number' ? raw.x : 0,
      y: typeof raw.y === 'number' ? raw.y : 0,
      width: typeof raw.width === 'number' ? raw.width : size.width,
      height: typeof raw.height === 'number' ? raw.height : size.height,
    } as C4Node
  })

  const relations: C4Relation[] = (concept.relations ?? [])
    .filter((r) => ids.has(String(r.sourceId)) && ids.has(String(r.targetId)))
    .map((r, i) => ({
      id: typeof r.id === 'string' ? r.id : `${concept.id}-rel-${i}`,
      sourceId: String(r.sourceId),
      targetId: String(r.targetId),
      label: typeof r.label === 'string' ? substituteTemplateDefaults(r.label, params) : undefined,
      technology: typeof r.technology === 'string' ? r.technology : undefined,
      relationType: typeof r.relationType === 'string' ? r.relationType : undefined,
    }))

  const relIds = new Set(relations.map((r) => r.id))
  const sequences: DiagramSequence[] = (concept.sequences ?? [])
    .filter((s) => Array.isArray(s.relationIds) && (s.relationIds as string[]).length > 0 && (s.relationIds as string[]).every((id) => relIds.has(id)))
    .map((s, i) => ({
      id: typeof s.id === 'string' ? s.id : `${concept.id}-seq-${i}`,
      name: typeof s.name === 'string' ? s.name : concept.name,
      relationIds: s.relationIds as string[],
      stepDescriptions: Array.isArray(s.stepDescriptions) ? (s.stepDescriptions as (string | undefined)[]) : undefined,
    }))

  const allIds = nodes.map((n) => n.id)
  const firstRoot = nodes.find((n) => !n.parentId)?.id ?? allIds[0] ?? null
  const seqIds = new Set(sequences.map((s) => s.id))
  const keep = (set: Set<string>) => (id: string) => (set.has(id) ? id : undefined)
  const views: DiagramView[] = [
    ...conceptViewsToDiagram(
      concept.views,
      { node: keep(ids), relation: keep(relIds), sequence: keep(seqIds) },
      { keepPositions: true },
    ),
    { id: HUB_WIKI_VIEW_ID, name: 'Wiki', kind: 'wiki', nodeIds: allIds, positions: {}, wikiFocusId: firstRoot },
    { id: HUB_TABLE_VIEW_ID, name: 'Table', kind: 'table', nodeIds: allIds, positions: {} },
  ]

  const layout = opts.layoutFrom ? views.find((v) => v.id === opts.layoutFrom)?.positions : undefined
  if (layout) {
    for (const n of nodes) {
      const p = layout[n.id]
      if (p) Object.assign(n, { x: p.x, y: p.y, width: p.width, height: p.height })
    }
  }

  return {
    nodes,
    relations,
    sequences,
    views,
    metamodel: builtInGovernanceMetamodel(),
  }
}
