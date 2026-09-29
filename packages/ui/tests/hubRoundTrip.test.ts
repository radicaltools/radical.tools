/**
 * Opening a Hub concept in Studio must keep its `hub` metadata block, so the
 * document can be saved back into the catalogue unchanged.
 */
import { describe, it, expect } from 'vitest'
import type { HubRadicalDoc } from '@radical/common/hubFormat'
import { useDiagramStore } from '../src/store/diagramStore'

const doc: HubRadicalDoc = {
  hub: {
    id: 'req-x', category: 'requirement', name: 'X', description: 'd', tags: ['a'],
    templateParams: [{ key: 'K', label: 'k' }],
  },
  nodes: [
    { id: 'n1', type: 'requirement', label: 'L', ears_type: 'ubiquitous', priority: 'must', status: '' },
    { id: 'n2', type: 'container', label: 'C', parentId: 'n1' },
  ],
  relations: [{ id: 'r1', sourceId: 'n2', targetId: 'n1' }],
}

describe('studio round-trip', () => {
  it('loadDiagram → saveDiagram keeps the hub block (opening a concept in Studio must not strip it)', () => {
    const store = useDiagramStore.getState()
    store.loadDiagram({ nodes: [], relations: [], hub: doc.hub })
    expect(useDiagramStore.getState().saveDiagram().hub).toEqual(doc.hub)
    store.newDiagram()
    expect(useDiagramStore.getState().saveDiagram().hub).toBeUndefined()
  })
})
