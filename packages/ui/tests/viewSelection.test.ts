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

it('each view keeps its own selection', () => {
  load()
  s().setActiveView('v1')
  s().selectNode('a')
  expect(ringed()).toEqual(['a'])

  // Another view starts with nothing selected, even where it shows the node.
  s().setActiveView('v2')
  expect(s().selectedNodeIds).toEqual([])
  expect(ringed()).toEqual([])
  s().selectNode('c')

  // Back on v1, its selection is there again, ring included.
  s().setActiveView('v1')
  expect(s().selectedNodeIds).toEqual(['a'])
  expect(ringed()).toEqual(['a'])
  s().setActiveView('v2')
  expect(s().selectedNodeIds).toEqual(['c'])
})

it('a selected relation is kept per view too', () => {
  load()
  s().setActiveView('v1')
  s().selectEdge('r')
  s().setActiveView(null)
  expect(s().selectedEdgeId).toBeNull()
  s().setActiveView('v1')
  expect(s().selectedEdgeId).toBe('r')
  expect(s().rfEdges.find((e) => e.id === 'r')?.selected).toBe(true)
})

it('a selection survives the canvas being rebuilt', () => {
  load()
  s().setActiveView('v1')
  s().selectNode('b')
  s()._sync()
  expect(ringed()).toEqual(['b'])
})

it('reading the same document again keeps every view\'s selection', () => {
  load()
  s().selectNode('c')
  s().setActiveView('v1')
  s().selectNode('a')
  // An outside change: the document is read again, the user stays on v1.
  const data = s().saveDiagram()
  s().loadDiagram(data)
  s().setActiveView('v1')
  expect(s().selectedNodeIds).toEqual(['a'])
  s().setActiveView(null)
  expect(s().selectedNodeIds).toEqual(['c'])
})
