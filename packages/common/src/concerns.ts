// ─── Hub concern packs ───────────────────────────────────────────────────────
//
// A concern pack (a Hub concept of category `concern`) covers one concern a
// system must decide, such as authentication. Its trigger, a query in the
// model query language, finds the elements the concern applies to; its
// questions (template parameters with options) decide it; its slice (a
// need, requirements, an ADR marked with the concern, a fitness function and
// scenarios) is imported for the answers given and bound to the elements
// it covers.
//
// The check's concern-unaddressed rule (check/rules.ts) reports a concern
// whose elements no accepted ADR marked with it constrains. The packs come
// from the caller (the CLI and the MCP server read the catalogue they
// bundle, Studio the Hub catalogue it loads): this module does not read the
// catalogue.

import type { C4Node, C4Relation, DiagramView } from './c4'
import { uniqueName } from './hubViews'
import { runModelQuery } from './ai/queryLanguage'
import type { ConcernMeta, HubConcept, HubConceptMeta, HubRadicalDoc, TemplateParam } from './hubFormat'
import { buildConceptInsert, resolveParamValues, type ConceptInsert, type ConceptInsertOptions } from './hubImport'
import type { Metamodel } from './metamodel'

/** What the check and the dialogs need of a pack: its hub block. */
export type ConcernPack = Pick<HubConceptMeta, 'id' | 'name' | 'description' | 'requiredMetamodel' | 'sources'> & {
  concern: ConcernMeta
  templateParams?: TemplateParam[]
}

/** The groups of concern packs, by the area of the architecture where the
 *  decision is made, each with the ISO/IEC 25010 characteristics it serves.
 *  ADR Concern groups and pack standard. */
export const CONCERN_GROUPS = [
  { id: 'architecture', label: 'Architecture', description: 'How the system is structured and divided, and how its parts talk to each other.', iso: ['Maintainability', 'Compatibility', 'Flexibility'] },
  { id: 'identity', label: 'Identity & access', description: 'Who calls, and what they may see and do.', iso: ['Security'] },
  { id: 'security', label: 'Security', description: 'Protection against abuse, leaks and tampering.', iso: ['Security'] },
  { id: 'data', label: 'Data', description: 'What is kept, for how long, and how consistently.', iso: ['Reliability', 'Security'] },
  { id: 'integration', label: 'Integration', description: 'How the system talks to other systems.', iso: ['Compatibility', 'Reliability'] },
  { id: 'reliability', label: 'Reliability', description: 'How it behaves under failure and load.', iso: ['Reliability', 'Performance efficiency'] },
  { id: 'operations', label: 'Operations', description: 'How it is run, released and watched.', iso: ['Maintainability', 'Reliability'] },
  { id: 'maintainability', label: 'Maintainability', description: 'How its code can be understood, tested and changed.', iso: ['Maintainability'] },
  { id: 'technology', label: 'Technology', description: 'What it is built on and why.', iso: ['Maintainability', 'Flexibility'] },
] as const

export type ConcernGroupId = typeof CONCERN_GROUPS[number]['id']

/** The group of a pack, or undefined for a group no longer known. */
export const concernGroup = (pack: Pick<ConcernPack, 'concern'>) =>
  CONCERN_GROUPS.find((g) => g.id === pack.concern.group)

/** The ADR property that names the concern a decision settles. */
export const CONCERN_KEY = 'concern'
/** An element's answers it is imported for: `{ KEY: [values] }`, every key
 *  matching. Removed on import. */
export const HUB_WHEN_KEY = 'hubWhen'

export const isConcernPack = (meta: HubConceptMeta): meta is HubConceptMeta & ConcernPack =>
  meta.category === 'concern' && !!meta.concern

/** The concern packs among Hub concepts or summaries. */
export const concernPacks = (metas: HubConceptMeta[]): ConcernPack[] => metas.filter(isConcernPack)

/** The question a parameter asks, with its choices, for findings and agents. */
export function questionLine(param: TemplateParam): string {
  const choices = param.options?.length ? ` (${param.options.map((o) => `${o.value}: ${o.label}`).join(' | ')})` : ''
  return `${param.label}${choices}`
}

/** The ids of the elements the pack's trigger finds, by label. */
export function concernTargets(pack: ConcernPack, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string[] {
  const { result } = runModelQuery(pack.concern.trigger, { nodes, relations })
  const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? []
  const key = /^\s*LIST\s+RELATIONS/i.test(pack.concern.trigger) ? (pack.concern.applyTo === 'source' ? 'sourceId' : 'targetId') : 'id'
  const ids = new Set(rows.map((row) => row[key]).filter((id): id is string => typeof id === 'string' && !!nodes[id]))
  return [...ids].sort((a, b) => nodes[a].label.localeCompare(nodes[b].label) || a.localeCompare(b))
}

/** Whether the model's metamodel can hold a decision marked with a concern. */
export const holdsConcerns = (metamodel: Metamodel | undefined): boolean =>
  !!metamodel?.nodeTypes.adr?.properties?.some((p) => p.key === CONCERN_KEY)

export interface ConcernStatus {
  pack: ConcernPack
  /** The elements the concern applies to. */
  targets: string[]
  /** Those that no accepted ADR marked with the concern constrains, directly
   *  or through an element containing them. */
  open: string[]
  /** Proposed ADRs marked with the concern: the decision is being made. */
  pending: C4Node[]
}

/** Where the model stands on each pack whose trigger finds something. */
export function concernStatuses(packs: ConcernPack[], nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): ConcernStatus[] {
  const out: ConcernStatus[] = []
  for (const pack of packs) {
    const targets = concernTargets(pack, nodes, relations)
    if (!targets.length) continue
    const marked = Object.values(nodes).filter((n) => n.type === 'adr' && prop(n, CONCERN_KEY) === pack.concern.id)
    const accepted = new Set(marked.filter((n) => prop(n, 'status') === 'accepted').map((n) => n.id))
    const settled = new Set<string>()
    for (const r of Object.values(relations)) {
      if (r.relationType === 'constrains' && accepted.has(r.sourceId)) settled.add(r.targetId)
    }
    const covered = (id: string): boolean => {
      for (let cur: string | undefined = id; cur; cur = nodes[cur]?.parentId) if (settled.has(cur)) return true
      return false
    }
    out.push({ pack, targets, open: targets.filter((id) => !covered(id)), pending: marked.filter((n) => prop(n, 'status') === 'proposed') })
  }
  return out
}

const prop = (node: C4Node, key: string): string => {
  const value = (node as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

// ─── Import: the answers pick the slice, the element binds it ───────────────

/** Why the answers do not fit the pack's questions, or null. */
export function answersProblem(pack: Pick<ConcernPack, 'templateParams'>, answers: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(answers)) {
    const param = pack.templateParams?.find((p) => p.key === key)
    if (!param) return `the pack asks no question ${key}`
    if (param.options?.length && value.trim() !== '' && !param.options.some((o) => o.value === value)) {
      return `"${value}" is not an answer to ${key}; it is one of ${param.options.map((o) => o.value).join(', ')}`
    }
  }
  return null
}

/** Whether an element the pack's elements come in for: every key of its
 *  hubWhen holds one of the values it lists. */
function picked(node: Record<string, unknown>, values: Record<string, string>): boolean {
  const when = node[HUB_WHEN_KEY] as Record<string, string[]> | undefined
  if (!when) return true
  return Object.entries(when).every(([key, wanted]) => wanted.includes(values[key] ?? ''))
}

/** The pack with only the elements the answers pick, and the relations
 *  between them; hubWhen removed. */
export function pickVariant(concept: HubConcept, values: Record<string, string>): HubConcept {
  const nodes = concept.nodes.filter((n) => picked(n, values)).map((n) => {
    const { [HUB_WHEN_KEY]: _when, ...rest } = n
    return rest
  })
  const kept = new Set(nodes.map((n) => n.id as string))
  const relations = (concept.relations ?? []).filter((r) => kept.has(r.sourceId as string) && kept.has(r.targetId as string))
  return { ...concept, nodes, relations }
}

/** Why `element` cannot carry the pack, or null: the pack's ADR and fitness
 *  function constrain it and it satisfies the pack's requirements. */
export function bindProblem(element: C4Node | undefined, metamodel: Metamodel | undefined): string | null {
  if (!element) return 'no such element'
  const allows = (type: string, from: string, to: string): boolean =>
    !metamodel || !!metamodel.relationTypes[type]?.allowedPairs.some((p) => p.from === from && p.to === to)
  if (!allows('constrains', 'adr', element.type) || !allows('satisfies', element.type, 'requirement')) {
    return `${/^[aeiou]/.test(element.type) ? 'an' : 'a'} ${element.type} ("${element.label}") cannot be constrained by an ADR and satisfy requirements`
  }
  return null
}

export interface BindSuggestion {
  id: string
  /** The open elements of the concern binding it settles: itself, or those
   *  inside it. */
  covers: string[]
  /** The first: it settles the most, and is the smallest that does. */
  recommended: boolean
}

/** Where to bind a concern pack, best first: the elements the concern is
 *  open for and what contains them, each with the open elements it would
 *  settle (an ADR on a system settles what is inside it). Ranked by how
 *  many it settles, then the more specific first; of an element and its
 *  container settling the same, only the element is offered. When nothing
 *  is open, the elements the trigger finds stand in for them. */
export function bindSuggestions(pack: ConcernPack, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel: Metamodel | undefined): BindSuggestion[] {
  const status = concernStatuses([pack], nodes, relations)[0]
  const pool = status?.open.length ? status.open : status?.targets ?? []
  const chain = (id: string): string[] => {
    const out: string[] = []
    for (let cur: string | undefined = id; cur && nodes[cur] && !out.includes(cur); cur = nodes[cur].parentId) out.push(cur)
    return out
  }
  const candidates = new Set(pool.flatMap(chain))
  const ranked = [...candidates]
    .filter((id) => !bindProblem(nodes[id], metamodel))
    .map((id) => ({ id, covers: pool.filter((t) => chain(t).includes(id)), depth: chain(id).length }))
    .sort((a, b) => b.covers.length - a.covers.length || b.depth - a.depth || nodes[a.id].label.localeCompare(nodes[b.id].label))
  const seen = new Set<string>()
  const out: BindSuggestion[] = []
  for (const { id, covers } of ranked) {
    const key = covers.join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id, covers, recommended: out.length === 0 })
  }
  return out
}

/** The fewest suggestions that together cover every element the best ones
 *  cover: the best first, then each that covers the most still left. What
 *  a wizard checks to begin with. */
export function suggestedCover(suggestions: BindSuggestion[]): string[] {
  const left = new Set(suggestions.flatMap((s) => s.covers))
  const picked: string[] = []
  while (left.size) {
    const best = suggestions
      .map((s) => ({ s, gain: s.covers.filter((c) => left.has(c)).length }))
      .filter((x) => x.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0]
    if (!best) break
    picked.push(best.s.id)
    best.s.covers.forEach((c) => left.delete(c))
  }
  return picked
}

export interface ConcernInsertOptions extends Omit<ConceptInsertOptions, 'paramValues'> {
  answers: Record<string, string>
  /** The elements the pack is bound to; none leaves it unbound, which the
   *  check's concern-unbound reports until it is bound. */
  elements: C4Node[]
  metamodel: Metamodel | undefined
  /** The ADR's date, YYYY-MM-DD. */
  today: string
  /** The model's elements, to place the bound elements' outermost
   *  containers in the pack's view. */
  nodes?: Record<string, C4Node>
}

/** The folder of the views concern packs bring. */
export const CONCERN_VIEWS_FOLDER = 'Concerns'
const VIEW_COLUMN_GAP = 60
const VIEW_ROW_GAP = 40

/** The part of a concern pack the answers pick, its texts filled, bound to
 *  `elements`: the ADR (accepted, dated today) and the fitness functions
 *  constrain each and each satisfies the requirements. No template record:
 *  the answers also chose the elements, which a later change of value would
 *  not. Throws when the answers or an element do not fit. */
export function buildConcernInsert(concept: HubConcept, options: ConcernInsertOptions): ConceptInsert {
  const problem = answersProblem(concept, options.answers)
    ?? options.elements.map((e) => bindProblem(e, options.metamodel)).find(Boolean) ?? null
  if (problem) throw new Error(problem)
  const values = resolveParamValues(concept.templateParams, options.answers)
  const insert = buildConceptInsert({ ...pickVariant(concept, values), templateParams: undefined }, {
    ...options,
    paramValues: answerTexts(concept.templateParams, values),
  })
  const bind = (relationType: string, sourceId: string, targetId: string): void => {
    const id = options.newId()
    insert.relations[id] = { id, sourceId, targetId, relationType }
  }
  for (const node of Object.values(insert.nodes)) {
    if (node.type === 'adr') Object.assign(node, { status: 'accepted', ...(prop(node, 'date') ? {} : { date: options.today }) })
    for (const { id: elementId } of options.elements) {
      if (node.type === 'adr' || node.type === 'fitness-fn') bind('constrains', node.id, elementId)
      else if (node.type === 'requirement') bind('satisfies', elementId, node.id)
    }
  }
  insert.views.push(concernView(concept.name, insert, options))
  return insert
}

/** The canvas view a pack brings, in the folder Concerns: its elements as
 *  the pack lays them out (need, requirements, scenarios, decisions,
 *  fitness functions in columns), and the elements it is bound to, by
 *  their outermost containers, in a column on their left. */
function concernView(name: string, insert: ConceptInsert, options: ConcernInsertOptions): DiagramView {
  const packNodes = Object.values(insert.nodes)
  const minX = Math.min(...packNodes.map((n) => n.x))
  const minY = Math.min(...packNodes.map((n) => n.y))
  const positions: DiagramView['positions'] = {}
  for (const n of packNodes) positions[n.id] = { x: n.x - minX, y: n.y - minY, width: n.width, height: n.height }
  const all = options.nodes ?? {}
  const outermost = (n: C4Node): C4Node => {
    let cur = n
    for (let p = all[cur.parentId ?? '']; p; p = all[p.parentId ?? '']) cur = p
    return cur
  }
  const roots = [...new Map(options.elements.map((e) => { const r = outermost(all[e.id] ?? e); return [r.id, r] })).values()]
  const width = Math.max(0, ...roots.map((r) => r.width))
  let y = 0
  for (const r of roots) {
    positions[r.id] = { x: -width - VIEW_COLUMN_GAP * 2, y, width: r.width, height: r.height }
    y += r.height + VIEW_ROW_GAP
  }
  return {
    id: options.newId(),
    name: uniqueName(name, new Set(options.takenNames?.views ?? [])),
    kind: 'static',
    folder: CONCERN_VIEWS_FOLDER,
    nodeIds: [...packNodes.map((n) => n.id), ...options.elements.map((e) => e.id)],
    positions,
  }
}

/** The requirements the answers bring, by label: what the import dialog
 *  shows before the import. */
export function requirementsFor(concept: HubConcept, answers: Record<string, string>): string[] {
  const values = resolveParamValues(concept.templateParams, answers)
  const texts = answerTexts(concept.templateParams, values)
  return pickVariant(concept, values).nodes
    .filter((n) => n.type === 'requirement')
    .map((n) => String(n.label ?? '').replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k: string) => texts[k] ?? ''))
}

/** What each answer reads as in the pack's texts: a chosen option's label,
 *  free text as it is. The values pick the variant; the labels fill it. */
export function answerTexts(params: TemplateParam[] | undefined, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const option = params?.find((p) => p.key === key)?.options?.find((o) => o.value === value)
    return [key, option?.label ?? value]
  }))
}

// ─── Validation of a pack in the catalogue ───────────────────────────────────

/** What is wrong with a concern pack's file: a trigger that does not run, no
 *  question, answers its elements name that no question offers, and a slice
 *  that is not connected (each requirement derives from the need and is
 *  verified by a scenario, each fitness function implements an ADR marked
 *  with the concern). */
export function concernPackProblems(doc: HubRadicalDoc): string[] {
  const meta = doc.hub
  const errors: string[] = []
  const concern = meta.concern
  if (!concern?.id || !concern.trigger || !concern.why) return ['hub.concern needs id, trigger and why']
  if (!/^\s*LIST\s+(NODES|RELATIONS)\b/i.test(concern.trigger)) errors.push('hub.concern.trigger must be a LIST NODES or LIST RELATIONS query')
  try { runModelQuery(concern.trigger, { nodes: {}, relations: {} }) } catch (error) {
    errors.push(`hub.concern.trigger does not run: ${(error as Error).message}`)
  }
  if (!CONCERN_GROUPS.some((g) => g.id === concern.group)) errors.push(`hub.concern.group must be one of ${CONCERN_GROUPS.map((g) => g.id).join(', ')}`)
  const params = meta.templateParams ?? []
  const questions = params.filter((p) => p.options?.length)
  if (questions.length < 3) errors.push(`a concern pack asks at least three questions with options (it asks ${questions.length})`)
  for (const q of questions) {
    for (const o of q.options!) if (!o.description?.trim()) errors.push(`question ${q.key}: option "${o.value}" does not say what it means and when to pick it`)
  }
  const sources = meta.sources ?? []
  if (sources.length < 2) errors.push(`a concern pack names at least two sources (it names ${sources.length})`)
  for (const src of sources) if (!src.title?.trim() || !/^https?:\/\//.test(src.url ?? '')) errors.push(`source "${src.title ?? ''}" needs a title and an http(s) link`)
  const nodes = doc.nodes
  for (const n of nodes) {
    for (const [key, values] of Object.entries((n[HUB_WHEN_KEY] as Record<string, string[]> | undefined) ?? {})) {
      const param = params.find((p) => p.key === key)
      if (!param?.options) { errors.push(`node "${n.id}": hubWhen names ${key}, which is no question with options`); continue }
      for (const v of values) if (!param.options.some((o) => o.value === v)) errors.push(`node "${n.id}": hubWhen ${key} = "${v}" is none of its options`)
    }
  }
  const rels = doc.relations ?? []
  const has = (type: string, from: string, to?: string): boolean =>
    rels.some((r) => r.relationType === type && r.sourceId === from && (to === undefined || r.targetId === to))
  const into = (type: string, to: string): boolean => rels.some((r) => r.relationType === type && r.targetId === to)
  const ofType = (type: string) => nodes.filter((n) => n.type === type)
  const needs = ofType('need')
  if (needs.length !== 1) errors.push('a concern pack holds exactly one need')
  const adrs = ofType('adr')
  if (!adrs.length) errors.push('a concern pack holds an ADR')
  for (const a of adrs) if (a[CONCERN_KEY] !== concern.id) errors.push(`ADR "${a.id}" is not marked with the concern "${concern.id}"`)
  for (const r of ofType('requirement')) {
    if (!needs.some((need) => has('derives', r.id as string, need.id as string))) errors.push(`requirement "${r.id}" derives from no need of the pack`)
    if (!into('verifies', r.id as string)) errors.push(`requirement "${r.id}" is verified by no scenario`)
  }
  for (const f of ofType('fitness-fn')) {
    if (!adrs.some((a) => has('implements', f.id as string, a.id as string))) errors.push(`fitness function "${f.id}" implements no ADR of the pack`)
    const text = String(f.description ?? '')
    if (!/^Tool: \S/m.test(text)) errors.push(`fitness function "${f.id}" names no tool (a "Tool: …" line in its description)`)
    if (!/```[\s\S]+?```/.test(text)) errors.push(`fitness function "${f.id}" carries no snippet to copy (a fenced block in its description)`)
  }
  for (const s of ofType('scenario')) if (!has('verifies', s.id as string)) errors.push(`scenario "${s.id}" verifies nothing`)
  return errors
}
