/**
 * Layout pipeline plumbing shared by every layout engine: what graph the
 * engines see (visible projection) and how a raw layout is turned into the
 * one that gets rendered (finalizeLayout).
 */
import { describe, it, expect } from 'vitest'
import { projectToVisibleGraph } from '../src/geometry'
import { finalizeLayout, separateBoxes, ROOT_GAP } from '../src/layoutFinalize'
import { applyElkLayout } from '../src/elkLayout'
import { minimizeCrossings, totalLayoutCost } from '../src/crossingOpt'
import { runSmartLayoutELKPhase, type SmartLayoutProgress } from '../src/smartLayout'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, type C4Node, type C4Relation } from '@radical/common/c4'

function node(id: string, type: C4Node['type'], extras: Partial<C4Node> = {}): C4Node {
  return { id, type, label: id, x: 0, y: 0, collapsed: false, ...NODE_SIZES[type], ...extras }
}
function rel(id: string, sourceId: string, targetId: string): C4Relation {
  return { id, sourceId, targetId }
}

/** A collapsed system whose hidden containers carry relations. */
function collapsedScene(): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {
    p: node('p', 'person'),
    A: node('A', 'system', { collapsed: true, width: 900, height: 600 }),
    a1: node('a1', 'container', { parentId: 'A', x: 20, y: 120 }),
    a2: node('a2', 'container', { parentId: 'A', x: 600, y: 450 }),
    B: node('B', 'system'),
  }
  const relations: Record<string, C4Relation> = {
    r1: rel('r1', 'p', 'a1'),
    r2: rel('r2', 'a2', 'B'),
    r3: rel('r3', 'a1', 'a2'),   // both ends hidden in the same box → self-loop
    r4: rel('r4', 'a1', 'B'),    // duplicates r2 once projected
  }
  return { nodes, relations }
}

describe('projectToVisibleGraph', () => {
  it('drops hidden nodes and re-attaches their relations to the visible ancestor', () => {
    const { nodes, relations } = projectToVisibleGraph(collapsedScene().nodes, collapsedScene().relations)

    expect(Object.keys(nodes).sort()).toEqual(['A', 'B', 'p'])
    expect(nodes.A.width).toBe(COLLAPSED_WIDTH.system)
    expect(nodes.A.height).toBe(COLLAPSED_HEIGHT.system)
    expect(Object.values(relations).map((r) => `${r.sourceId}>${r.targetId}`).sort()).toEqual(['A>B', 'p>A'])
  })
})

describe('applyElkLayout with a collapsed container', () => {
  it('lays out the visible graph instead of failing on edges to hidden children', async () => {
    const { nodes, relations } = collapsedScene()
    const positions = await applyElkLayout(nodes, relations)
    expect(Object.keys(positions).sort()).toEqual(['A', 'B', 'p'])
  })
})

describe('finalizeLayout', () => {
  it('pushes overlapping roots apart to the root gap', () => {
    const boxes = [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 50, y: 20, width: 200, height: 100 },
      { x: 60, y: 30, width: 200, height: 100 },
    ]
    separateBoxes(boxes, ROOT_GAP)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + ROOT_GAP
        const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + ROOT_GAP
        expect(ox > 1e-6 && oy > 1e-6).toBe(false)
      }
    }
  })

  it('fits compounds around their children with header room and a minimum size', () => {
    const nodes: Record<string, C4Node> = {
      S: node('S', 'system', { width: 50, height: 50 }),
      c: node('c', 'component', { parentId: 'S', x: -300, y: -300, width: 100, height: 60 }),
    }
    const out = finalizeLayout(nodes, {})
    expect(out.c.y).toBe(120)
    expect(out.c.x).toBeGreaterThan(0)
    expect(out.S.width).toBeGreaterThanOrEqual(NODE_SIZES.system.width)
    expect(out.S.height).toBeGreaterThanOrEqual(120 + 60)
  })
})

/** Six systems in a row wired so that the row order crosses edges. */
function crossedRow(): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {}
  for (let i = 0; i < 6; i++) nodes[`s${i}`] = node(`s${i}`, 'system', { x: i * 300, y: 0 })
  nodes.p = node('p', 'person', { x: 700, y: -300 })
  nodes.q = node('q', 'person', { x: 700, y: 400 })
  const relations: Record<string, C4Relation> = {
    r1: rel('r1', 'p', 's0'), r2: rel('r2', 'p', 's5'), r3: rel('r3', 'q', 's1'),
    r4: rel('r4', 'q', 's4'), r5: rel('r5', 's0', 's3'), r6: rel('r6', 's2', 's5'),
  }
  return { nodes, relations }
}

describe('minimizeCrossings', () => {
  it('never increases the crossing/overdraw cost', () => {
    const { nodes, relations } = crossedRow()
    const updates = minimizeCrossings(nodes, relations)
    const after: Record<string, C4Node> = {}
    for (const [id, n] of Object.entries(nodes)) after[id] = updates[id] ? { ...n, ...updates[id] } : n
    expect(Object.keys(updates).length).toBeGreaterThan(0)
    expect(totalLayoutCost(after, relations)).toBeLessThan(totalLayoutCost(nodes, relations))
  })
})

describe('minimizeCrossings work budget', () => {
  /** One container with many crossing children: a lot of pairs to swap. */
  function crowdedContainer(n: number): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
    const nodes: Record<string, C4Node> = { box: node('box', 'system', { width: 3000, height: 3000 }) }
    const relations: Record<string, C4Relation> = {}
    for (let i = 0; i < n; i++) {
      nodes[`c${i}`] = node(`c${i}`, 'container', { parentId: 'box', x: 40 + (i % 8) * 260, y: 120 + Math.floor(i / 8) * 160 })
      if (i > 0) relations[`r${i}`] = rel(`r${i}`, `c${i}`, `c${(i * 7) % i}`)
    }
    return { nodes, relations }
  }

  it('stops past its budget and keeps what it improved', () => {
    const { nodes, relations } = crowdedContainer(40)
    const free = { work: 0, exhausted: false }
    minimizeCrossings(nodes, relations, { stats: free, maxWork: Infinity })
    expect(free.exhausted).toBe(false)

    const capped = { work: 0, exhausted: false }
    const updates = minimizeCrossings(nodes, relations, { stats: capped, maxWork: free.work / 10 })
    expect(capped.exhausted).toBe(true)
    expect(capped.work).toBeLessThan(free.work / 5)
    const after: Record<string, C4Node> = {}
    for (const [id, n] of Object.entries(nodes)) after[id] = updates[id] ? { ...n, ...updates[id] } : n
    expect(totalLayoutCost(after, relations)).toBeLessThanOrEqual(totalLayoutCost(nodes, relations))
  })

  it('leaves a diagram of ordinary size unbounded by the default budget', () => {
    const { nodes, relations } = crowdedContainer(40)
    const stats = { work: 0, exhausted: false }
    minimizeCrossings(nodes, relations, { stats })
    expect(stats.exhausted).toBe(false)
  })
})

describe('runSmartLayoutELKPhase', () => {
  it('only runs the engines, one at a time, reporting each', async () => {
    const { nodes, relations } = crossedRow()
    const progress: SmartLayoutProgress[] = []
    const result = await runSmartLayoutELKPhase(nodes, relations, undefined, (p) => progress.push(p))
    if (result.done) throw new Error('expected candidates')

    expect(result.raw).toHaveLength(10)
    expect(result.raw.every((c) => !('score' in c))).toBe(true)
    expect(progress.map((p) => ('done' in p ? p.done : -1))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
