// ─── Where a Radical Forge run puts what it generates ───────────────────────
// A run splits its output into five views from the start, the layers of a
// Radical architecture model: Conceptual (the need, requirements, scenarios,
// mockups, and for now the domain model too), Domain (the domains and their
// entities), States (the state machines, their events and the entities they
// are the lifecycle of), Logical & physical (the C4 elements) and Governance
// (fitness functions and decisions). A type may go into several views. A view
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

export type ForgeViewKey = 'conceptual' | 'domain' | 'states' | 'logical' | 'governance'

export const FORGE_VIEW_NAMES: Record<ForgeViewKey, string> = {
  conceptual: 'Conceptual',
  domain: 'Domain',
  states: 'States',
  logical: 'Logical & physical',
  governance: 'Governance',
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
  'fitness-fn': 'governance',
  adr: 'governance',
}

export const FORGE_STAGE_VIEW: Record<ForgeStageId, ForgeViewKey> = {
  requirements: 'conceptual',
  domain: 'domain',
  fitness: 'governance',
  scenarios: 'conceptual',
  states: 'states',
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

/** The canvas view of that name in the model, if any. */
export function findForgeView(views: Record<string, DiagramView> | undefined, key: ForgeViewKey): DiagramView | undefined {
  const name = FORGE_VIEW_NAMES[key].toLowerCase()
  return Object.values(views ?? {}).find((v) => isCanvas(v) && v.name.trim().toLowerCase() === name)
}

/** The id of the run's view for `key`, created when missing; null when the
 *  facade cannot add views. */
export function ensureForgeView(facade: DiagramFacade, key: ForgeViewKey): string | null {
  const existing = findForgeView(facade.getViews?.(), key)
  if (existing) return existing.id
  return facade.addView?.(FORGE_VIEW_NAMES[key]) ?? null
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
