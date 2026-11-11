/**
 * Calibrates Tidy's weights (src/tidy/cost.ts WEIGHTS) from the author's
 * judgements, instead of guessing them.
 *
 *   npx tsx bench/tidy-calibrate.mts pairs <dir>
 *     For every bench model (and the fixtures), two layouts of each view:
 *     A = Tidy with the current weights, B = Tidy with one weight doubled
 *     or halved (a different trade-off), drawn side by side as SVG in <dir>
 *     with the cost parts of each in <dir>/pairs.json, lines as the canvas
 *     draws them. Open <dir>/index.html, click the layout that reads better
 *     in each pair (or Same), and save the answers.json it downloads into
 *     <dir>: { "<pair id>": "A" | "B" }. A pair whose two layouts came out
 *     the same is left out.
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
import { renderedEdges } from '../src/smartLayout'
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
  // The lines as the canvas draws them: from their ports, curved, led round the elements in their way.
  const shown = Object.fromEntries(Object.entries(relations).filter(([, r]) => nodes[r.sourceId] && nodes[r.targetId]))
  for (const e of renderedEdges(nodes, shown)) {
    s += `<polyline points="${e.samples.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#222" stroke-width="2"/>`
    const end = e.samples[e.samples.length - 1]
    s += `<circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="5" fill="#222"/>`
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
    i++
    // The same layout either way: nothing to choose.
    if (JSON.stringify(a.positions) === JSON.stringify(b.positions)) continue
    writeFileSync(join(dir, `${id}-A.svg`), svg(a.positions, m.relations, `${id} A`))
    writeFileSync(join(dir, `${id}-B.svg`), svg(b.positions, m.relations, `${id} B`))
    pairs.push({ id, model: m.name, changed, factor, a: a.parts, b: b.parts })
  }
  writeFileSync(join(dir, 'pairs.json'), JSON.stringify({ weights: WEIGHTS, pairs }, null, 1))
  // One page to answer on: the two layouts of each pair side by side, a click chooses, the
  // choices are kept in the browser and downloaded as answers.json. Which weight differs is
  // not shown: the choice is by how the diagram reads.
  writeFileSync(join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Tidy calibration</title>
<style>body{font:15px sans-serif;margin:16px;background:#f4f4f4}h1{font-size:18px}.pair{background:#fff;border:1px solid #ccc;margin:0 0 24px;padding:12px}.two{display:flex;gap:12px}.side{flex:1;min-width:0;border:3px solid transparent;cursor:pointer;padding:4px}.side img{width:100%;height:auto;display:block}.side.chosen{border-color:#2a7}.bar{display:flex;gap:12px;align-items:center;margin-top:8px}button{font:inherit;padding:4px 12px}#top{position:sticky;top:0;background:#f4f4f4;padding:8px 0;z-index:1}</style>
<div id="top"><h1>Which layout reads better? <span id="count"></span> <button id="save">Download answers.json</button></h1></div>
${pairs.map((p) => `<div class="pair" data-id="${p.id}"><div class="two"><div class="side" data-v="A"><img src="${p.id}-A.svg"></div><div class="side" data-v="B"><img src="${p.id}-B.svg"></div></div><div class="bar"><strong>${p.id}</strong><button data-v="">Same / cannot say</button></div></div>`).join('\n')}
<script>
const key = 'tidy-calibration:' + location.pathname
let answers = {}
try { answers = JSON.parse(localStorage.getItem(key) || '{}') } catch {}
const show = () => {
  for (const el of document.querySelectorAll('.pair')) for (const s of el.querySelectorAll('.side')) s.classList.toggle('chosen', answers[el.dataset.id] === s.dataset.v)
  document.getElementById('count').textContent = Object.keys(answers).length + ' of ' + document.querySelectorAll('.pair').length + ' answered'
  try { localStorage.setItem(key, JSON.stringify(answers)) } catch {}
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-v]'); if (!t) return
  const id = t.closest('.pair').dataset.id
  if (t.dataset.v) answers[id] = t.dataset.v; else delete answers[id]
  show()
})
document.getElementById('save').onclick = () => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(answers, null, 1)], { type: 'application/json' }))
  a.download = 'answers.json'; a.click()
}
show()
</script>`)
  console.log(`${pairs.length} pairs in ${dir}: open ${join(dir, 'index.html')}, choose, and save the answers.json it downloads into ${dir}`)
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
