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
import { saveAsViewpoint, viewpointsOf } from '@radical/common/viewpoints'
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

describe('a metamodel edit is an undo step (decided 2026-10-21)', () => {
  // The metamodel was in no step: a step that held elements of a type
  // deleted since was dropped from the history, and Undo after Save as
  // viewpoint left the viewpoint.
  beforeEach(() => {
    s().upsertNodeType({ ...s().metamodel.nodeTypes.system, id: 'gizmo', label: 'Gizmo', builtin: false, properties: [] })
  })

  it('a type deleted comes back, and the steps before it with their elements', () => {
    const id = add('gizmo', 'G')
    expect(id).not.toBe('')
    s().removeNode(id)
    s().removeNodeType('gizmo')
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toBeDefined()
    expect(hasType('gizmo')).toBe(false)
    s().undo()
    expect(s().c4Nodes[id]?.type).toBe('gizmo')
    s().undo()
    expect(s().c4Nodes[id]).toBeUndefined()
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    stillBefore()
    for (let i = 0; i < 4; i++) s().redo()
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    expect(s().c4Nodes[id]).toBeUndefined()
  })

  it('a type edited is one step for what is typed into a field', () => {
    s().beginTyping()
    for (const label of ['W', 'Wi', 'Widget']) s().upsertNodeType({ ...s().metamodel.nodeTypes.gizmo, label })
    s().endTyping()
    s().upsertNodeType({ ...s().metamodel.nodeTypes.gizmo, allowedAtRoot: false })
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toMatchObject({ label: 'Widget' })
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toMatchObject({ label: 'Gizmo' })
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
    stillBefore()
  })

  it('a relation type added and deleted, each a step', () => {
    s().upsertRelationType({ id: 'feeds', label: 'feeds', allowedPairs: [], builtin: false })
    s().removeRelationType('feeds')
    s().undo()
    expect(s().metamodel.relationTypes.feeds).toBeDefined()
    s().undo()
    expect(s().metamodel.relationTypes.feeds).toBeUndefined()
    expect(s().metamodel.nodeTypes.gizmo).toBeDefined()
  })

  it('the same type set again is no step', () => {
    s().upsertNodeType({ ...s().metamodel.nodeTypes.gizmo })
    s().undo()
    expect(s().metamodel.nodeTypes.gizmo).toBeUndefined()
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

  it('goes through when every element has a type there, and is an undo step', () => {
    const governance = builtInGovernanceMetamodel()
    s().loadDiagram({ ...model(), metamodel: governance })
    const id = add('adr', 'Use Postgres')
    expect(id).not.toBe('')
    s().removeNode(id)
    s().resetMetamodelToC4()
    expect(s().metamodel.nodeTypes.adr).toBeUndefined()
    s().undo()
    expect(s().metamodel.nodeTypes.adr).toBeDefined()
    s().undo()
    expect(s().c4Nodes[id]?.type).toBe('adr')
    s().redo()
    s().redo()
    expect(s().metamodel.nodeTypes.adr).toBeUndefined()
    expect(hasType('adr')).toBe(false)
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

describe('a change of view type', () => {
  // It pushed no step: Undo took back the New view before it, and Redo
  // brought the view back as a table.
  it('is one undo step, and takes the viewpoint back with it', () => {
    const v = s().addViewOfViewpoint('containers')!
    s().setViewKind(v, 'table')
    expect(s().views[v]).toMatchObject({ kind: 'table' })
    expect(s().views[v].viewpoint).toBeUndefined()
    s().undo()
    expect(s().views[v]).toMatchObject({ kind: 'static', viewpoint: 'containers' })
    s().redo()
    expect(s().views[v].kind).toBe('table')
    s().undo()
    s().undo()
    expect(s().views[v]).toBeUndefined()
    stillBefore()
  })

  it('to the type it has is no step', () => {
    s().setViewKind('v1', 'static')
    s().undo()
    expect(s().c4Nodes.bank.description).toBeUndefined()
  })
})

describe('undo after a viewpoint changed in the metamodel', () => {
  // "Save as viewpoint…" is one step, the metamodel's edit with it: Undo
  // left the viewpoint in the metamodel.
  it('"Save as viewpoint… → Replace" is one step, taken back with the viewpoint', () => {
    const a = s().addViewOfViewpoint('system-context')!
    const b = s().addViewOfViewpoint('containers')!
    s().detachViewpoint(b)
    const before = JSON.stringify(s().views[a].pipeline)
    const viewpoints = JSON.stringify(viewpointsOf(s().metamodel))
    const saved = saveAsViewpoint(s().metamodel, 'System context', 'static', s().views[b].pipeline!)
    s().runAsOneStep(() => {
      s().setMetamodel(saved.metamodel)
      s().applyViewpoint(b, saved.type.id)
    })
    const chain = JSON.stringify(s().views[a].pipeline)
    expect(chain).toBe(JSON.stringify(s().views[b].pipeline))
    expect(chain).not.toBe(before)

    s().undo()
    expect(JSON.stringify(viewpointsOf(s().metamodel))).toBe(viewpoints)
    expect(s().views[b].viewpoint).toBeUndefined()
    expect(s().views[a].viewpoint).toBe('system-context')
    expect(JSON.stringify(s().views[a].pipeline)).toBe(before)
    s().undo()
    expect(s().views[b].viewpoint).toBe('containers')
    s().undo()
    expect(s().views[b]).toBeUndefined()
    expect(s().views[a]).toBeDefined()
    s().undo()
    expect(s().views[a]).toBeUndefined()
    stillBefore()
    for (let i = 0; i < 4; i++) s().redo()
    expect(JSON.stringify(s().views[a].pipeline)).toBe(chain)
    expect(s().views[b].viewpoint).toBe(saved.type.id)
  })

  it('a viewpoint deleted in the metamodel editor comes back with its view', () => {
    const a = s().addViewOfViewpoint('containers')!
    s().updateNode('bank', { description: 'after' })
    s().setMetamodel({ ...s().metamodel, viewpoints: viewpointsOf(s().metamodel).filter((t) => t.id !== 'containers') })
    expect(s().views[a].viewpoint).toBeUndefined()
    s().undo()
    expect(viewpointsOf(s().metamodel).some((t) => t.id === 'containers')).toBe(true)
    expect(s().views[a].viewpoint).toBe('containers')
    expect(s().c4Nodes.bank.description).toBe('after')
    s().undo()
    expect(s().c4Nodes.bank.description).toBe('before')
    s().undo()
    expect(s().views[a]).toBeUndefined()
  })
})

describe('the selection after an undo', () => {
  // Undoing the add of the selected element left an empty properties card
  // and "1 node selected" for an element that was gone.
  it('drops an element the undo took away', () => {
    const id = add('system', 'New')
    s().selectNode(id)
    s().undo()
    expect(s().c4Nodes[id]).toBeUndefined()
    expect(s().selectedNodeId).toBeNull()
    expect(s().selectedNodeIds).toEqual([])
  })

  it('drops a relation the undo took away, and keeps what is still there', () => {
    s().setSelectedNodeIds(['web', 'api'])
    s().addRelation({ sourceId: 'web', targetId: 'db' })
    const id = Object.keys(s().c4Relations).find((r) => !['r1', 'r2', 'r3'].includes(r))!
    s().undo()
    expect(s().selectedNodeIds).toEqual(['web', 'api'])
    s().redo()
    s().selectEdge(id)
    s().undo()
    expect(s().selectedEdgeId).toBeNull()
  })

  it('drops an element the milestone opened does not have', () => {
    const snap = s().createSnapshot('Before')
    const id = add('system', 'New')
    s().selectNode(id)
    s().selectMilestone(snap)
    expect(s().c4Nodes[id]).toBeUndefined()
    expect(s().selectedNodeId).toBeNull()
    expect(s().selectedNodeIds).toEqual([])
  })
})

describe('Hide from view of what the view does not show', () => {
  // It pushed a step that changed nothing, and that dropped the redo.
  it('is no undo step', () => {
    s().setActiveView('v1')
    useDiagramStore.setState((st) => ({ views: { ...st.views, v1: { ...st.views.v1, nodeIds: ['shop', 'web', 'api'] } } }))
    const id = add('system', 'New')
    s().undo()
    expect(s().canRedo).toBe(true)
    s().removeNodeFromView('v1', id)
    s().removeNodeFromView('v1', 'bank')
    expect(s().canRedo).toBe(true)
    s().redo()
    expect(s().c4Nodes[id]).toBeDefined()
  })
})

describe('Multi page and Depth of a wiki', () => {
  // Neither was a step, and Undo of an element written before them gave
  // back Single page at Depth 1 with it (saved).
  it('are undo steps of their own', () => {
    s().setViewKind('v1', 'wiki')
    const id = add('system', 'Written in the wiki')
    s().setWikiPageMode('v1', 'multi')
    s().setWikiDepth('v1', 3)
    s().undo()
    expect(s().views.v1.wikiPageMode).toBe('multi')
    expect(s().views.v1.wikiDepth ?? 1).toBe(1)
    expect(s().c4Nodes[id]).toBeDefined()
    s().undo()
    expect(s().views.v1.wikiPageMode ?? 'single').toBe('single')
    expect(s().c4Nodes[id]).toBeDefined()
    s().undo()
    expect(s().c4Nodes[id]).toBeUndefined()
    expect(s().views.v1.kind).toBe('wiki')
    s().redo()
    s().redo()
    s().redo()
    expect(s().views.v1).toMatchObject({ wikiPageMode: 'multi', wikiDepth: 3 })
  })

  it('set to what they are is no step', () => {
    s().setWikiPageMode('v1', 'single')
    s().setWikiDepth('v1', 1)
    s().undo()
    expect(s().c4Nodes.bank.description).toBeUndefined()
  })
})

describe('Size and Levels of a hierarchy', () => {
  // Neither was a step, and Undo of an element added before them gave back
  // the old Size and Levels with it (saved).
  it('are undo steps of their own', () => {
    s().setViewKind('v1', 'treemap')
    const id = add('system', 'Added')
    s().setTreemapSizeBy('v1', 'uniform')
    s().setTreemapMaxDepth('v1', 3)
    s().undo()
    expect(s().views.v1.treemapSizeBy).toBe('uniform')
    expect(s().views.v1.treemapMaxDepth).toBeUndefined()
    expect(s().c4Nodes[id]).toBeDefined()
    s().undo()
    expect(s().views.v1.treemapSizeBy).toBeUndefined()
    expect(s().c4Nodes[id]).toBeDefined()
    s().undo()
    expect(s().c4Nodes[id]).toBeUndefined()
    s().redo()
    s().redo()
    s().redo()
    expect(s().views.v1).toMatchObject({ treemapSizeBy: 'uniform', treemapMaxDepth: 3 })
  })

  it('set to what they are is no step', () => {
    s().setViewKind('v1', 'treemap')
    s().undo()
    s().setTreemapSizeBy('v1', 'leaves')
    s().setTreemapMaxDepth('v1', 2)
    s().undo()
    expect(s().c4Nodes.bank.description).toBeUndefined()
  })
})

describe('typing into a text field is one undo step (item 158)', () => {
  const type = (text: string, edit: (v: string) => void) => {
    for (let i = 1; i <= text.length; i++) edit(text.slice(0, i))
  }

  it('a name typed letter by letter is taken back at once', () => {
    s().undo()
    expect(s().canUndo).toBe(false)
    s().beginTyping()
    type('Card Gateway', (v) => s().updateNode('bank', { label: v }))
    s().endTyping()
    expect(s().c4Nodes.bank.label).toBe('Card Gateway')
    expect(s().canUndo).toBe(true)
    s().undo()
    expect(s().c4Nodes.bank.label).toBe('bank')
    expect(s().canUndo).toBe(false)
    s().redo()
    expect(s().c4Nodes.bank.label).toBe('Card Gateway')
  })

  it("a relation's name too, and each field typed into is a step of its own", () => {
    s().beginTyping()
    type('pays', (v) => s().updateRelation('r3', { label: v }))
    s().endTyping()
    s().beginTyping()
    type('HTTPS', (v) => s().updateRelation('r3', { technology: v }))
    s().endTyping()
    s().undo()
    expect(s().c4Relations.r3).toMatchObject({ label: 'pays' })
    expect(s().c4Relations.r3.technology).toBeUndefined()
    s().undo()
    expect(s().c4Relations.r3.label).toBeUndefined()
  })

  it('the same field typed into again after it lost focus, or after Undo, is a new step', () => {
    s().beginTyping()
    type('Card', (v) => s().updateNode('bank', { label: v }))
    s().endTyping()
    s().beginTyping()
    type('Card Gateway', (v) => v.length > 4 && s().updateNode('bank', { label: v }))
    s().undo()
    expect(s().c4Nodes.bank.label).toBe('Card')
    type('Card Bank', (v) => v.length > 4 && s().updateNode('bank', { label: v }))
    s().endTyping()
    s().undo()
    expect(s().c4Nodes.bank.label).toBe('Card')
  })

  it('without a focused field each edit is a step', () => {
    s().updateNode('bank', { label: 'B' })
    s().updateNode('bank', { label: 'Ba' })
    s().undo()
    expect(s().c4Nodes.bank.label).toBe('B')
  })
})
