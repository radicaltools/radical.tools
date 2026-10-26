/**
 * An undo step belongs to the canvas and to the model it was made on.
 *
 * A history entry holds the nodes as the canvas shown then had them. Restored
 * under another canvas they became that canvas's layout: a drag on one view,
 * undone on another, gave the second the first one's positions. And an entry
 * did not say whether it was the live model's or a milestone's: Undo right
 * after opening a milestone put the live model under the milestone's name
 * ("Propagate" then copied it over every milestone), and Undo after leaving
 * a milestone made the milestone the live model.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as C4Node)
const at = (id: string) => ({ x: s().c4Nodes[id].x, y: s().c4Nodes[id].y })

function model(): DiagramData {
  const size = NODE_SIZES.system
  return {
    nodes: [sys('a', 0, 0), sys('b', 600, 0)],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b' }],
    views: [
      { id: 'one', name: 'One', nodeIds: ['a', 'b'], positions: { a: { x: 100, y: 100, ...size }, b: { x: 900, y: 100, ...size } } },
      { id: 'two', name: 'Two', nodeIds: ['a', 'b'], positions: { a: { x: 50, y: 700, ...size }, b: { x: 50, y: 1100, ...size } } },
    ],
  }
}

/** What a drag does to the store (see dragUndo.test.ts). */
function drag(id: string, to: { x: number; y: number }): void {
  s().liveGrab(id, at(id).x, at(id).y, 'calm', at(id))
  useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, [id]: { ...st.c4Nodes[id], ...to } } }))
  s().liveRelease(id, [], true)
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('Undo and the canvas a step was made on', () => {
  it('goes back to that canvas and leaves the one shown as it was', () => {
    s().setActiveView('one')
    drag('b', { x: 1300, y: 400 })
    s().setActiveView('two')
    expect(at('a')).toEqual({ x: 50, y: 700 })

    s().undo()
    expect(s().activeViewId).toBe('one')
    expect(at('b')).toEqual({ x: 900, y: 100 })
    expect(s().views.two.positions.a).toMatchObject({ x: 50, y: 700 })
    expect(s().views.two.positions.b).toMatchObject({ x: 50, y: 1100 })

    // The other view still has its own layout.
    s().setActiveView('two')
    expect(at('a')).toEqual({ x: 50, y: 700 })
    expect(at('b')).toEqual({ x: 50, y: 1100 })
  })

  it('undoes a step made on All elements from a view', () => {
    drag('b', { x: 600, y: 500 })
    s().setActiveView('one')
    s().undo()
    expect(s().activeViewId).toBeNull()
    expect(at('b')).toEqual({ x: 600, y: 0 })
    s().setActiveView('one')
    expect(at('b')).toEqual({ x: 900, y: 100 })
  })

  // Redo went to the canvas where Undo was pressed, which the step never
  // changed.
  it('gives the step back on that canvas too, wherever it was undone from', () => {
    s().setActiveView('one')
    drag('b', { x: 1300, y: 400 })
    s().setActiveView('two')
    s().undo()
    s().redo()
    expect(s().activeViewId).toBe('one')
    expect(at('b')).toEqual({ x: 1300, y: 400 })
    s().setActiveView('two')
    expect(at('a')).toEqual({ x: 50, y: 700 })
    expect(at('b')).toEqual({ x: 50, y: 1100 })
    // And Undo after a Redo pressed elsewhere goes back to it as well.
    s().undo()
    expect(s().activeViewId).toBe('one')
    expect(at('b')).toEqual({ x: 900, y: 100 })
    s().setActiveView('two')
    s().redo()
    expect(s().activeViewId).toBe('one')
    expect(at('b')).toEqual({ x: 1300, y: 400 })
  })

  // F-0063: the camera is no part of a step. Undo pressed on another view
  // put back the cameras the views had when the step was made: the view it
  // went back to opened at the camera of the load, and the one left lost
  // its zoom.
  it('keeps the cameras of both views', () => {
    const w = window as any
    const placed: unknown[] = []
    w.__rfPlaceCamera = (vp: unknown) => placed.push(vp)
    try {
      s().setActiveView('one')
      w.__rfCurrentViewport = { x: -159, y: -160, zoom: 0.834 }
      drag('b', { x: 1300, y: 400 })
      s().setActiveView('two')
      w.__rfCurrentViewport = { x: 222, y: 92, zoom: 0.318 }
      s().undo()
      expect(s().activeViewId).toBe('one')
      expect(placed[placed.length - 1]).toEqual({ x: -159, y: -160, zoom: 0.834 })
      expect(s().views.one.viewport).toEqual({ x: -159, y: -160, zoom: 0.834 })
      expect(s().views.two.viewport).toEqual({ x: 222, y: 92, zoom: 0.318 })
    } finally {
      delete w.__rfPlaceCamera
      w.__rfCurrentViewport = undefined
    }
  })

  it('gives a step made on All elements back there, redone from a view', () => {
    drag('b', { x: 600, y: 500 })
    s().setActiveView('one')
    s().undo()
    s().setActiveView('one')
    s().redo()
    expect(s().activeViewId).toBeNull()
    expect(at('b')).toEqual({ x: 600, y: 500 })
    s().setActiveView('one')
    expect(at('b')).toEqual({ x: 900, y: 100 })
  })
})

describe('Undo and the model a step was made on', () => {
  /** A milestone of the two systems, then a third added to the live model. */
  function withMilestone(): string {
    const id = s().createSnapshot('v1')
    s().addNode({ type: 'system', label: 'c', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    return id
  }
  const labels = (): string[] => Object.values(s().c4Nodes).map((n) => n.label).sort()

  it('does nothing right after a milestone is opened', () => {
    const v1 = withMilestone()
    expect(s().canUndo).toBe(true)
    s().selectMilestone(v1)
    expect(labels()).toEqual(['a', 'b'])
    expect(s().canUndo).toBe(false)
    s().undo()
    expect(labels()).toEqual(['a', 'b'])
    expect(s().activeSnapshotId).toBe(v1)
  })

  it('finds the live model\'s own steps again after a look at a milestone', () => {
    const v1 = withMilestone()
    s().selectMilestone(v1)
    s().discardMilestoneChanges()
    expect(labels()).toEqual(['a', 'b', 'c'])
    expect(s().canUndo).toBe(true)
    s().undo()
    expect(labels()).toEqual(['a', 'b'])
  })

  it('does not bring a milestone\'s steps onto the live model', () => {
    const v1 = withMilestone()
    s().selectMilestone(v1)
    drag('a', { x: 300, y: 300 })
    expect(s().canUndo).toBe(true)
    s().discardMilestoneChanges()
    // The step made in the milestone is gone; the live model's own is back.
    s().undo()
    expect(s().activeSnapshotId).toBeNull()
    expect(labels()).toEqual(['a', 'b'])
    s().redo()
    expect(labels()).toEqual(['a', 'b', 'c'])
    expect(at('a')).toEqual({ x: 0, y: 0 })
  })

  it('has no step to undo once a milestone\'s edits were propagated', () => {
    const v1 = withMilestone()
    s().selectMilestone(v1)
    drag('a', { x: 300, y: 300 })
    s().commitMilestoneChanges('propagate')
    expect(s().canUndo).toBe(false)
    s().discardMilestoneChanges()
    expect(s().canUndo).toBe(false)
    // The milestone kept what it was given.
    expect(Object.keys(s().snapshots.find((m) => m.id === v1)!.nodes).length).toBe(2)
  })
})

// The milestones, the metamodel and the views are the live model's as much
// as a milestone's: what is done to them while a milestone is shown is no
// edit of it. Undo of a live step after the visit took it back with the
// step (the steps held them as they were before the visit), and saved that.
describe('Undo of a live step after a look at a milestone', () => {
  function visit(v1: string, edit: () => void): void {
    drag('a', { x: 300, y: 300 })
    s().selectMilestone(v1)
    edit()
    s().discardMilestoneChanges()
    expect(s().canUndo).toBe(true)
    s().undo()
    expect(at('a')).toEqual({ x: 0, y: 0 })
  }

  it('keeps the milestone made by Save as new', () => {
    const v1 = s().createSnapshot('v1')
    visit(v1, () => {
      drag('b', { x: 600, y: 400 })
      s().commitMilestoneChanges('new', 'v1 moved')
    })
    expect(s().snapshots.map((m) => m.name)).toEqual(['v1', 'v1 moved'])
    s().redo()
    expect(at('a')).toEqual({ x: 300, y: 300 })
    expect(s().snapshots.map((m) => m.name)).toEqual(['v1', 'v1 moved'])
  })

  it('keeps a milestone renamed', () => {
    const v1 = s().createSnapshot('v1')
    visit(v1, () => s().renameSnapshot(v1, 'first'))
    expect(s().snapshots.map((m) => m.name)).toEqual(['first'])
  })

  it('keeps a view renamed', () => {
    const v1 = s().createSnapshot('v1')
    visit(v1, () => s().renameView('one', 'Uno'))
    expect(s().views.one.name).toBe('Uno')
  })

  it('keeps a type added to the metamodel', () => {
    const v1 = s().createSnapshot('v1')
    visit(v1, () => s().upsertNodeType({ ...s().metamodel.nodeTypes.system, id: 'gizmo', label: 'Gizmo', builtin: false, properties: [] }))
    expect(s().metamodel.nodeTypes.gizmo).toBeDefined()
  })

  it('still takes back a milestone made on live', () => {
    drag('a', { x: 300, y: 300 })
    const v1 = s().createSnapshot('v1')
    s().selectMilestone(v1)
    s().renameView('one', 'Uno')
    s().discardMilestoneChanges()
    s().undo()
    expect(s().snapshots).toEqual([])
    expect(s().views.one.name).toBe('Uno')
    s().undo()
    expect(at('a')).toEqual({ x: 0, y: 0 })
  })
})

