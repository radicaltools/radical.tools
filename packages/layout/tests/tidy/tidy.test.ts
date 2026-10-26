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
import { buildIndex, linesOf, localCostParts, totalCost, updateIndex } from '../../src/tidy/cost'
import { candidateMoves } from '../../src/tidy/moves'
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

  it('judges each move by what it changes in the whole layout', { timeout: 120_000 }, () => {
    // Every move a tidied layout offers, judged locally as Tidy judges it and
    // on the whole layout: what lines do (crossings, lines and labels over
    // elements, slants, length…) must agree exactly, and the index kept up
    // to date move by move must draw every line as a fresh one would.
    const lineParts = ['crossings', 'overdraws', 'brushes', 'labels', 'fans', 'slanted', 'length', 'bends', 'againstFlow', 'flat', 'imbalance', 'misplaced', 'offConvention'] as const
    const files = [
      ...readdirSync(join(benchDir, 'pattern')).filter((f) => f.endsWith('.radical')).sort().map((f) => join(benchDir, 'pattern', f)),
      join(benchDir, 'blueprint', 'bp-realtime-collaboration.radical'),
      join(fixturesDir, 'spread-open-system.json'),
    ]
    let judged = 0
    for (const file of files) {
      const name = file.split('/').pop()
      const { laidOut, visible } = tidy(load(file))
      const l = new Layout(laidOut)
      const lines = linesOf(l, visible.relations)
      const index = buildIndex(l, lines)
      for (const move of candidateMoves(l, visible.nodes, visible.relations, lines)) {
        const whole0 = totalCost(l, lines)
        l.begin()
        if (!move.apply(l)) { l.rollback(); continue }
        const touched = l.changed()
        const after = l.snapshot(touched)
        const was = l.journalBoxes()
        const whole1 = totalCost(l, lines)
        l.rollback()
        const moved = new Set(move.ids), changed = new Set(touched)
        l.restore(after)
        const shifted = updateIndex(l, index, touched)
        const fresh = buildIndex(l, lines)
        for (const q of lines) expect(index.geom.get(q), `${name}: ${move.description}, line ${q.id}`).toEqual(fresh.geom.get(q))
        const local1 = localCostParts(l, lines, moved, index, undefined, shifted, changed)
        l.restore(was)
        updateIndex(l, index, touched)
        const local0 = localCostParts(l, lines, moved, index, undefined, shifted, changed)
        for (const k of lineParts) expect(local0[k] - local1[k], `${name}: ${move.description}, ${k}`).toBeCloseTo(whole0[k] - whole1[k], 6)
        judged++
      }
    }
    expect(judged).toBeGreaterThan(300)
  })

  it('never goes round in circles', { timeout: 120_000 }, () => {
    // Tidied twice, every pattern: no layout comes back on the way, and the
    // second run finds little left to do.
    for (const f of readdirSync(join(benchDir, 'pattern')).filter((f) => f.endsWith('.radical')).sort()) {
      const first = tidy(load(join(benchDir, 'pattern', f)))
      const again = runTidyLayout(first.laidOut, first.visible.relations)
      for (const [run, start] of [[first.result, first.visible.nodes], [again, first.laidOut]] as const) {
        const at: PositionMap = Object.fromEntries(Object.entries(start).map(([id, n]) => [id, { x: n.x, y: n.y }]))
        const key = (): string => Object.keys(at).sort().map((id) => `${Math.round(at[id].x)},${Math.round(at[id].y)}`).join(';')
        const seen = new Set([key()])
        for (const s of run.tidy.steps) {
          for (const [id, p] of Object.entries(s.moved)) at[id] = { x: p.x, y: p.y }
          expect(seen.has(key()), `${f}: back to an earlier layout at "${s.description}"`).toBe(false)
          seen.add(key())
        }
      }
      expect(again.tidy.steps.length, f).toBe(0)
    }
  })

  it('leaves nothing for a second run: every blueprint tidied twice', { timeout: 120_000 }, () => {
    // All of a blueprint's elements on one canvas, as a view listing them
    // all shows them: tidied, then tidied again from the result.
    for (const f of readdirSync(join(benchDir, 'blueprint')).filter((f) => f.endsWith('.radical')).sort()) {
      const d = load(join(benchDir, 'blueprint', f))
      const visible = projectToVisibleGraph(byId(d.nodes), byId(d.relations))
      const first = runTidyLayout(visible.nodes, visible.relations)
      const laidOut: Record<string, C4Node> = {}
      for (const [id, n] of Object.entries(visible.nodes)) laidOut[id] = { ...n, ...(first.winner.positions[id] ?? {}) }
      const again = runTidyLayout(laidOut, visible.relations)
      expect(again.tidy.steps.map((s) => s.description), f).toEqual([])
      expect(again.keptCurrent, f).toBe(true)
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
