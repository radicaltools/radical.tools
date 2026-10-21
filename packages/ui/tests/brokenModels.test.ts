/**
 * A model that breaks a rule of its own still opens. A child of an element
 * that is not in the model made React Flow throw ("Parent node … not found")
 * and the model could not be opened again, not even to repair it.
 */
import { it, expect, afterEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'

afterEach(() => useDiagramStore.getState().stopLiveLayout())

it('draws a child whose parent is missing as one without a parent', () => {
  const s = useDiagramStore.getState
  s().loadDiagram({
    nodes: [
      { id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 300, height: 200 },
      { id: 'orphan', type: 'container', label: 'Orphan', parentId: 'gone', collapsed: false, x: 40, y: 120, width: 240, height: 160 },
    ],
    relations: [],
  })
  const orphan = s().rfNodes.find((n) => n.id === 'orphan')!
  expect(orphan.parentNode).toBeUndefined()
  expect(s().rfNodes.every((n) => !n.parentNode || s().rfNodes.some((p) => p.id === n.parentNode))).toBe(true)
})

it('opens a view saved without a positions key as one not laid out yet', () => {
  const s = useDiagramStore.getState
  s().setAppMode('designer')
  s().loadDiagram({
    nodes: [
      { id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 300, height: 200 },
      { id: 'b', type: 'system', label: 'B', collapsed: false, x: 400, y: 0, width: 300, height: 200 },
    ],
    relations: [],
    // A hand-written document: the view names its elements, nothing more.
    views: [{ id: 'v', name: 'Part', nodeIds: ['a', 'b'] } as any],
  })
  expect(() => s().setActiveView('v')).not.toThrow()
  expect(s().activeViewId).toBe('v')
  expect(s().rfNodes.filter((n) => !n.hidden).map((n) => n.id).sort()).toEqual(['a', 'b'])
})
