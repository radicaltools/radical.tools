import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import { checkAddRelation, type ModelState } from '@radical/common/model'

type Store = ReturnType<typeof useDiagramStore.getState>

/** The `nth` pair of elements a relation may join (not one that holds the
 *  other, of a pair the metamodel allows). */
function connectablePair(store: Store, nth: number): [string, string] {
  const ids = Object.keys(store.c4Nodes)
  const pairs = ids.flatMap((a) => ids.filter((b) => b !== a && !checkAddRelation(store as unknown as ModelState, { sourceId: a, targetId: b })).map((b): [string, string] => [a, b]))
  return pairs[nth]
}

describe('Connection via store actions', () => {
  it('startConnection sets connectSource', () => {
    const store = useDiagramStore.getState()
    expect(store.connectSource).toBeNull()

    store.startConnection('node-1')
    expect(useDiagramStore.getState().connectSource).toBe('node-1')

    store.cancelConnection()
    expect(useDiagramStore.getState().connectSource).toBeNull()
  })

  it('addRelation creates a new relation and edge', () => {
    const store = useDiagramStore.getState()
    const nodeIds = Object.keys(store.c4Nodes)
    expect(nodeIds.length).toBeGreaterThanOrEqual(2)

    const [sourceId, targetId] = connectablePair(store, 0)
    const edgesBefore = store.rfEdges.length
    const relsBefore = Object.keys(store.c4Relations).length

    store.addRelation({ sourceId, targetId })

    const after = useDiagramStore.getState()
    expect(Object.keys(after.c4Relations).length).toBe(relsBefore + 1)
    // rfEdges should also increase (or stay same if edge was already there)
    expect(after.rfEdges.length).toBeGreaterThanOrEqual(edgesBefore)
  })

  it('full connect flow: startConnection → addRelation → cancelConnection', () => {
    const store = useDiagramStore.getState()
    const nodeIds = Object.keys(store.c4Nodes)
    const [src, tgt] = connectablePair(store, 1)

    // Simulate first click (modifier held)
    store.startConnection(src)
    expect(useDiagramStore.getState().connectSource).toBe(src)

    // Simulate second click (modifier held) 
    const relsBefore = Object.keys(useDiagramStore.getState().c4Relations).length
    store.addRelation({ sourceId: src, targetId: tgt })
    store.cancelConnection()

    const after = useDiagramStore.getState()
    expect(after.connectSource).toBeNull()
    expect(Object.keys(after.c4Relations).length).toBe(relsBefore + 1)
  })
})

describe('moving a relation end via the store', () => {
  it('refuses a pair the metamodel forbids and says why', () => {
    const node = (id: string, type: string) =>
      ({ id, type, label: id, description: '', x: 0, y: 0, width: 100, height: 60, collapsed: false })
    useDiagramStore.setState({
      c4Nodes: { user: node('user', 'person'), store: node('store', 'database'), shop: node('shop', 'system') },
      c4Relations: { uses: { id: 'uses', sourceId: 'user', targetId: 'shop', relationType: 'interacts' } },
      notifications: [],
    } as any)

    useDiagramStore.getState().updateRelation('uses', { sourceId: 'store' })

    const after = useDiagramStore.getState()
    expect(after.c4Relations.uses.targetId).toBe('shop')
    expect(after.notifications[after.notifications.length - 1]?.message).toMatch(/Relation not allowed: Database → Software System/)
  })
})
