/**
 * Every relation is drawn. A second relation between the same two elements
 * was skipped (its label appended to a field the edge does not show): it
 * could not be seen, selected, edited or deleted on any canvas, and each
 * further connect gesture added another invisible one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: 'system' | 'container' | 'person', x: number, y: number, parentId?: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...NODE_SIZES[type], ...(parentId ? { parentId } : {}) } as C4Node)

function model(): DiagramData {
  return {
    nodes: [node('user', 'person', 0, 0), { ...node('shop', 'system', 400, 0), width: 700, height: 400 }, node('web', 'container', 40, 120, 'shop'), node('api', 'container', 360, 120, 'shop')],
    relations: [
      { id: 'r1', sourceId: 'user', targetId: 'web', label: 'browses' },
      { id: 'r2', sourceId: 'user', targetId: 'web', label: 'pays' },
      { id: 'r3', sourceId: 'web', targetId: 'api', label: 'calls' },
    ],
    views: [{ id: 'ctx', name: 'Context', nodeIds: ['user', 'shop'], positions: {}, collapsedNodeIds: ['shop'] }],
  }
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('two relations between the same two elements', () => {
  it('are two edges, each its own relation', () => {
    const ids = s().rfEdges.map((e) => e.id).sort()
    expect(ids).toEqual(['r1', 'r2', 'r3'])
    expect(s().rfEdges.find((e) => e.id === 'r2')?.data?.label).toBe('pays')
  })

  it('rolled up into one edge to a collapsed container, show both labels', () => {
    s().setActiveView('ctx')
    const edges = s().rfEdges.filter((e) => !e.hidden)
    expect(edges).toHaveLength(1)
    expect(edges[0].data?.label).toContain('browses')
    expect(edges[0].data?.label).toContain('pays')
  })
})
