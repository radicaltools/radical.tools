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
import type { C4Node, C4Relation } from '@radical/common/c4'

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

  it('still arranges one that has no layout yet', async () => {
    const nodes: Nodes = { a: node('a', 0, 0), b: node('b', 0, 0), c: node('c', 0, 0) }
    const { engine, moved } = engineOver(nodes, spread().relations)
    engine.start()
    await wait(300)
    engine.stop()
    expect(Object.keys(moved).sort()).toEqual(['a', 'b', 'c'])
  })
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
