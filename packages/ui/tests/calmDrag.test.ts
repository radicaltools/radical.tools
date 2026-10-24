/**
 * Calm drags and pins: what a drag on the canvas moves.
 *
 * Covers:
 *   - a calm drag moves only the dragged element (and the elements dragged
 *     along with it); nothing else moves during the drag or after the drop
 *   - the drop pushes what it covers clear, whole, and nothing more
 *   - a row moves up and down with a dragged member, the others stay put
 *     along it
 *   - a container grown by a drag pushes a neighbouring container whole,
 *     clear of it even when it grew past the whole of it; a drop leaves
 *     nothing overlapping, also when the pushes run out
 *   - a row through a container follows it while a child's drag grows it
 *   - a dropped element is pinned: the physics leaves it where it is, on a
 *     small diagram that relaxes as a whole too
 *   - a drop pushes a pinned element clear like any other (it stays pinned
 *     where it lands); one that lines hold on both axes stays, and the
 *     dropped element moves off it
 *   - the store records the pin on the canvas, unpins as one undo step and
 *     drops deleted elements from it
 *   - an element added stays where it was dropped and pushes what it, or
 *     the container it grew, covers past its far edge, pinned elements
 *     too; nothing else moves (items 249, 256 and "Calm drags and pins"
 *     item 2)
 *   - a rebuild takes the place of an element the store moved since from
 *     the model (item 261)
 *   - an element dragged inside its container leaves the frames round it
 *     where they stand, grown only as far as needed to hold it; a
 *     container's only child does not take the container along (F-0028)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { LIVE_CHILD_TOP_MIN, LiveColaEngine, relaxLayout } from '@radical/layout/liveColaEngine'
import { useDiagramStore } from '../src/store/diagramStore'
import { NODE_SIZES, pinnedNodeIds, type C4Node, type C4Relation, type DiagramView } from '@radical/common/c4'
import type { Alignment } from '@radical/layout/constraints'
import { drawnSize } from '@radical/layout/geometry'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...extra }) as C4Node

type Nodes = Record<string, C4Node>

/** 160 linked containers far to the right: the diagram is large, so the
 *  physics is local and at rest once built. */
function withFillers(nodes: Nodes, relations: Record<string, C4Relation>, count = 160): void {
  for (let i = 0; i < count; i++) nodes[`f${i}`] = node(`f${i}`, 'container', { x: 6000 + (i % 16) * 320, y: Math.floor(i / 16) * 220 })
  for (let i = 1; i < count; i++) relations[`fr${i}`] = { id: `fr${i}`, sourceId: `f${i - 1}`, targetId: `f${i}` } as C4Relation
}

function engineFor(nodes: Nodes, relations: Record<string, C4Relation>, alignments: Alignment[] = [], pinned: string[] = [], frames: string[] = []): LiveColaEngine {
  return new LiveColaEngine({
    getModel: () => ({ nodes, relations, alignments, pinned, frames }),
    applyPositions: (positions) => {
      for (const [id, pos] of Object.entries(positions)) {
        const n = nodes[id]
        if (!n) continue
        n.x = pos.x
        n.y = pos.y
        if (pos.width != null) n.width = pos.width
        if (pos.height != null) n.height = pos.height
      }
    },
  })
}

/** Absolute top-left of a node, through its parents' relative positions. */
function absOf(nodes: Nodes, id: string): { x: number; y: number } {
  let x = 0
  let y = 0
  for (let cur: C4Node | undefined = nodes[id]; cur; cur = cur.parentId ? nodes[cur.parentId] : undefined) {
    x += cur.x
    y += cur.y
  }
  return { x, y }
}

/** Every node's absolute top-left, rounded. */
function snapshot(nodes: Nodes): Record<string, string> {
  return Object.fromEntries(Object.keys(nodes).map((id) => {
    const a = absOf(nodes, id)
    return [id, `${Math.round(a.x)},${Math.round(a.y)}`]
  }))
}

/** As the canvas does: React Flow moves the dragged node (its absolute
 *  top-left goes from `from` to `to` in `steps`), the engine the rest. */
function calmDrag(engine: LiveColaEngine, nodes: Nodes, id: string, to: { x: number; y: number }, withIds: string[] = [], steps = 10): void {
  const from = absOf(nodes, id)
  engine.grab(id, nodes[id].x, nodes[id].y, 'calm', from, withIds)
  for (let i = 1; i <= steps; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }
    engine.drag(id, at.x, at.y, at)
  }
}

/** The boxes overlap as drawn (a system without children is drawn collapsed). */
const overlaps = (nodes: Nodes, a: string, b: string): boolean => {
  const p = absOf(nodes, a)
  const q = absOf(nodes, b)
  const hasChildren = (id: string): boolean => Object.values(nodes).some((n) => n.parentId === id)
  const sa = drawnSize(nodes[a], hasChildren(a))
  const sb = drawnSize(nodes[b], hasChildren(b))
  return p.x < q.x + sb.width && q.x < p.x + sa.width && p.y < q.y + sb.height && q.y < p.y + sa.height
}

describe('Calm drag', () => {
  it('moves only the dragged element, during the drag and after the drop', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 600, y: 0 }),
      c: node('c', 'system', { x: 0, y: 600 }),
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'a', targetId: 'b' } as C4Relation,
      r2: { id: 'r2', sourceId: 'b', targetId: 'c' } as C4Relation,
    }
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    const before = snapshot(nodes)

    calmDrag(engine, nodes, 'b', { x: 1400, y: 900 })
    expect({ ...snapshot(nodes), b: before.b }).toEqual(before)
    engine.release('b')
    engine.stop()

    const after = snapshot(nodes)
    expect(after.b).toBe('1400,900')
    expect({ ...after, b: before.b }).toEqual(before)
  })

  it('pushes what the dropped element covers clear, whole, and nothing more', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 1000, y: 0 }),
      c: node('c', 'system', { x: 1000, y: 1000 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    const before = snapshot(nodes)

    // Drop a mostly on top of b, a little to its left.
    calmDrag(engine, nodes, 'a', { x: 960, y: 20 })
    engine.release('a')
    engine.stop()

    const after = snapshot(nodes)
    expect(after.a).toBe('960,20')
    expect(overlaps(nodes, 'a', 'b')).toBe(false)
    expect(after.b).not.toBe(before.b)
    // b went one way, along the axis it overlapped least on.
    const b = absOf(nodes, 'b')
    expect([b.x === 1000, b.y === 0]).toContain(true)
    expect({ ...after, a: before.a, b: before.b }).toEqual(before)
  })

  it('moves a row up and down with a dragged member; along it the others stay', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 0 }),
      c: node('c', 'system', { x: 1000, y: 0 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [{ axis: 'y', ids: ['a', 'b', 'c'], orders: [] }])
    engine.start(true)

    calmDrag(engine, nodes, 'b', { x: 560, y: 400 })
    expect(absOf(nodes, 'a')).toEqual({ x: 0, y: 400 })
    expect(absOf(nodes, 'c')).toEqual({ x: 1000, y: 400 })
    engine.release('b')
    engine.stop()
    expect(absOf(nodes, 'b')).toEqual({ x: 560, y: 400 })
    expect(absOf(nodes, 'a')).toEqual({ x: 0, y: 400 })
    expect(absOf(nodes, 'c')).toEqual({ x: 1000, y: 400 })
  })

  it('pushes the next member of an ordered row ahead instead of passing it', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 0 }),
      c: node('c', 'system', { x: 1000, y: 0 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [{ axis: 'y', ids: ['a', 'b', 'c'], orders: [['a', 'b', 'c']] }])
    engine.start(true)

    calmDrag(engine, nodes, 'a', { x: 900, y: 0 })
    engine.release('a')
    engine.stop()
    const cx = (id: string): number => absOf(nodes, id).x + nodes[id].width / 2
    expect(cx('a')).toBe(900 + nodes.a.width / 2)
    expect(cx('a')).toBeLessThan(cx('b'))
    expect(cx('b')).toBeLessThan(cx('c'))
    expect(absOf(nodes, 'b').y).toBe(0)
  })

  it('pushes a member of its row along the line when dropped onto it (item 251)', () => {
    // API and Orders DB in a row, API dropped onto Orders DB: the row's
    // members moved with the drag across the line and were taken for
    // dropped ones, which push nothing, so the two stayed 56 px over each
    // other.
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 0 }),
      c: node('c', 'system', { x: 0, y: 600 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [{ axis: 'y', ids: ['a', 'b'], orders: [] }])
    engine.start(true)

    calmDrag(engine, nodes, 'a', { x: 400, y: 30 })
    engine.release('a')
    engine.stop()
    expect(absOf(nodes, 'a')).toEqual({ x: 400, y: 30 })
    expect(overlaps(nodes, 'a', 'b')).toBe(false)
    // Along the line, and still on it.
    expect(absOf(nodes, 'b').y).toBe(30)
    expect(absOf(nodes, 'c')).toEqual({ x: 0, y: 600 })
  })

  it('leaves everything as it was on a click', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 100, y: 50 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    let settled = 0
    const engine = new LiveColaEngine({
      getModel: () => ({ nodes, relations }),
      applyPositions: () => { throw new Error('nothing moves on a click') },
      onSettled: () => { settled++ },
    })
    engine.start(true)
    settled = 0
    // React Flow starts and ends a drag on a click; a and b overlap.
    engine.grab('a', 0, 0, 'calm', { x: 0, y: 0 })
    engine.drag('a', 0, 0, { x: 0, y: 0 })
    engine.release('a')
    engine.stop()
    expect(settled).toBe(0)
  })

  it('moves the other selected elements with the dragged one', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 0 }),
      c: node('c', 'system', { x: 0, y: 600 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)

    calmDrag(engine, nodes, 'a', { x: 100, y: 1500 }, ['b'])
    engine.release('a')
    engine.stop()
    expect(absOf(nodes, 'a')).toEqual({ x: 100, y: 1500 })
    expect(absOf(nodes, 'b')).toEqual({ x: 600, y: 1500 })
    expect(absOf(nodes, 'c')).toEqual({ x: 0, y: 600 })
  })

  it('keeps a row through a container while a child\'s drag grows it', () => {
    const nodes: Nodes = {
      box: node('box', 'system', { x: 0, y: 0, width: 600, height: 400 }),
      kid: node('kid', 'container', { parentId: 'box', x: 80, y: 120 }),
      b: node('b', 'system', { x: 900, y: 0 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [{ axis: 'y', ids: ['box', 'b'], orders: [] }])
    engine.start(true)
    /** Distance between the two centres on the row's axis, as drawn. */
    const offLine = (): number => {
      const boxY = absOf(nodes, 'box').y + nodes.box.height / 2
      const bY = absOf(nodes, 'b').y + drawnSize(nodes.b, false).height / 2
      return Math.abs(boxY - bY)
    }
    // A nudge reports the group box the physics made.
    const k0 = absOf(nodes, 'kid')
    calmDrag(engine, nodes, 'kid', { x: k0.x + 1, y: k0.y }, [], 1)
    engine.release('kid')
    expect(offLine()).toBeLessThan(1.5)

    // Down past the bottom edge: the box grows down, its centre moves.
    const k1 = absOf(nodes, 'kid')
    const bX = absOf(nodes, 'b').x
    calmDrag(engine, nodes, 'kid', { x: k1.x, y: k1.y + 500 })
    expect(offLine()).toBeLessThan(1.5)
    engine.release('kid')
    expect(offLine()).toBeLessThan(1.5)
    // Along the row it stays.
    expect(absOf(nodes, 'b').x).toBe(bX)

    // Up past the top edge.
    const k2 = absOf(nodes, 'kid')
    calmDrag(engine, nodes, 'kid', { x: k2.x, y: k2.y - 900 })
    engine.release('kid')
    engine.stop()
    expect(offLine()).toBeLessThan(1.5)
  })

  it('lets a container grown by a drag push its neighbour, whole', () => {
    const nodes: Nodes = {
      left: node('left', 'system', { x: 0, y: 0, width: 600, height: 400 }),
      l1: node('l1', 'container', { parentId: 'left', x: 80, y: 120 }),
      l2: node('l2', 'container', { parentId: 'left', x: 340, y: 120 }),
      right: node('right', 'system', { x: 900, y: 0, width: 600, height: 400 }),
      r1: node('r1', 'container', { parentId: 'right', x: 80, y: 120 }),
      r2: node('r2', 'container', { parentId: 'right', x: 340, y: 120 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    // The physics boxes the groups from their children: a nudge reports
    // where they are.
    const l20 = absOf(nodes, 'l2')
    calmDrag(engine, nodes, 'l2', { x: l20.x + 1, y: l20.y }, [], 1)
    engine.release('l2')
    const r1 = absOf(nodes, 'r1')
    const r2 = absOf(nodes, 'r2')
    const rightBefore = absOf(nodes, 'right')

    // Drag l2 to the right, into where `right` stands: `left` grows into it.
    const l2 = absOf(nodes, 'l2')
    calmDrag(engine, nodes, 'l2', { x: l2.x + 500, y: l2.y })
    engine.release('l2')
    engine.stop()

    expect(overlaps(nodes, 'left', 'right')).toBe(false)
    const shift = absOf(nodes, 'right').x - rightBefore.x
    expect(shift).toBeGreaterThan(0)
    // Whole: its children moved with it, by the same amount.
    expect(absOf(nodes, 'r1')).toEqual({ x: r1.x + shift, y: r1.y })
    expect(absOf(nodes, 'r2')).toEqual({ x: r2.x + shift, y: r2.y })
  })

  it('leaves nothing overlapping when a child is dragged far out of its container, past the one below', () => {
    // A system with two containers one above the other, and a system below
    // it: a component dragged down out of the top container, onto the bottom
    // of the one below, grows its container over the whole of that one.
    const nodes: Nodes = {
      sys: node('sys', 'system', { x: 0, y: 0, width: 640, height: 900 }),
      top: node('top', 'container', { parentId: 'sys', x: 40, y: 120, width: 560, height: 330 }),
      k0: node('k0', 'component', { parentId: 'top', x: 40, y: 120 }),
      k1: node('k1', 'component', { parentId: 'top', x: 300, y: 120 }),
      low: node('low', 'container', { parentId: 'sys', x: 40, y: 520, width: 560, height: 330 }),
      m0: node('m0', 'component', { parentId: 'low', x: 40, y: 120 }),
      m1: node('m1', 'component', { parentId: 'low', x: 300, y: 120 }),
      next: node('next', 'system', { x: 0, y: 1000, width: 640, height: 500 }),
      n0: node('n0', 'container', { parentId: 'next', x: 40, y: 120 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    const k00 = absOf(nodes, 'k0')
    calmDrag(engine, nodes, 'k0', { x: k00.x + 1, y: k00.y }, [], 1)
    engine.release('k0')

    // Down past m0, to the bottom edge of the container below.
    const m0 = absOf(nodes, 'm0')
    calmDrag(engine, nodes, 'k0', { x: m0.x, y: m0.y + 120 })
    engine.release('k0')
    engine.stop()

    const ancestors = (id: string): string[] => {
      const out: string[] = []
      for (let p = nodes[id].parentId; p; p = nodes[p].parentId) out.push(p)
      return out
    }
    const ids = ['sys', 'top', 'k0', 'k1', 'low', 'm0', 'm1', 'next', 'n0']
    const overlapping: string[] = []
    for (const a of ids) {
      for (const b of ids) {
        if (a >= b || ancestors(a).includes(b) || ancestors(b).includes(a)) continue
        if (overlaps(nodes, a, b)) overlapping.push(`${a}/${b}`)
      }
    }
    expect(overlapping).toEqual([])
  })

  it('leaves nothing overlapping when the pushes run out', () => {
    // A column of 420 elements, each 24 px (CALM_GAP) below the last: a drop
    // on the first pushes each one onto the next, more pushes than a drop
    // makes.
    const nodes: Nodes = { a: node('a', 'component', { x: 600, y: 0 }) }
    const { height } = NODE_SIZES.component
    for (let i = 0; i < 420; i++) nodes[`c${i}`] = node(`c${i}`, 'component', { x: 0, y: i * (height + 24) })
    const engine = engineFor(nodes, {})
    engine.start(true)

    calmDrag(engine, nodes, 'a', { x: 0, y: -100 })
    engine.release('a')
    engine.stop()

    const ids = Object.keys(nodes).sort((p, q) => nodes[p].y - nodes[q].y)
    const overlapping: string[] = []
    for (let i = 1; i < ids.length; i++) {
      if (overlaps(nodes, ids[i - 1], ids[i])) overlapping.push(`${ids[i - 1]}/${ids[i]}`)
    }
    expect(overlapping).toEqual([])
    expect(absOf(nodes, 'a')).toEqual({ x: 0, y: -100 })
  })
})

describe('A drag on a view that does not draw the containers its elements are in (F-0048)', () => {
  // The sample's Domain model: entities, drawn without the domains they are
  // in. Payment, dropped on an empty spot 190 px from Account and Ledger
  // Entry, pushed them 422 px left: its domain grew round the drop and
  // pushed theirs, with them in it.
  const domainModel = (): Nodes => ({
    acc: node('acc', 'domain', { x: 0, y: 0, width: 700, height: 400 }),
    account: node('account', 'entity', { parentId: 'acc', x: 30, y: 120 }),
    ledger: node('ledger', 'entity', { parentId: 'acc', x: 300, y: 120 }),
    pay: node('pay', 'domain', { x: 800, y: 0, width: 700, height: 400 }),
    payment: node('payment', 'entity', { parentId: 'pay', x: 30, y: 120 }),
    batch: node('batch', 'entity', { parentId: 'pay', x: 300, y: 120 }),
  })
  const drawnIds = ['account', 'ledger', 'payment', 'batch']

  it('moves only the dropped element where it covers nothing', () => {
    const nodes = domainModel()
    const relations: Record<string, C4Relation> = { r: { id: 'r', sourceId: 'payment', targetId: 'account' } as C4Relation }
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [], [], ['acc', 'pay'])
    engine.start(true)
    const before = snapshot(nodes)
    const gap = 420 - (120 + NODE_SIZES.entity.height)
    expect(gap).toBeGreaterThan(200)
    calmDrag(engine, nodes, 'payment', { x: 150, y: 420 })
    engine.release('payment')
    engine.stop()
    const after = snapshot(nodes)
    expect(after.payment).toBe('150,420')
    for (const id of drawnIds.filter((id) => id !== 'payment')) expect(after[id], id).toBe(before[id])
  })

  it('pushes what the drop covers, across the containers the view does not draw', () => {
    const nodes = domainModel()
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [], [], ['acc', 'pay'])
    engine.start(true)
    const before = snapshot(nodes)
    // Onto Ledger Entry, a little to its right.
    calmDrag(engine, nodes, 'payment', { x: 320, y: 125 })
    engine.release('payment')
    engine.stop()
    const after = snapshot(nodes)
    expect(after.payment).toBe('320,125')
    expect(overlaps(nodes, 'payment', 'ledger')).toBe(false)
    expect(after.ledger).not.toBe(before.ledger)
    expect(after.account).toBe(before.account)
    expect(after.batch).toBe(before.batch)
  })
})

describe('A drag and the open containers it does not touch', () => {
  // A layout leaves 120 px above a container's children; the physics keeps
  // about 60 around them. The engine reported every open container at its
  // own bounds with the first drag, so dragging anything re-framed every
  // container of a laid-out diagram.
  const laidOut = (): Nodes => ({
    shop: node('shop', 'system', { x: 0, y: 300, width: 760, height: 380 }),
    web: node('web', 'container', { parentId: 'shop', x: 40, y: 120 }),
    api: node('api', 'container', { parentId: 'shop', x: 400, y: 120 }),
    user: node('user', 'person', { x: 300, y: 0 }),
    bank: node('bank', 'system', { x: 1100, y: 400 }),
  })
  const relations: Record<string, C4Relation> = {
    r1: { id: 'r1', sourceId: 'user', targetId: 'web' } as C4Relation,
    r2: { id: 'r2', sourceId: 'web', targetId: 'api' } as C4Relation,
    r3: { id: 'r3', sourceId: 'api', targetId: 'bank' } as C4Relation,
  }
  const frame = (nodes: Nodes, id: string) => (({ x, y, width, height }) => ({ x, y, width, height }))(nodes[id])

  it('leaves a container as the layout framed it when an element outside it is dragged', () => {
    const nodes = laidOut()
    const before = structuredClone(nodes)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    calmDrag(engine, nodes, 'user', { x: -400, y: -200 })
    engine.release('user')
    engine.stop()
    expect(absOf(nodes, 'user')).toEqual({ x: -400, y: -200 })
    for (const id of ['shop', 'web', 'api', 'bank']) expect(frame(nodes, id)).toEqual(frame(before, id))
  })

  /** The sample's Core Banking view, as Smart Layout leaves it. */
  const coreBanking = (): { nodes: Nodes; links: Record<string, C4Relation> } => {
    const nodes: Nodes = Object.fromEntries([
      node('sys-core', 'system', { x: 30, y: 120, width: 1230, height: 1440 }),
      node('dom-access', 'group', { parentId: 'sys-core', x: 20, y: 110, width: 690, height: 330 }),
      node('ctn-apigw', 'container', { parentId: 'dom-access', x: 20, y: 110, width: 300, height: 200 }),
      node('ctn-auth', 'container', { parentId: 'dom-access', x: 370, y: 110, width: 300, height: 200 }),
      node('dom-banking', 'group', { parentId: 'sys-core', x: 20, y: 650, width: 610, height: 770 }),
      node('ctn-payments', 'container', { parentId: 'dom-banking', x: 110, y: 340, width: 240, height: 410 }),
      node('comp-validator', 'component', { parentId: 'ctn-payments', x: 20, y: 110, width: 200, height: 120 }),
      node('comp-fx', 'component', { parentId: 'ctn-payments', x: 20, y: 270, width: 200, height: 120 }),
      node('ctn-accounts', 'container', { parentId: 'dom-banking', x: 20, y: 110, width: 300, height: 200 }),
      node('ctn-evtbus', 'queue', { parentId: 'dom-banking', x: 370, y: 178, width: 220, height: 95 }),
      node('dom-risk', 'group', { parentId: 'sys-core', x: 750, y: 110, width: 460, height: 500 }),
      node('ctn-fraud', 'container', { parentId: 'dom-risk', x: 20, y: 280, width: 300, height: 200 }),
      node('ctn-db-acc', 'database', { parentId: 'dom-risk', x: 20, y: 110, width: 190, height: 130 }),
      node('ctn-db-tx', 'database', { parentId: 'dom-risk', x: 250, y: 110, width: 190, height: 130 }),
    ].map((n) => [n.id, n]))
    const links: Record<string, C4Relation> = Object.fromEntries([
      ['ctn-apigw', 'ctn-auth'], ['ctn-apigw', 'ctn-payments'], ['ctn-apigw', 'ctn-accounts'], ['ctn-payments', 'ctn-db-tx'],
      ['ctn-accounts', 'ctn-db-acc'], ['ctn-payments', 'ctn-evtbus'], ['ctn-accounts', 'ctn-evtbus'], ['ctn-evtbus', 'ctn-fraud'],
    ].map(([sourceId, targetId], i) => [`r${i}`, { id: `r${i}`, sourceId, targetId } as C4Relation]))
    return { nodes, links }
  }

  it('keeps the groups beside the one dragged in below their system\'s header (item 218)', () => {
    // Risk & Data holds its first child 110 px below its top, more than the
    // physics leaves.
    const { nodes, links } = coreBanking()
    const engine = engineFor(nodes, links)
    engine.start(true)
    const at = absOf(nodes, 'ctn-apigw')
    calmDrag(engine, nodes, 'ctn-apigw', { x: at.x + 100, y: at.y + 67 })
    engine.release('ctn-apigw')
    engine.stop()
    // The canvas draws a child nearer its parent's top at that distance:
    // the model must not say less.
    for (const id of ['dom-access', 'dom-risk', 'dom-banking']) expect(nodes[id].y, id).toBeGreaterThanOrEqual(LIVE_CHILD_TOP_MIN)
  })

  for (const dx of [5, 20]) {
    it(`leaves the frames round an element dragged a little inside its group as they were (F-0028, ${dx} px)`, () => {
      // API Gateway a few px right inside Access & Security, which has room
      // for it: Core Banking Platform took the physics' bounds (x 30 → -78,
      // width 1230 → 1468), Access & Security's top dropped 52 px and Risk
      // & Data moved 22 px with its children.
      const { nodes, links } = coreBanking()
      const engine = engineFor(nodes, links)
      engine.start(true)
      /** Every element's frame as drawn: absolute top-left and size. */
      const frames = (): Record<string, string> => Object.fromEntries(Object.keys(nodes).map((id) => {
        const a = absOf(nodes, id)
        return [id, `${Math.round(a.x)},${Math.round(a.y)} ${Math.round(nodes[id].width)}×${Math.round(nodes[id].height)}`]
      }))
      const before = frames()
      const at = absOf(nodes, 'ctn-apigw')
      calmDrag(engine, nodes, 'ctn-apigw', { x: at.x + dx, y: at.y })
      engine.release('ctn-apigw')
      engine.stop()
      expect(absOf(nodes, 'ctn-apigw')).toEqual({ x: at.x + dx, y: at.y })
      const after = frames()
      expect(Object.keys(after).filter((id) => id !== 'ctn-apigw' && after[id] !== before[id]).map((id) => `${id}: ${before[id]} → ${after[id]}`)).toEqual([])
    })
  }

  it('leaves a container where it stands when its only child is dragged a little inside it (F-0028)', () => {
    // All of its leaves moved alike, which read as the container moving.
    const nodes: Nodes = {
      box: node('box', 'system', { x: 0, y: 0, width: 640, height: 600 }),
      ctn: node('ctn', 'container', { parentId: 'box', x: 30, y: 120, width: 400, height: 400 }),
      cmp: node('cmp', 'component', { parentId: 'ctn', x: 40, y: 120 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    const before = structuredClone(nodes)
    const at = absOf(nodes, 'cmp')
    calmDrag(engine, nodes, 'cmp', { x: at.x + 20, y: at.y + 10 })
    engine.release('cmp')
    engine.stop()
    expect(absOf(nodes, 'cmp')).toEqual({ x: at.x + 20, y: at.y + 10 })
    for (const id of ['box', 'ctn']) expect(frame(nodes, id), id).toEqual(frame(before, id))
  })

  it('moves a dragged container with the frame it had', () => {
    const nodes = laidOut()
    const engine = engineFor(nodes, relations)
    engine.start(true)
    calmDrag(engine, nodes, 'shop', { x: 0, y: 900 })
    engine.release('shop')
    engine.stop()
    expect(frame(nodes, 'shop')).toEqual({ x: 0, y: 900, width: 760, height: 380 })
    expect(frame(nodes, 'web')).toMatchObject({ x: 40, y: 120 })
  })

  it('leaves it as the layout framed it when an element is added outside it', async () => {
    const nodes = laidOut()
    const before = structuredClone(nodes)
    const engine = engineFor(nodes, relations)
    engine.start(true)
    // A new element far from the container, related to nothing.
    nodes.guest = node('guest', 'person', { x: -900, y: -600 })
    engine.invalidate()
    await wait(500)
    engine.stop()
    for (const id of ['shop', 'web', 'api', 'bank', 'user']) expect(frame(nodes, id)).toEqual(frame(before, id))
  })

  it('grows the container an element is dragged inside of, where it stands, to hold it', () => {
    const nodes = laidOut()
    const engine = engineFor(nodes, relations)
    engine.start(true)
    calmDrag(engine, nodes, 'api', { x: 400, y: 700 })
    engine.release('api')
    engine.stop()
    // It grew down to hold the element where it was dropped, as drawn (a
    // container without children is drawn folded), and only down.
    expect(nodes.shop.y + nodes.shop.height).toBeGreaterThan(700 + drawnSize(nodes.api, false).height)
    expect(frame(nodes, 'shop')).toMatchObject({ x: 0, y: 300, width: 760 })
  })
})

describe('An element added', () => {
  // The bookstore: Customer above Bookstore, its containers in a row.
  const bookstore = (): Nodes => ({
    customer: node('customer', 'person', { x: 355, y: 0 }),
    shop: node('shop', 'system', { x: 0, y: 270, width: 860, height: 350 }),
    web: node('web', 'webapp', { parentId: 'shop', x: 30, y: 120, width: 210, height: 140 }),
    api: node('api', 'container', { parentId: 'shop', x: 290, y: 120, width: 300, height: 200 }),
    db: node('db', 'database', { parentId: 'shop', x: 640, y: 155 }),
    bank: node('bank', 'system', { x: 960, y: 355, external: true }),
  })
  const relations: Record<string, C4Relation> = {
    r1: { id: 'r1', sourceId: 'customer', targetId: 'web' } as C4Relation,
    r2: { id: 'r2', sourceId: 'web', targetId: 'api' } as C4Relation,
    r3: { id: 'r3', sourceId: 'api', targetId: 'db' } as C4Relation,
    r4: { id: 'r4', sourceId: 'api', targetId: 'bank' } as C4Relation,
  }

  it('stays where it was dropped and pushes what it covers past its far edge (item 249)', () => {
    // A person dropped between Customer and Bookstore, where there is no
    // room: it stayed over both, the physics holding them where they were.
    const nodes = bookstore()
    const engine = engineFor(nodes, relations)
    engine.start(true)
    const before = snapshot(nodes)
    nodes.guest = node('guest', 'person', { x: 284.6, y: 94.8 })
    engine.invalidate(['guest'])
    engine.stop()

    expect(absOf(nodes, 'guest').x).toBeCloseTo(284.6, 6)
    expect(absOf(nodes, 'guest').y).toBeCloseTo(94.8, 6)
    expect(overlaps(nodes, 'guest', 'customer')).toBe(false)
    expect(overlaps(nodes, 'guest', 'shop')).toBe(false)
    // Customer up, Bookstore down, whole; nothing else.
    expect(absOf(nodes, 'customer').x).toBe(355)
    expect(absOf(nodes, 'customer').y).toBeLessThan(0)
    expect(absOf(nodes, 'shop').x).toBe(0)
    expect(absOf(nodes, 'shop').y).toBeGreaterThan(270)
    const after = snapshot(nodes)
    expect(after.bank).toBe(before.bank)
    for (const id of ['web', 'api', 'db']) expect(nodes[id], id).toMatchObject({ x: bookstore()[id].x, y: bookstore()[id].y })
  })

  it('pushes the neighbour of the container it grew, also inside a pinned one ("Calm drags and pins" item 2)', () => {
    // Bookstore dragged (pinned, which holds what is in it), a component
    // dropped into Web App near its right edge: the store grew Web App onto
    // API, and the physics could move neither.
    const nodes = bookstore()
    const pinned = ['shop']
    const engine = engineFor(nodes, relations, [], pinned)
    engine.start(true)
    nodes.comp = node('comp', 'component', { parentId: 'web', x: 40.7, y: 120 })
    // As the store fits a parent to a new child.
    Object.assign(nodes.web, { width: 260.7, height: 260 })
    engine.invalidate(['comp', 'web'])
    engine.stop()

    expect(absOf(nodes, 'comp').x).toBeCloseTo(70.7, 6)
    expect(absOf(nodes, 'comp').y).toBeCloseTo(510, 6)
    expect(overlaps(nodes, 'web', 'api')).toBe(false)
    expect(overlaps(nodes, 'api', 'db')).toBe(false)
    expect(absOf(nodes, 'api').y).toBe(390)
  })

  it('moves nothing else where there is room for it (item 256)', async () => {
    // The sample's All elements: a component dropped into Fraud Detection
    // freed the 40 elements nearest to it by relation and containment for
    // the physics, which moved 43 elements, a process 560 px, and left a
    // step's child outside it.
    const nodes: Nodes = {
      risk: node('risk', 'group', { x: 780, y: 1036, width: 460, height: 500 }),
      fraud: node('fraud', 'container', { parentId: 'risk', x: 20, y: 280, width: 300, height: 200 }),
      db: node('db', 'database', { parentId: 'risk', x: 20, y: 110 }),
      proc: node('proc', 'process', { x: 30, y: 5646, width: 1440, height: 330 }),
      validate: node('validate', 'step', { parentId: 'proc', x: 240, y: 50, width: 220, height: 260 }),
      screen: node('screen', 'step', { parentId: 'validate', x: 20, y: 160, width: 180, height: 80 }),
      post: node('post', 'step', { parentId: 'proc', x: 600, y: 50, width: 220, height: 160 }),
      ops: node('ops', 'person', { x: 0, y: 0 }),
      core: node('core', 'system', { x: 1600, y: 0 }),
    }
    const links: Record<string, C4Relation> = Object.fromEntries([
      ['fraud', 'db'], ['screen', 'fraud'], ['validate', 'post'], ['ops', 'fraud'], ['core', 'fraud'], ['ops', 'core'],
    ].map(([sourceId, targetId], i) => [`r${i}`, { id: `r${i}`, sourceId, targetId } as C4Relation]))
    const engine = engineFor(nodes, links)
    engine.start(true)
    const before = snapshot(nodes)
    nodes.comp = node('comp', 'component', { parentId: 'fraud', x: 20, y: 120 })
    engine.invalidate(['comp', 'fraud'])
    await wait(400)
    engine.stop()
    expect({ ...snapshot(nodes), comp: undefined }).toEqual({ ...before, comp: undefined })
    expect(absOf(nodes, 'comp')).toEqual({ x: 820, y: 1436 })
  })
})

describe('An element added in the store', () => {
  it('stays where it was dropped, and what it covers is pushed clear (item 249)', () => {
    useDiagramStore.setState({
      c4Nodes: {
        customer: node('customer', 'person', { x: 355, y: 0 }),
        shop: node('shop', 'system', { x: 0, y: 270, width: 860, height: 350 }),
        web: node('web', 'webapp', { parentId: 'shop', x: 30, y: 120, width: 210, height: 140 }),
      },
      c4Relations: {},
      views: {} as Record<string, DiagramView>,
      activeViewId: null,
      defaultLayoutConstraints: [],
      notifications: [],
      appMode: 'designer',
    } as any)
    const s = useDiagramStore.getState
    s()._sync()
    s().startLiveLayout({ skipBulk: true })
    const id = s().addNode({ type: 'person', label: 'Guest', description: '', collapsed: false, x: 284.6, y: 94.8, ...NODE_SIZES.person } as Omit<C4Node, 'id'>)
    const nodes = s().c4Nodes as Nodes
    s().stopLiveLayout()
    expect(nodes[id].x).toBeCloseTo(284.6, 6)
    expect(nodes[id].y).toBeCloseTo(94.8, 6)
    expect(overlaps(nodes, id, 'customer')).toBe(false)
    expect(overlaps(nodes, id, 'shop')).toBe(false)
  })
})

describe('A rebuild after the store moved an element', () => {
  it('takes the element\'s place from the model (item 261)', async () => {
    // An agent deleted one of Container 1.0's two components; a move
    // elsewhere then refitted Container 1.0 round the other one, which the
    // physics still held where it was before: reported from there, it lay
    // 50 px outside its container.
    const nodes: Nodes = {
      sys: node('sys', 'system', { x: 0, y: 0, width: 600, height: 400 }),
      box: node('box', 'container', { parentId: 'sys', x: 40, y: 120, width: 500, height: 260 }),
      kid: node('kid', 'component', { parentId: 'box', x: 280, y: 120 }),
      other: node('other', 'system', { x: 1000, y: 0 }),
    }
    const relations: Record<string, C4Relation> = { r1: { id: 'r1', sourceId: 'kid', targetId: 'other' } as C4Relation }
    const engine = engineFor(nodes, relations)
    engine.start(true)
    // The store refits the container round its child, and moves the system.
    Object.assign(nodes.sys, { x: 300 })
    Object.assign(nodes.box, { x: 30, width: 240 })
    Object.assign(nodes.kid, { x: 20 })
    // Something new elsewhere sets the physics going.
    nodes.guest = node('guest', 'person', { x: 1600, y: 600 })
    relations.r2 = { id: 'r2', sourceId: 'guest', targetId: 'other' } as C4Relation
    engine.invalidate()
    await wait(600)
    engine.stop()
    const box = absOf(nodes, 'box')
    const kid = absOf(nodes, 'kid')
    expect(kid.x).toBeGreaterThanOrEqual(box.x)
    expect(kid.x + nodes.kid.width).toBeLessThanOrEqual(box.x + nodes.box.width)
  })
})

describe('Pins', () => {
  it('keep a dropped element where it is when the physics moves the diagram around it', async () => {
    // The relations pull a and b together, but b was dropped and stays.
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 2000, y: 1500 }),
      c: node('c', 'system', { x: 500, y: 600 }),
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'a', targetId: 'b' } as C4Relation,
      r2: { id: 'r2', sourceId: 'b', targetId: 'c' } as C4Relation,
    }
    const pinned: string[] = []
    const engine = engineFor(nodes, relations, [], pinned)
    engine.start(true)
    calmDrag(engine, nodes, 'b', { x: 2400, y: 1800 })
    engine.release('b')
    engine.stop()
    expect(absOf(nodes, 'b')).toEqual({ x: 2400, y: 1800 })

    // The store records the pin; a run of the physics reads it from the model.
    pinned.push('b')
    const relaxed = relaxLayout({ nodes, relations, pinned })!
    expect(relaxed.b?.x ?? nodes.b.x).toBeCloseTo(2400, 0)
    expect(relaxed.b?.y ?? nodes.b.y).toBeCloseTo(1800, 0)
    // The others did move.
    expect(relaxed.a).toBeDefined()
    expect(Math.hypot(relaxed.a.x, relaxed.a.y)).toBeGreaterThan(100)
  })

  it('let a drop push a pinned element clear, which stays pinned where it lands', async () => {
    // Every drop pins, so the element dropped on was often dragged before:
    // the two used to stay on top of each other for good.
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 1000, y: 0 }),
      c: node('c', 'system', { x: 0, y: 1200 }),
    }
    const relations: Record<string, C4Relation> = { r1: { id: 'r1', sourceId: 'b', targetId: 'c' } as C4Relation }
    const pinned: string[] = []
    const engine = engineFor(nodes, relations, [], pinned)
    engine.start(true)
    calmDrag(engine, nodes, 'b', { x: 1000, y: 40 })
    engine.release('b')
    pinned.push('b')

    calmDrag(engine, nodes, 'a', { x: 960, y: 60 })
    engine.release('a')
    expect(absOf(nodes, 'a')).toEqual({ x: 960, y: 60 })
    expect(overlaps(nodes, 'a', 'b')).toBe(false)
    const landed = absOf(nodes, 'b')

    // The physics of a small diagram keeps b where the push left it.
    pinned.push('a')
    engine.invalidate()
    await wait(400)
    engine.stop()
    expect(absOf(nodes, 'b').x).toBeCloseTo(landed.x, 0)
    expect(absOf(nodes, 'b').y).toBeCloseTo(landed.y, 0)
    expect(overlaps(nodes, 'a', 'b')).toBe(false)
  })

  it('move the dropped element off one that lines hold on both axes', () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 1000, y: 0 }),
      row: node('row', 'system', { x: 2000, y: 0 }),
      col: node('col', 'system', { x: 1000, y: 1000 }),
    }
    const relations: Record<string, C4Relation> = {}
    withFillers(nodes, relations)
    const engine = engineFor(nodes, relations, [
      { axis: 'y', ids: ['b', 'row'], orders: [] },
      { axis: 'x', ids: ['b', 'col'], orders: [] },
    ])
    engine.start(true)
    calmDrag(engine, nodes, 'a', { x: 960, y: 60 })
    engine.release('a')
    engine.stop()
    expect(absOf(nodes, 'b')).toEqual({ x: 1000, y: 0 })
    expect(overlaps(nodes, 'a', 'b')).toBe(false)
  })

  it('hold after a click on the pinned element', async () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 2000, y: 1500 }),
    }
    const relations: Record<string, C4Relation> = { r1: { id: 'r1', sourceId: 'a', targetId: 'b' } as C4Relation }
    const engine = engineFor(nodes, relations, [], ['b'])
    engine.start(true)
    engine.grab('b', 2000, 1500, 'calm', { x: 2000, y: 1500 })
    engine.release('b')
    await wait(400)
    engine.stop()
    expect(absOf(nodes, 'b').x).toBeCloseTo(2000, 0)
    expect(absOf(nodes, 'b').y).toBeCloseTo(1500, 0)
  })

  it('hold through a push drag of a neighbour', async () => {
    const nodes: Nodes = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 400, y: 0 }),
    }
    const relations: Record<string, C4Relation> = {}
    // Under WHOLE_DIAGRAM_MAX_NODES: from there up a push drag is a calm
    // one, whose drop pushes pinned elements clear too.
    withFillers(nodes, relations, 100)
    const engine = engineFor(nodes, relations, [], ['b'])
    engine.start(true)
    // Push a onto b: the physics makes room, but not by moving b.
    engine.grab('a', 0, 0, 'push')
    for (let i = 1; i <= 10; i++) {
      engine.drag('a', 40 * i, 0)
      await wait(16)
    }
    engine.release('a')
    await wait(300)
    engine.stop()
    expect(absOf(nodes, 'b').x).toBeCloseTo(400, 0)
    expect(absOf(nodes, 'b').y).toBeCloseTo(0, 0)
  })
})

describe('Pins in the store', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      c4Nodes: {
        a: node('a', 'system', { x: 0, y: 0 }),
        b: node('b', 'system', { x: 600, y: 0 }),
      },
      c4Relations: {},
      views: {} as Record<string, DiagramView>,
      activeViewId: null,
      defaultLayoutConstraints: [],
      notifications: [],
      appMode: 'designer',
    } as any)
    useDiagramStore.getState()._sync()
  })

  it('pins what a drag drops, unpins as one undo step, forgets deleted elements', () => {
    const s = useDiagramStore.getState
    s().liveGrab('a', 0, 0)
    s().liveRelease('a', ['b'])
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a', 'b'])

    s().unpinNodes(['a'])
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['b'])
    s().undo()
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a', 'b'])

    s().removeNode('b')
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a'])
    s().removeNode('a')
    expect(s().defaultLayoutConstraints).toEqual([])
  })

  it('the Ensemble unpins the canvas it arranges, in the same undo step', async () => {
    const s = useDiagramStore.getState
    // On top of each other: Smart Layout has something to do.
    useDiagramStore.setState({
      c4Nodes: {
        a: node('a', 'system', { x: 0, y: 0 }),
        b: node('b', 'system', { x: 10, y: 10 }),
        c: node('c', 'system', { x: 20, y: 20 }),
      },
    } as any)
    s()._sync()
    const vid = s().addView('Ensemble')
    s().setActiveView(vid)
    s().setViewLayoutMode(vid, 'ensemble')
    s().liveRelease('a', ['b'])
    expect(pinnedNodeIds(s().views[vid].layoutConstraints)).toEqual(['a', 'b'])
    await s().runSmartLayout()
    expect(pinnedNodeIds(s().views[vid].layoutConstraints)).toEqual([])
    s().undo()
    expect(pinnedNodeIds(s().views[vid].layoutConstraints)).toEqual(['a', 'b'])
  }, 60_000)

  it('Tidy keeps the pins and leaves the pinned elements where they are', async () => {
    const s = useDiagramStore.getState
    useDiagramStore.setState({
      c4Nodes: {
        a: node('a', 'system', { x: 0, y: 0 }),
        b: node('b', 'system', { x: 600, y: 0 }),
        c: node('c', 'system', { x: 20, y: 20 }),
        d: node('d', 'system', { x: 30, y: 30 }),
      },
      c4Relations: { ab: { id: 'ab', sourceId: 'a', targetId: 'b' }, cd: { id: 'cd', sourceId: 'c', targetId: 'd' } },
    } as any)
    s()._sync()
    s().liveRelease('a', ['b'])
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a', 'b'])
    await s().runSmartLayout()
    expect(pinnedNodeIds(s().defaultLayoutConstraints)).toEqual(['a', 'b'])
    expect([s().c4Nodes.a.x, s().c4Nodes.a.y, s().c4Nodes.b.x, s().c4Nodes.b.y]).toEqual([0, 0, 600, 0])
    // The rest was tidied off them.
    for (const id of ['c', 'd']) for (const p of ['a', 'b']) {
      const m = s().c4Nodes[id], f = s().c4Nodes[p]
      expect(m.x >= f.x + f.width || f.x >= m.x + m.width || m.y >= f.y + f.height || f.y >= m.y + m.height, `${id} clear of ${p}`).toBe(true)
    }
  }, 60_000)

  it('pins in the active view only', () => {
    const s = useDiagramStore.getState
    const vid = s().addView('Context')
    s().setActiveView(vid)
    s().liveRelease('a')
    expect(pinnedNodeIds(s().views[vid].layoutConstraints)).toEqual(['a'])
    expect(s().defaultLayoutConstraints).toEqual([])
  })
})
