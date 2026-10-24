/**
 * The finer points of tidying: pinned elements stay, rows are spaced
 * evenly, two moves are taken where one alone would not do, lines are
 * judged between the ports Studio draws them from, labels get room, loose
 * elements gather by type, frames are no larger than their children need,
 * and a row is put in the order of what it relates to.
 */
import { describe, it, expect } from 'vitest'
import { runTidyLayout } from '../../src/tidy'
import { Layout } from '../../src/tidy/layout'
import { buildIndex, linesOf, totalCost } from '../../src/tidy/cost'
import { builtInGovernanceMetamodel, type Metamodel } from '@radical/common/metamodel'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, type C4Node, type C4Relation } from '@radical/common/c4'
import { compoundPadding } from '../../src/geometry'

function node(id: string, type: string, x: number, y: number, parentId?: string, extra: Partial<C4Node> = {}): C4Node {
  return { id, type: type as C4Node['type'], label: id, collapsed: false, x, y, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...(parentId ? { parentId } : {}), ...extra } as C4Node
}
const rel = (sourceId: string, targetId: string, label?: string): C4Relation => ({ id: `${sourceId}-${targetId}`, sourceId, targetId, relationType: 'interacts', ...(label ? { label } : {}) })
const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))

function tidy(nodes: C4Node[], relations: C4Relation[], options: { pinned?: string[]; metamodel?: Metamodel | null } = {}) {
  const mm = options.metamodel === undefined ? builtInGovernanceMetamodel() : options.metamodel
  const result = runTidyLayout(byId(nodes), byId(relations), { metamodel: mm, pinned: options.pinned })
  const laidOut: Record<string, C4Node> = {}
  for (const n of nodes) laidOut[n.id] = { ...n, ...(result.winner.positions[n.id] ?? {}) }
  const l = new Layout(laidOut, mm)
  const box = (id: string) => l.box(id)!
  return { result, l, box, laidOut }
}

describe('Tidy, the finer points', () => {
  it('pinned elements stay where they are', () => {
    const nodes = [node('a', 'system', 100, 100), node('b', 'system', 110, 110), node('c', 'system', 120, 120), node('d', 'system', 130, 130)]
    const relations = [rel('a', 'b'), rel('c', 'd')]
    const { result, box } = tidy(nodes, relations, { pinned: ['a', 'b'] })
    expect(result.winner.positions.a).toMatchObject({ x: 100, y: 100 })
    expect(result.winner.positions.b).toMatchObject({ x: 110, y: 110 })
    for (const id of ['c', 'd']) for (const p of ['a', 'b']) {
      const m = box(id), f = box(p)
      expect(m.x >= f.x + f.w || f.x >= m.x + m.w || m.y >= f.y + f.h || f.y >= m.y + m.h, `${id} clear of ${p}`).toBe(true)
    }
    expect(result.tidy.steps.every((s) => !('a' in s.moved) && !('b' in s.moved))).toBe(true)
  })

  it('a row is spaced evenly', () => {
    // Three containers in a row, a chain, with uneven gaps between them.
    const nodes = [node('l', 'container', 0, 0), node('m', 'container', 400, 0), node('r', 'container', 1000, 0)]
    const relations = [rel('l', 'm'), rel('m', 'r')]
    const { box, result } = tidy(nodes, relations)
    const gl = box('m').x - (box('l').x + box('l').w), gr = box('r').x - (box('m').x + box('m').w)
    expect(Math.abs(gl - gr), result.tidy.steps.map((s) => s.description).join('; ')).toBeLessThan(2)
    expect(result.tidy.after.uneven).toBe(0)
  })

  it('two moves where one alone makes it worse', () => {
    // A chain a → b → c read down: b can only go under a once c moves out of the way.
    const mm = builtInGovernanceMetamodel()
    const nodes = [node('a', 'state', 0, 0), node('c', 'state', 0, 130), node('b', 'state', 300, 130)]
    const relations: C4Relation[] = [
      { id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'transition' },
      { id: 'bc', sourceId: 'b', targetId: 'c', relationType: 'transition' },
    ]
    const { box, result } = tidy(nodes, relations, { metamodel: mm })
    expect(Math.abs(box('a').cx - box('b').cx), result.tidy.steps.map((s) => s.description).join('; ')).toBeLessThan(2)
    expect(box('b').y).toBeGreaterThanOrEqual(box('a').y + box('a').h)
    expect(box('c').y).toBeGreaterThanOrEqual(box('b').y + box('b').h)
  })

  it('a line to a side shared by two lines ends at its port', () => {
    const nodes = [node('svc', 'container', 0, 0), node('db1', 'database', 400, -200), node('db2', 'database', 400, 200)]
    const relations = [rel('svc', 'db1'), rel('svc', 'db2')]
    const laid = byId(nodes)
    const l = new Layout(laid)
    const lines = linesOf(l, byId(relations))
    const index = buildIndex(l, lines)
    const g1 = index.geom.get(lines[0])!, g2 = index.geom.get(lines[1])!
    // Both leave the right side of the container, one above the other, not from its middle.
    expect(g1.ax).toBe(l.box('svc')!.x + l.box('svc')!.w)
    expect(g2.ax).toBe(g1.ax)
    expect(g1.ay).toBeLessThan(l.box('svc')!.cy)
    expect(g2.ay).toBeGreaterThan(l.box('svc')!.cy)
    // Judged straight from the middle of the side: a database level with the container.
    const level = [node('svc', 'container', 0, 0), node('db1', 'database', 400, 35), node('db2', 'database', 400, 250)]
    const lv = new Layout(byId(level))
    const cost = totalCost(lv, linesOf(lv, byId(relations)))
    // One straight, one of a fan slanted: half a slant.
    expect(cost.slanted).toBe(0.5)
  })

  it('a label is not drawn over an element', () => {
    // A long label on a → c would lie over b, which stands between them.
    const nodes = [node('a', 'container', 0, 0), node('b', 'container', 400, 0), node('c', 'container', 800, 0)]
    const relations = [rel('a', 'c', 'Sends the daily reconciliation report'), rel('a', 'b'), rel('b', 'c')]
    const l = new Layout(byId(nodes))
    const before = totalCost(l, linesOf(l, byId(relations)))
    expect(before.labels).toBeGreaterThan(0)
    const { result } = tidy(nodes, relations)
    expect(result.tidy.after.labels).toBe(0)
  })

  it('loose elements gather in a column per type', () => {
    const mm = builtInGovernanceMetamodel()
    const nodes = [
      node('sys', 'system', 600, 300), node('user', 'person', 600, 0),
      node('Zebra', 'adr', 0, 0), node('Apple', 'adr', 20, 20), node('Mango', 'requirement', 40, 40), node('Berry', 'requirement', 60, 60),
    ]
    const relations = [rel('user', 'sys')]
    const { box } = tidy(nodes, relations, { metamodel: mm })
    // Two columns: ADRs, then requirements, each by name from the top.
    expect(Math.abs(box('Apple').cx - box('Zebra').cx)).toBeLessThan(1)
    expect(box('Apple').y).toBeLessThan(box('Zebra').y)
    expect(Math.abs(box('Berry').cx - box('Mango').cx)).toBeLessThan(1)
    expect(box('Berry').y).toBeLessThan(box('Mango').y)
    expect(box('Apple').x + box('Apple').w).toBeLessThanOrEqual(box('Berry').x)
    expect(box('Berry').x + box('Berry').w).toBeLessThanOrEqual(box('sys').x)
  })

  it('a frame is no larger than its children and padding need', () => {
    const nodes = [node('sys', 'system', 0, 0, undefined, { width: 900, height: 700 }), node('api', 'container', 30, 120, 'sys')]
    const { box } = tidy(nodes, [])
    const pad = compoundPadding('system')
    expect(box('sys').w).toBe(Math.max(box('api').w + 2 * pad.side, COLLAPSED_WIDTH.system))
    expect(box('sys').h).toBe(Math.max(box('api').h + pad.top + pad.bottom, COLLAPSED_HEIGHT.system))
  })

  it('a time budget stops the tidying with what was done', () => {
    // A pile of 30 elements: more moves than fit in a budget of a moment.
    const nodes: C4Node[] = [], relations: C4Relation[] = []
    for (let i = 0; i < 30; i++) {
      nodes.push(node(`n${i}`, 'container', (i % 5) * 10, Math.floor(i / 5) * 10))
      if (i) relations.push(rel(`n${i - 1}`, `n${i}`))
    }
    const reported: number[] = []
    const result = runTidyLayout(byId(nodes), byId(relations), { budgetMs: 1, onProgress: (done) => reported.push(done) })
    expect(result.tidy.budgetOut).toBe(true)
    expect(reported).toEqual(result.tidy.steps.map((_, i) => i + 1))
    const whole = runTidyLayout(byId(nodes), byId(relations))
    expect(whole.tidy.budgetOut).toBe(false)
    expect(whole.tidy.steps.length).toBeGreaterThan(result.tidy.steps.length)
    // A stop asked for from outside ends it the same way.
    let rounds = 0
    const stopped = runTidyLayout(byId(nodes), byId(relations), { shouldStop: () => ++rounds > 3 })
    expect(stopped.tidy.budgetOut).toBe(true)
  }, 60_000)

  it('tidy around moves only the given elements and what they relate to', () => {
    // a → b stand well; c was just dropped on d; e and f are far off, standing where they are.
    const nodes = [node('a', 'container', 0, 0), node('b', 'container', 0, 400), node('c', 'container', 2000, 0), node('d', 'container', 2010, 10), node('e', 'container', 0, 2000), node('f', 'container', 600, 2000)]
    const relations = [rel('a', 'b'), rel('c', 'd'), rel('e', 'f')]
    const { result, box } = tidy(nodes, relations)
    void result
    const around = runTidyLayout(byId(nodes), byId(relations), { around: ['c'] })
    const p = around.winner.positions
    for (const id of ['a', 'b', 'e', 'f']) expect(p[id], id).toMatchObject({ x: byId(nodes)[id].x, y: byId(nodes)[id].y })
    const c = p.c, d = p.d
    expect(c.x >= d.x + d.width! || d.x >= c.x + c.width! || c.y >= d.y + d.height! || d.y >= c.y + c.height!).toBe(true)
    expect(around.tidy.steps.every((s) => Object.keys(s.moved).every((id) => id === 'c' || id === 'd'))).toBe(true)
    void box
  })

  it('orthogonal lines are judged along their route, bends counted', () => {
    // a above-left of b: the orthogonal route leaves a's right side, turns twice and enters b's left;
    // c stands on the straight chord between them, off the route.
    const nodes = [node('a', 'container', 0, 0), node('b', 'container', 700, 500), node('c', 'container', 520, 330)]
    const relations = [rel('a', 'b')]
    const curved = new Layout(byId(nodes))
    const orth = new Layout(byId(nodes))
    orth.edgeStyle = 'orthogonal'
    const straight = totalCost(curved, linesOf(curved, byId(relations)))
    const routed = totalCost(orth, linesOf(orth, byId(relations)))
    expect(straight.bends).toBe(0)
    expect(routed.bends).toBe(2)
    expect(straight.overdraws).toBeGreaterThan(0)
    expect(routed.overdraws).toBe(0)
    // Tidied as drawn: no element under the route, and fewer bends where a slide straightens the line.
    const result = runTidyLayout(byId(nodes), byId(relations), { edgeStyle: 'orthogonal' })
    expect(result.tidy.after.overdraws).toBe(0)
    expect(result.tidy.after.bends).toBeLessThan(2)
  })

  it('a row is reordered to uncross its lines', () => {
    // Four in a row above four below, the top row in reverse order: every line crosses.
    const top = ['t1', 't2', 't3', 't4'].map((id, i) => node(id, 'container', (3 - i) * 320, 0))
    const bottom = ['b1', 'b2', 'b3', 'b4'].map((id, i) => node(id, 'container', i * 320, 400))
    const relations = [1, 2, 3, 4].map((i) => rel(`t${i}`, `b${i}`))
    const { box, result } = tidy([...top, ...bottom], relations)
    expect(result.tidy.after.crossings).toBe(0)
    for (let i = 1; i <= 4; i++) expect(Math.abs(box(`t${i}`).cx - box(`b${i}`).cx), `t${i} over b${i}`).toBeLessThan(2)
    expect(result.tidy.steps.some((s) => s.kind === 'order')).toBe(true)
  })
})
