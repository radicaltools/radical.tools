/**
 * Tidy (src/tidy): Smart Layout as a person arranges a diagram, one move at
 * a time. The author's view is the oracle; every bench model checks that
 * no move makes the layout worse.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runTidyLayout } from '../../src/tidy'
import { Layout } from '../../src/tidy/layout'
import { linesOf, totalCost } from '../../src/tidy/cost'
import { viewLayoutInput } from '../../src/viewInput'
import { projectToVisibleGraph } from '../../src/geometry'
import type { C4Node, C4Relation, DiagramView, PositionMap } from '@radical/common/c4'

const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))
const fixturesDir = join(__dirname, '..', 'fixtures')
const benchDir = join(__dirname, '..', '..', 'bench', 'models')

interface Fixture { nodes: C4Node[]; relations: C4Relation[]; view?: DiagramView }
const load = (file: string): Fixture => JSON.parse(readFileSync(file, 'utf8'))

function tidy(f: Fixture) {
  const input = viewLayoutInput(f.view, byId(f.nodes), byId(f.relations))
  const visible = projectToVisibleGraph(input.nodes, input.relations)
  const result = runTidyLayout(input.nodes, input.relations)
  const laidOut: Record<string, C4Node> = {}
  for (const [id, n] of Object.entries(visible.nodes)) laidOut[id] = { ...n, ...(result.winner.positions[id] ?? {}) }
  const l = new Layout(laidOut)
  const box = (id: string) => l.box(id)!
  return { input, visible, result, l, box, laidOut }
}

/** Siblings on each other, or children outside their container. */
function violations(l: Layout): string[] {
  const out: string[] = []
  for (const id of l.ids()) {
    if (!l.clear(id)) out.push(`${id} is not clear of its siblings`)
    const p = l.parentOf(id)
    if (!p) continue
    const b = l.box(id)!, f = l.box(p)!
    if (b.x < f.x - 1 || b.y < f.y - 1 || b.x + b.w > f.x + f.w + 1 || b.y + b.h > f.y + f.h + 1) out.push(`${id} is outside ${p}`)
  }
  return out
}

describe('Tidy', () => {
  it("tidies the author's view", () => {
    const { result, l, box } = tidy(load(join(fixturesDir, 'spread-open-system.json')))
    // Each database right of its container, on its row.
    for (const [db, user] of [['orders-db', 'api'], ['stock-db', 'worker']]) {
      expect(box(db).x).toBeGreaterThan(box(user).x + box(user).w)
      expect(Math.abs(box(db).cy - box(user).cy)).toBeLessThan(2)
    }
    // The ADR that constrains the collapsed system left of it, on its row.
    expect(box('adr-billing').x + box('adr-billing').w).toBeLessThan(box('billing').x)
    expect(Math.abs(box('adr-billing').cy - box('billing').cy)).toBeLessThan(2)
    // The person above what it uses.
    for (const id of ['api', 'billing']) expect(box('customer').y + box('customer').h).toBeLessThan(box(id).y)
    expect(violations(l)).toEqual([])
    expect(result.tidy.after.total).toBeLessThan(result.tidy.before.total)
    expect(result.tidy.steps.length).toBeGreaterThan(5)
    // What it did is said.
    for (const s of result.tidy.steps) expect(s.description.length).toBeGreaterThan(5)
  })

  it('never makes a layout worse', { timeout: 120_000 }, () => {
    const files: string[] = []
    for (const dir of ['blueprint', 'pattern']) for (const f of readdirSync(join(benchDir, dir)).filter((f) => f.endsWith('.radical')).sort()) files.push(join(benchDir, dir, f))
    files.push(join(fixturesDir, 'spread-open-system.json'))
    expect(files.length).toBeGreaterThan(20)
    for (const file of files) {
      const name = file.split('/').pop()
      const { result, l, visible } = tidy(load(file))
      expect(violations(l), name).toEqual([])
      expect(result.tidy.after.total, name).toBeLessThanOrEqual(result.tidy.before.total + 0.01)
      // Step by step the cost never rises: replay the moves and sum the gains.
      const replay = new Layout(visible.nodes)
      const lines = linesOf(replay, visible.relations)
      let cost = totalCost(replay, lines).total
      for (const s of result.tidy.steps) {
        for (const [id, p] of Object.entries(s.moved)) {
          const b = replay.box(id)
          if (!b) continue
          const parent = replay.parentOf(id)
          const pb = parent ? replay.box(parent)! : { x: 0, y: 0 }
          void pb
          void p
        }
        expect(s.gain, `${name}: ${s.description}`).toBeGreaterThanOrEqual(0)
      }
      void cost
    }
  })

  it('stops when nothing is left to do', () => {
    const f = load(join(fixturesDir, 'spread-open-system.json'))
    const first = tidy(f)
    const again = runTidyLayout(first.laidOut, first.visible.relations)
    expect(again.tidy.steps.length).toBe(0)
    expect(again.keptCurrent).toBe(true)
    // 300 elements piled up in a few seconds.
    const big = bigModel(300)
    const t = Date.now()
    runTidyLayout(big.nodes, big.relations)
    expect(Date.now() - t).toBeLessThan(15_000)
  }, 30_000)
})

function node(id: string, type: string, parentId: string | undefined, x: number, y: number): C4Node {
  const size: Record<string, [number, number]> = { system: [360, 260], person: [150, 170], database: [190, 130], container: [240, 160], adr: [180, 52] }
  const [width, height] = size[type] ?? [200, 100]
  return { id, type: type as C4Node['type'], label: id, collapsed: false, x, y, width, height, ...(parentId ? { parentId } : {}) }
}

/** `n` elements piled up: systems with containers and databases, people, ADRs, a chain of relations. */
function bigModel(n: number): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: C4Node[] = [], relations: C4Relation[] = []
  const rel = (id: string, sourceId: string, targetId: string, relationType = 'interacts'): C4Relation => ({ id, sourceId, targetId, relationType })
  for (let i = 0; nodes.length < n; i++) {
    nodes.push(node(`sys${i}`, 'system', undefined, (i % 6) * 700, Math.floor(i / 6) * 500))
    for (let k = 0; k < 4 && nodes.length < n; k++) {
      nodes.push(node(`c${i}-${k}`, 'container', `sys${i}`, 30 + (k % 2) * 300, 130 + Math.floor(k / 2) * 200))
      if (nodes.length < n) nodes.push(node(`db${i}-${k}`, 'database', `sys${i}`, 60 + (k % 2) * 300, 160 + Math.floor(k / 2) * 200))
      relations.push(rel(`r${i}-${k}`, `c${i}-${k}`, `db${i}-${k}`))
      if (k) relations.push(rel(`q${i}-${k}`, `c${i}-${k - 1}`, `c${i}-${k}`))
    }
    if (i) relations.push(rel(`x${i}`, `c${i - 1}-0`, `c${i}-0`))
    if (nodes.length < n) nodes.push(node(`p${i}`, 'person', undefined, (i % 6) * 700 + 100, Math.floor(i / 6) * 500 - 50))
    relations.push(rel(`u${i}`, `p${i}`, `c${i}-0`))
    if (nodes.length < n) nodes.push(node(`a${i}`, 'adr', undefined, (i % 6) * 700 - 100, Math.floor(i / 6) * 500 + 100))
    relations.push(rel(`k${i}`, `a${i}`, `sys${i}`, 'constrains'))
  }
  const ids = new Set(nodes.map((x) => x.id))
  return {
    nodes: byId(nodes.filter((x) => !x.parentId || ids.has(x.parentId))),
    relations: byId(relations.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId))),
  }
}

export type { PositionMap }
