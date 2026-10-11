// ─── Hub concept → model insertion ───────────────────────────────────────────
// Turns a fully loaded Hub concept into the nodes, relations, sequences and
// views to add to a model: fresh ids, template params filled in, the cluster
// moved to where the caller wants it. Studio adds the result to its store
// (hub/importConcept.ts, centred on the viewport); the MCP server's Forge
// adds it to the folder, beside the existing model.

import type { C4ElementType, C4Node, C4Relation, DiagramSequence, DiagramView } from './c4'
import { NODE_SIZES } from './c4'
import type { HubConcept, HubImportRecord, TemplateParam } from './hubFormat'
import { conceptViewsToDiagram } from './hubViews'

/** Default parameter values (each param's `defaultValue`/`hint`, or `''`) —
 *  used when the caller doesn't collect explicit values via a param dialog. */
export function defaultParamValues(params: TemplateParam[] | undefined): Record<string, string> {
  const values: Record<string, string> = {}
  for (const p of params ?? []) values[p.key] = p.defaultValue ?? p.hint ?? ''
  return values
}

/** Replace all `{{KEY}}` tokens in a string with `values[KEY]` (left as-is
 *  when the key is unknown). Mirrors HubImportModal.tsx's substituteParams. */
function substituteParams(str: string, values: Record<string, string>): string {
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`)
}

/** Returns a copy of `concept` with every node's string fields substituted. */
function applyTemplateParams(concept: HubConcept, values: Record<string, string>): HubConcept {
  if (!concept.templateParams?.length) return concept
  const subst = (node: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] = typeof v === 'string' ? substituteParams(v, values) : v
    }
    return out
  }
  return { ...concept, nodes: concept.nodes.map(subst) }
}

export interface ConceptInsertOptions {
  newId: () => string
  /** Top-left corner for the concept's root nodes, given the size of the
   *  box around them. */
  place: (cluster: { width: number; height: number }) => { x: number; y: number }
  paramValues?: Record<string, string>
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
  const paramValues = options.paramValues ?? defaultParamValues(concept.templateParams)
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
  for (const raw of templated.nodes) {
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
  for (const raw of templated.sequences ?? []) {
    const ids = (raw.relationIds as string[] | undefined) ?? []
    const mapped = ids.map((id) => relIdMap.get(id))
    if (ids.length === 0 || mapped.some((id) => !id)) continue
    const seqId = newId()
    if (typeof raw.id === 'string') seqIdMap.set(raw.id, seqId)
    sequences[seqId] = {
      id: seqId,
      name: (raw.name as string) || concept.name,
      relationIds: mapped as string[],
      stepDescriptions: raw.stepDescriptions as (string | undefined)[] | undefined,
    }
  }

  const views = conceptViewsToDiagram(
    templated.views,
    { node: (id) => idMap.get(id), relation: (id) => relIdMap.get(id), sequence: (id) => seqIdMap.get(id) },
    { newId, namePrefix: concept.name },
  )

  const insert: ConceptInsert = { nodes, relations, sequences, views }
  if (concept.templateParams?.length) {
    const originalNodes: Record<string, Record<string, unknown>> = {}
    const nodeParamsMap: Record<string, TemplateParam[]> = {}
    for (const origNode of concept.nodes) {
      const id = idMap.get(origNode.id as string)
      if (id) {
        originalNodes[id] = origNode as Record<string, unknown>
        const perNodeParams = origNode.templateParams as TemplateParam[] | undefined
        if (perNodeParams?.length) nodeParamsMap[id] = perNodeParams
      }
    }
    insert.template = {
      id: newId(),
      record: {
        conceptId: concept.id,
        conceptName: concept.name,
        templateParams: concept.templateParams,
        paramValues: { ...paramValues },
        nodeIds: Object.keys(nodes),
        originalNodes,
        nodeParams: Object.keys(nodeParamsMap).length ? nodeParamsMap : undefined,
      },
    }
  }
  return insert
}
