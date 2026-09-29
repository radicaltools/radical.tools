/**
 * The annealing engine behind Smart Layout's refinement phases.
 *
 * Guards the three properties the refinement relies on: the incremental
 * energy is exact (a drifting delta silently steers the search wrong), the
 * annealer never creates overlapping siblings, and a seed fully determines
 * the outcome.
 */
import { describe, it, expect } from 'vitest'
import {
  anneal, buildLayoutGraph, createRng, graphSeed, ProxyEnergy, type LayoutGraph,
} from '../src/annealing'
import type { C4Node, C4Relation } from '@radical/common/c4'

function node(id: string, x: number, y: number, w = 200, h = 100, parentId?: string): C4Node {
  return { id, type: parentId ? 'container' : 'system', label: id, x, y, width: w, height: h, collapsed: false, parentId }
}

/** Twelve roots (some with children) wired pseudo-randomly and scattered so they cross and overlap. */
function scatteredGraph(seed: number): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const rng = createRng(seed)
  const nodes: Record<string, C4Node> = {}
  const leaves: string[] = []
  for (let i = 0; i < 12; i++) {
    nodes[`s${i}`] = node(`s${i}`, rng() * 1600, rng() * 1000, 360, 260)
    if (i % 3 === 0) {
      for (let j = 0; j < 2; j++) {
        const id = `s${i}c${j}`
        nodes[id] = node(id, 20 + j * 160, 120, 140, 80, `s${i}`)
        leaves.push(id)
      }
    } else {
      leaves.push(`s${i}`)
    }
  }
  const relations: Record<string, C4Relation> = {}
  for (let k = 0; k < 24; k++) {
    const s = leaves[Math.floor(rng() * leaves.length)]
    const t = leaves[Math.floor(rng() * leaves.length)]
    if (s !== t) relations[`r${k}`] = { id: `r${k}`, sourceId: s, targetId: t }
  }
  return { nodes, relations }
}

function roots(g: LayoutGraph): number[] {
  return Array.from({ length: g.n }, (_, i) => i).filter((i) => g.parent[i] === -1)
}

describe('ProxyEnergy', () => {
  it('keeps its incremental totals equal to a full recount', () => {
    const { nodes, relations } = scatteredGraph(3)
    const g = buildLayoutGraph(nodes, relations)
    const ev = new ProxyEnergy(g)
    const rng = createRng(11)
    const rootIdx = roots(g)
    for (let i = 0; i < 500; i++) {
      const a = rootIdx[Math.floor(rng() * rootIdx.length)]
      const b = rootIdx[Math.floor(rng() * rootIdx.length)]
      const moves = [{ node: a, dx: (rng() - 0.5) * 400, dy: (rng() - 0.5) * 400 }]
      if (a !== b && rng() < 0.3) moves.push({ node: b, dx: (rng() - 0.5) * 400, dy: (rng() - 0.5) * 400 })
      ev.apply(moves)
      if (rng() < 0.5) ev.commit()
      else ev.revert()

      const incremental = ev.energy()
      ev.recomputeTotals()
      expect(ev.energy()).toBeCloseTo(incremental, 6)
    }
  })
})

describe('anneal', () => {
  const GAP = 40

  function siblingsOverlap(g: LayoutGraph, group: number[]): boolean {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const i = group[a], j = group[b]
        const ox = Math.min(g.relX[i] + g.w[i], g.relX[j] + g.w[j]) - Math.max(g.relX[i], g.relX[j]) + GAP
        const oy = Math.min(g.relY[i] + g.h[i], g.relY[j] + g.h[j]) - Math.max(g.relY[i], g.relY[j]) + GAP
        if (ox > 1e-6 && oy > 1e-6) return true
      }
    }
    return false
  }

  function run(seed: number): { g: LayoutGraph; group: number[]; before: number; after: number } {
    // A clean grid (no overlaps) with crossing wiring — plenty to improve.
    const { nodes, relations } = scatteredGraph(5)
    Object.values(nodes).filter((n) => !n.parentId).forEach((n, i) => {
      n.x = (i % 4) * 500
      n.y = Math.floor(i / 4) * 400
    })
    const g = buildLayoutGraph(nodes, relations)
    const group = roots(g)
    const res = anneal(new ProxyEnergy(g), g, group, {
      rng: createRng(seed), restarts: 3, sweeps: 40,
      stepFactor: 0.06, tempFactor: 1, calibrationSamples: 16,
      gap: GAP, deadline: Infinity,
    })
    return { g, group, before: res.before, after: res.after }
  }

  it('lowers the energy without ever creating overlapping siblings', () => {
    const { g, group, before, after } = run(1)
    expect(after).toBeLessThan(before)
    expect(siblingsOverlap(g, group)).toBe(false)
  })

  it('is fully determined by its seed', () => {
    const a = run(7)
    const b = run(7)
    expect(Array.from(a.g.relX)).toEqual(Array.from(b.g.relX))
    expect(Array.from(a.g.relY)).toEqual(Array.from(b.g.relY))
    expect(a.after).toBe(b.after)
  })
})

describe('graphSeed', () => {
  it('depends on structure, not on object key order or positions', () => {
    const { nodes, relations } = scatteredGraph(2)
    const reordered = Object.fromEntries(Object.entries(nodes).reverse().map(([id, n]) => [id, { ...n, x: n.x + 99 }]))
    expect(graphSeed(reordered, relations)).toBe(graphSeed(nodes, relations))
    const { r0: _dropped, ...fewer } = relations
    expect(graphSeed(nodes, fewer)).not.toBe(graphSeed(nodes, relations))
  })
})
