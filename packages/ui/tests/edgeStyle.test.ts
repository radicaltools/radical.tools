import { it, expect } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const node = (id: string, x: number): C4Node => ({ id, type: 'system', label: id, x, y: 0, width: 160, height: 80 }) as C4Node

it('a view\'s line style and the model\'s are each one undo step, and saved with the document', () => {
  s().loadDiagram({ nodes: [node('a', 0), node('b', 300)], relations: [], views: [{ id: 'v', name: 'v', nodeIds: ['a', 'b'], positions: {} }] })
  useDiagramStore.setState({ appMode: 'designer' } as any)
  s().setViewEdgeStyle('v', 'orthogonal')
  s().setDefaultEdgeStyle('orthogonal')
  expect(s().views.v.edgeStyle).toBe('orthogonal')
  expect(s().saveDiagram().defaultEdgeStyle).toBe('orthogonal')
  s().undo()
  expect(s().defaultEdgeStyle).toBe('curved')
  expect(s().views.v.edgeStyle).toBe('orthogonal')
  s().undo()
  expect(s().views.v.edgeStyle).toBeUndefined()
})
