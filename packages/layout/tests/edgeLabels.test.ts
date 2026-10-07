import { describe, it, expect } from 'vitest'
import { estimateLabelSize, labelOverlaps, placeEdgeLabels, type LabelEdge } from '../src/edgeLabels'
import { computeRoutedEdge, type RoutingObstacle } from '../src/edgeRouting'
import { Position } from '../src/side'

const STYLE = { maxWidth: 200, padX: 8, padY: 3, border: 1, lineHeight: 1.4 }

function straight(id: string, x1: number, y1: number, x2: number, y2: number, w = 120, h = 30): LabelEdge {
  return { id, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], anchor: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, size: { w, h } }
}

describe('estimateLabelSize', () => {
  it('wraps long text at the box width and stacks the lines', () => {
    const short = estimateLabelSize([{ text: 'Reads', fontSize: 17 }], STYLE)
    const long = estimateLabelSize([{ text: 'Reads and writes the customer accounts and their history', fontSize: 17 }], STYLE)
    const withTech = estimateLabelSize([{ text: 'Reads', fontSize: 17 }, { text: '[JDBC]', fontSize: 14 }], STYLE)
    expect(short.w).toBeLessThan(100)
    expect(long.w).toBeLessThanOrEqual(200)
    expect(long.h).toBeGreaterThan(2 * short.h)
    expect(withTech.h).toBeCloseTo(short.h + 14 * 1.4)
  })
})

describe('placeEdgeLabels', () => {
  it('keeps the anchor when the middle is free', () => {
    const edges = [straight('a', 0, 0, 400, 0), straight('b', 0, 300, 400, 300)]
    const placed = placeEdgeLabels(edges, [])
    expect(placed.get('a')).toEqual({ x: 200, y: 0 })
    expect(placed.get('b')).toEqual({ x: 200, y: 300 })
  })

  it('separates the labels of parallel edges', () => {
    // Two edges 12px apart: the middles' labels would cover each other.
    const edges = [straight('a', 0, 0, 400, 0), straight('b', 0, 12, 400, 12)]
    const placed = placeEdgeLabels(edges, [])
    expect(labelOverlaps(edges, new Map(), []).labelLabel).toBe(1)
    expect(labelOverlaps(edges, placed, []).labelLabel).toBe(0)
  })

  it('moves a label off a node the path passes next to', () => {
    // A vertical edge whose middle runs past a node's corner.
    const node: RoutingObstacle = { x: -150, y: 180, w: 160, h: 60 }
    const edges = [straight('a', 0, 0, 0, 400)]
    const placed = placeEdgeLabels(edges, [node])
    expect(labelOverlaps(edges, new Map(), [node]).labelNode).toBe(1)
    expect(labelOverlaps(edges, placed, [node]).labelNode).toBe(0)
  })

  it('covers the body of a node rather than its name when it must cover one', () => {
    // A short edge between two nodes stacked 20px apart: no free spot.
    const top: RoutingObstacle = { x: 0, y: 0, w: 200, h: 100 }
    const bottom: RoutingObstacle = { x: 0, y: 120, w: 200, h: 100 }
    const header = { ...bottom, h: 40, weight: 4 }
    const edges = [straight('a', 100, 100, 100, 120, 150, 50)]
    const centre = placeEdgeLabels(edges, [top, bottom, header]).get('a')!
    expect(centre.y).toBeLessThan(110)
  })

  it('separates the labels of edges crossing in the middle', () => {
    const edges = [straight('a', 0, 0, 400, 400), straight('b', 400, 0, 0, 400)]
    const placed = placeEdgeLabels(edges, [])
    expect(labelOverlaps(edges, placed, []).labelLabel).toBe(0)
  })

  it('is deterministic and reduces overlaps on a dense random scene', () => {
    let seed = 5
    const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    const nodes: RoutingObstacle[] = []
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) nodes.push({ x: c * 320, y: r * 260, w: 200, h: 120 })
    const sides = [Position.Bottom, Position.Top]
    const edges: LabelEdge[] = []
    for (let i = 0; i < 40; i++) {
      const s = nodes[Math.floor(random() * nodes.length)]
      const t = nodes[Math.floor(random() * nodes.length)]
      if (s === t) continue
      const down = t.y >= s.y
      const r = computeRoutedEdge(s.x + s.w / 2, down ? s.y + s.h : s.y, sides[down ? 0 : 1],
        t.x + t.w / 2, down ? t.y : t.y + t.h, sides[down ? 1 : 0], [])
      edges.push({ id: `e${i}`, points: r.points, anchor: { x: r.labelX, y: r.labelY }, size: { w: 60 + random() * 140, h: 30 } })
    }
    const placed = placeEdgeLabels(edges, nodes)
    expect(placeEdgeLabels(edges, nodes)).toEqual(placed)
    const before = labelOverlaps(edges, new Map(), nodes)
    const after = labelOverlaps(edges, placed, nodes)
    expect(after.labelLabel + after.labelNode).toBeLessThan((before.labelLabel + before.labelNode) / 2)
  })
})

describe('computeRoutedEdge points', () => {
  it('runs from source to target through the default label centre', () => {
    const r = computeRoutedEdge(0, 0, Position.Bottom, 300, 400, Position.Top, [])
    expect(r.points[0]).toEqual({ x: 0, y: 0 })
    expect(r.points[r.points.length - 1]).toEqual({ x: 300, y: 400 })
    expect(r.points).toContainEqual({ x: r.labelX, y: r.labelY })
  })
})
