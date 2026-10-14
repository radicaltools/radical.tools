/**
 * What is an undo step.
 *
 * Each action of the user is one step, and a step is taken back alone.
 * Editing a sequence or adding, renaming and deleting a view pushed none, so
 * Undo after one of them took back the edit made before it (and, a history
 * entry carrying the views, added or deleted views as a side effect of
 * undoing something else). "Wrap into…" pushed one per wrapped element plus
 * one. And a step can only be gone back to while the metamodel still has
 * the types it holds.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, x: number, y: number, parentId?: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...(NODE_SIZES as Record<string, { width: number; height: number }>)[type], ...(parentId ? { parentId } : {}) } as C4Node)

function model(): DiagramData {
  return {
    nodes: [
      { ...node('shop', 'system', 0, 0), width: 900, height: 400 },
      node('web', 'container', 40, 80, 'shop'),
      node('api', 'container', 340, 80, 'shop'),
      node('db', 'container', 640, 80, 'shop'),
      node('bank', 'system', 1200, 0),
    ],
    relations: [
      { id: 'r1', sourceId: 'web', targetId: 'api' },
      { id: 'r2', sourceId: 'api', targetId: 'db' },
      { id: 'r3', sourceId: 'api', targetId: 'bank' },
    ],
    sequences: [{ id: 'pay', name: 'Pay', relationIds: ['r1', 'r2', 'r3'] }],
    views: [{ id: 'v1', name: 'One', nodeIds: [], positions: {} }],
    metamodel: builtInC4Metamodel(),
  }
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  // One edit before each case: the step that must not be taken back with
  // the one under test.
  s().updateNode('bank', { description: 'before' })
})
afterEach(() => s().stopLiveLayout())

const stillBefore = (): void => expect(s().c4Nodes.bank.description).toBe('before')
const lastNotice = (): string | undefined => s().notifications[s().notifications.length - 1]?.message
const hasType = (type: string): boolean => Object.values(s().c4Nodes).some((n) => (n.type as string) === type)
/** An element of a type the built-in list of C4 types does not know. */
const add = (type: string, label: string): string =>
  s().addNode({ type, label, x: 0, y: 700, width: 200, height: 100, collapsed: false } as unknown as Omit<C4Node, 'id'>)

describe('editing a sequence is an undo step', () => {
  it('removing a step', () => {
    s().removeFromSequence('pay', 1)
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r3'])
    s().undo()
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r2', 'r3'])
    stillBefore()
    s().redo()
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r3'])
  })

  it('moving a step', () => {
    s().reorderSequence('pay', 0, 2)
    expect(s().sequences.pay.relationIds).toEqual(['r2', 'r3', 'r1'])
    s().undo()
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r2', 'r3'])
    stillBefore()
  })

  it("a step's note", () => {
    s().updateStepDescription('pay', 1, 'stores it')
    s().undo()
    expect(s().sequences.pay.stepDescriptions?.[1]).toBeUndefined()
    stillBefore()
  })

  it('adding a step, clearing, renaming', () => {
    s().toggleRelationInSequence('pay', 'r1')
    s().undo()
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r2', 'r3'])
    s().renameSequence('pay', 'Checkout')
    s().undo()
    expect(s().sequences.pay.name).toBe('Pay')
    s().clearSequence('pay')
    s().undo()
    expect(s().sequences.pay.relationIds).toEqual(['r1', 'r2', 'r3'])
    stillBefore()
  })

  it('deleting a sequence, with the views that played it', () => {
    const view = s().addViewFromSequence('pay')
    s().setActiveView(null)
    s().removeSequence('pay')
    expect(s().sequences.pay).toBeUndefined()
    s().undo()
    expect(s().sequences.pay?.relationIds).toEqual(['r1', 'r2', 'r3'])
    expect(s().views[view].sequenceId).toBe('pay')
    stillBefore()
  })

  it('a new sequence', () => {
    const id = s().addSequence('Refund')
    s().undo()
    expect(s().sequences[id]).toBeUndefined()
    stillBefore()
  })
})

describe('reordering the steps of a sequence', () => {
  it('moves each note with its step when not every step has one', () => {
    s().updateStepDescription('pay', 0, 'first')
    expect(s().sequences.pay.stepDescriptions).toHaveLength(1)
    s().reorderSequence('pay', 0, 2)
    expect(s().sequences.pay.relationIds).toEqual(['r2', 'r3', 'r1'])
    const notes = s().sequences.pay.stepDescriptions ?? []
    expect([notes[0], notes[1], notes[2]]).toEqual([undefined, undefined, 'first'])

    // And a move from beyond the notes into them.
    s().reorderSequence('pay', 0, 1)
    const after = s().sequences.pay.stepDescriptions ?? []
    expect(s().sequences.pay.relationIds).toEqual(['r3', 'r2', 'r1'])
    expect([after[0], after[1], after[2]]).toEqual([undefined, undefined, 'first'])
  })
})

describe('adding, renaming and deleting a view is an undo step', () => {
  it('a new view is taken back alone', () => {
    const id = s().addView('Two')
    expect(s().views[id]).toBeDefined()
    s().undo()
    expect(s().views[id]).toBeUndefined()
    stillBefore()
    s().redo()
    expect(s().views[id]?.name).toBe('Two')
  })

  it('a new view ends what could be redone', () => {
    s().undo()
    expect(s().canRedo).toBe(true)
    const id = s().addView('Two')
    expect(s().canRedo).toBe(false)
    s().redo()
    expect(s().views[id]).toBeDefined()
  })

  it('a deleted view comes back, as the one shown when it was', () => {
    s().setActiveView('v1')
    s().removeView('v1')
    expect(s().views.v1).toBeUndefined()
    s().undo()
    expect(s().views.v1?.name).toBe('One')
    expect(s().activeViewId).toBe('v1')
    stillBefore()
  })

  it('a rename', () => {
    s().renameView('v1', 'Renamed')
    s().undo()
    expect(s().views.v1.name).toBe('One')
    stillBefore()
  })
})

describe('"Wrap into…"', () => {
  it('is one undo step', () => {
    s().setSelectedNodeIds(['web', 'api'])
    s().wrapSelectionInNewParent('group')
    const group = Object.values(s().c4Nodes).find((n) => n.type === 'group')
    expect(group).toBeDefined()
    expect(s().c4Nodes.web.parentId).toBe(group!.id)
    expect(s().c4Nodes.api.parentId).toBe(group!.id)

    s().undo()
    expect(Object.values(s().c4Nodes).some((n) => n.type === 'group')).toBe(false)
    expect(s().c4Nodes.web.parentId).toBe('shop')
    expect(s().c4Nodes.api.parentId).toBe('shop')
    expect(s().c4Nodes.web).toMatchObject({ x: 40, y: 80 })
    stillBefore()

    s().redo()
    expect(Object.values(s().c4Nodes).filter((n) => n.type === 'group')).toHaveLength(1)
  })
})

describe('Unwrap', () => {
  it('refuses to leave a group where its contents have no place', () => {
    s().setSelectedNodeIds(['web', 'api', 'db'])
    s().wrapSelectionInNewParent('group')
    const group = Object.values(s().c4Nodes).find((n) => n.type === 'group')!
    const before = s().c4Nodes
    // A group may lie at the root. Without the system, this one would lie
    // there with its containers, which have no place at the root.
    s().unwrapNode('shop')
    expect(s().c4Nodes).toBe(before)
    expect(s().c4Nodes[group.id].parentId).toBe('shop')
    expect(lastNotice()).toMatch(/Cannot unwrap/)
  })
})

describe('the Parent of an element', () => {
  it('cannot be one of its own children', () => {
    // A system may lie inside a system.
    s().reparentNodes(['bank'], 'shop')
    expect(s().c4Nodes.bank.parentId).toBe('shop')
    const before = s().c4Nodes
    s().updateNode('shop', { parentId: 'bank' })
    expect(s().c4Nodes).toBe(before)
    expect(lastNotice()).toMatch(/into itself or one of its descendants/)
  })
})

describe('a step that needs a type the metamodel no longer has', () => {
  beforeEach(() => {
    s().upsertNodeType({ ...s().metamodel.nodeTypes.system, id: 'gizmo', label: 'Gizmo', builtin: false, properties: [] })
  })

  it('cannot be gone back to once the type is deleted', () => {
    const id = add('gizmo', 'G')
    expect(id).not.toBe('')
    s().removeNode(id)
    s().removeNodeType('gizmo')
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    // Every step left is one from after the gizmo.
    const gizmos = (): boolean => hasType('gizmo')
    for (let i = 0; i < 5; i++) { s().undo(); expect(gizmos()).toBe(false) }
    for (let i = 0; i < 5; i++) { s().redo(); expect(gizmos()).toBe(false) }
  })

  it('steps made after the last element of the type went stay', () => {
    const id = add('gizmo', 'G')
    s().removeNode(id)
    s().updateNode('bank', { description: 'after' })
    s().removeNodeType('gizmo')
    expect(s().canUndo).toBe(true)
    s().undo()
    stillBefore()
    expect(s().canUndo).toBe(false)
  })
})

describe('Reset to C4 preset', () => {
  it('is refused while elements are of types the preset does not have', () => {
    const governance = builtInGovernanceMetamodel()
    s().loadDiagram({
      ...model(),
      nodes: [...model().nodes, { id: 'adr1', type: 'adr', label: 'Use Postgres', collapsed: false, x: 0, y: 700, width: 200, height: 100 } as C4Node],
      metamodel: governance,
    })
    expect(s().metamodel.nodeTypes.adr).toBeDefined()
    s().resetMetamodelToC4()
    expect(s().metamodel.nodeTypes.adr).toBeDefined()
    expect(lastNotice()).toMatch(/ADR|Decision|adr/i)
  })

  it('goes through when every element has a type there, and forgets steps that do not', () => {
    const governance = builtInGovernanceMetamodel()
    s().loadDiagram({ ...model(), metamodel: governance })
    const id = add('adr', 'Use Postgres')
    expect(id).not.toBe('')
    s().removeNode(id)
    s().resetMetamodelToC4()
    expect(s().metamodel.nodeTypes.adr).toBeUndefined()
    for (let i = 0; i < 5; i++) {
      s().undo()
      expect(hasType('adr')).toBe(false)
    }
  })
})

describe('a model loaded while a drag is in progress', () => {
  it('is not taken back by undoing the drag', () => {
    s().liveGrab('bank', 1200, 0, 'calm', { x: 1200, y: 0 })
    // A folder reloaded because a file changed outside Studio.
    const outside = model()
    outside.nodes = outside.nodes.map((n) => n.id === 'bank' ? { ...n, label: 'Renamed outside' } : n)
    s().loadDiagram(outside)
    s().liveRelease('bank', [], true)
    expect(s().canUndo).toBe(false)
    s().undo()
    expect(s().c4Nodes.bank.label).toBe('Renamed outside')
  })
})

describe('deleting with the Delete key', () => {
  // React Flow hands over the selected elements and the relations that go
  // with them. Each was deleted with its own undo step, and the relations
  // were gone already with their elements: the first Undos did nothing,
  // then the elements came back one at a time.
  it('is one undo step', () => {
    const before = { nodes: Object.keys(s().c4Nodes).length, relations: Object.keys(s().c4Relations).length }
    useDiagramStore.setState({ pendingDelete: { nodeIds: ['web', 'db'], edgeIds: ['r1', 'r2'] } } as never)
    s().resolvePendingDelete('model')
    expect(s().c4Nodes.web).toBeUndefined()
    expect(s().c4Nodes.db).toBeUndefined()
    s().undo()
    expect(Object.keys(s().c4Nodes).length).toBe(before.nodes)
    expect(Object.keys(s().c4Relations).length).toBe(before.relations)
    stillBefore()
  })

  it('removing from the view only is one step too', () => {
    s().setActiveView('v1')
    useDiagramStore.setState((st) => ({ views: { ...st.views, v1: { ...st.views.v1, nodeIds: ['shop', 'web', 'api', 'db', 'bank'] } } }))
    useDiagramStore.setState({ pendingDelete: { nodeIds: ['web', 'db'], edgeIds: [] } } as never)
    s().resolvePendingDelete('view')
    expect(s().views.v1.nodeIds).toEqual(['shop', 'api', 'bank'])
    s().undo()
    expect(s().views.v1.nodeIds).toEqual(['shop', 'web', 'api', 'db', 'bank'])
  })
})

describe('steps that arrive one after another for one action', () => {
  // A Hub concept with its related concepts is imported in parts (the
  // related ones while the template form is still open): one Undo took back
  // only the last part.
  it('become one step with _mergeStepsSince', () => {
    const mark = s()._historyMark()
    for (const label of ['A', 'B', 'C']) add('system', label)
    s()._mergeStepsSince(mark)
    expect(['A', 'B', 'C'].every((l) => Object.values(s().c4Nodes).some((n) => n.label === l))).toBe(true)
    s().undo()
    expect(['A', 'B', 'C'].some((l) => Object.values(s().c4Nodes).some((n) => n.label === l))).toBe(false)
    stillBefore()
  })
})

describe('an edit that changes nothing', () => {
  // A table cell opened and left without typing saved its value again: an
  // undo step that did nothing.
  it('is no undo step', () => {
    s().updateNode('bank', { description: 'before' })
    s().updateRelation('r1', { label: undefined })
    s().undo()
    expect(s().c4Nodes.bank.description).toBeUndefined()
  })
})

describe('deleting several elements from the selection bar', () => {
  // One undo step per element: it took as many Undos as elements.
  it('is one undo step', () => {
    const before = Object.keys(s().c4Nodes).length
    s().removeNodes(['web', 'db', 'bank'])
    expect(Object.keys(s().c4Nodes).length).toBe(before - 3)
    s().undo()
    expect(Object.keys(s().c4Nodes).length).toBe(before)
    stillBefore()
  })
})
