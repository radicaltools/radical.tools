// ─── Where a Radical Forge run puts what it generates ───────────────────────
// A run splits its output into three views from the start, the layers of a
// Radical architecture model: Conceptual (the need, requirements, scenarios,
// mockups), Logical & physical (the C4 elements) and Governance (fitness
// functions and decisions). A view is created when its first element arrives,
// since an empty view shows the whole model; a later run reuses the views by
// name.
//
// After each stage the user is offered to keep the stage's new elements in a
// row, a column or a grid on their view, and to run Smart Layout on it.
// Studio's wizard and the MCP server's forge_* tools both go through the
// facade here, so they file and arrange the same way.

import { landscapeGridColumns, type C4Node, type DiagramView } from '../../c4'
import type { DiagramFacade } from '../diagramFacade'
import type { ForgeStageId } from './prompts'

export type ForgeViewKey = 'conceptual' | 'logical' | 'governance'

export const FORGE_VIEW_NAMES: Record<ForgeViewKey, string> = {
  conceptual: 'Conceptual',
  logical: 'Logical & physical',
  governance: 'Governance',
}

/** Node types with a fixed view; any other type goes where its stage does. */
const VIEW_OF_TYPE: Record<string, ForgeViewKey> = {
  need: 'conceptual',
  requirement: 'conceptual',
  scenario: 'conceptual',
  mockup: 'conceptual',
  'fitness-fn': 'governance',
  adr: 'governance',
}

export const FORGE_STAGE_VIEW: Record<ForgeStageId, ForgeViewKey> = {
  requirements: 'conceptual',
  fitness: 'governance',
  scenarios: 'conceptual',
  mockups: 'conceptual',
  c4: 'logical',
}

export function forgeViewOf(type: string, stage?: ForgeStageId): ForgeViewKey {
  return VIEW_OF_TYPE[type] ?? (stage ? FORGE_STAGE_VIEW[stage] : 'logical')
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

/** Adds each node to its view (forgeViewOf), creating the view when needed.
 *  Nodes already in their view are left alone. */
export function fileIntoForgeViews(facade: DiagramFacade, nodeIds: string[], stage?: ForgeStageId): FiledNodes[] {
  const nodes = facade.getNodes()
  const byKey = new Map<ForgeViewKey, string[]>()
  for (const id of nodeIds) {
    const node = nodes[id]
    if (!node) continue
    const key = forgeViewOf(node.type, stage)
    byKey.set(key, [...(byKey.get(key) ?? []), id])
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
    const ids = addedNodeIds.filter((id) => nodes[id] && inView.has(id) && forgeViewOf(nodes[id].type, stage) === key)
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
