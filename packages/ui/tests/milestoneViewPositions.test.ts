/**
 * Views keep one layout for every milestone, and a milestone keeps its All
 * elements positions: creating one with a view open, showing one and moving
 * through views, and keeping its edits leave the live views and All
 * elements as they were.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const box = (x: number) => ({ x, y: 0, width: 160, height: 80 })
const node = (id: string, x: number): C4Node => ({ id, type: 'system', label: id, ...box(x) }) as C4Node
const moveB = (x: number) => useDiagramStore.setState((st: any) => { st.c4Nodes.b.x = x })

beforeEach(() => {
  // All elements has b at 300; the view v has it at 5000.
  s().loadDiagram({
    nodes: [node('a', 0), node('b', 300)], relations: [],
    defaultPositions: { a: box(0), b: box(300) },
    views: [{ id: 'v', name: 'v', nodeIds: ['a', 'b'], positions: { a: box(0), b: box(5000) } }],
  })
  useDiagramStore.setState({ appMode: 'designer' } as any)
})

describe('milestones and view positions', () => {
  it('a milestone made with a view open keeps All elements positions', () => {
    s().setActiveView('v')
    expect(s().c4Nodes.b.x).toBe(5000)
    const id = s().createSnapshot('M1')
    expect(s().snapshots.find((m) => m.id === id)!.nodes.b.x).toBe(300)
  })

  it('a milestone shown takes the views\' layout, keeps its own All elements, and saves nothing into the live ones', () => {
    s().createSnapshot('M1')
    s().selectMilestone(s().snapshots[0].id)
    s().setActiveView('v')
    expect(s().c4Nodes.b.x).toBe(5000)
    moveB(7777)
    s().setActiveView(null)
    expect(s().views.v.positions.b.x).toBe(5000)
    expect(s().c4Nodes.b.x).toBe(300)
    moveB(4444)
    s().setActiveView('v')
    s().setActiveView(null)
    expect(s().defaultPositions.b.x).toBe(300)
    // Its own All elements, while it is shown.
    expect(s().c4Nodes.b.x).toBe(4444)
  })

  it('leaving a milestone shows the live layout of the canvas shown', () => {
    s().createSnapshot('M1')
    s().selectMilestone(s().snapshots[0].id)
    s().setActiveView('v')
    s().discardMilestoneChanges()
    expect(s().activeViewId).toBe('v')
    expect(s().c4Nodes.b.x).toBe(5000)
    s().setActiveView(null)
    expect(s().c4Nodes.b.x).toBe(300)
  })

  it('keeping a milestone\'s edits with a view open carries no view layout into the live model', () => {
    s().createSnapshot('M1')
    s().selectMilestone(s().snapshots[0].id)
    s().setActiveView('v')
    s().updateNode('a', { label: 'Renamed' })
    s().commitMilestoneChanges('propagate')
    expect(s().snapshots[0].nodes.b.x).toBe(300)
    expect(s().snapshots[0].nodes.a.label).toBe('Renamed')
    s().discardMilestoneChanges()
    s().setActiveView(null)
    expect(s().c4Nodes.a.label).toBe('Renamed')
    expect(s().c4Nodes.b.x).toBe(300)
  })
})
