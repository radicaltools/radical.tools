// Tidy over every bench model: time, moves, cost, and what the reader sees.
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { runTidyLayout } from '../src/tidy'
import { viewLayoutInput } from '../src/viewInput'
const byId = (xs: any[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
const files: string[] = []
for (const dir of ['blueprint', 'pattern']) for (const f of readdirSync(join('bench/models', dir)).filter((f) => f.endsWith('.radical')).sort()) files.push(join('bench/models', dir, f))
files.push('../../apps/e2e/fixtures/bookstore.radical', 'tests/fixtures/spread-open-system.json')
for (const f of process.argv.length > 2 ? process.argv.slice(2) : files) {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
  const t = Date.now()
  const r = runTidyLayout(input.nodes, input.relations)
  const ms = Date.now() - t
  const b = r.tidy.before, a = r.tidy.after
  console.log(`${basename(f).padEnd(36)} n ${String(Object.keys(r.winner.positions).length).padStart(3)} ${String(ms).padStart(5)} ms  moves ${String(r.tidy.steps.length).padStart(3)}  cost ${b.total.toFixed(0).padStart(5)} -> ${a.total.toFixed(0).padStart(5)}  cross ${b.crossings}->${a.crossings} over ${b.overdraws}->${a.overdraws} slant ${b.slanted}->${a.slanted}  metrics cross ${r.baseline.crossings}->${r.winner.metrics.crossings} over ${r.baseline.overdraws}->${r.winner.metrics.overdraws}`)
}
