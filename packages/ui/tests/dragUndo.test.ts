/**
 * A drag is an undo step of its own. It had none: Undo stayed disabled after
 * a drag, and after "add an element, then drag another" one Undo took back
 * both, because the step before the drag was the only one there was.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { NODE_SIZES, pinnedNodeIds } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as C4Node)
const at = (id: string) => ({ x: s().c4Nodes[id].x, y: s().c4Nodes[id].y })

/** What a drag does to the store: grab, the canvas and the physics move
 *  the element, release. */
function drag(id: string, to: { x: number; y: number }, moved = true): void {
  s().liveGrab(id, at(id).x, at(id).y, 'calm', at(id))
  if (moved) useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, [id]: { ...st.c4Nodes[id], ...to } } }))
  s().liveRelease(id, [], moved)
}

describe('A drag as an undo step', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram({ nodes: [sys('a', 0, 0), sys('b', 600, 0)], relations: [] })
  })
  afterEach(() => s().stopLiveLayout())

  it('is taken back by one Undo, with the pin it set, and given back by Redo', () => {
    expect(s().canUndo).toBe(false)
    drag('a', { x: 300, y: 200 })
    expect(at('a')).toEqual({ x: 300, y: 200 })
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a'])
    expect(s().canUndo).toBe(true)

    s().undo()
    expect(at('a')).toEqual({ x: 0, y: 0 })
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual([])
    expect(s().canUndo).toBe(false)

    s().redo()
    expect(at('a')).toEqual({ x: 300, y: 200 })
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a'])
  })

  it('is a step of its own after another edit', () => {
    const added = s().addNode({ type: 'system', label: 'c', x: 1200, y: 0, ...NODE_SIZES.system, collapsed: false } as Omit<C4Node, 'id'>)
    drag('a', { x: 300, y: 200 })

    s().undo()
    expect(at('a')).toEqual({ x: 0, y: 0 })
    expect(s().c4Nodes[added]).toBeDefined()

    s().undo()
    expect(s().c4Nodes[added]).toBeUndefined()
  })

  it('is no step when nothing moved (a click)', () => {
    drag('a', { x: 0, y: 0 }, false)
    expect(s().canUndo).toBe(false)
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual([])
  })

  it('is no step in Viewer, where nothing that is moved is kept', () => {
    s().setAppMode('viewer')
    drag('a', { x: 300, y: 200 })
    expect(s().canUndo).toBe(false)
    s().setAppMode('designer')
  })
})
