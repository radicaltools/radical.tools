import { it, expect } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const node = (id: string, x: number): C4Node => ({ id, type: 'system', label: id, x, y: 0, width: 160, height: 80 }) as C4Node
const ringed = () => s().rfNodes.filter((n) => n.selected).map((n) => n.id)

function load() {
  s().loadDiagram({
    nodes: [node('a', 0), node('b', 300), node('c', 600)],
    relations: [{ id: 'r', sourceId: 'a', targetId: 'b' } as any],
    views: [
      { id: 'v1', name: 'v1', nodeIds: ['a', 'b'], positions: {} },
      { id: 'v2', name: 'v2', nodeIds: ['b', 'c'], positions: {} },
    ],
  })
  useDiagramStore.setState({ appMode: 'designer' } as any)
}

it('leaving a view clears its selection', () => {
  load()
  s().setActiveView('v1')
  s().selectNode('a')
  expect(ringed()).toEqual(['a'])

  // Another view starts with nothing selected, even where it shows the node.
  s().setActiveView('v2')
  expect(s().selectedNodeIds).toEqual([])
  expect(ringed()).toEqual([])
  s().selectNode('c')

  // Back on v1, nothing is selected: it was cleared when the user left.
  s().setActiveView('v1')
  expect(s().selectedNodeIds).toEqual([])
  expect(ringed()).toEqual([])
})

it('a selected relation is cleared too', () => {
  load()
  s().setActiveView('v1')
  s().selectEdge('r')
  s().setActiveView(null)
  expect(s().selectedEdgeId).toBeNull()
  s().setActiveView('v1')
  expect(s().selectedEdgeId).toBeNull()
  expect(s().rfEdges.find((e) => e.id === 'r')?.selected ?? false).toBe(false)
})

it('a selection survives the canvas being rebuilt', () => {
  load()
  s().setActiveView('v1')
  s().selectNode('b')
  s()._sync()
  expect(ringed()).toEqual(['b'])
})

it('reading the same document again keeps the open view\'s selection', () => {
  load()
  s().setActiveView('v1')
  s().selectNode('a')
  // An outside change: the document is read again, the user stays on v1.
  const data = s().saveDiagram()
  s().loadDiagram(data)
  s().setActiveView('v1')
  expect(s().selectedNodeIds).toEqual(['a'])
  // Leaving it clears it, as any other switch does.
  s().setActiveView(null)
  expect(s().selectedNodeIds).toEqual([])
  s().setActiveView('v1')
  expect(s().selectedNodeIds).toEqual([])
})
