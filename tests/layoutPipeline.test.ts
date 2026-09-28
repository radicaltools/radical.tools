/**
 * Layout pipeline plumbing shared by every layout engine: what graph the
 * engines see (visible projection) and how a raw layout is turned into the
 * one that gets rendered (finalizeLayout).
 */
import { describe, it, expect } from 'vitest'
import { projectToVisibleGraph } from '../src/renderer/src/layout/geometry'
import { finalizeLayout, separateBoxes, ROOT_GAP } from '../src/renderer/src/layout/layoutFinalize'
import { applyElkLayout } from '../src/renderer/src/layout/elkLayout'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, type C4Node, type C4Relation } from '../src/renderer/src/types/c4'

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
