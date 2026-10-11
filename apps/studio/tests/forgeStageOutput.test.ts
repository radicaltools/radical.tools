import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { addedSince, currentModelIds, removeAdded } from '../src/renderer/src/ai/forgeStageOutput'

const node = (label: string, parentId?: string) => ({
  type: 'container' as const, label, description: '', technology: '', collapsed: false, external: false,
  x: 0, y: 0, width: 200, height: 100, ...(parentId ? { parentId } : {}),
})

describe('Forge stage output', () => {
  it('a regenerated stage replaces what its previous run added, nothing else', () => {
    const store = useDiagramStore.getState
    const system = store().addNode({ ...node('Shop'), type: 'system' })
    const kept = store().addNode(node('Kept', system))
    const before = currentModelIds()

    // A stage run adds two containers, a relation and a view.
    const a = store().addNode(node('A', system))
    const b = store().addNode(node('B', system))
    store().addRelation({ sourceId: a, targetId: b })
    store().addView('Stage view')
    const added = addedSince(before)
    expect([added.nodes.length, added.relations.length, added.views.length]).toEqual([2, 1, 1])

    removeAdded(added)
    expect(currentModelIds()).toEqual(before)
    expect(store().c4Nodes[kept]).toBeDefined()
  })

  it('skips additions the user already deleted', () => {
    const store = useDiagramStore.getState
    const before = currentModelIds()
    const a = store().addNode({ ...node('Gone'), type: 'system' })
    const added = addedSince(before)
    store().removeNode(a)
    expect(() => removeAdded(added)).not.toThrow()
    expect(currentModelIds()).toEqual(before)
  })
})
