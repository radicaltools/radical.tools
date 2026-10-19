// ─── Viewpoints ─────────────────────────────────────────────────────────────
// Viewpoints the metamodel defines (Metamodel.viewpoints): a view type
// (table, wiki, …) and a filter chain under a name, for a question asked of
// the model again and again. New view offers them, and so does a view's
// Viewpoint list. A view of a viewpoint (DiagramView.viewpoint) has its view
// type and chain and follows it when it changes (model.ts, syncViewpoints);
// a view whose type or chain is changed by hand is of no viewpoint any more.
// A view's chain can be saved as a viewpoint (under a viewpoint's name it
// replaces that one's).
//
// A viewpoint may draw one element (ViewpointDef.subject: a state machine, a
// process, a system's containers): a view of it names the element
// (DiagramView.subject) and holds the viewpoint's chain with the first level
// kept to that element and what lies inside it (scopedChain). It is named
// after the element and follows its name until renamed, and goes with it
// (model.ts).

import type { C4Node, DiagramView, ViewPipeline } from './c4'
import type { Metamodel, ViewpointDef, ViewpointKind } from './metamodel/types'
import { levelLabel, readPipeline, sortLabel, type PipelineContext } from './viewPipeline'

export const VIEWPOINT_KINDS: readonly ViewpointKind[] = ['static', 'table', 'treemap', 'matrix', 'wiki', 'warnier']

/** How each kind is called in Studio. */
export const VIEW_KIND_LABELS: Record<ViewpointKind, string> = {
  static: 'Structure', table: 'Table', treemap: 'Hierarchy', matrix: 'Matrix', wiki: 'Wiki', warnier: 'Warnier',
}

export function isViewpointKind(kind: unknown): kind is ViewpointKind {
  return (VIEWPOINT_KINDS as readonly unknown[]).includes(kind)
}

/** The metamodel's viewpoints that have an id, a name, a kind and a chain,
 *  each chain read with readPipeline (a hand-edited file may hold anything). */
export function viewpointsOf(mm: Metamodel | null | undefined): ViewpointDef[] {
  const raw: unknown = mm?.viewpoints
  if (!Array.isArray(raw)) return []
  const out: ViewpointDef[] = []
  for (const t of raw as Array<Partial<ViewpointDef> | null>) {
    if (!t || typeof t.id !== 'string' || typeof t.label !== 'string' || !t.label.trim() || !isViewpointKind(t.kind)) continue
    const subject = readSubject(t.subject)
    out.push({ id: t.id, label: t.label, ...(t.group?.trim() ? { group: t.group.trim() } : {}), ...(t.description ? { description: t.description } : {}), kind: t.kind, pipeline: readPipeline(t.pipeline) ?? {}, ...(subject ? { subject } : {}) })
  }
  return out
}

/** A viewpoint's subject as a file may hold it: types, at least one. */
function readSubject(raw: unknown): ViewpointDef['subject'] | undefined {
  const types = (raw as { types?: unknown } | undefined)?.types
  const list = Array.isArray(types) ? types.filter((t): t is string => typeof t === 'string' && !!t) : []
  return list.length ? { types: list } : undefined
}

/** Whether `node` can be the element a view of `type` draws. */
export function canBeSubject(type: ViewpointDef, node: C4Node | undefined): boolean {
  return !!node && !!type.subject?.types.includes(node.type)
}

/** The elements of `nodes` a view of `type` can draw, by name. */
export function subjectsOf(type: ViewpointDef, nodes: Record<string, C4Node>): C4Node[] {
  return Object.values(nodes).filter((n) => canBeSubject(type, n)).sort((a, b) => a.label.localeCompare(b.label))
}

/** The chain of a view of `type` that draws `subjectId`: the viewpoint's,
 *  its first level kept to that element and what lies inside it. Without a
 *  subject (or for a viewpoint that draws none), the viewpoint's own. */
export function scopedChain(type: ViewpointDef, subjectId?: string): ViewPipeline {
  const chain = chainOfViewpoint(type)
  if (!subjectId || !type.subject) return chain
  const [first, ...rest] = chain.levels?.length ? chain.levels : [{ ways: [{}] }]
  return { ...chain, levels: [{ ...first, filters: [...(first.filters ?? []), { kind: 'within', nodeId: subjectId, self: true }] }, ...rest] }
}

/** The name of a view of one element: the element's. */
export function subjectViewName(subject: C4Node | undefined, type: ViewpointDef): string {
  return subject?.label.trim() || type.label
}

/** The name viewpoints without a group are listed under. */
export const UNGROUPED_VIEWPOINTS = 'Custom'

/** `viewpoints` by group, each group where its first viewpoint is in the
 *  list; those without a group last, under UNGROUPED_VIEWPOINTS. */
export function viewpointGroups(viewpoints: ViewpointDef[]): Array<{ group: string; viewpoints: ViewpointDef[] }> {
  const groups = new Map<string, ViewpointDef[]>()
  for (const v of viewpoints) {
    if (!v.group) continue
    const list = groups.get(v.group)
    if (list) list.push(v)
    else groups.set(v.group, [v])
  }
  const out = [...groups].map(([group, list]) => ({ group, viewpoints: list }))
  const rest = viewpoints.filter((v) => !v.group)
  if (rest.length) out.push({ group: UNGROUPED_VIEWPOINTS, viewpoints: rest })
  return out
}

/** The viewpoint `view` is of, if the metamodel still has it. */
export function viewpointOfView(view: DiagramView | undefined, mm: Metamodel | null | undefined): ViewpointDef | undefined {
  return view?.viewpoint ? viewpointsOf(mm).find((t) => t.id === view.viewpoint) : undefined
}

/** The viewpoint with this id, or else this name (any case). */
export function findViewpoint(types: ViewpointDef[], idOrLabel: unknown): ViewpointDef | undefined {
  if (typeof idOrLabel !== 'string') return undefined
  const wanted = idOrLabel.trim().toLowerCase()
  return types.find((t) => t.id === idOrLabel) ?? types.find((t) => t.label.trim().toLowerCase() === wanted)
}

/** JSON with object keys sorted, so two chains compare by what they say. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Whether two chains say the same, however each was written. */
export function sameChain(a: unknown, b: unknown): boolean {
  return canonical(readPipeline(a) ?? {}) === canonical(readPipeline(b) ?? {})
}

/** A copy of a viewpoint's chain for a view to hold. */
export function chainOfViewpoint(type: ViewpointDef): ViewPipeline {
  return JSON.parse(JSON.stringify(type.pipeline)) as ViewPipeline
}

/** An id for a new type named `label`, unlike the ids `types` have. */
export function newViewpointId(label: string, types: ViewpointDef[]): string {
  const base = label.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'view-type'
  const taken = new Set(types.map((t) => t.id))
  let id = base
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`
  return id
}

/** `mm` with `type` in it: in the place of the one with its id, else last. */
export function withViewpoint(mm: Metamodel, type: ViewpointDef): Metamodel {
  const list = viewpointsOf(mm)
  const i = list.findIndex((t) => t.id === type.id)
  const removed = (mm.removedViewpoints ?? []).filter((id) => id !== type.id)
  const { removedViewpoints: _r, ...rest } = mm
  return { ...rest, viewpoints: i < 0 ? [...list, type] : list.map((t, j) => (j === i ? type : t)), ...(removed.length ? { removedViewpoints: removed } : {}) }
}

/** `mm` without the viewpoint `id`, noted as removed so that a preset's
 *  does not come back on load (documentMetamodel). */
export function withoutViewpoint(mm: Metamodel, id: string): Metamodel {
  return { ...mm, viewpoints: viewpointsOf(mm).filter((t) => t.id !== id), removedViewpoints: [...new Set([...(mm.removedViewpoints ?? []), id])] }
}

/** `mm` with a view's kind and chain saved as the viewpoint named `label`: the
 *  type of that name gets them, or a new one is added. */
export function saveAsViewpoint(mm: Metamodel, label: string, kind: ViewpointKind, pipeline: ViewPipeline, description?: string): { metamodel: Metamodel; type: ViewpointDef } {
  const list = viewpointsOf(mm)
  const trimmed = label.trim()
  const existing = findViewpoint(list, trimmed)
  const desc = description?.trim() || existing?.description
  const type: ViewpointDef = {
    id: existing?.id ?? newViewpointId(trimmed, list),
    label: trimmed,
    ...(existing?.group ? { group: existing.group } : {}),
    ...(desc ? { description: desc } : {}),
    kind,
    pipeline: JSON.parse(JSON.stringify(readPipeline(pipeline) ?? {})) as ViewPipeline,
    ...(existing?.subject ? { subject: existing.subject } : {}),
  }
  return { metamodel: withViewpoint(mm, type), type }
}

/** A view name for a new view of `type`, unlike the names `views` have. */
export function newViewName(type: ViewpointDef, views: Record<string, DiagramView>): string {
  const taken = new Set(Object.values(views).map((v) => v.name))
  let name = type.label
  for (let i = 2; taken.has(name); i++) name = `${type.label} ${i}`
  return name
}

/** A chain in words, its levels in order: "Need → Refined into →
 *  Requirement → Verified by → Scenario · sorted by Name". */
export function chainSummary(pipeline: ViewPipeline, ctx: PipelineContext): string {
  const levels = (pipeline.levels ?? []).map((l) => levelLabel(l, ctx))
  const filters = (pipeline.levels ?? []).reduce((n, l) => n + (l.filters?.length ?? 0), 0)
  const parts = [levels.join(' → ') || 'Every element']
  if (filters) parts.push(`${filters} filter${filters === 1 ? '' : 's'}`)
  if (pipeline.sort) parts.push(`sorted by ${sortLabel(pipeline.sort, ctx)}`)
  return parts.join(' · ')
}
