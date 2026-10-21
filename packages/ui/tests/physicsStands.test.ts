/**
 * The live physics leaves a laid-out diagram where it stands: what the
 * invariant fuzzer (invariants.test.ts) found it moving after the fact.
 *
 * Covers:
 *   - a row of two open containers the physics framed stays where it is
 *     on a reload, also after a fold or a drop inside one of them (fuzzer K2)
 *   - a row's members stay where they are when the layout is built again
 *     (an unfold): a later drag does not show them elsewhere (K5c)
 *   - a run of the physics comes to rest, on the sample too (K20)
 *   - an unfold on a view that does not draw the children leaves nothing
 *     that moves them later on another canvas (K22)
 *
 * The physics' timer is stepped by hand on a 16 ms frame clock, as the
 * fuzzer steps it, so every run is the same on every machine.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, DiagramView } from '@radical/common/c4'
import { nodeTypeSize } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import bookstoreText from '../../../apps/e2e/fixtures/bookstore.radical?raw'
import sampleText from '../../../apps/studio/src/renderer/src/store/fintechSampleData.json?raw'

vi.mock('d3-timer', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  interface ManualTimer { cb: (elapsed: number) => void; t0: number; stop(): void; restart(cb: (elapsed: number) => void, delay?: number): void }
  const timers = new Set<ManualTimer>()
  let clock = 0
  const timer = (cb: (elapsed: number) => void, delay = 0): ManualTimer => {
    const t: ManualTimer = {
      cb,
      t0: clock + delay,
      stop() { timers.delete(t) },
      restart(next, d = 0) { t.cb = next; t.t0 = clock + d; timers.add(t) },
    }
    timers.add(t)
    return t
  }
  ;(globalThis as Record<string, unknown>).__physicsTimers = {
    timers,
    tick() {
      clock += 16
      for (const t of [...timers]) if (timers.has(t)) t.cb(clock - t.t0)
    },
  }
  return { ...real, timer, now: () => clock }
})

import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const timers = (): { timers: Set<unknown>; tick(): void } =>
  (globalThis as unknown as { __physicsTimers: { timers: Set<unknown>; tick(): void } }).__physicsTimers

let frameClock = 1_000_000
/** Steps the physics until it rests, at most `frames` frames; the frames it took. */
function rest(frames = 2500): number {
  const realNow = performance.now
  performance.now = () => frameClock
  let n = 0
  try {
    for (; n < frames && timers().timers.size; n++) { timers().tick(); frameClock += 16 }
  } finally {
    performance.now = realNow
  }
  return n
}

interface Box { x: number; y: number; width: number; height: number }
/** Every element as the canvas draws it, at its absolute place. */
function drawn(): Record<string, Box> {
  const rf = s().rfNodes
  const byId = Object.fromEntries(rf.map((n) => [n.id, n]))
  const out: Record<string, Box> = {}
  for (const n of rf) {
    if (n.hidden) continue
    let { x, y } = n.position
    for (let p = n.parentNode; p && byId[p]; p = byId[p].parentNode) { x += byId[p].position.x; y += byId[p].position.y }
    out[n.id] = { x, y, width: Number(n.width), height: Number(n.height) }
  }
  return out
}

/** A calm drag on the canvas shown, in three moves, then the drop. */
function drag(id: string, dx: number, dy: number): void {
  const from = { ...s().rfNodes.find((n) => n.id === id)!.position }
  const abs = { x: drawn()[id].x, y: drawn()[id].y }
  s().liveGrab(id, from.x, from.y, 'calm', abs, [])
  for (const k of [1, 2, 3]) s().liveDrag(id, from.x + (dx * k) / 3, from.y + (dy * k) / 3, { x: abs.x + (dx * k) / 3, y: abs.y + (dy * k) / 3 })
  s().liveRelease(id, [], true)
  rest()
}

/** A palette drop at (relX, relY) in `parentId`'s frame. */
function drop(type: string, parentId: string | undefined, relX: number, relY: number): string {
  const size = nodeTypeSize(type, s().metamodel)
  const id = s().requestCreateNode({ type, label: type, description: '', technology: '', collapsed: false, external: false, parentId, x: relX - size.width / 2, y: relY - size.height / 2, ...size } as Omit<C4Node, 'id'>, { skipWizard: true })
  rest()
  return id
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const bookstore = (): DiagramData => JSON.parse(bookstoreText) as DiagramData

beforeEach(() => { s().setAppMode('designer') })
afterEach(() => s().stopLiveLayout())

describe('a row of containers the physics framed', () => {
  it('stays where it is on a reload (fuzzer K2)', () => {
    // A container dropped into Payment Provider, then it and Bookstore kept
    // in a row: the physics lined up their bounds, not their frames as
    // drawn, and saved them off the line; read again, the row was snapped
    // and Bookstore refit (top 333.5 → 273.8, 980 → 920 wide).
    s().loadDiagram(bookstore())
    rest()
    drop('container', 'payments', 15, 9)
    s().addAlignment('horizontal', ['payments', 'bookstore'])
    rest()
    const before = drawn()
    const saved = clone(s().saveDiagram())
    s().loadDiagram(clone(saved))
    rest()
    const after = drawn()
    for (const id of ['bookstore', 'payments', 'web', 'api', 'db']) {
      expect(after[id].x, id).toBeCloseTo(before[id].x, 0)
      expect(after[id].y, id).toBeCloseTo(before[id].y, 0)
      expect(after[id].width, id).toBeCloseTo(before[id].width, 0)
      expect(after[id].height, id).toBeCloseTo(before[id].height, 0)
    }
    expect(s().saveDiagram().defaultPositions).toEqual(saved.defaultPositions)
  })

  it('stays on its line when a fold inside one of them shrinks it, and on a reload (fuzzer K2)', () => {
    // Bookstore and Customer in a row, API folded: Bookstore shrank round
    // the folded API and left the line by 30 px; read again, the row was
    // snapped and Bookstore refit (Web App, API, Orders DB 60 px lower in it).
    s().loadDiagram(bookstore())
    rest()
    s().addAlignment('horizontal', ['bookstore', 'customer'])
    rest()
    s().toggleCollapse('api')
    rest()
    const d = drawn()
    expect(Math.abs(d.bookstore.y + d.bookstore.height / 2 - (d.customer.y + d.customer.height / 2))).toBeLessThanOrEqual(0.5)
    const saved = clone(s().saveDiagram())
    s().loadDiagram(clone(saved))
    rest()
    expect(s().saveDiagram().defaultPositions).toEqual(saved.defaultPositions)
  })
})

describe('a row of containers, one of them holding what is dragged', () => {
  it('stays on its line after a drop pushes inside it, and on a reload (fuzzer K2)', () => {
    // Nested model, Smart Layout, Component 0.0.1 dragged 1 px: the drop
    // pushed the component below it, Container 0.0 grew, and the row of
    // containers it is on did not follow (2.5 px off); read again, the row
    // was snapped and every container refit (Container 0.0 (84, 84) →
    // (30, 120)). Here: Orders' Billing dropped 4 px nearer Ledger.
    const box = (id: string, type: string, parentId: string | undefined, x: number, y: number, width: number, height: number): C4Node =>
      ({ id, type, label: id, description: '', parentId, x, y, width, height, collapsed: false }) as C4Node
    s().loadDiagram({
      nodes: [
        box('shop', 'system', undefined, 0, 0, 1180, 760),
        box('web', 'container', 'shop', 30, 270, 240, 160),
        box('orders', 'container', 'shop', 330, 120, 280, 610),
        box('k0', 'component', 'orders', 30, 120, 220, 140),
        box('k1', 'component', 'orders', 30, 284, 220, 140),
        box('k2', 'component', 'orders', 30, 448, 220, 140),
        box('api', 'container', 'shop', 670, 270, 240, 160),
      ],
      relations: [],
      views: [],
      defaultLayoutConstraints: [{ id: 'row', type: 'align', axis: 'horizontal', nodeIds: ['web', 'orders', 'api'] }],
    } as DiagramData)
    rest()
    drag('k1', 0, 4)
    const after = drawn()
    const mid = (id: string): number => after[id].y + after[id].height / 2
    expect(Math.abs(mid('web') - mid('orders'))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(mid('api') - mid('orders'))).toBeLessThanOrEqual(0.5)
    const saved = clone(s().saveDiagram())
    s().loadDiagram(clone(saved))
    rest()
    expect(s().saveDiagram().defaultPositions).toEqual(saved.defaultPositions)
  })
})

describe('a row of elements in a container', () => {
  it('stays where it is when the layout is built again (fuzzer K5c)', () => {
    // API and Orders DB in a row, Bookstore folded and unfolded: WebCoLa's
    // start spread the row (centres a box width apart) unseen, and a 1 px
    // drag of Bookstore showed Orders DB 55 px further right, out of it.
    s().loadDiagram(bookstore())
    rest()
    s().addAlignment('horizontal', ['api', 'db'])
    rest()
    s().toggleCollapse('bookstore')
    rest()
    s().toggleCollapse('bookstore')
    rest()
    const before = drawn()
    drag('bookstore', 0, 1)
    const after = drawn()
    for (const id of ['web', 'api', 'db']) {
      expect(after[id].x, id).toBeCloseTo(before[id].x, 0)
      expect(after[id].y, id).toBeCloseTo(before[id].y + 1, 0)
    }
    expect(after.db.x + after.db.width).toBeLessThanOrEqual(after.bookstore.x + after.bookstore.width)
  })
})

describe('a run of the physics', () => {
  it('comes to rest: an add into a container on the sample (fuzzer K20)', () => {
    // Auth Service folded, a component dropped into Accounts Service: after
    // 2500 frames (40 s) 19 elements still moved, ADR-000 by 21 px a second.
    const sample = JSON.parse(sampleText) as DiagramData
    sample.metamodel ??= builtInGovernanceMetamodel()
    s().loadDiagram(sample)
    rest()
    s().toggleCollapse('ctn-auth')
    rest()
    const accounts = drawn()['ctn-accounts']
    s().requestCreateNode({ type: 'component', label: 'Component', description: '', technology: '', collapsed: false, external: false, parentId: 'ctn-accounts', x: accounts.width * 0.27 - 110, y: accounts.height * 0.61 - 70, ...nodeTypeSize('component', s().metamodel) } as Omit<C4Node, 'id'>, { skipWizard: true })
    const frames = rest()
    expect(timers().timers.size).toBe(0)
    // Within the cap on a run (8 s), not at the end of the frames given.
    expect(frames).toBeLessThan(600)
    const settled = drawn()
    rest(60)
    expect(drawn()).toEqual(settled)
  }, 60_000)
})

describe('an unfold on a view that does not draw the children', () => {
  /** A system with two containers; Orders holds two components. The view
   *  Containers draws the system and the containers only, laid out
   *  elsewhere than All elements. */
  const model = (): DiagramData => ({
    nodes: [
      { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 300, width: 1060, height: 340, collapsed: false },
      { id: 'web', type: 'container', label: 'Web', parentId: 'sys', x: 30, y: 120, width: 240, height: 160, collapsed: false },
      { id: 'orders', type: 'container', label: 'Orders', parentId: 'sys', x: 330, y: 120, width: 700, height: 300, collapsed: false },
      { id: 'k1', type: 'component', label: 'Checkout', parentId: 'orders', x: 40, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'k2', type: 'component', label: 'Billing', parentId: 'orders', x: 440, y: 120, width: 220, height: 140, collapsed: false },
      { id: 'buyer', type: 'person', label: 'Buyer', x: 400, y: 0, width: 150, height: 170, collapsed: false },
    ] as C4Node[],
    relations: [{ id: 'r1', sourceId: 'buyer', targetId: 'k1', label: 'orders' }],
    views: [{
      id: 'v', name: 'Containers', kind: 'static', nodeIds: ['sys', 'web', 'orders', 'buyer'],
      positions: {
        sys: { x: 900, y: 600, width: 640, height: 310 },
        web: { x: 30, y: 120, width: 240, height: 160 },
        orders: { x: 330, y: 120, width: 700, height: 300 },
        buyer: { x: 1100, y: 200, width: 150, height: 170 },
      },
    } as DiagramView],
  })

  it('leaves nothing that moves them later on All elements (fuzzer K22)', () => {
    // The unfold seeded the physics with the children's places on the view
    // (Orders 900 px right there); they were not drawn, so the seeds stayed
    // until All elements built them: the next drag showed them there.
    s().loadDiagram(model())
    rest()
    s().setActiveView('v')
    rest()
    s().toggleCollapse('orders')
    rest()
    s().toggleCollapse('orders')
    rest()
    s().setActiveView(null)
    rest()
    const before = drawn()
    drag('buyer', -200, 0)
    const after = drawn()
    expect(after.k1).toEqual(before.k1)
    expect(after.k2).toEqual(before.k2)
  })

  it('leaves nothing that moves them after the model is read again', () => {
    s().loadDiagram(model())
    rest()
    s().setActiveView('v')
    rest()
    s().toggleCollapse('orders')
    rest()
    s().toggleCollapse('orders')
    rest()
    s().loadDiagram(model())
    rest()
    const before = drawn()
    drag('buyer', -200, 0)
    const after = drawn()
    expect(after.k1).toEqual(before.k1)
    expect(after.k2).toEqual(before.k2)
  })
})
