/**
 * A group of many, barely linked elements is packed as a compact block
 * (with linked elements side by side) rather than laid out in layers, and a
 * large model is scored as if it had SCALE_FROM_EDGES relations, and
 * relations squeezed through one narrow place cost (corridorCrowding).
 */
import { describe, it, expect } from 'vitest'
import { applyElkLayout } from '../src/elkLayout'
import { computeCompositeScore } from '../src/smartLayout'
import { edgeScale, pairScale, SCALE_FROM_EDGES } from '../src/scoreWeights'
import type { C4Node, C4Relation } from '@radical/common/c4'

const node = (id: string, parentId?: string, w = 200, h = 80): C4Node =>
  ({ id, type: parentId ? 'requirement' : 'group', label: id, x: 0, y: 0, width: w, height: h, ...(parentId ? { parentId } : {}) }) as C4Node
const rel = (id: string, sourceId: string, targetId: string): C4Relation => ({ id, sourceId, targetId }) as C4Relation

/** A domain of 16 requirements, the first six linked in pairs (a scenario
 *  verifying a requirement), the rest alone. */
function domain(dense = false) {
  const nodes: Record<string, C4Node> = { g: node('g', undefined, 400, 300) }
  for (let i = 0; i < 16; i++) nodes[`n${i}`] = node(`n${i}`, 'g')
  const relations: Record<string, C4Relation> = {}
  // Linked pairs far apart in the model's order: n0–n15, n1–n14, n2–n13.
  for (let i = 0; i < 3; i++) relations[`r${i}`] = rel(`r${i}`, `n${i}`, `n${15 - i}`)
  if (dense) for (let i = 0; i < 16; i++) for (const d of [1, 2]) relations[`d${i}-${d}`] = rel(`d${i}-${d}`, `n${i}`, `n${(i + d) % 16}`)
  return { nodes, relations }
}


describe('packed groups', () => {
  it('packs a group of many sparsely linked children into a compact block, linked ones side by side', async () => {
    const { nodes, relations } = domain()
    const layered = await applyElkLayout(nodes, relations)
    const packed = await applyElkLayout(nodes, relations, { packSparseGroups: true })
    const area = (p: any) => p.g.width * p.g.height
    // No larger than in layers (on radical.tools' own domains, which also
    // link outside the group, the packed blocks are a fraction of the size:
    // see bench/nestedLayout.bench.mts).
    expect(area(packed)).toBeLessThanOrEqual(area(layered))
    const aspect = packed.g.width! / packed.g.height!
    expect(aspect).toBeGreaterThan(0.8)
    expect(aspect).toBeLessThan(3)
    // Linked elements follow each other in reading order (a pair may still
    // fall across the end of a row).
    const reading = Object.keys(nodes).filter((id) => id !== 'g')
      .sort((a, b) => packed[a].y - packed[b].y || packed[a].x - packed[b].x)
    for (let i = 0; i < 3; i++) expect(Math.abs(reading.indexOf(`n${i}`) - reading.indexOf(`n${15 - i}`))).toBe(1)
    for (const id of Object.keys(nodes).filter((id) => id !== 'g')) {
      const c = packed[id], g = packed.g
      expect(c.x >= 0 && c.y >= 0 && c.x + c.width! <= g.width! + 1 && c.y + c.height! <= g.height! + 1, id).toBe(true)
    }
  })

  it('leaves a densely linked group, and a small one, to the layered layout', async () => {
    const dense = domain(true)
    expect(await applyElkLayout(dense.nodes, dense.relations, { packSparseGroups: true })).toEqual(await applyElkLayout(dense.nodes, dense.relations))
    const small: Record<string, C4Node> = { g: node('g', undefined, 400, 300) }
    for (let i = 0; i < 5; i++) small[`n${i}`] = node(`n${i}`, 'g')
    expect(await applyElkLayout(small, {}, { packSparseGroups: true })).toEqual(await applyElkLayout(small, {}))
  })
})

describe('score scaling', () => {
  it('leaves diagrams up to SCALE_FROM_EDGES relations as they were, and scores larger ones per relation', () => {
    expect(edgeScale(10)).toBe(1)
    expect(edgeScale(SCALE_FROM_EDGES)).toBe(1)
    expect(pairScale(SCALE_FROM_EDGES)).toBe(1)
    expect(edgeScale(SCALE_FROM_EDGES * 4)).toBeCloseTo(0.25)
    expect(pairScale(SCALE_FROM_EDGES * 4)).toBeCloseTo(0.0625)
  })
})

describe('corridor crowding', () => {
  // Six relations between a column on the left and one on the right: in
  // reverse order they all pass through the middle, one narrow place; in
  // the same order they run side by side, spread over the whole height.
  const box = (id: string, x: number, y: number) => [id, { id, type: 'container', label: id, x, y, width: 120, height: 60 } as C4Node]
  const left = Object.fromEntries(Array.from({ length: 6 }, (_, i) => box(`l${i}`, 0, i * 120)))
  const relations = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`r${i}`, rel(`r${i}`, `l${i}`, `t${i}`)]))
  it('counts relations squeezed through one place, not the same relations spread out', () => {
    const through = { ...left, ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => box(`t${i}`, 1200, (5 - i) * 120))) }
    const side = { ...left, ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => box(`t${i}`, 1200, i * 120))) }
    expect(computeCompositeScore(through, relations).corridorCrowding).toBeGreaterThan(5)
    expect(computeCompositeScore(side, relations).corridorCrowding).toBe(0)
  })
})
