// ─── Hub concern pack → live diagram insertion ──────────────────────────────
// Inserts the part of a concern pack its answers pick into the current
// document, bound to the elements chosen, as one undo step: the import of
// the concern wizard (components/ConcernWizard.tsx) and of Radical Forge's
// Requirements stage. What to insert comes from @radical/common/concerns,
// which the MCP server uses too.

import type { ConceptInsert } from '@radical/common/hubImport'
import { buildConcernInsert } from '@radical/common/concerns'
import { freeSpotNear } from '@radical/layout/geometry'
import { computeViewNodeSet } from '@radical/layout/viewInput'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { HubConcept } from '@radical/ui/store/hubStore'
import { addToViewList } from '@radical/common/c4'

export interface ImportHubConceptResult {
  nodeIds: string[]
}

/** Inserts the part of a concern pack the answers pick, bound to the
 *  elements `elementIds` (buildConcernInsert), in the free spot nearest the
 *  viewport centre, as one undo step. Throws when the answers or an element
 *  do not fit the pack. */
export function importConcernPackIntoDiagram(concept: HubConcept, answers: Record<string, string>, elementIds: string[]): ImportHubConceptResult & { insert: ConceptInsert } {
  const store = useDiagramStore.getState()
  const getViewport = (window as unknown as { __rfGetViewport?: () => { x: number; y: number; zoom: number } }).__rfGetViewport
  const vp = getViewport?.() ?? { x: 0, y: 0, zoom: 1 }
  const centre = { x: (-vp.x + window.innerWidth / 2) / vp.zoom, y: (-vp.y + window.innerHeight / 2) / vp.zoom }
  const shown = store.activeViewId ? computeViewNodeSet(store.views[store.activeViewId], store.c4Nodes) : undefined
  const taken = Object.values(store.c4Nodes)
    .filter((n) => !n.parentId && (!shown || shown.has(n.id)))
    .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }))

  const insert = buildConcernInsert(concept, {
    answers,
    elements: elementIds.map((id) => store.c4Nodes[id]).filter(Boolean),
    metamodel: store.metamodel,
    today: new Date().toISOString().slice(0, 10),
    newId: () => crypto.randomUUID(),
    place: (size) => freeSpotNear(taken, size, centre),
    takenNames: { views: Object.values(store.views).map((v) => v.name), sequences: Object.values(store.sequences).map((q) => q.name) },
  })

  store._pushUndo()
  store._markMilestoneEdit()
  useDiagramStore.setState((state) => {
    Object.assign(state.c4Nodes, insert.nodes)
    Object.assign(state.c4Relations, insert.relations)
    if (state.activeViewId && state.views[state.activeViewId]) {
      addToViewList(state.views[state.activeViewId], Object.keys(insert.nodes))
    }
  })
  useDiagramStore.getState()._placeOnAllElements()
  store._sync()
  return { nodeIds: Object.keys(insert.nodes), insert }
}
