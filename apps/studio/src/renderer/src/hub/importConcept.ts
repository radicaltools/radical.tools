// ─── Hub concept → live diagram insertion ───────────────────────────────────
// Inserts a fully-loaded Hub concept's nodes/relations/sequences into the
// current document, centered on the viewport. A standalone counterpart to
// HubImportModal.tsx's own (more UI-entangled — template param dialog,
// drop-onto-selected-node, modal close semantics) import flow, for callers
// that just want "drop this concept into the model" with no modal around it
// (Radical Forge's Hub suggestion cards). What to insert comes from
// @radical/common/hubImport, which the MCP server's Forge uses too.

import { buildConceptInsert } from '@radical/common/hubImport'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { HubConcept } from '@radical/ui/store/hubStore'

export interface ImportHubConceptResult {
  nodeIds: string[]
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

  const getViewport = (window as unknown as { __rfGetViewport?: () => { x: number; y: number; zoom: number } }).__rfGetViewport
  const vp = getViewport?.() ?? { x: 0, y: 0, zoom: 1 }
  const centerX = (-vp.x + window.innerWidth / 2) / vp.zoom
  const centerY = (-vp.y + window.innerHeight / 2) / vp.zoom

  const insert = buildConceptInsert(concept, {
    newId: () => crypto.randomUUID(),
    place: ({ width, height }) => ({ x: centerX - width / 2, y: centerY - height / 2 }),
    paramValues: opts?.paramValues,
  })

  store._pushUndo()
  store._markMilestoneEdit()
  useDiagramStore.setState((state) => {
    Object.assign(state.c4Nodes, insert.nodes)
    Object.assign(state.c4Relations, insert.relations)
    Object.assign(state.sequences, insert.sequences)
    for (const v of insert.views) state.views[v.id] = v
    // Empty nodeIds means "show all" — the imported nodes are already in it.
    if (state.activeViewId && state.views[state.activeViewId]?.nodeIds.length) {
      state.views[state.activeViewId].nodeIds.push(...Object.keys(insert.nodes))
    }
  })

  useDiagramStore.getState()._resizeParentsBottomUp()
  store._sync()

  if (insert.template) store.upsertHubTemplate(insert.template.id, insert.template.record)

  // No success toast — callers show the imported state on the card itself.

  return { nodeIds: Object.keys(insert.nodes) }
}
