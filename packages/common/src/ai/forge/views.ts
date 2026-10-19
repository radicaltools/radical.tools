// ─── Where a Radical Forge run puts what it generates ───────────────────────
// Before a run starts the user picks its view structure (ForgeStructure):
//
// Radical, the default when the metamodel has viewpoints, is the structure of
// radical.tools' own model: a view of each chosen viewpoint, in the folders
// Conceptual, Logical and Governance. Such a view lists no elements; it shows
// what its viewpoint's chain gives. It is made once its chain shows an
// element, and a view of the viewpoint the model already has is reused.
//
// Layer canvases split the output into six views, the layers of a
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
import type { Metamodel } from '../../metamodel'
import { runChain, runPipeline, type PipelineContext } from '../../viewPipeline'
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
  review: 'logical',
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

// ─── The structures ─────────────────────────────────────────────────────────

/** The view structure of a run: Radical, the chosen viewpoints (ids, in the
 *  order of radicalViewpoints), or the six layer canvases. */
export type ForgeStructure = { kind: 'radical'; viewpoints: string[] } | { kind: 'layers' }

/** The folder each built-in viewpoint's view goes into, as in radical.tools'
 *  own model, in the order of the list of views there. */
export const RADICAL_FOLDERS: Record<string, string> = {
  'domain-map': 'Conceptual',
  'domain-model': 'Conceptual',
  traceability: 'Conceptual',
  specification: 'Conceptual',
  'entity-lifecycles': 'Conceptual',
  'event-catalogue': 'Conceptual',
  'process-warnier': 'Conceptual',
  'screen-flow': 'Conceptual',
  screens: 'Conceptual',
  'system-context': 'Logical',
  containers: 'Logical',
  components: 'Logical',
  'container-dependencies': 'Logical',
  'domain-realisation': 'Logical',
  responsibilities: 'Logical',
  decisions: 'Governance',
  'decision-log': 'Governance',
  'fitness-functions': 'Governance',
  'requirement-coverage': 'Governance',
  'requirement-gaps': 'Governance',
}

const RADICAL_FOLDER_ORDER = ['Conceptual', 'Logical', 'Governance']

/** A viewpoint the Radical structure can have a view of. */
export interface ForgeViewpointChoice {
  id: string
  label: string
  folder: string
  /** Chosen unless the user unticks it: every viewpoint the radical model
   *  has a folder for; another metamodel's only when ticked. */
  chosen: boolean
}

/** The metamodel's viewpoints by folder: Conceptual, Logical and Governance
 *  in the radical model's order, then the others in folders named after
 *  their group, in the metamodel's order. */
export function radicalViewpoints(metamodel: Metamodel | undefined): ForgeViewpointChoice[] {
  const defs = metamodel?.viewpoints ?? []
  const known = Object.keys(RADICAL_FOLDERS)
  const choices = defs.map((v): ForgeViewpointChoice => ({
    id: v.id,
    label: v.label,
    folder: RADICAL_FOLDERS[v.id] ?? v.group ?? 'Other',
    chosen: v.id in RADICAL_FOLDERS,
  }))
  const folders = [...RADICAL_FOLDER_ORDER, ...new Set(choices.map((c) => c.folder).filter((f) => !RADICAL_FOLDER_ORDER.includes(f)))]
  const rank = (c: ForgeViewpointChoice): number => (c.id in RADICAL_FOLDERS ? known.indexOf(c.id) : known.length + defs.findIndex((v) => v.id === c.id))
  return choices.sort((a, b) => folders.indexOf(a.folder) - folders.indexOf(b.folder) || rank(a) - rank(b))
}

/** Whether the model already has a layer canvas of a Forge run: a canvas
 *  named Conceptual that lists elements. */
function hasLayerCanvases(views: Record<string, DiagramView> | undefined): boolean {
  return Object.values(views ?? {}).some((v) => isCanvas(v) && !v.viewpoint && v.nodeIds.length > 0
    && v.name.trim().toLowerCase() === FORGE_VIEW_NAMES.conceptual.toLowerCase())
}

/** The structure a run starts with: Layer canvases when the metamodel has no
 *  viewpoints, or the model has layer canvases and no view of a viewpoint;
 *  otherwise Radical with the viewpoints chosen by default. */
export function defaultForgeStructure(metamodel: Metamodel | undefined, views: Record<string, DiagramView> | undefined): ForgeStructure {
  const choices = radicalViewpoints(metamodel)
  const ofViewpoint = Object.values(views ?? {}).some((v) => v.viewpoint)
  if (!choices.length || (hasLayerCanvases(views) && !ofViewpoint)) return { kind: 'layers' }
  return { kind: 'radical', viewpoints: choices.filter((c) => c.chosen).map((c) => c.id) }
}

/** The structure in a sentence, for the MCP server's answers. */
export function describeForgeStructure(structure: ForgeStructure, metamodel: Metamodel | undefined): string {
  if (structure.kind === 'layers') return `Layer canvases: ${Object.values(FORGE_VIEW_NAMES).join(', ')}.`
  const chosen = new Set(structure.viewpoints)
  const byFolder = new Map<string, string[]>()
  for (const c of radicalViewpoints(metamodel)) {
    if (chosen.has(c.id)) byFolder.set(c.folder, [...(byFolder.get(c.folder) ?? []), c.label])
  }
  return `Radical: ${[...byFolder].map(([folder, labels]) => `${folder} (${labels.join(', ')})`).join('; ')}.`
}

/** The viewpoints whose view shows a stage's work best, first first. */
const RADICAL_STAGE_VIEWPOINTS: Record<ForgeStageId, string[]> = {
  requirements: ['traceability', 'requirement-coverage', 'specification', 'requirement-gaps'],
  domain: ['domain-model', 'domain-map', 'domain-realisation'],
  fitness: ['fitness-functions', 'decisions'],
  scenarios: ['traceability', 'requirement-coverage', 'specification'],
  states: ['entity-lifecycles', 'event-catalogue'],
  processes: ['process-warnier'],
  mockups: ['screen-flow', 'screens'],
  c4: ['containers', 'system-context', 'components', 'responsibilities'],
  review: ['requirement-gaps', 'requirement-coverage', 'traceability'],
}

/** The view of a viewpoint the model has, if any. */
const viewOfViewpoint = (views: Record<string, DiagramView> | undefined, viewpoint: string): DiagramView | undefined =>
  Object.values(views ?? {}).find((v) => v.viewpoint === viewpoint)

/** The view that shows a stage's work, if the model has it: the stage's
 *  layer canvas, or the first of its viewpoints' views. */
export function forgeStageView(views: Record<string, DiagramView> | undefined, stage: ForgeStageId, structure: ForgeStructure): DiagramView | undefined {
  if (structure.kind === 'layers') return findForgeView(views, FORGE_STAGE_VIEW[stage])
  const chosen = new Set(structure.viewpoints)
  for (const viewpoint of RADICAL_STAGE_VIEWPOINTS[stage]) {
    const view = chosen.has(viewpoint) ? viewOfViewpoint(views, viewpoint) : undefined
    if (view) return view
  }
  return undefined
}

export interface FiledNodes {
  /** The layer (ForgeViewKey) or, in the Radical structure, the viewpoint. */
  key: string
  viewId: string
  viewName: string
  /** A canvas: its elements have places, and can be arranged. */
  canvas: boolean
  /** Made by this call. */
  made: boolean
  /** The given nodes the view now shows that it did not list before: on a
   *  layer canvas those this call added to it, in a view of a viewpoint
   *  those its chain shows. In the order given. */
  nodeIds: string[]
}

/** What `view` shows of the model. */
function shownBy(facade: DiagramFacade, view: DiagramView, metamodel: Metamodel): C4Node[] {
  return runPipeline(view, { nodes: facade.getNodes(), relations: facade.getRelations(), metamodel }).nodes
}

/** The Radical structure: a view of each chosen viewpoint that shows
 *  something, made in its folder when the model has none. */
function fileIntoRadicalViews(facade: DiagramFacade, nodeIds: string[], viewpoints: string[]): FiledNodes[] {
  const metamodel = facade.getMetamodel?.()
  if (!metamodel || !facade.addView) return []
  const choices = new Map(radicalViewpoints(metamodel).map((c) => [c.id, c]))
  const defs = new Map((metamodel.viewpoints ?? []).map((v) => [v.id, v]))
  const fresh = new Set(nodeIds)
  const filed: FiledNodes[] = []
  for (const viewpoint of viewpoints) {
    const def = defs.get(viewpoint)
    const choice = choices.get(viewpoint)
    if (!def || !choice) continue
    let view = viewOfViewpoint(facade.getViews?.(), viewpoint)
    let made = false
    if (!view) {
      const ctx: PipelineContext = { nodes: facade.getNodes(), relations: facade.getRelations(), metamodel }
      if (!runChain(Object.values(ctx.nodes), def.pipeline, ctx).nodes.length) continue
      const viewId = facade.addView(def.label)
      if (!viewId || !facade.applyViewpoint?.(viewId, viewpoint)) continue
      facade.setViewFolder?.(viewId, choice.folder)
      view = facade.getViews?.()[viewId]
      if (!view) continue
      made = true
    }
    const shown = shownBy(facade, view, metamodel).map((n) => n.id).filter((id) => fresh.has(id))
    filed.push({ key: viewpoint, viewId: view.id, viewName: view.name, canvas: isCanvas(view), made, nodeIds: nodeIds.filter((id) => shown.includes(id)) })
  }
  return filed
}

/** Files nodes a run added into its structure (Layer canvases when none is
 *  given). With Layer canvases each node goes into its views
 *  (forgeViewsOf), a view made when needed; nodes already in a view are
 *  left alone, and a state machine brings along the entity it is the
 *  lifecycle of, so the States view shows the link. */
export function fileIntoForgeViews(facade: DiagramFacade, nodeIds: string[], stage?: ForgeStageId, structure: ForgeStructure = { kind: 'layers' }): FiledNodes[] {
  if (structure.kind === 'radical') return fileIntoRadicalViews(facade, nodeIds, structure.viewpoints)
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
    const existed = !!findForgeView(facade.getViews?.(), key)
    const viewId = ensureForgeView(facade, key)
    const view = viewId ? facade.getViews?.()[viewId] : undefined
    if (!viewId || !view) continue
    const entry = { key, viewId, viewName: view.name, canvas: isForgeCanvas(key), made: !existed }
    // A view of a viewpoint shows what its chain gives: listing the elements
    // would hide the ones a later run adds.
    if (!isForgeCanvas(key)) { filed.push({ ...entry, nodeIds: [] }); continue }
    const present = new Set(view.nodeIds)
    const missing = ids.filter((id) => !present.has(id))
    if (missing.length) facade.setViewNodes(viewId, [...view.nodeIds, ...missing])
    filed.push({ ...entry, nodeIds: missing })
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

/** The stage's new elements grouped by the canvas of the structure they are
 *  in (Layer canvases when none is given). */
export function forgeArrangeGroups(facade: DiagramFacade, addedNodeIds: string[], stage?: ForgeStageId, structure: ForgeStructure = { kind: 'layers' }): ForgeArrangeGroup[] {
  const nodes = facade.getNodes()
  const views = facade.getViews?.() ?? {}
  const groups: ForgeArrangeGroup[] = []
  if (structure.kind === 'radical') {
    const metamodel = facade.getMetamodel?.()
    if (!metamodel) return []
    const added = new Set(addedNodeIds)
    for (const viewpoint of structure.viewpoints) {
      const view = viewOfViewpoint(views, viewpoint)
      if (!view || !isCanvas(view)) continue
      const shown = new Set(shownBy(facade, view, metamodel).map((n) => n.id))
      const nodeIds = outermostNodes(nodes, addedNodeIds.filter((id) => added.has(id) && shown.has(id)))
      if (nodeIds.length) groups.push({ viewId: view.id, viewName: view.name, nodeIds })
    }
    return groups
  }
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
