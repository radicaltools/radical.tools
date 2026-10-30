// ─── Hub concept → model insertion ───────────────────────────────────────────
// Turns a fully loaded Hub concept into the nodes, relations, sequences and
// views to add to a model: fresh ids, template params filled in, the cluster
// moved to where the caller wants it. Studio adds the result to its store
// (hub/importConcept.ts, centred on the viewport); the MCP server's Forge
// adds it to the folder, beside the existing model.

import { migrateCheckFields } from './formats/checksMigration'
import type { C4ElementType, C4Node, C4Relation, DiagramData, DiagramSequence, DiagramView } from './c4'
import { NODE_SIZES, trimStepBackward } from './c4'
import type { HubConcept, HubImportRecord, TemplateParam } from './hubFormat'
import { conceptViewsToDiagram, uniqueName } from './hubViews'

/** The value each parameter takes: the one given, or, left blank, the
 *  template's default. The hint is only an example shown in the empty field,
 *  never a value (the MCP server filled in the hint, Studio nothing). */
export function resolveParamValues(params: TemplateParam[] | undefined, given: Record<string, string> = {}): Record<string, string> {
  const values: Record<string, string> = { ...given }
  for (const p of params ?? []) {
    const v = given[p.key]
    values[p.key] = v == null || v.trim() === '' ? p.defaultValue ?? '' : v
  }
  return values
}

/** Default parameter values (each param's `defaultValue`, or `''`) — used
 *  when the caller doesn't collect explicit values via a param dialog. */
export function defaultParamValues(params: TemplateParam[] | undefined): Record<string, string> {
  return resolveParamValues(params)
}

const TOKEN = /\{\{([A-Z0-9_]+)\}\}/g
const hasToken = (v: unknown): v is string => typeof v === 'string' && /\{\{[A-Z0-9_]+\}\}/.test(v)
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * What a field reads after the template's values change from `oldValues`
 * to `newValues`, given the Hub's `original` text (with its {{KEY}} tokens)
 * and the `current` one. Untouched since the import, it is the original
 * with the new values. Edited since, each changed value is replaced where
 * the text still has it (a whole word, not inside another), and the rest of
 * the edit stays; a text without the old value is left as it is.
 */
export function retemplateText(current: string, original: string, oldValues: Record<string, string>, newValues: Record<string, string>): string {
  if (current === substituteParams(original, oldValues)) return substituteParams(original, newValues)
  const changed = new Map<string, string>()
  for (const [, key] of original.matchAll(TOKEN)) {
    const was = oldValues[key] ?? ''
    const now = newValues[key] ?? was
    if (was !== '' && was !== now && !changed.has(was)) changed.set(was, now)
  }
  if (changed.size === 0) return current
  const pattern = [...changed.keys()]
    .sort((a, b) => b.length - a.length)
    .map((v) => `${/^[\p{L}\p{N}_]/u.test(v) ? '(?<![\\p{L}\\p{N}_])' : ''}${escapeRegExp(v)}${/[\p{L}\p{N}_]$/u.test(v) ? '(?![\\p{L}\\p{N}_])' : ''}`)
    .join('|')
  return current.replace(new RegExp(pattern, 'gu'), (m) => changed.get(m) ?? m)
}

/** Replace all `{{KEY}}` tokens in a string with `values[KEY]` (left as-is
 *  when the key is unknown). Mirrors HubImportModal.tsx's substituteParams. */
function substituteParams(str: string, values: Record<string, string>): string {
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`)
}

/** Returns a copy of `concept` with the `{{KEY}}` tokens of its nodes,
 *  relations and sequences (names and step notes) substituted. Nodes only
 *  were: a flow's step notes kept their tokens in the model. */
export function applyTemplateParams(concept: HubConcept, values: Record<string, string>): HubConcept {
  const subst = (item: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item)) {
      out[k] = typeof v === 'string'
        ? substituteParams(v, values)
        : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? substituteParams(x, values) : x)) : v
    }
    return out
  }
  return {
    ...concept,
    nodes: concept.nodes.map(subst),
    ...(concept.relations ? { relations: concept.relations.map(subst) } : {}),
    ...(concept.sequences ? { sequences: concept.sequences.map(subst) } : {}),
  }
}

/** The keys of the `{{KEY}}` tokens a concept's texts hold. */
export function templateKeysUsed(concept: Pick<HubConcept, 'nodes' | 'relations' | 'sequences'>): Set<string> {
  const keys = new Set<string>()
  const scan = (v: unknown): void => {
    if (typeof v === 'string') for (const m of v.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) keys.add(m[1])
    else if (Array.isArray(v)) v.forEach(scan)
  }
  for (const item of [...concept.nodes, ...(concept.relations ?? []), ...(concept.sequences ?? [])]) {
    for (const v of Object.values(item)) scan(v)
  }
  return keys
}

export interface ConceptInsertOptions {
  newId: () => string
  /** Top-left corner for the concept's root nodes, given the size of the
   *  box around them. */
  place: (cluster: { width: number; height: number }) => { x: number; y: number }
  paramValues?: Record<string, string>
  /** Names of the model's views and sequences: the import's take another
   *  (" 2"), or a concept imported twice gave two of each name. */
  takenNames?: { views?: Iterable<string>; sequences?: Iterable<string> }
}

export interface ConceptInsert {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  sequences: Record<string, DiagramSequence>
  views: DiagramView[]
  /** For a concept with template params: the record that keeps the import
   *  editable (the document's `hubTemplates`, keyed by `id`). */
  template?: { id: string; record: HubImportRecord }
}

export function buildConceptInsert(concept: HubConcept, options: ConceptInsertOptions): ConceptInsert {
  const { newId } = options
  const paramValues = resolveParamValues(concept.templateParams, options.paramValues)
  const templated = applyTemplateParams(concept, paramValues)

  const idMap = new Map<string, string>()
  for (const raw of templated.nodes) {
    idMap.set(raw.id as string, newId())
  }

  const rootNodes = templated.nodes.filter((n) => !n.parentId)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of rootNodes) {
    const rx = (n.x as number) ?? 0
    const ry = (n.y as number) ?? 0
    const rw = (n.width as number) ?? 200
    const rh = (n.height as number) ?? 120
    if (rx < minX) minX = rx
    if (ry < minY) minY = ry
    if (rx + rw > maxX) maxX = rx + rw
    if (ry + rh > maxY) maxY = ry + rh
  }
  const bounded = isFinite(minX) && isFinite(minY)
  const corner = options.place(bounded ? { width: maxX - minX, height: maxY - minY } : { width: 0, height: 0 })
  const offsetX = corner.x - (bounded ? minX : 0)
  const offsetY = corner.y - (bounded ? minY : 0)

  const nodes: Record<string, C4Node> = {}
  for (const node of templated.nodes) {
    // A concept from before `metrics` (a test list, a threshold) comes in
    // as models from then are read.
    const raw = migrateCheckFields(node as Record<string, unknown>)
    const oldId = raw.id as string
    const id = idMap.get(oldId)!
    const type = ((raw.type as C4ElementType) ?? 'component')
    const defaults = NODE_SIZES[type] ?? { width: 200, height: 120 }
    const isChild = !!raw.parentId

    nodes[id] = {
      ...(raw as Record<string, unknown>),
      id,
      type,
      label: (raw.label as string) ?? concept.name,
      description: (raw.description as string) ?? undefined,
      technology: (raw.technology as string) ?? undefined,
      collapsed: (raw.collapsed as boolean) ?? false,
      templateParams: undefined,
      parentId: raw.parentId && idMap.has(raw.parentId as string) ? idMap.get(raw.parentId as string) : undefined,
      x: isChild ? ((raw.x as number) ?? 20) : ((raw.x as number) ?? 0) + offsetX,
      y: isChild ? ((raw.y as number) ?? 20) : ((raw.y as number) ?? 0) + offsetY,
      width: (raw.width as number) ?? defaults.width,
      height: (raw.height as number) ?? defaults.height,
    } as C4Node
  }

  const relations: Record<string, C4Relation> = {}
  const relIdMap = new Map<string, string>()
  for (const raw of templated.relations ?? []) {
    const srcId = idMap.get(raw.sourceId as string)
    const dstId = idMap.get(raw.targetId as string)
    if (!srcId || !dstId) continue
    const relId = newId()
    if (typeof raw.id === 'string') relIdMap.set(raw.id, relId)
    relations[relId] = {
      id: relId,
      sourceId: srcId,
      targetId: dstId,
      label: (raw.label as string) ?? undefined,
      technology: (raw.technology as string) ?? undefined,
      relationType: (raw.relationType as string) ?? undefined,
    }
  }

  const sequences: Record<string, DiagramSequence> = {}
  const seqIdMap = new Map<string, string>()
  const takenSequenceNames = new Set(options.takenNames?.sequences ?? [])
  for (const raw of templated.sequences ?? []) {
    const ids = (raw.relationIds as string[] | undefined) ?? []
    const mapped = ids.map((id) => relIdMap.get(id))
    if (ids.length === 0 || mapped.some((id) => !id)) continue
    const seqId = newId()
    if (typeof raw.id === 'string') seqIdMap.set(raw.id, seqId)
    sequences[seqId] = {
      id: seqId,
      name: uniqueName((raw.name as string) || concept.name, takenSequenceNames),
      relationIds: mapped as string[],
      stepDescriptions: raw.stepDescriptions as (string | undefined)[] | undefined,
      stepBackward: trimStepBackward(Array.isArray(raw.stepBackward) ? raw.stepBackward : undefined),
    }
  }

  const views = conceptViewsToDiagram(
    templated.views,
    { node: (id) => idMap.get(id), relation: (id) => relIdMap.get(id), sequence: (id) => seqIdMap.get(id) },
    { newId, namePrefix: concept.name, keepPositions: true, takenNames: new Set(options.takenNames?.views ?? []) },
  )

  const insert: ConceptInsert = { nodes, relations, sequences, views }
  if (concept.templateParams?.length) {
    insert.template = {
      id: newId(),
      record: templateRecord(concept, paramValues, { node: idMap, relation: relIdMap, sequence: seqIdMap }),
    }
  }
  return insert
}

/**
 * The record that keeps a templated import editable (Apply in the Hub
 * template section): the values, and the Hub's texts with their {{KEY}}
 * tokens under the new ids, of the elements, the relations and the
 * sequences' names and step notes (only elements were kept: Apply left a
 * flow's notes at the old value).
 */
export function templateRecord(
  concept: HubConcept,
  paramValues: Record<string, string>,
  maps: { node: Map<string, string>; relation: Map<string, string>; sequence: Map<string, string> },
): HubImportRecord {
  const originalNodes: Record<string, Record<string, unknown>> = {}
  const nodeParamsMap: Record<string, TemplateParam[]> = {}
  for (const origNode of concept.nodes) {
    const id = maps.node.get(origNode.id as string)
    if (!id) continue
    originalNodes[id] = migrateCheckFields(origNode as Record<string, unknown>)
    const perNodeParams = origNode.templateParams as TemplateParam[] | undefined
    if (perNodeParams?.length) nodeParamsMap[id] = perNodeParams
  }
  const originalRelations: Record<string, Record<string, unknown>> = {}
  for (const raw of concept.relations ?? []) {
    const id = typeof raw.id === 'string' ? maps.relation.get(raw.id) : undefined
    if (!id) continue
    const texts = Object.fromEntries(Object.entries(raw).filter(([k, v]) => k !== 'id' && hasToken(v)))
    if (Object.keys(texts).length) originalRelations[id] = texts
  }
  const originalSequences: NonNullable<HubImportRecord['originalSequences']> = {}
  for (const raw of concept.sequences ?? []) {
    const id = typeof raw.id === 'string' ? maps.sequence.get(raw.id) : undefined
    if (!id) continue
    const notes = Array.isArray(raw.stepDescriptions) ? (raw.stepDescriptions as (string | undefined)[]) : undefined
    if (!hasToken(raw.name) && !notes?.some(hasToken)) continue
    originalSequences[id] = {
      ...(hasToken(raw.name) ? { name: raw.name } : {}),
      ...(notes?.some(hasToken) ? { stepDescriptions: notes } : {}),
    }
  }
  return {
    conceptId: concept.id,
    conceptName: concept.name,
    templateParams: concept.templateParams ?? [],
    paramValues: { ...paramValues },
    nodeIds: [...maps.node.values()],
    originalNodes,
    ...(Object.keys(originalRelations).length ? { originalRelations } : {}),
    ...(Object.keys(originalSequences).length ? { originalSequences } : {}),
    nodeParams: Object.keys(nodeParamsMap).length ? nodeParamsMap : undefined,
  }
}

/**
 * A Hub concept file opened as a model (the Hub's Download, then Open →
 * File…): its {{KEY}} tokens filled with the template's defaults and a
 * record kept, so the Hub template section can change them, as after Add to
 * Studio; ids stay. It kept its tokens ("within {{P95_MS}} ms") and had no
 * record. Anything else, and a concept already filled, comes back as it is.
 */
export function conceptFileAsModel(data: DiagramData): DiagramData {
  const meta = data.hub
  if (!meta?.templateParams?.length || Object.keys(data.hubTemplates ?? {}).length) return data
  const concept: HubConcept = {
    ...meta,
    nodes: data.nodes as unknown as Array<Record<string, unknown>>,
    relations: data.relations as unknown as Array<Record<string, unknown>>,
    sequences: (data.sequences ?? []) as unknown as Array<Record<string, unknown>>,
  }
  if (templateKeysUsed(concept).size === 0) return data
  const values = resolveParamValues(meta.templateParams)
  const filled = applyTemplateParams(concept, values)
  const same = (items: Array<{ id: string }>): Map<string, string> => new Map(items.map((x) => [x.id, x.id]))
  const record = templateRecord(concept, values, { node: same(data.nodes), relation: same(data.relations), sequence: same(data.sequences ?? []) })
  return {
    ...data,
    nodes: filled.nodes as unknown as C4Node[],
    relations: (filled.relations ?? []) as unknown as C4Relation[],
    ...(data.sequences ? { sequences: filled.sequences as unknown as DiagramSequence[] } : {}),
    hubTemplates: { [`hub-${meta.id}`]: record },
  }
}
