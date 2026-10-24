/**
 * Tidy follows the conventions of each notation through the metamodel's
 * layout hints: a statechart's start on top and end at the bottom, a
 * requirements chain with the need on top, an aggregate root above its
 * parts, screens in a row, a queue between its sides, and a custom type
 * with the actor role placed as an actor.
 */
import { describe, it, expect } from 'vitest'
import { runTidyLayout } from '../../src/tidy'
import { Layout } from '../../src/tidy/layout'
import { builtInGovernanceMetamodel, type Metamodel } from '@radical/common/metamodel'
import type { C4Node, C4Relation } from '@radical/common/c4'

type Props = Record<string, string>
function node(id: string, type: string, x: number, y: number, props: Props = {}, parentId?: string): C4Node {
  const size: Record<string, [number, number]> = { person: [150, 170], database: [190, 130], queue: [220, 95], state: [180, 90], pseudostate: [40, 40], need: [220, 120], requirement: [220, 120], scenario: [220, 120], entity: [200, 120], mockup: [260, 180] }
  const [width, height] = size[type] ?? [200, 100]
  return { id, type: type as C4Node['type'], label: id, collapsed: false, x, y, width, height, ...(parentId ? { parentId } : {}), ...props } as C4Node
}
const rel = (sourceId: string, targetId: string, relationType: string): C4Relation => ({ id: `${sourceId}-${targetId}`, sourceId, targetId, relationType })
const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))

function tidy(nodes: C4Node[], relations: C4Relation[], metamodel: Metamodel | null = builtInGovernanceMetamodel()) {
  const result = runTidyLayout(byId(nodes), byId(relations), { metamodel })
  const laidOut: Record<string, C4Node> = {}
  for (const n of nodes) laidOut[n.id] = { ...n, ...(result.winner.positions[n.id] ?? {}) }
  const l = new Layout(laidOut, metamodel)
  const box = (id: string) => l.box(id)!
  const above = (a: string, b: string): boolean => box(a).y + box(a).h <= box(b).y
  const leftOf = (a: string, b: string): boolean => box(a).x + box(a).w <= box(b).x
  return { result, l, box, above, leftOf }
}

// Piled up: every element at the same place, as new elements land.
const pile = (ids: [string, string, Props?][]): C4Node[] => ids.map(([id, type, props], i) => node(id, type, (i % 3) * 30, Math.floor(i / 3) * 30, props))

describe('Tidy by the conventions of the metamodel', () => {
  it('a state machine: the start on top, the end at the bottom, transitions down', () => {
    const nodes = pile([['start', 'pseudostate', { kind: 'initial' }], ['open', 'state'], ['paid', 'state'], ['shipped', 'state'], ['done', 'state', { kind: 'final' }]])
    const relations = [rel('start', 'open', 'transition'), rel('open', 'paid', 'transition'), rel('paid', 'shipped', 'transition'), rel('shipped', 'done', 'transition')]
    const { above, l } = tidy(nodes, relations)
    expect(l.role('start')).toBe('start')
    expect(l.role('done')).toBe('end')
    for (const s of ['open', 'paid', 'shipped']) { expect(above('start', s), `start above ${s}`).toBe(true); expect(above(s, 'done'), `${s} above done`).toBe(true) }
    expect(above('open', 'paid')).toBe(true)
    expect(above('paid', 'shipped')).toBe(true)
  })

  it('a requirements chain: the need on top', () => {
    const nodes = pile([['scenario', 'scenario'], ['requirement', 'requirement'], ['need', 'need']])
    const relations = [rel('requirement', 'need', 'derives'), rel('scenario', 'requirement', 'verifies')]
    const { above, result } = tidy(nodes, relations)
    expect(above('need', 'requirement')).toBe(true)
    expect(above('requirement', 'scenario')).toBe(true)
    expect(result.tidy.after.againstFlow).toBe(0)
  })

  it('a domain: the aggregate root above its parts', () => {
    const nodes = pile([['line', 'entity'], ['order', 'entity'], ['payment', 'entity'], ['customer', 'entity']])
    const relations = [rel('line', 'order', 'part-of'), rel('payment', 'order', 'part-of'), rel('order', 'customer', 'references')]
    const { above, box } = tidy(nodes, relations)
    expect(above('order', 'line')).toBe(true)
    expect(above('order', 'payment')).toBe(true)
    // Referenced: beside, not below.
    expect(Math.abs(box('customer').cy - box('order').cy)).toBeLessThan(2)
  })

  it('a screen flow: screens in a row, left to right', () => {
    const nodes = pile([['checkout', 'mockup'], ['cart', 'mockup'], ['home', 'mockup']])
    const relations = [rel('home', 'cart', 'navigates-to'), rel('cart', 'checkout', 'navigates-to')]
    const { leftOf, box } = tidy(nodes, relations)
    expect(leftOf('home', 'cart')).toBe(true)
    expect(leftOf('cart', 'checkout')).toBe(true)
    expect(Math.abs(box('home').cy - box('cart').cy)).toBeLessThan(2)
    expect(Math.abs(box('cart').cy - box('checkout').cy)).toBeLessThan(2)
  })

  it('a queue between producer and consumer', () => {
    const nodes = [node('orders', 'container', 0, 0, {}, 'shop'), node('events', 'queue', 900, 500, {}, 'shop'), node('billing', 'container', 0, 600, {}, 'shop'), { ...node('shop', 'system', 0, 0), width: 400, height: 300 }]
    const relations = [rel('orders', 'events', 'interacts'), rel('events', 'billing', 'interacts')]
    const { box, result } = tidy(nodes, relations)
    expect(result.tidy.after.misplaced).toBe(0)
    const o = box('orders'), e = box('events'), b = box('billing')
    expect(e.cy).toBeGreaterThan(o.cy)
    expect(e.cy).toBeLessThan(b.cy)
    expect(Math.abs(e.cx - o.cx)).toBeLessThan(2)
  })

  it('a custom type with the actor role', () => {
    const mm = builtInGovernanceMetamodel()
    mm.nodeTypes.robot = { ...mm.nodeTypes.system, id: 'robot', label: 'Robot', builtin: false, layout: { role: 'actor' } }
    mm.relationTypes.interacts.allowedPairs = []
    const nodes = pile([['api', 'container'], ['bot', 'robot']])
    const relations = [rel('bot', 'api', 'interacts')]
    const { above, l } = tidy(nodes, relations, mm)
    expect(l.role('bot')).toBe('actor')
    expect(above('bot', 'api')).toBe(true)
  })
})
