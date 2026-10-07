import { describe, it, expect } from 'vitest'
import { NODE_SIZES, type C4Node, type C4Relation, type LayoutConstraint, type PositionMap } from '@radical/common/c4'
import { alignmentError, enforceAlignments, resolveAlignments } from '../src/constraints'
import { runSmartLayoutCore } from '../src/smartLayout'

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...extra }) as C4Node

const byId = (...nodes: C4Node[]): Record<string, C4Node> => Object.fromEntries(nodes.map((n) => [n.id, n]))

const align = (axis: LayoutConstraint['axis'], ...nodeIds: string[]): LayoutConstraint =>
  ({ id: nodeIds.join('+'), type: 'align', axis, nodeIds })

const ordered = (axis: LayoutConstraint['axis'], ...nodeIds: string[]): LayoutConstraint =>
  ({ ...align(axis, ...nodeIds), ordered: true })

/** Drawn centres of `ids` along x, root nodes only. */
const xs = (nodes: Record<string, C4Node>, positions: PositionMap, ids: string[]): number[] =>
  ids.map((id) => positions[id].x + (positions[id].width ?? nodes[id].width) / 2)

/** Absolute boxes, so cross-parent results can be checked directly. */
function absolute(nodes: Record<string, C4Node>, positions: PositionMap): Record<string, { x: number; y: number; width: number; height: number }> {
  const out: Record<string, { x: number; y: number; width: number; height: number }> = {}
  const abs = (id: string): { x: number; y: number } => {
    const p = positions[id]
    const parent = nodes[id].parentId
    if (!parent || !nodes[parent]) return { x: p.x, y: p.y }
    const a = abs(parent)
    return { x: a.x + p.x, y: a.y + p.y }
  }
  for (const id of Object.keys(nodes)) out[id] = { ...abs(id), width: positions[id].width!, height: positions[id].height! }
  return out
}

function overlapping(boxes: Array<{ x: number; y: number; width: number; height: number }>): boolean {
  return boxes.some((a, i) => boxes.slice(i + 1).some((b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height))
}

describe('resolveAlignments', () => {
  it('maps rows to a shared y and columns to a shared x', () => {
    const nodes = byId(node('a', 'person'), node('b', 'system'), node('c', 'system'))
    expect(resolveAlignments([align('horizontal', 'a', 'b'), align('vertical', 'b', 'c')], nodes)).toEqual([
      { axis: 'x', ids: ['b', 'c'], orders: [] },
      { axis: 'y', ids: ['a', 'b'], orders: [] },
    ])
  })

  it('merges rules on one axis that share a member', () => {
    const nodes = byId(node('a', 'system'), node('b', 'system'), node('c', 'system'), node('d', 'system'))
    expect(resolveAlignments([align('horizontal', 'a', 'b'), align('horizontal', 'c', 'b'), align('horizontal', 'd', 'a')], nodes))
      .toEqual([{ axis: 'y', ids: ['a', 'b', 'c', 'd'], orders: [] }])
  })

  it('skips hidden members and rests a rule left with one', () => {
    const nodes = byId(
      node('sys', 'system', { collapsed: true }),
      node('api', 'container', { parentId: 'sys' }),
      node('db', 'database', { parentId: 'sys' }),
      node('ext', 'system'),
      node('user', 'person'),
    )
    expect(resolveAlignments([align('horizontal', 'api', 'ext'), align('vertical', 'api', 'db', 'ext', 'user')], nodes))
      .toEqual([{ axis: 'x', ids: ['ext', 'user'], orders: [] }])
  })

  it('skips a member that contains another member', () => {
    const nodes = byId(node('sys', 'system'), node('api', 'container', { parentId: 'sys' }), node('ext', 'system'))
    expect(resolveAlignments([align('horizontal', 'sys', 'api', 'ext')], nodes)).toEqual([{ axis: 'y', ids: ['api', 'ext'], orders: [] }])
  })
})

describe('enforceAlignments', () => {
  it('returns the input untouched without alignments', () => {
    const positions: PositionMap = { a: { x: 1, y: 2 } }
    expect(enforceAlignments(byId(node('a', 'system')), positions, [])).toBe(positions)
  })

  it('puts root nodes in a row on their mean centre line', () => {
    const nodes = byId(
      node('a', 'system', { x: 0, y: 0 }),
      node('b', 'system', { x: 600, y: 300 }),
      node('c', 'system', { x: 1200, y: 600 }),
    )
    const alignments = resolveAlignments([align('horizontal', 'a', 'b', 'c')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    expect(out.b.y).toBeCloseTo(300)
    expect(out.a.x).toBe(0)
    expect(out.c.x).toBe(1200)
  })

  it('pushes stacked members apart along their row instead of off it', () => {
    // One on top of the other: a free separation would push them apart
    // vertically, out of the row.
    const nodes = byId(node('a', 'system', { x: 0, y: 0 }), node('b', 'system', { x: 30, y: 200 }))
    const alignments = resolveAlignments([align('horizontal', 'a', 'b')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    expect(overlapping([out.a, out.b] as never)).toBe(false)
  })

  it('moves a row together when it collides with another node', () => {
    const nodes = byId(
      node('a', 'container', { x: 0, y: 0 }),
      node('b', 'container', { x: 600, y: 0 }),
      node('x', 'container', { x: 300, y: 60 }),
    )
    const alignments = resolveAlignments([align('horizontal', 'a', 'b')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    expect(overlapping([out.a, out.b, out.x] as never)).toBe(false)
  })

  it('aligns elements in different parents on the canvas and keeps children inside', () => {
    const nodes = byId(
      node('s1', 'system', { x: 0, y: 0, width: 400, height: 400 }),
      node('api', 'container', { parentId: 's1', x: 30, y: 120 }),
      node('s2', 'system', { x: 800, y: 0, width: 400, height: 900 }),
      node('db', 'database', { parentId: 's2', x: 30, y: 600 }),
    )
    const alignments = resolveAlignments([align('horizontal', 'api', 'db')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    const abs = absolute(nodes, out)
    for (const [child, parent] of [['api', 's1'], ['db', 's2']]) {
      expect(abs[child].x).toBeGreaterThanOrEqual(abs[parent].x)
      expect(abs[child].y).toBeGreaterThanOrEqual(abs[parent].y)
      expect(abs[child].x + abs[child].width).toBeLessThanOrEqual(abs[parent].x + abs[parent].width)
      expect(abs[child].y + abs[child].height).toBeLessThanOrEqual(abs[parent].y + abs[parent].height)
    }
    expect(overlapping([abs.s1, abs.s2])).toBe(false)
  })

  it('aligns expanded containers by their boxes', () => {
    const nodes = byId(
      node('s1', 'system', { x: 0, y: 0 }),
      node('a', 'container', { parentId: 's1', x: 30, y: 120 }),
      node('s2', 'system', { x: 900, y: 500 }),
      node('b', 'container', { parentId: 's2', x: 30, y: 120 }),
    )
    const alignments = resolveAlignments([align('vertical', 's1', 's2')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    expect(overlapping([out.s1, out.s2] as never)).toBe(false)
  })

  it('holds a row and a column through one member', () => {
    const nodes = byId(
      node('a', 'system', { x: 0, y: 0 }),
      node('b', 'system', { x: 700, y: 150 }),
      node('c', 'system', { x: 100, y: 700 }),
    )
    const alignments = resolveAlignments([align('horizontal', 'a', 'b'), align('vertical', 'a', 'c')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    expect(overlapping([out.a, out.b, out.c] as never)).toBe(false)
  })
})

describe('ordered alignments', () => {
  it('resolve to chains of drawn members, in order', () => {
    const nodes = byId(
      node('sys', 'system', { collapsed: true }),
      node('api', 'container', { parentId: 'sys' }),
      node('a', 'system'), node('b', 'system'), node('c', 'system'),
    )
    expect(resolveAlignments([ordered('horizontal', 'c', 'api', 'a'), align('horizontal', 'a', 'b')], nodes))
      .toEqual([{ axis: 'y', ids: ['c', 'a', 'b'], orders: [['c', 'a']] }])
  })

  it('give members swapped by a layout their places back, in order', () => {
    const nodes = byId(
      node('a', 'system', { x: 1200, y: 0 }),
      node('b', 'system', { x: 600, y: 300 }),
      node('c', 'system', { x: 0, y: 600 }),
    )
    const alignments = resolveAlignments([ordered('horizontal', 'a', 'b', 'c')], nodes)
    expect(alignmentError(nodes, {}, alignments)).toBeGreaterThan(100)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    const [a, b, c] = xs(nodes, out, ['a', 'b', 'c'])
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
    expect(overlapping([out.a, out.b, out.c] as never)).toBe(false)
  })

  it('separate stacked members without swapping them', () => {
    // b sits on a, a hair to its left: the order asks for a first.
    const nodes = byId(node('a', 'system', { x: 10, y: 0 }), node('b', 'system', { x: 0, y: 40 }))
    const alignments = resolveAlignments([ordered('horizontal', 'a', 'b')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
    const [a, b] = xs(nodes, out, ['a', 'b'])
    expect(a).toBeLessThan(b)
    expect(overlapping([out.a, out.b] as never)).toBe(false)
  })

  it('order a column top to bottom across parents', () => {
    const nodes = byId(
      node('s1', 'system', { x: 0, y: 900, width: 400, height: 400 }),
      node('api', 'container', { parentId: 's1', x: 30, y: 120 }),
      node('db', 'database', { x: 900, y: 0 }),
    )
    const alignments = resolveAlignments([ordered('vertical', 'api', 'db')], nodes)
    const out = enforceAlignments(nodes, {}, alignments)
    expect(alignmentError(nodes, out, alignments)).toBeLessThanOrEqual(0.5)
  })
})

describe('Smart Layout with alignments', () => {
  it('returns a layout that keeps them', async () => {
    const nodes = byId(
      node('user', 'person', { x: 0, y: 0 }),
      node('web', 'system', { x: 300, y: 0 }),
      node('api', 'system', { x: 600, y: 0 }),
      node('db', 'system', { x: 900, y: 0 }),
      node('mail', 'system', { x: 1200, y: 0, external: true }),
    )
    const rel = (id: string, sourceId: string, targetId: string): C4Relation => ({ id, sourceId, targetId })
    const relations = Object.fromEntries([
      rel('r1', 'user', 'web'), rel('r2', 'web', 'api'), rel('r3', 'api', 'db'), rel('r4', 'api', 'mail'),
    ].map((r) => [r.id, r]))
    const alignments = resolveAlignments([align('horizontal', 'user', 'db', 'mail'), align('vertical', 'web', 'api')], nodes)
    const result = await runSmartLayoutCore(nodes, relations, undefined, undefined, { alignments })
    expect(result.keptCurrent).toBe(false)
    expect(alignmentError(nodes, result.winner.positions, alignments)).toBeLessThanOrEqual(0.5)
    for (const c of result.candidates) expect(alignmentError(nodes, c.positions, alignments)).toBeLessThanOrEqual(0.5)
  }, 60_000)

  it('never swaps an ordered row', async () => {
    // The relations pull the row into the reverse order.
    const nodes = byId(
      node('a', 'system', { x: 0, y: 0 }), node('b', 'system', { x: 400, y: 0 }), node('c', 'system', { x: 800, y: 0 }),
      node('hub', 'system', { x: 400, y: 400 }),
    )
    const rel = (id: string, sourceId: string, targetId: string): C4Relation => ({ id, sourceId, targetId })
    const relations = Object.fromEntries([rel('r1', 'c', 'hub'), rel('r2', 'hub', 'a'), rel('r3', 'b', 'hub')].map((r) => [r.id, r]))
    const alignments = resolveAlignments([ordered('horizontal', 'c', 'b', 'a')], nodes)
    const result = await runSmartLayoutCore(nodes, relations, undefined, undefined, { alignments })
    for (const cand of [result.winner, ...result.candidates]) {
      expect(alignmentError(nodes, cand.positions, alignments)).toBeLessThanOrEqual(0.5)
    }
  }, 60_000)
})
