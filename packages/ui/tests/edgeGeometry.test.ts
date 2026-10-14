import { describe, it, expect, vi, beforeEach } from 'vitest'

const placed = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@radical/layout/edgeLabels', async (load) => {
  const actual = await load<typeof import('@radical/layout/edgeLabels')>()
  return { ...actual, placeEdgeLabels: (...args: Parameters<typeof actual.placeEdgeLabels>) => { placed.calls++; return actual.placeEdgeLabels(...args) } }
})

import { edgeGeometry } from '../src/components/edges/edgeGeometry'

type Box = { x: number; y: number; w?: number; h?: number }
// React Flow's node internals as edgeGeometry reads them, made fresh on each
// call as React Flow does while a view opens.
const internals = (boxes: Record<string, Box>) => new Map(Object.entries(boxes).map(([id, b]) => [id, {
  id, type: 'c4', data: {}, position: { x: b.x, y: b.y }, positionAbsolute: { x: b.x, y: b.y }, width: b.w ?? 160, height: b.h ?? 80,
}])) as any
const edges = [
  { id: 'e1', source: 'a', target: 'b', data: { label: 'reads orders from' } },
  { id: 'e2', source: 'b', target: 'c', data: { label: 'writes to' } },
] as any
const layout = { a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, c: { x: 400, y: 300 } }

describe('edgeGeometry', () => {
  beforeEach(() => { placed.calls = 0 })

  it('places the labels once while new state objects bring nothing new, and again when a node moves', () => {
    const first = edgeGeometry(internals(layout), edges, false)
    expect(placed.calls).toBe(1)
    const again = edgeGeometry(internals(layout), [...edges], false)
    expect(placed.calls).toBe(1)
    expect(again.get('e1')!.label).toEqual(first.get('e1')!.label)
    edgeGeometry(internals({ ...layout, c: { x: 900, y: 600 } }), edges, false)
    expect(placed.calls).toBe(2)
  })

  it('places them again when a label changes size', () => {
    edgeGeometry(internals(layout), edges, false)
    const before = placed.calls
    const renamed = [edges[0], { ...edges[1], data: { label: 'writes every order and its lines to' } }]
    edgeGeometry(internals(layout), renamed, false)
    expect(placed.calls).toBe(before + 1)
  })

  it('leaves labels at the middle of their path while they are not shown, and places them when they are', () => {
    const nodes = internals({ ...layout, d: { x: 0, y: 600 } })
    const hidden = edgeGeometry(nodes, edges, false, false)
    expect(placed.calls).toBe(0)
    const shown = edgeGeometry(nodes, edges, false, true)
    expect(placed.calls).toBe(1)
    expect(hidden.get('e1')!.path).toBe(shown.get('e1')!.path)
    // Zooming out and in again: the placement is kept.
    edgeGeometry(nodes, edges, false, false)
    edgeGeometry(nodes, edges, false, true)
    expect(placed.calls).toBe(1)
  })
})
