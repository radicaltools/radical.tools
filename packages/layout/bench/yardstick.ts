// One yardstick for Tidy whatever its weights and moves: what a reader sees
// on the bench models after Smart Layout. Crossings and lines over elements
// are counted on the lines as the canvas draws them (curved, led round the
// elements in their way); slanted lines, line length and area in mean
// element sizes. bench/tidy-yard.mts prints it; tests/tidy/yardstick.test.ts
// holds it to bench/tidy-yardstick.json.
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'
import { runTidyLayout } from '../src/tidy/index'
import { Layout } from '../src/tidy/layout'
import { buildIndex, geomOf, isStraight, kinApartOf, linesOf, nearMissesOf, totalCost } from '../src/tidy/cost'
import { viewLayoutInput } from '../src/viewInput'
import { projectPositions } from '../src/smartLayout'
import { projectToVisibleGraph } from '../src/geometry'

const here = dirname(fileURLToPath(import.meta.url))
export const YARDSTICK_FILE = join(here, 'tidy-yardstick.json')

/** What the yardstick holds: none of these may grow past its baseline by more than YARDSTICK_SLACK. */
export interface Yardstick { drawnCrossings: number; drawnOverdraws: number; slanted: number; length: number; area: number }
export const YARDSTICK_KEYS: (keyof Yardstick)[] = ['drawnCrossings', 'drawnOverdraws', 'slanted', 'length', 'area']
/** A change to the moves shifts every number a little, one way or the other (a move taken earlier
 *  changes all that follow): this much is noise, more is a layout that reads worse. */
export const YARDSTICK_SLACK = 0.1

export interface YardRow extends Yardstick { file: string; lines: number; crossings: number; overdraws: number; near: number; kin: number; cramped: number; cost: number; moves: number }

/** Every bench model: the Hub's blueprints and patterns as their authors left them. */
export function benchModels(): string[] {
  const out: string[] = []
  for (const dir of ['blueprint', 'pattern']) for (const f of readdirSync(join(here, 'models', dir)).filter((f) => f.endsWith('.radical')).sort()) out.push(join(here, 'models', dir, f))
  return out
}

const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))

/** One model tidied from where its canvas stands, and measured. */
export function measure(file: string, tidy: typeof runTidyLayout = runTidyLayout): YardRow {
  const d = JSON.parse(readFileSync(file, 'utf8')) as { view?: DiagramView; nodes: C4Node[]; relations: C4Relation[] }
  const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
  const res = tidy(input.nodes, input.relations, { frames: [...input.frames] })
  const { nodes, relations } = projectToVisibleGraph(input.nodes, input.relations)
  const l = new Layout(projectPositions(nodes, res.winner.positions), undefined, [], input.frames)
  const lines = linesOf(l, relations)
  const index = buildIndex(l, lines)
  const c = totalCost(l, lines)
  const roots = l.ids().filter((id) => !l.parentOf(id)).map((id) => l.box(id)!)
  return {
    file: basename(file), lines: lines.length,
    drawnCrossings: res.winner.score.renderedCrossings, drawnOverdraws: res.winner.score.renderedOverdraws,
    slanted: lines.filter((x) => !isStraight(index, x)).length,
    length: lines.reduce((s, x) => { const g = geomOf(index, x); return s + Math.hypot(g.ax - g.bx, g.ay - g.by) }, 0) / l.meanSize,
    area: (Math.max(...roots.map((b) => b.x + b.w)) - Math.min(...roots.map((b) => b.x))) * (Math.max(...roots.map((b) => b.y + b.h)) - Math.min(...roots.map((b) => b.y))) / l.meanSize ** 2,
    crossings: c.crossings, overdraws: c.overdraws,
    near: l.ids().reduce((s, id) => s + nearMissesOf(l, id).length, 0) / 2,
    kin: l.ids().filter((id) => kinApartOf(l, id, (o) => !!index.linesOf.get(o)?.length).length).length,
    cramped: c.cramped, cost: c.total, moves: res.tidy.steps.length,
  }
}

/** The yardstick over a set of models: the sum of each measure. */
export function total(rows: YardRow[]): Yardstick {
  const sum: Yardstick = { drawnCrossings: 0, drawnOverdraws: 0, slanted: 0, length: 0, area: 0 }
  for (const r of rows) for (const k of YARDSTICK_KEYS) sum[k] += r[k]
  for (const k of YARDSTICK_KEYS) sum[k] = Math.round(sum[k] * 10) / 10
  return sum
}

export function baseline(): Yardstick { return JSON.parse(readFileSync(YARDSTICK_FILE, 'utf8')) as Yardstick }

/** The measures that grew past the baseline by more than the slack, as sentences; none: the yardstick holds. */
export function worse(now: Yardstick, base: Yardstick): string[] {
  return YARDSTICK_KEYS.filter((k) => now[k] > base[k] * (1 + YARDSTICK_SLACK) + 0.5)
    .map((k) => `${k} ${now[k]} is more than ${Math.round(YARDSTICK_SLACK * 100)} % over its baseline ${base[k]}`)
}
