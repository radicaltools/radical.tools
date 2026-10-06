import { describe, it, expect } from 'vitest'
import { computeRoutedEdge, directCurveBox, type RoutingObstacle } from '../src/edgeRouting'
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
