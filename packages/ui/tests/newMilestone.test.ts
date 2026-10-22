/**
 * + New milestone captures the live model, also while an older milestone
 * is shown, and files it after the last one (F-0024, decided 2026-10-22).
 * It took the nodes on the canvas: with v1 shown, the newest milestone was
 * v1 again, and its diff read everything since as removed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y: 0, ...NODE_SIZES.system } as C4Node)
const box = (x: number, y: number) => ({ x, y, ...NODE_SIZES.system })

function model(): DiagramData {
  return {
    nodes: [sys('a', 0), sys('b', 400)],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b' }],
    defaultPositions: { a: box(0, 0), b: box(400, 0) },
    views: [{ id: 'v', name: 'v', nodeIds: [], positions: { a: box(0, 900), b: box(400, 900) } }],
  }
}

const labels = (nodes: Record<string, C4Node>): string[] => Object.values(nodes).map((n) => n.label).sort()

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('+ New milestone while an older milestone is shown (F-0024)', () => {
  it('captures the live model, at All elements\' places, after the last milestone', () => {
    const v1 = s().createSnapshot('v1')
    const c = s().addNode({ type: 'system', label: 'c', x: 800, y: 0, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    s().addRelation({ sourceId: 'b', targetId: c, label: 'uses' } as Omit<C4Relation, 'id'>)
    const v2 = s().createSnapshot('v2')
    s().setActiveView('v')
    s().selectMilestone(v1)
    expect(labels(s().c4Nodes)).toEqual(['a', 'b'])

    const v3 = s().createSnapshot('v3')
    expect(s().snapshots.map((m) => m.id)).toEqual([v1, v2, v3])
    const made = s().snapshots[2]
    expect(labels(made.nodes as Record<string, C4Node>)).toEqual(['a', 'b', 'c'])
    expect(Object.keys(made.relations)).toHaveLength(2)
    // All elements' places, not the view's.
    expect((made.nodes as Record<string, C4Node>).a).toMatchObject({ x: 0, y: 0 })
    // The milestone shown stays shown, with nothing to save.
    expect(s().activeSnapshotId).toBe(v1)
    expect(s().milestoneDirty).toBe(false)
    expect(labels(s().c4Nodes)).toEqual(['a', 'b'])
    // And back on the live model it is there.
    s().discardMilestoneChanges()
    expect(s().snapshots.map((m) => m.name)).toEqual(['v1', 'v2', 'v3'])
    expect(labels(s().c4Nodes)).toEqual(['a', 'b', 'c'])
  })

  it('leaves out the unsaved edits of the milestone shown', () => {
    const v1 = s().createSnapshot('v1')
    s().selectMilestone(v1)
    s().addNode({ type: 'system', label: 'only in v1', x: 800, y: 0, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    s().dismissMilestonePrompt()
    const v2 = s().createSnapshot('v2')
    expect(labels(s().snapshots.find((m) => m.id === v2)!.nodes as Record<string, C4Node>)).toEqual(['a', 'b'])
    expect(s().milestoneDirty).toBe(true)
    expect(labels(s().c4Nodes)).toEqual(['a', 'b', 'only in v1'])
  })
})
