/**
 * Views keep one layout for every milestone, and a milestone keeps its All
 * elements positions: creating one with a view open, showing one and moving
 * through views, and keeping its edits leave the live views and All
 * elements as they were.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'

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

/** System S holds containers P and Q; P holds K1 and K2 in a row. The
 *  milestone M was made before K1 moved into Q and P was folded on live;
 *  the view v was laid out after: K2 where K1 was in P, Q beside P's fold. */
function movedSince(): DiagramData {
  const k = NODE_SIZES.component
  const c = NODE_SIZES.container
  const nodes: C4Node[] = [
    { id: 's', type: 'system', label: 'S', collapsed: false, x: 0, y: 0, width: 1160, height: 480 } as C4Node,
    { id: 'p', type: 'container', label: 'P', collapsed: false, parentId: 's', x: 30, y: 120, width: 520, height: 320 } as C4Node,
    { id: 'q', type: 'container', label: 'Q', collapsed: false, parentId: 's', x: 600, y: 120, width: 520, height: 320 } as C4Node,
    { id: 'k1', type: 'component', label: 'K1', collapsed: false, parentId: 'p', x: 20, y: 120, ...k } as C4Node,
    { id: 'k2', type: 'component', label: 'K2', collapsed: false, parentId: 'p', x: 280, y: 120, ...k } as C4Node,
  ]
  const early = JSON.parse(JSON.stringify(Object.fromEntries(nodes.map((n) => [n.id, n])))) as Record<string, C4Node>
  const live = JSON.parse(JSON.stringify(nodes)) as C4Node[]
  const byId = Object.fromEntries(live.map((n) => [n.id, n]))
  Object.assign(byId.k1, { parentId: 'q', x: 20, y: 120 })
  byId.p.collapsed = true
  const positions = {
    s: { x: 0, y: 0, width: 30 + c.width + 40 + 520 + 30, height: 480 },
    // Folded, P keeps its open size; Q stands beside the fold.
    p: { x: 30, y: 120, width: 520, height: 320 },
    q: { x: 30 + c.width + 40, y: 120, width: 520, height: 320 },
    k1: { x: 20, y: 120, ...k },
    k2: { x: 20, y: 120, ...k },
  }
  return {
    nodes: live, relations: [],
    defaultPositions: Object.fromEntries(live.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }])),
    views: [{ id: 'v', name: 'v', nodeIds: [], positions }],
    snapshots: [{ id: 'm', name: 'M', timestamp: 1, nodes: early, relations: {} }],
  }
}

describe('a milestone shown on a view laid out since', () => {
  const abs = (id: string): { x: number; y: number; width: number; height: number } => {
    const nodes = s().c4Nodes
    const n = nodes[id]
    const b = { x: n.x, y: n.y, width: n.width, height: n.height }
    for (let p = n.parentId; p; p = nodes[p].parentId) { b.x += nodes[p].x; b.y += nodes[p].y }
    return b
  }
  const clear = (a: string, b: string): boolean => {
    const [p, q] = [abs(a), abs(b)]
    return p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y
  }
  const within = (id: string): boolean => {
    const n = s().c4Nodes[id]
    const p = s().c4Nodes[n.parentId!]
    return n.x >= 0 && n.y >= 0 && n.x + n.width <= p.width && n.y + n.height <= p.height
  }

  beforeEach(() => {
    s().loadDiagram(movedSince())
    s().setActiveView('v')
  })

  // K1 in P in the milestone kept the view's place for it in Q: drawn on K2.
  it('draws an element with another parent there beside its siblings, inside its parent', () => {
    s().selectMilestone('m')
    expect(s().c4Nodes.k1.parentId).toBe('p')
    expect(clear('k1', 'k2')).toBe(true)
    expect(within('k1')).toBe(true)
    expect(within('k2')).toBe(true)
  })

  // P, folded on live, open in the milestone, took its open size at the
  // place of its fold: over Q.
  it('draws a container open there but folded on live clear of its siblings', () => {
    s().selectMilestone('m')
    expect(s().c4Nodes.p.collapsed).toBe(false)
    expect(clear('p', 'q')).toBe(true)
    expect(within('p')).toBe(true)
    expect(within('q')).toBe(true)
  })

  it('changes nothing of the view\'s layout', () => {
    const before = JSON.parse(JSON.stringify(s().saveDiagram().views![0].positions))
    s().selectMilestone('m')
    s().setActiveView(null)
    s().setActiveView('v')
    expect(s().saveDiagram().views![0].positions).toEqual(before)
    s().discardMilestoneChanges()
    expect(s().saveDiagram().views![0].positions).toEqual(before)
  })
})
