/**
 * A diagram that has a layout keeps it. The live physics used to relax every
 * diagram under 150 nodes as a whole after each rebuild (open, view switch,
 * undo, Smart Layout): on a dozen nodes that moved every element by hundreds
 * of pixels, and what was saved was the physics' layout, not the one Smart
 * Layout had chosen and reported. It now moves only what is new, with its
 * surroundings; relaxing a whole diagram is relaxLayout, which Smart Layout
 * scores as a candidate.
 */
import { describe, it, expect } from 'vitest'
import { LiveColaEngine, relaxLayout, LIVE_CHILD_TOP_MIN, WHOLE_DIAGRAM_MAX_NODES, type LiveColaPositions } from '../src/liveColaEngine'
import { CANVAS_MAX_ELEMENTS, type C4Node, type C4Relation } from '@radical/common/c4'

type Nodes = Record<string, C4Node>

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function node(id: string, x: number, y: number, parentId?: string): C4Node {
  return { id, type: 'system', label: id, x, y, width: 280, height: 180, collapsed: false, parentId }
}

/** Three related systems far apart: relaxed, the relations pull them together. */
function spread(): { nodes: Nodes; relations: Record<string, C4Relation> } {
  return {
    nodes: { a: node('a', 0, 0), b: node('b', 2000, 0), c: node('c', 1000, 1800) },
    relations: {
      ab: { id: 'ab', sourceId: 'a', targetId: 'b' },
      bc: { id: 'bc', sourceId: 'b', targetId: 'c' },
    },
  }
}

/** An engine over `nodes`, recording every position it reports. */
function engineOver(nodes: Nodes, relations: Record<string, C4Relation>): { engine: LiveColaEngine; moved: LiveColaPositions } {
  const moved: LiveColaPositions = {}
  const engine = new LiveColaEngine({
    getModel: () => ({ nodes, relations }),
    applyPositions: (positions) => {
      for (const [id, pos] of Object.entries(positions)) {
        moved[id] = pos
        if (nodes[id]) nodes[id] = { ...nodes[id], x: pos.x, y: pos.y }
      }
    },
  })
  return { engine, moved }
}

const at = (nodes: Nodes): Record<string, { x: number; y: number }> =>
  Object.fromEntries(Object.values(nodes).map((n) => [n.id, { x: n.x, y: n.y }]))

describe('Live layout physics: a diagram that has a layout', () => {
  it('keeps it when it is opened', async () => {
    const { nodes, relations } = spread()
    const before = at(nodes)
    const { engine } = engineOver(nodes, relations)
    engine.start(true)
    await wait(300)
    engine.stop()
    expect(at(nodes)).toEqual(before)
  })

  it('keeps it when its positions are replaced (a view switch, an undo, Smart Layout)', async () => {
    const { nodes, relations } = spread()
    const { engine } = engineOver(nodes, relations)
    engine.start(true)
    nodes.a = { ...nodes.a, x: -500, y: 300 }
    const before = at(nodes)
    engine.reset()
    await wait(300)
    engine.stop()
    expect(at(nodes)).toEqual(before)
  })

  it('moves only a new element and its surroundings when one is added', async () => {
    const { nodes, relations } = spread()
    // A second, unrelated pair, also far apart.
    nodes.p = node('p', 5000, 0)
    nodes.q = node('q', 7000, 0)
    relations.pq = { id: 'pq', sourceId: 'p', targetId: 'q' }
    const { engine } = engineOver(nodes, relations)
    engine.start(true)

    // Dropped on top of a, and related to it.
    nodes.fresh = node('fresh', 40, 40)
    relations.fa = { id: 'fa', sourceId: 'fresh', targetId: 'a' }
    const before = at(nodes)
    engine.invalidate()
    await wait(600)
    engine.stop()

    const after = at(nodes)
    expect(after.p).toEqual(before.p)
    expect(after.q).toEqual(before.q)
    // It was pushed clear of a.
    const clear = after.fresh.x >= after.a.x + 280 || after.fresh.x + 280 <= after.a.x
      || after.fresh.y >= after.a.y + 180 || after.fresh.y + 180 <= after.a.y
    expect(clear).toBe(true)
  })

  it('lets named elements settle after its positions were replaced (the members of a new alignment)', async () => {
    const { nodes, relations } = spread()
    nodes.p = node('p', 5000, 0)
    nodes.q = node('q', 7000, 0)
    relations.pq = { id: 'pq', sourceId: 'p', targetId: 'q' }
    const { engine } = engineOver(nodes, relations)
    engine.start(true)
    const before = at(nodes)
    engine.reset(['a'])
    await wait(600)
    engine.stop()
    const after = at(nodes)
    // a and what it is related to moved; the unrelated pair did not.
    expect(after.a).not.toEqual(before.a)
    expect(after.p).toEqual(before.p)
    expect(after.q).toEqual(before.q)
  })

  it('keeps it through a ⌘/Ctrl-click: a push grab released without a move (item 214)', async () => {
    const { nodes, relations } = spread()
    const before = at(nodes)
    const { engine } = engineOver(nodes, relations)
    engine.start(true)
    engine.grab('a', 0, 0, 'push', { x: 0, y: 0 })
    // React Flow reports a click as a drag that goes nowhere.
    engine.drag('a', 0, 0, { x: 0, y: 0 })
    await wait(300)
    engine.release('a')
    await wait(300)
    engine.stop()
    expect(at(nodes)).toEqual(before)
  })

  it('still arranges one that has no layout yet', async () => {
    const nodes: Nodes = { a: node('a', 0, 0), b: node('b', 0, 0), c: node('c', 0, 0) }
    const { engine, moved } = engineOver(nodes, spread().relations)
    engine.start()
    await wait(300)
    engine.stop()
    expect(Object.keys(moved).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('Live layout physics: a push drag on a diagram that has a layout', () => {
  // A grid with a person in every row. The physics keeps people above
  // everything else when it arranges a diagram; this layout does not have
  // them there. Imposed on it, that order threw the first element the
  // physics could move across the diagram: the dropped one ended up below
  // the whole grid, 3 400 px away, though it was pinned at the drop.
  function grid(count: number): { nodes: Nodes; relations: Record<string, C4Relation> } {
    const nodes: Nodes = {}
    const relations: Record<string, C4Relation> = {}
    const name = (i: number): string => `n${String(i).padStart(3, '0')}`
    for (let i = 0; i < count; i++) {
      nodes[name(i)] = { ...node(name(i), (i % 15) * 460, Math.floor(i / 15) * 360), type: i % 7 === 0 ? 'person' : 'system' } as C4Node
      if (i % 2 === 1) relations[`r${i}`] = { id: `r${i}`, sourceId: name(i - 1), targetId: name(i) }
    }
    return { nodes, relations }
  }

  // Below the size from which a push drag frees only its surroundings, and at it.
  for (const count of [WHOLE_DIAGRAM_MAX_NODES - 1, WHOLE_DIAGRAM_MAX_NODES]) {
    it(`leaves the element where it was dropped (${count} elements)`, async () => {
      const { nodes, relations } = grid(count)
      const before = at(nodes)
      const { engine } = engineOver(nodes, relations)
      engine.start(true)
      const from = before.n016
      engine.grab('n016', from.x, from.y, 'push', from)
      for (let step = 1; step <= 10; step++) {
        const x = from.x + 10.3 * step
        nodes.n016 = { ...nodes.n016, x }
        engine.drag('n016', x, from.y, { x, y: from.y })
        await wait(30)
      }
      engine.release('n016')
      await wait(1500)
      engine.stop()

      const after = at(nodes)
      expect(after.n016.x).toBeCloseTo(from.x + 103, 0)
      expect(after.n016.y).toBeCloseTo(from.y, 0)
      // From that size up only its surroundings are free: its neighbour
      // made room, nobody was sent across the diagram. (Below it, a push
      // drag relaxes the whole diagram, which is what it is for.)
      if (count >= WHOLE_DIAGRAM_MAX_NODES) {
        const farthest = Math.max(...Object.keys(before).map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)))
        expect(farthest).toBeLessThan(300)
      }
    }, 20_000)
  }
})

describe('Live layout physics: a push drag on a large diagram', () => {
  // Run 19: from 150 elements a push drag freed the 40 nearest by relation
  // and froze the rest. Relations to frozen elements far away pulled those
  // 40 across the diagram (2 500 to 5 000 px), the canvas took a minute or
  // more to rest, and they came to rest on top of frozen ones.
  it('moves what is held, and clears only what it lands on', async () => {
    const nodes: Nodes = {}
    const relations: Record<string, C4Relation> = {}
    const name = (i: number): string => `n${String(i).padStart(3, '0')}`
    const count = WHOLE_DIAGRAM_MAX_NODES + 50
    for (let i = 0; i < count; i++) nodes[name(i)] = node(name(i), (i % 20) * 460, Math.floor(i / 20) * 360)
    // Relations across the diagram, as a laid-out model has them.
    for (let i = 0; i < count; i++) {
      const j = (i * 37 + 11) % count
      if (j !== i) relations[`r${i}`] = { id: `r${i}`, sourceId: name(i), targetId: name(j) }
    }
    const before = at(nodes)
    const { engine } = engineOver(nodes, relations)
    engine.start(true)
    const held = 'n106'
    const from = before[held]
    engine.grab(held, from.x, from.y, 'push', from)
    // Onto its right-hand neighbour's place.
    for (let step = 1; step <= 10; step++) {
      const x = from.x + 46 * step
      const y = from.y + 9 * step
      nodes[held] = { ...nodes[held], x, y }
      engine.drag(held, x, y, { x, y })
      await wait(20)
    }
    engine.release(held)
    await wait(1500)
    engine.stop()

    const after = at(nodes)
    expect(after[held].x).toBeCloseTo(from.x + 460, 0)
    expect(after[held].y).toBeCloseTo(from.y + 90, 0)
    const moves = Object.keys(before).filter((id) => id !== held)
      .map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y))
    // Only what it landed on made room, by about its own size.
    expect(moves.filter((d) => d > 0.5).length).toBeLessThanOrEqual(3)
    expect(Math.max(...moves)).toBeLessThan(500)
    const ids = Object.keys(after)
    const overlapping: string[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = after[ids[i]], b = after[ids[j]]
        if (a.x < b.x + 280 && b.x < a.x + 280 && a.y < b.y + 180 && b.y < a.y + 180) overlapping.push(`${ids[i]}/${ids[j]}`)
      }
    }
    expect(overlapping).toEqual([])
  }, 20_000)
})

describe('relaxLayout', () => {
  it('brings a whole diagram to rest, the same way every time', () => {
    const first = relaxLayout(spread())!
    const second = relaxLayout(spread())!
    expect(second).toEqual(first)
    // The relations pulled the three together.
    const { nodes } = spread()
    const span = (pos: Record<string, { x: number; y: number }>): number =>
      Math.max(...Object.values(pos).map((p) => p.x)) - Math.min(...Object.values(pos).map((p) => p.x))
    expect(span(first)).toBeLessThan(span(at(nodes)) / 2)
  })

  it('leaves the model it was given as it was', () => {
    const model = spread()
    const before = at(model.nodes)
    relaxLayout(model)
    expect(at(model.nodes)).toEqual(before)
  })

  it('has a live form, for a canvas that shows the diagram settle', async () => {
    const { nodes, relations } = spread()
    const before = at(nodes)
    const { engine, moved } = engineOver(nodes, relations)
    engine.relaxLive()
    await wait(600)
    engine.stop()
    expect(Object.keys(moved).sort()).toEqual(['a', 'b', 'c'])
    expect(at(nodes)).not.toEqual(before)
  })

  it('keeps every child at least LIVE_CHILD_TOP_MIN below the top of its parent', () => {
    // The canvas draws a child nearer the top than that lower (a safeguard
    // for old files). Were the physics to place one nearer, the canvas
    // would show it elsewhere than the model has it after the next reload.
    const box = (id: string, type: string, x: number, y: number, w: number, h: number, parentId?: string): C4Node =>
      ({ id, type, label: id, x, y, width: w, height: h, collapsed: false, parentId } as C4Node)
    const nodes: Nodes = {
      sys: box('sys', 'system', 0, 0, 1400, 900),
      grp: box('grp', 'group', 40, 130, 900, 600, 'sys'),
      ctn: box('ctn', 'container', 40, 130, 600, 400, 'grp'),
      c1: box('c1', 'component', 30, 120, 200, 120, 'ctn'),
      c2: box('c2', 'component', 300, 120, 200, 120, 'ctn'),
      api: box('api', 'container', 700, 130, 300, 200, 'grp'),
      db: box('db', 'database', 1000, 130, 190, 130, 'sys'),
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'c1', targetId: 'c2' },
      r2: { id: 'r2', sourceId: 'c2', targetId: 'api' },
      r3: { id: 'r3', sourceId: 'api', targetId: 'db' },
    }
    const relaxed = relaxLayout({ nodes, relations })!
    for (const n of Object.values(nodes)) {
      if (n.parentId) expect(relaxed[n.id].y, `${n.id} in ${n.parentId}`).toBeGreaterThanOrEqual(LIVE_CHILD_TOP_MIN)
    }
  })

  it('does not take on a diagram too large to relax', () => {
    const nodes: Nodes = {}
    for (let i = 0; i < WHOLE_DIAGRAM_MAX_NODES; i++) nodes[`n${i}`] = node(`n${i}`, (i % 15) * 400, Math.floor(i / 15) * 300)
    expect(relaxLayout({ nodes, relations: {} })).toBeNull()
  })
})

describe('Live layout physics: collapsing a container', () => {
  // A container that is collapsed becomes one box where it was a frame
  // around others. The engine took it for a new element and freed the 40
  // elements nearest to it, reaching into other containers whose frames and
  // other children stayed fixed: in a model nested four levels deep the
  // canvas never came to rest, and elements ended outside their frames.
  function nested(): { nodes: Nodes; relations: Record<string, C4Relation> } {
    const nodes: Nodes = {}
    const relations: Record<string, C4Relation> = {}
    const box = (id: string, type: string, x: number, y: number, width: number, height: number, parentId?: string): void => {
      nodes[id] = { id, type, label: id, x, y, width, height, collapsed: false, parentId } as C4Node
    }
    for (let s = 0; s < 2; s++) {
      box(`s${s}`, 'system', s * 1700, 0, 1600, 1500)
      for (let c = 0; c < 3; c++) {
        box(`s${s}c${c}`, 'container', 40 + c * 510, 130, 480, 1300, `s${s}`)
        for (let k = 0; k < 5; k++) box(`s${s}c${c}k${k}`, 'component', 40, 130 + k * 220, 400, 180, `s${s}c${c}`)
        if (c > 0) relations[`s${s}c${c}`] = { id: `s${s}c${c}`, sourceId: `s${s}c${c - 1}k0`, targetId: `s${s}c${c}k0` }
      }
    }
    relations.across = { id: 'across', sourceId: 's0c2k1', targetId: 's1c0k1' }
    return { nodes, relations }
  }

  it('moves nothing: the container shrinks where it is', async () => {
    const { nodes, relations } = nested()
    const { engine, moved } = engineOver(nodes, relations)
    engine.start(true)
    await wait(100)
    for (const id of Object.keys(moved)) delete moved[id]

    nodes.s0c1 = { ...nodes.s0c1, collapsed: true }
    const before = at(nodes)
    engine.invalidate()
    await wait(800)
    engine.stop()
    expect(Object.keys(moved)).toEqual([])
    expect(at(nodes)).toEqual(before)
  })

  it('opening it again frees what it shows, with its surroundings', async () => {
    const { nodes, relations } = nested()
    nodes.s0c1 = { ...nodes.s0c1, collapsed: true }
    const { engine, moved } = engineOver(nodes, relations)
    engine.start(true)
    await wait(100)
    // The children come back on top of each other: the engine parts them.
    for (let k = 0; k < 5; k++) nodes[`s0c1k${k}`] = { ...nodes[`s0c1k${k}`], x: 40, y: 130 }
    nodes.s0c1 = { ...nodes.s0c1, collapsed: false }
    for (const id of Object.keys(moved)) delete moved[id]
    engine.invalidate()
    await wait(1500)
    engine.stop()
    expect(Object.keys(moved).some((id) => id.startsWith('s0c1k'))).toBe(true)
    const ys = [0, 1, 2, 3, 4].map((k) => nodes[`s0c1k${k}`].y)
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(5)
  })
})

describe('Live layout physics: more elements than a canvas draws', () => {
  it('lays out none of them, and builds none of its matrices', async () => {
    const nodes: Nodes = {}
    const relations: Record<string, C4Relation> = {}
    for (let i = 0; i <= CANVAS_MAX_ELEMENTS; i++) {
      nodes[`n${i}`] = node(`n${i}`, (i % 40) * 300, Math.floor(i / 40) * 200)
      if (i) relations[`r${i}`] = { id: `r${i}`, sourceId: `n${i - 1}`, targetId: `n${i}` }
    }
    const before = at(nodes)
    const { engine, moved } = engineOver(nodes, relations)
    expect(() => engine.start(false)).not.toThrow()
    await wait(100)
    expect((engine as unknown as { cola: unknown }).cola).toBeNull()
    expect(() => { engine.grab('n0', 10, 10); engine.drag('n0', 50, 50); engine.release('n0') }).not.toThrow()
    engine.stop()
    expect(moved).toEqual({})
    expect(at(nodes)).toEqual(before)
  })
})
