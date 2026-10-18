// ─── Where a Radical Forge run puts what it generates ───────────────────────
// A run splits its output into six views from the start, the layers of a
// Radical architecture model: Conceptual (the need, requirements, scenarios,
// mockups, and for now the domain model too), Domain (the domains and their
// entities), States (the state machines, their events and the entities they
// are the lifecycle of), Processes (a Warnier view of the viewpoint Process
// (Warnier): it shows every process and step, lists none and needs no
// layout), Logical & physical (the C4 elements) and Governance (fitness
// functions and decisions). A type may go into several views. A view
// is created when its first element arrives, since an empty view shows the
// whole model; a later run reuses the views by name.
//
// After each stage the user is offered to keep the stage's new elements in a
// row, a column or a grid on their view, and to run Smart Layout on it.
// Studio's wizard and the MCP server's forge_* tools both go through the
// facade here, so they file and arrange the same way.

import { landscapeGridColumns, type C4Node, type DiagramView } from '../../c4'
import type { DiagramFacade } from '../diagramFacade'
import type { ForgeStageId } from './prompts'

export type ForgeViewKey = 'conceptual' | 'domain' | 'states' | 'processes' | 'logical' | 'governance'

export const FORGE_VIEW_NAMES: Record<ForgeViewKey, string> = {
  conceptual: 'Conceptual',
  domain: 'Domain',
  states: 'States',
  processes: 'Processes',
  logical: 'Logical & physical',
  governance: 'Governance',
}

/** The viewpoint a view of the run is of, when it is no canvas: it shows
 *  what its viewpoint's chain gives, so nothing is listed in it. */
const FORGE_VIEW_VIEWPOINT: Partial<Record<ForgeViewKey, { viewpoint: string; kind: NonNullable<DiagramView['kind']> }>> = {
  processes: { viewpoint: 'process-warnier', kind: 'warnier' },
}

/** Node types with fixed views (the first is their own); any other type
 *  goes where its stage does. */
const VIEW_OF_TYPE: Record<string, ForgeViewKey | ForgeViewKey[]> = {
  need: 'conceptual',
  requirement: 'conceptual',
  scenario: 'conceptual',
  mockup: 'conceptual',
  domain: ['domain', 'conceptual'],
  entity: ['domain', 'conceptual'],
  'state-machine': 'states',
  state: 'states',
  pseudostate: 'states',
  event: 'states',
  process: 'processes',
  step: 'processes',
  'fitness-fn': 'governance',
  adr: 'governance',
}

export const FORGE_STAGE_VIEW: Record<ForgeStageId, ForgeViewKey> = {
  requirements: 'conceptual',
  domain: 'domain',
  fitness: 'governance',
  scenarios: 'conceptual',
  states: 'states',
  processes: 'processes',
  mockups: 'conceptual',
  c4: 'logical',
}

/** Every view a node of `type` goes into, its own first. */
export function forgeViewsOf(type: string, stage?: ForgeStageId): ForgeViewKey[] {
  const fixed = VIEW_OF_TYPE[type]
  if (fixed) return Array.isArray(fixed) ? fixed : [fixed]
  return [stage ? FORGE_STAGE_VIEW[stage] : 'logical']
}

/** The view a node of `type` belongs to. */
export function forgeViewOf(type: string, stage?: ForgeStageId): ForgeViewKey {
  return forgeViewsOf(type, stage)[0]
}

const isCanvas = (view: DiagramView): boolean => !view.kind || view.kind === 'static'

/** Whether the run's view for `key` is a canvas (elements are listed in it,
 *  and can be arranged). */
export const isForgeCanvas = (key: ForgeViewKey): boolean => !FORGE_VIEW_VIEWPOINT[key]

/** The run's view of that name in the model, if any: a canvas, or a view of
 *  the kind its viewpoint has. */
export function findForgeView(views: Record<string, DiagramView> | undefined, key: ForgeViewKey): DiagramView | undefined {
  const name = FORGE_VIEW_NAMES[key].toLowerCase()
  const of = FORGE_VIEW_VIEWPOINT[key]
  return Object.values(views ?? {}).find((v) => (of ? v.kind === of.kind : isCanvas(v)) && v.name.trim().toLowerCase() === name)
}

/** The id of the run's view for `key`, created when missing (of its
 *  viewpoint, for a view that is no canvas); null when the facade cannot
 *  add views. */
export function ensureForgeView(facade: DiagramFacade, key: ForgeViewKey): string | null {
  const existing = findForgeView(facade.getViews?.(), key)
  if (existing) return existing.id
  const id = facade.addView?.(FORGE_VIEW_NAMES[key]) ?? null
  const of = FORGE_VIEW_VIEWPOINT[key]
  if (id && of && !facade.applyViewpoint?.(id, of.viewpoint)) facade.setViewKind?.(id, of.kind)
  return id
}

export interface FiledNodes {
  key: ForgeViewKey
  viewId: string
  /** The nodes this call added to the view, in the order given. */
  nodeIds: string[]
}

/** Adds each node to its views (forgeViewsOf), creating a view when needed.
 *  Nodes already in a view are left alone. A state machine brings along the
 *  entity it is the lifecycle of, so the States view shows the link. */
export function fileIntoForgeViews(facade: DiagramFacade, nodeIds: string[], stage?: ForgeStageId): FiledNodes[] {
  const nodes = facade.getNodes()
  const byKey = new Map<ForgeViewKey, string[]>()
  const file = (key: ForgeViewKey, id: string): void => {
    const ids = byKey.get(key) ?? []
    if (!ids.includes(id)) byKey.set(key, [...ids, id])
  }
  for (const id of nodeIds) {
    const node = nodes[id]
    if (!node) continue
    for (const key of forgeViewsOf(node.type, stage)) file(key, id)
  }
  const machines = new Set(nodeIds.filter((id) => nodes[id]?.type === 'state-machine'))
  for (const r of Object.values(facade.getRelations())) {
    if (r.relationType === 'lifecycle-of' && machines.has(r.sourceId) && nodes[r.targetId]) file('states', r.targetId)
  }
  const filed: FiledNodes[] = []
  for (const [key, ids] of byKey) {
    if (!facade.setViewNodes) break
    const viewId = ensureForgeView(facade, key)
    const view = viewId ? facade.getViews?.()[viewId] : undefined
    if (!viewId || !view) continue
    // A view of a viewpoint shows what its chain gives: listing the elements
    // would hide the ones a later run adds.
    if (!isForgeCanvas(key)) { filed.push({ key, viewId, nodeIds: [] }); continue }
    const present = new Set(view.nodeIds)
    const missing = ids.filter((id) => !present.has(id))
    if (missing.length) facade.setViewNodes(viewId, [...view.nodeIds, ...missing])
    filed.push({ key, viewId, nodeIds: missing })
  }
  return filed
}

/** The outermost of `nodeIds`: those with no ancestor among them, in the
 *  order given. These are what a row, column or grid can hold, since an
 *  element cannot be aligned with its own container. */
export function outermostNodes(nodes: Record<string, C4Node>, nodeIds: string[]): string[] {
  const set = new Set(nodeIds)
  return nodeIds.filter((id) => {
    if (!nodes[id]) return false
    for (let cur = nodes[id].parentId; cur; cur = nodes[cur]?.parentId) if (set.has(cur)) return false
    return true
  })
}

export type ForgeArrangement = 'row' | 'column' | 'grid'

export const FORGE_ARRANGEMENTS: ForgeArrangement[] = ['row', 'column', 'grid']

/** What a stage added, per view, that the user can arrange. */
export interface ForgeArrangeGroup {
  viewId: string
  viewName: string
  /** The outermost new elements on that view, in creation order. */
  nodeIds: string[]
}

/** The stage's new elements grouped by the view they are in. */
export function forgeArrangeGroups(facade: DiagramFacade, addedNodeIds: string[], stage?: ForgeStageId): ForgeArrangeGroup[] {
  const nodes = facade.getNodes()
  const views = facade.getViews?.() ?? {}
  const groups: ForgeArrangeGroup[] = []
  for (const key of Object.keys(FORGE_VIEW_NAMES) as ForgeViewKey[]) {
    // Only a canvas is arranged; a Warnier view lays itself out.
    if (!isForgeCanvas(key)) continue
    const view = findForgeView(views, key)
    if (!view) continue
    const inView = new Set(view.nodeIds)
    const ids = addedNodeIds.filter((id) => nodes[id] && inView.has(id) && forgeViewsOf(nodes[id].type, stage).includes(key))
    const nodeIds = outermostNodes(nodes, ids)
    if (nodeIds.length) groups.push({ viewId: view.id, viewName: view.name, nodeIds })
  }
  return groups
}

/** Keeps a group's elements in a row, a column (both in creation order) or a
 *  landscape grid on its view, for every later layout. */
export function arrangeForgeGroup(
  facade: DiagramFacade, group: ForgeArrangeGroup, arrangement: ForgeArrangement,
): { ok: true; text: string } | { ok: false; text: string } {
  const count = group.nodeIds.length
  if (count < 2) return { ok: false, text: `${group.viewName}: only one new element, nothing to arrange.` }
  if (arrangement === 'grid') {
    if (!facade.addGrid) return { ok: false, text: 'Grids are not editable here.' }
    const columns = landscapeGridColumns(count)
    const added = facade.addGrid(group.viewId, group.nodeIds, columns)
    if ('error' in added) return { ok: false, text: `${group.viewName}: ${added.error}` }
    return { ok: true, text: `${group.viewName}: ${count} elements in a grid of ${columns} columns.` }
  }
  if (!facade.addAlignment) return { ok: false, text: 'Alignments are not editable here.' }
  const added = facade.addAlignment(group.viewId, arrangement === 'row' ? 'horizontal' : 'vertical', group.nodeIds, true)
  if ('error' in added) return { ok: false, text: `${group.viewName}: ${added.error}` }
  return { ok: true, text: `${group.viewName}: ${count} elements in a ${arrangement}.` }
}
