// ─── Hub concept → live diagram insertion ───────────────────────────────────
// Inserts a fully-loaded Hub concept's nodes/relations/sequences into the
// current document, centered on the viewport. A standalone counterpart to
// HubImportModal.tsx's own (more UI-entangled — template param dialog,
// drop-onto-selected-node, modal close semantics) import flow, for callers
// that just want "drop this concept into the model" with no modal around it
// (Radical Forge's Hub suggestion cards).

import type { C4ElementType, C4Node, C4Relation, DiagramSequence } from '../types/c4'
import { NODE_SIZES } from '../types/c4'
import { useDiagramStore } from '../store/diagramStore'
import type { HubConcept, HubImportRecord, TemplateParam } from '../store/hubStore'

export interface ImportHubConceptResult {
  nodeIds: string[]
}

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

/** Inserts `concept` into the live document, centered on the current
 *  viewport (same placement math as HubImportModal's direct-import path,
 *  minus the "drop onto the selected node" behavior, which only makes sense
 *  from a canvas-focused modal). One undo step for the whole insert. */
export function importHubConceptIntoDiagram(
  concept: HubConcept,
  opts?: { paramValues?: Record<string, string> },
): ImportHubConceptResult {
  const store = useDiagramStore.getState()
  const paramValues = opts?.paramValues ?? defaultParamValues(concept.templateParams)
  const templated = applyTemplateParams(concept, paramValues)

  const idMap = new Map<string, string>()
  for (const raw of templated.nodes) {
    idMap.set(raw.id as string, crypto.randomUUID())
  }

  const getViewport = (window as unknown as { __rfGetViewport?: () => { x: number; y: number; zoom: number } }).__rfGetViewport
  const vp = getViewport?.() ?? { x: 0, y: 0, zoom: 1 }
  const centerX = (-vp.x + window.innerWidth / 2) / vp.zoom
  const centerY = (-vp.y + window.innerHeight / 2) / vp.zoom

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
  const clusterW = maxX - minX
  const clusterH = maxY - minY
  const offsetX = isFinite(minX) ? centerX - minX - clusterW / 2 : centerX
  const offsetY = isFinite(minY) ? centerY - minY - clusterH / 2 : centerY

  const newNodes: Record<string, C4Node> = {}
  for (const raw of templated.nodes) {
    const oldId = raw.id as string
    const newId = idMap.get(oldId)!
    const type = ((raw.type as C4ElementType) ?? 'component')
    const defaults = NODE_SIZES[type] ?? { width: 200, height: 120 }
    const isChild = !!raw.parentId

    newNodes[newId] = {
      ...(raw as Record<string, unknown>),
      id: newId,
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

  const newRelations: Record<string, C4Relation> = {}
  const relIdMap = new Map<string, string>()
  for (const raw of templated.relations ?? []) {
    const srcId = idMap.get(raw.sourceId as string)
    const dstId = idMap.get(raw.targetId as string)
    if (!srcId || !dstId) continue
    const relId = crypto.randomUUID()
    if (typeof raw.id === 'string') relIdMap.set(raw.id, relId)
    newRelations[relId] = {
      id: relId,
      sourceId: srcId,
      targetId: dstId,
      label: (raw.label as string) ?? undefined,
      technology: (raw.technology as string) ?? undefined,
      relationType: (raw.relationType as string) ?? undefined,
    }
  }

  const newSequences: Record<string, DiagramSequence> = {}
  for (const raw of templated.sequences ?? []) {
    const ids = (raw.relationIds as string[] | undefined) ?? []
    const mapped = ids.map((id) => relIdMap.get(id))
    if (ids.length === 0 || mapped.some((id) => !id)) continue
    const seqId = crypto.randomUUID()
    newSequences[seqId] = {
      id: seqId,
      name: (raw.name as string) || concept.name,
      relationIds: mapped as string[],
      stepDescriptions: raw.stepDescriptions as (string | undefined)[] | undefined,
    }
  }

  store._pushUndo()
  store._markMilestoneEdit()
  useDiagramStore.setState((state) => {
    Object.assign(state.c4Nodes, newNodes)
    Object.assign(state.c4Relations, newRelations)
    Object.assign(state.sequences, newSequences)
    if (state.activeViewId && state.views[state.activeViewId]) {
      state.views[state.activeViewId].nodeIds.push(...Object.keys(newNodes))
    }
  })

  useDiagramStore.getState()._resizeParentsBottomUp()
  store._sync()

  if (concept.templateParams?.length) {
    const importId = crypto.randomUUID()
    const originalNodesMap: Record<string, Record<string, unknown>> = {}
    const nodeParamsMap: Record<string, TemplateParam[]> = {}
    for (const origNode of concept.nodes) {
      const newId = idMap.get(origNode.id as string)
      if (newId) {
        originalNodesMap[newId] = origNode as Record<string, unknown>
        const perNodeParams = origNode.templateParams as TemplateParam[] | undefined
        if (perNodeParams?.length) nodeParamsMap[newId] = perNodeParams
      }
    }
    const record: HubImportRecord = {
      conceptId: concept.id,
      conceptName: concept.name,
      templateParams: concept.templateParams,
      paramValues: { ...paramValues },
      nodeIds: Object.keys(newNodes),
      originalNodes: originalNodesMap,
      nodeParams: Object.keys(nodeParamsMap).length ? nodeParamsMap : undefined,
    }
    store.upsertHubTemplate(importId, record)
  }

  store.pushNotification(`Imported "${concept.name}"`, 'info')

  return { nodeIds: Object.keys(newNodes) }
}
