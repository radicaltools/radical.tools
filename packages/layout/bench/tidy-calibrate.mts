/**
 * Calibrates Tidy's weights (src/tidy/cost.ts WEIGHTS) from the author's
 * judgements, instead of guessing them.
 *
 *   npx tsx bench/tidy-calibrate.mts pairs <dir>
 *     For every bench model (and the fixtures), two layouts of each view:
 *     A = Tidy with the current weights, B = Tidy with one weight doubled
 *     or halved (a different trade-off), drawn side by side as SVG in <dir>
 *     with the cost parts of each in <dir>/pairs.json. Look at them and
 *     write your choice into <dir>/answers.json: { "<pair id>": "A" | "B" }.
 *
 *   npx tsx bench/tidy-calibrate.mts fit <dir>
 *     Fits weights to the answers: a perceptron over the difference of the
 *     two layouts' cost parts (the chosen one must cost less), starting from
 *     the current weights and keeping them positive. Prints the weights to
 *     paste into cost.ts, and how many answers the fitted weights agree with.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { runTidyLayout } from '../src/tidy/index'
import { Layout } from '../src/tidy/layout'
import { type CostParts, linesOf, totalCost, WEIGHTS } from '../src/tidy/cost'
import { viewLayoutInput } from '../src/viewInput'
import { projectToVisibleGraph } from '../src/geometry'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'

type Weights = typeof WEIGHTS
type PartName = keyof Weights
const PARTS = Object.keys(WEIGHTS) as PartName[]
const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))

function models(): { name: string; nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; view?: DiagramView }[] {
  const out: ReturnType<typeof models> = []
  for (const dir of ['blueprint', 'pattern']) {
    for (const f of readdirSync(join('bench/models', dir)).filter((f) => f.endsWith('.radical')).sort()) {
      const d = JSON.parse(readFileSync(join('bench/models', dir, f), 'utf8'))
      out.push({ name: basename(f, '.radical'), nodes: byId(d.nodes), relations: byId(d.relations) })
    }
  }
  const fx = JSON.parse(readFileSync('tests/fixtures/spread-open-system.json', 'utf8'))
  const input = viewLayoutInput(fx.view, byId(fx.nodes), byId(fx.relations))
  out.push({ name: 'spread-open-system', nodes: input.nodes, relations: input.relations })
  return out
}

/** Tidy with `weights` in place of the current ones (WEIGHTS is mutated for the run and restored). */
function tidyWith(weights: Weights, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): { positions: Record<string, C4Node>; parts: CostParts } {
  const was = { ...WEIGHTS }
  Object.assign(WEIGHTS, weights)
  try {
    const visible = projectToVisibleGraph(nodes, relations)
    const result = runTidyLayout(nodes, relations)
    const laid: Record<string, C4Node> = {}
    for (const [id, n] of Object.entries(visible.nodes)) laid[id] = { ...n, ...(result.winner.positions[id] ?? {}) }
    const l = new Layout(laid)
    const parts = totalCost(l, linesOf(l, visible.relations))
    return { positions: laid, parts }
  } finally {
    Object.assign(WEIGHTS, was)
  }
}

function svg(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, title: string): string {
  const all = Object.values(nodes)
  const abs = new Map<string, { x: number; y: number }>()
  const of = (n: C4Node): { x: number; y: number } => {
    const hit = abs.get(n.id); if (hit) return hit
    const p = n.parentId && nodes[n.parentId] ? of(nodes[n.parentId]) : { x: 0, y: 0 }
    const at = { x: p.x + n.x, y: p.y + n.y }; abs.set(n.id, at); return at
  }
  const x0 = Math.min(...all.map((n) => of(n).x)) - 20, y0 = Math.min(...all.map((n) => of(n).y)) - 40
  const x1 = Math.max(...all.map((n) => of(n).x + n.width)) + 20, y1 = Math.max(...all.map((n) => of(n).y + n.height)) + 20
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${(x1 - x0) / 2}" height="${(y1 - y0) / 2}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="white"/><text x="${x0 + 10}" y="${y0 + 28}" font-size="22" font-family="sans-serif">${title}</text>`
  const depth = (n: C4Node): number => (n.parentId && nodes[n.parentId] ? 1 + depth(nodes[n.parentId]) : 0)
  for (const n of [...all].sort((a, b) => depth(a) - depth(b))) {
    const p = of(n)
    s += `<rect x="${p.x}" y="${p.y}" width="${n.width}" height="${n.height}" fill="${n.type === 'adr' || n.type === 'requirement' ? '#d9b89c' : '#a9c8e8'}" fill-opacity="0.85" stroke="#333"/><text x="${p.x + 8}" y="${p.y + 20}" font-size="16" font-family="sans-serif">${(n.label || n.id).replace(/[<&]/g, '')}</text>`
  }
  for (const r of Object.values(relations)) {
    const a = nodes[r.sourceId], b = nodes[r.targetId]
    if (!a || !b) continue
    const pa = of(a), pb = of(b)
    s += `<line x1="${pa.x + a.width / 2}" y1="${pa.y + a.height / 2}" x2="${pb.x + b.width / 2}" y2="${pb.y + b.height / 2}" stroke="#222" stroke-width="2"/>`
  }
  return s + '</svg>'
}

const [command, dir] = process.argv.slice(2)
if (!command || !dir) { console.error('usage: tidy-calibrate.mts pairs|fit <dir>'); process.exit(1) }

if (command === 'pairs') {
  mkdirSync(dir, { recursive: true })
  const pairs: { id: string; model: string; changed: PartName; factor: number; a: CostParts; b: CostParts }[] = []
  let i = 0
  for (const m of models()) {
    const a = tidyWith({ ...WEIGHTS }, m.nodes, m.relations)
    // One trade-off per model, round robin over the parts, doubled and halved in turn.
    const changed = PARTS[i % PARTS.length], factor = i % 2 ? 0.5 : 2
    const b = tidyWith({ ...WEIGHTS, [changed]: WEIGHTS[changed] * factor }, m.nodes, m.relations)
    const id = `${String(i + 1).padStart(2, '0')}-${m.name}`
    writeFileSync(join(dir, `${id}-A.svg`), svg(a.positions, m.relations, `${id} A`))
    writeFileSync(join(dir, `${id}-B.svg`), svg(b.positions, m.relations, `${id} B (${changed} ×${factor})`))
    pairs.push({ id, model: m.name, changed, factor, a: a.parts, b: b.parts })
    i++
  }
  writeFileSync(join(dir, 'pairs.json'), JSON.stringify({ weights: WEIGHTS, pairs }, null, 1))
  console.log(`${pairs.length} pairs in ${dir}; answer in ${join(dir, 'answers.json')} as {"<id>": "A"|"B"}`)
} else if (command === 'fit') {
  const { pairs } = JSON.parse(readFileSync(join(dir, 'pairs.json'), 'utf8')) as { pairs: { id: string; a: CostParts; b: CostParts }[] }
  const answersFile = join(dir, 'answers.json')
  if (!existsSync(answersFile)) { console.error(`no ${answersFile}`); process.exit(1) }
  const answers = JSON.parse(readFileSync(answersFile, 'utf8')) as Record<string, 'A' | 'B'>
  const judged = pairs.filter((p) => answers[p.id] === 'A' || answers[p.id] === 'B')
  // Perceptron: the preferred layout's cost must be lower by a margin; a
  // violated pair pulls the weights towards it, never below a tenth of the start.
  const w: Record<PartName, number> = { ...WEIGHTS }
  const cost = (parts: CostParts, weights: Record<PartName, number>): number => PARTS.reduce((s, k) => s + (parts[k] ?? 0) * weights[k], 0)
  const agree = (weights: Record<PartName, number>): number => judged.filter((p) => (answers[p.id] === 'A') === (cost(p.a, weights) < cost(p.b, weights))).length
  const rate = 0.05
  for (let epoch = 0; epoch < 200; epoch++) {
    let changed = false
    for (const p of judged) {
      const good = answers[p.id] === 'A' ? p.a : p.b, bad = answers[p.id] === 'A' ? p.b : p.a
      if (cost(good, w) + 1 <= cost(bad, w)) continue
      for (const k of PARTS) w[k] = Math.max(WEIGHTS[k] / 10, w[k] + rate * ((bad[k] ?? 0) - (good[k] ?? 0)))
      changed = true
    }
    if (!changed) break
  }
  console.log(`agree with ${agree(w)} of ${judged.length} answers (was ${agree(WEIGHTS)})`)
  console.log('export const WEIGHTS = {')
  for (const k of PARTS) console.log(`  ${k}: ${+w[k].toFixed(2)},`)
  console.log('}')
} else {
  console.error(`unknown command ${command}`)
  process.exit(1)
}
