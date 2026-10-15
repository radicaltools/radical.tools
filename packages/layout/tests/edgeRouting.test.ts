import { describe, it, expect } from 'vitest'
import { computeRoutedEdge, directCurveBox, ObstacleGrid, type RoutingObstacle } from '../src/edgeRouting'
import { Position } from '../src/side'

/** Small deterministic PRNG so the scenes are the same on every run. */
function rng(seed: number): () => number {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

describe('directCurveBox', () => {
  it('routes exactly as with every obstacle when only those in the box are tested', () => {
    const random = rng(7)
    const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]
    for (let scene = 0; scene < 200; scene++) {
      const obstacles: RoutingObstacle[] = Array.from({ length: 60 }, () => ({
        x: random() * 3000, y: random() * 2000, w: 80 + random() * 160, h: 50 + random() * 100,
      }))
      const [sx, sy, tx, ty] = [random() * 3000, random() * 2000, random() * 3000, random() * 2000]
      const [ss, ts] = [sides[Math.floor(random() * 4)], sides[Math.floor(random() * 4)]]
      const box = directCurveBox(sx, sy, ss, tx, ty, ts)
      const near = obstacles.filter((o) => !(o.x > box.maxX || o.x + o.w < box.minX || o.y > box.maxY || o.y + o.h < box.minY))
      expect(computeRoutedEdge(sx, sy, ss, tx, ty, ts, near, () => obstacles))
        .toEqual(computeRoutedEdge(sx, sy, ss, tx, ty, ts, obstacles))
    }
  })
})

describe('ObstacleGrid', () => {
  it('routes exactly as with the full obstacle list, exclusions included', () => {
    const random = rng(11)
    const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]
    for (let scene = 0; scene < 300; scene++) {
      // Small scenes route around nodes; large ones exceed routeAround's grid.
      const extent = scene % 3 === 0 ? 8000 : 2000
      const items = Array.from({ length: 80 }, (_, i) => ({
        id: i, rect: { x: random() * extent * 1.5, y: random() * extent, w: 80 + random() * 160, h: 50 + random() * 100 },
      }))
      const skip = new Set([Math.floor(random() * 80), Math.floor(random() * 80)])
      const [sx, sy, tx, ty] = [random() * extent * 1.5, random() * extent, random() * extent * 1.5, random() * extent]
      const [ss, ts] = [sides[Math.floor(random() * 4)], sides[Math.floor(random() * 4)]]
      const grid = new ObstacleGrid(items)
      expect(computeRoutedEdge(sx, sy, ss, tx, ty, ts, grid.without((item) => skip.has(item.id))))
        .toEqual(computeRoutedEdge(sx, sy, ss, tx, ty, ts, items.filter((item) => !skip.has(item.id)).map((item) => item.rect)))
    }
  })
})

describe('edge styles', () => {
  // A wall between two nodes facing each other across it.
  const wall = [{ x: 180, y: 60, w: 140, h: 160 }]
  const axisAligned = (pts: { x: number; y: number }[]) =>
    pts.slice(1).every((p, i) => Math.abs(p.x - pts[i].x) < 0.01 || Math.abs(p.y - pts[i].y) < 0.01)
  const inside = (p: { x: number; y: number }, o: { x: number; y: number; w: number; h: number }) => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h

  it('orthogonal: horizontal and vertical segments, a straight line between aligned sides', () => {
    const z = computeRoutedEdge(0, 0, Position.Bottom, 300, 400, Position.Top, [], undefined, 'orthogonal')
    expect(axisAligned(z.points)).toBe(true)
    expect(z.points.length).toBeGreaterThan(2)
    const straight = computeRoutedEdge(100, 0, Position.Bottom, 100, 400, Position.Top, [], undefined, 'orthogonal')
    expect(straight.points).toHaveLength(2)
    const l = computeRoutedEdge(0, 0, Position.Right, 300, 300, Position.Top, [], undefined, 'orthogonal')
    expect(axisAligned(l.points)).toBe(true)
  })

  it('orthogonal: around a node in the way, still only horizontal and vertical', () => {
    const r = computeRoutedEdge(100, 140, Position.Right, 400, 140, Position.Left, wall, undefined, 'orthogonal')
    expect(axisAligned(r.points)).toBe(true)
    expect(r.points.some((p) => inside(p, wall[0]))).toBe(false)
  })

  it('curved: around a node in the way, a smooth curve, not right angles', () => {
    const r = computeRoutedEdge(100, 140, Position.Right, 400, 140, Position.Left, wall, undefined, 'curved')
    // Cubic segments only: no straight runs, no rounded right-angle corners.
    expect(r.path).toMatch(/^M[^LQ]*$/)
    expect(r.path).toContain('C')
    expect(r.points[0]).toEqual({ x: 100, y: 140 })
    expect(r.points[r.points.length - 1]).toEqual({ x: 400, y: 140 })
    expect(r.points.some((p) => inside(p, wall[0]))).toBe(false)
  })

  it('curved is the default and draws the direct curve when nothing is in the way', () => {
    const byDefault = computeRoutedEdge(0, 0, Position.Bottom, 300, 400, Position.Top, [])
    expect(byDefault.path).toMatch(/^M[\d.,-]+C/)
    expect(computeRoutedEdge(0, 0, Position.Bottom, 300, 400, Position.Top, [], undefined, 'curved')).toEqual(byDefault)
  })
})

describe('curved ends', () => {
  const cross = (a: Pt2, b: Pt2, c: Pt2, d: Pt2) => {
    const o = (p: Pt2, q: Pt2, r: Pt2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  type Pt2 = { x: number; y: number }
  /** Samples moving away from `end` while within 120 px of it, walking towards it. */
  const awaySteps = (pts: Pt2[], end: Pt2) => {
    let bad = 0, prev = Infinity
    for (const p of pts) { const d = Math.hypot(p.x - end.x, p.y - end.y); if (d < 120 && d > prev + 0.5) bad++; prev = d }
    return bad
  }

  it('a curve around a node leaves and enters its sides without a hook', () => {
    // The target's side faces the source, but a block makes the route come
    // in from below: the curve used to go out past the route and back.
    const r = computeRoutedEdge(700, 260, Position.Left, 300, 120, Position.Right, [{ x: 380, y: 60, w: 200, h: 180 }], undefined, 'curved')
    expect(awaySteps([...r.points].reverse(), { x: 700, y: 260 })).toBe(0)
    expect(awaySteps(r.points, { x: 300, y: 120 })).toBe(0)
  })

  it('a curve around nodes never crosses itself', () => {
    const random = rng(11)
    const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]
    let routed = 0
    for (let i = 0; i < 300; i++) {
      const obstacles = Array.from({ length: 4 }, () => ({ x: random() * 800, y: random() * 600, w: 80 + random() * 160, h: 60 + random() * 120 }))
      const s = { x: random() * 900, y: random() * 700 }, t = { x: random() * 900, y: random() * 700 }
      const sSide = sides[Math.floor(random() * 4)], tSide = sides[Math.floor(random() * 4)]
      if (obstacles.some((o) => [s, t].some((p) => p.x > o.x - 30 && p.x < o.x + o.w + 30 && p.y > o.y - 30 && p.y < o.y + o.h + 30))) continue
      const pts = computeRoutedEdge(s.x, s.y, sSide, t.x, t.y, tSide, obstacles, undefined, 'curved').points
      if (pts.length <= 25) continue
      routed++
      for (let a = 1; a < pts.length; a++) for (let b = a + 2; b < pts.length; b++) expect(cross(pts[a - 1], pts[a], pts[b - 1], pts[b])).toBe(false)
    }
    expect(routed).toBeGreaterThan(20)
  })
})
