/**
 * Undo / redo tests.
 *
 * Covers:
 *   - addNode → undo restores prior c4Nodes; redo reapplies
 *   - updateNode round-trip
 *   - removeNode round-trip (cascade is also undone in one shot)
 *   - canUndo / canRedo flags reflect the stack state
 *   - undo on an empty stack is a no-op
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node, C4Relation } from '@radical/common/c4'

const initial = (() => {
  const s = useDiagramStore.getState()
  return {
    c4Nodes: JSON.parse(JSON.stringify(s.c4Nodes)) as Record<string, C4Node>,
    c4Relations: JSON.parse(JSON.stringify(s.c4Relations)) as Record<string, C4Relation>,
  }
})()

beforeEach(() => {
  useDiagramStore.setState({
    c4Nodes: JSON.parse(JSON.stringify(initial.c4Nodes)),
    c4Relations: JSON.parse(JSON.stringify(initial.c4Relations)),
    canUndo: false,
    canRedo: false,
    appMode: 'designer',
    presentationActive: false,
  } as any)
  // Drain any leftover undo stack from previous tests by undoing until canUndo=false
  let safety = 100
  while (useDiagramStore.getState().canUndo && safety-- > 0) {
    useDiagramStore.getState().undo()
  }
  // After draining, restore baseline again so we start clean
  useDiagramStore.setState({
    c4Nodes: JSON.parse(JSON.stringify(initial.c4Nodes)),
    c4Relations: JSON.parse(JSON.stringify(initial.c4Relations)),
    canUndo: false,
    canRedo: false,
  } as any)
  useDiagramStore.getState()._sync()
})

describe('undo / redo', () => {
  it('undo on an empty stack is a no-op', () => {
    const before = JSON.stringify(useDiagramStore.getState().c4Nodes)
    useDiagramStore.getState().undo()
    expect(JSON.stringify(useDiagramStore.getState().c4Nodes)).toBe(before)
  })

  it('addNode → undo removes it; redo reapplies', () => {
    const before = Object.keys(useDiagramStore.getState().c4Nodes).length
    const id = useDiagramStore.getState().addNode({
      type: 'system', label: 'X', collapsed: false, x: 0, y: 0, width: 200, height: 100,
    } as any)
    expect(Object.keys(useDiagramStore.getState().c4Nodes).length).toBe(before + 1)
    expect(useDiagramStore.getState().canUndo).toBe(true)

    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Nodes[id]).toBeUndefined()
    expect(Object.keys(useDiagramStore.getState().c4Nodes).length).toBe(before)
    expect(useDiagramStore.getState().canRedo).toBe(true)

    useDiagramStore.getState().redo()
    expect(useDiagramStore.getState().c4Nodes[id]).toBeDefined()
  })

  it('updateNode round-trip restores the original label', () => {
    const id = Object.keys(useDiagramStore.getState().c4Nodes)[0]
    const original = useDiagramStore.getState().c4Nodes[id].label
    useDiagramStore.getState().updateNode(id, { label: 'TEMPORARY' } as any)
    expect(useDiagramStore.getState().c4Nodes[id].label).toBe('TEMPORARY')
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Nodes[id].label).toBe(original)
    useDiagramStore.getState().redo()
    expect(useDiagramStore.getState().c4Nodes[id].label).toBe('TEMPORARY')
  })

  it('removeNode (with cascade) round-trip restores the whole subtree', () => {
    // sys1 + its children
    const sys1Children = Object.values(useDiagramStore.getState().c4Nodes).filter(
      (n) => n.parentId === 'sys1',
    ).length
    expect(sys1Children).toBeGreaterThan(0)
    useDiagramStore.getState().removeNode('sys1')
    expect(useDiagramStore.getState().c4Nodes['sys1']).toBeUndefined()
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Nodes['sys1']).toBeDefined()
    const restoredChildren = Object.values(useDiagramStore.getState().c4Nodes).filter(
      (n) => n.parentId === 'sys1',
    ).length
    expect(restoredChildren).toBe(sys1Children)
  })
})

describe('view visibility is undoable', () => {
  it('hiding several nodes from a view is one undo step', () => {
    const s = useDiagramStore.getState()
    const viewId = s.addView('V')
    const [a, b] = Object.keys(useDiagramStore.getState().c4Nodes).filter((id) => !useDiagramStore.getState().c4Nodes[id].parentId)
    const before = useDiagramStore.getState().views[viewId].nodeIds
    useDiagramStore.getState().removeNodeFromView(viewId, [a, b])
    expect(useDiagramStore.getState().views[viewId].nodeIds).not.toContain(a)
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().views[viewId].nodeIds).toEqual(before)
  })

  it('hiding a relation from a view can be undone and redone', () => {
    const viewId = useDiagramStore.getState().addView('V')
    const relId = Object.keys(useDiagramStore.getState().c4Relations)[0]
    useDiagramStore.getState().hideRelationFromView(viewId, relId)
    expect(useDiagramStore.getState().views[viewId].hiddenRelationIds).toEqual([relId])
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().views[viewId].hiddenRelationIds ?? []).toEqual([])
    useDiagramStore.getState().redo()
    expect(useDiagramStore.getState().views[viewId].hiddenRelationIds).toEqual([relId])
  })

  it('a no-op hide records nothing', () => {
    const viewId = useDiagramStore.getState().addView('V')
    const relId = Object.keys(useDiagramStore.getState().c4Relations)[0]
    useDiagramStore.getState().hideRelationFromView(viewId, relId)
    useDiagramStore.getState().hideRelationFromView(viewId, relId)
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().views[viewId].hiddenRelationIds ?? []).toEqual([])
  })
})

describe('clearModel (the AI reset) is undoable', () => {
  it('undo brings back nodes, relations, views and sequences; milestones stay', () => {
    const s = useDiagramStore.getState()
    s.addView('V')
    s.addSequence('Flow')
    s.createSnapshot('v1')
    const before = useDiagramStore.getState()
    const { c4Nodes, c4Relations, views, sequences, snapshots } = before

    useDiagramStore.getState().clearModel()
    const cleared = useDiagramStore.getState()
    expect([Object.keys(cleared.c4Nodes).length, Object.keys(cleared.views).length, Object.keys(cleared.sequences).length]).toEqual([0, 0, 0])
    expect(cleared.snapshots).toBe(snapshots)

    useDiagramStore.getState().undo()
    const after = useDiagramStore.getState()
    expect(after.c4Nodes).toBe(c4Nodes)
    expect(after.c4Relations).toBe(c4Relations)
    expect(after.views).toBe(views)
    expect(after.sequences).toBe(sequences)

    useDiagramStore.getState().redo()
    expect(Object.keys(useDiagramStore.getState().sequences)).toHaveLength(0)
  })
})
