// ─── Hub concept → DiagramData ───────────────────────────────────────────────
//
// Turns a catalogue concept (the raw `nodes` / `relations` arrays from
// hub-data.json) into a self-contained `DiagramData` the embedded viewer can
// `loadDiagram()`. Ids are kept as-is (there is no model to collide with), the
// governance metamodel is attached so ADR / requirement / fitness-fn nodes
// render with their full property sets, and two synthetic views (wiki, table)
// are provided so the viewer can switch presentation without any store
// mutations beyond `setActiveView`.

import type { C4Node, C4Relation, C4ElementType, DiagramData, DiagramView } from '../types/c4'
import { NODE_SIZES } from '../types/c4'
import { builtInGovernanceMetamodel } from '../types/metamodel'
import type { HubConcept, TemplateParam } from '../store/hubStore'

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

export function kindForViewId(viewId: string | null): HubViewKind {
  if (viewId === HUB_WIKI_VIEW_ID) return 'wiki'
  if (viewId === HUB_TABLE_VIEW_ID) return 'table'
  return 'canvas'
}

/** Fill `{{KEY}}` placeholders with each parameter's default so the preview
 *  reads as prose; keys without a default stay visible as placeholders. */
export function substituteTemplateDefaults(str: string, params: TemplateParam[] | undefined): string {
  if (!params?.length) return str
  const defaults = new Map(params.map((p) => [p.key, p.defaultValue ?? p.hint]))
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key: string) => {
    const v = defaults.get(key)
    return v ? v : m
  })
}

export function conceptToDiagramData(concept: HubConcept): DiagramData {
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

  const allIds = nodes.map((n) => n.id)
  const firstRoot = nodes.find((n) => !n.parentId)?.id ?? allIds[0] ?? null
  const views: DiagramView[] = [
    { id: HUB_WIKI_VIEW_ID, name: 'Wiki', kind: 'wiki', nodeIds: allIds, positions: {}, wikiFocusId: firstRoot },
    { id: HUB_TABLE_VIEW_ID, name: 'Table', kind: 'table', nodeIds: allIds, positions: {} },
  ]

  return {
    nodes,
    relations,
    views,
    metamodel: builtInGovernanceMetamodel(),
  }
}
