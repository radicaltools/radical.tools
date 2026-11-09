// Radical Assay's bench, for an agent's model: scores the central model an
// agent wrote against what bench.json writes down for its repositories.
// Run: npx tsx packages/assay/bench/model.ts <central repository> <bench entry>…
// (the entries by name, of the tuned set or the held-out one).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deserializeFromMdFolder, type FolderFiles } from '@radical/common/formats/mdFolder'
import { joinsOnly, scoreModel, type Expectations, type RunFacts, type WrittenItem } from './score'

const [central, ...names] = process.argv.slice(2)
if (!central || !names.length) {
  console.error('usage: model.ts <central repository> <bench entry>…')
  process.exit(2)
}
const bench = JSON.parse(readFileSync(fileURLToPath(new URL('./bench.json', import.meta.url)), 'utf8')) as { repositories: Expectations[]; heldOut: Expectations[] }

/** Every file of the model folder, by its path from the folder. */
function folderFiles(dir: string): FolderFiles {
  const files: FolderFiles = {}
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const full = join(at, name)
      if (statSync(full).isDirectory()) { if (name !== '.state') walk(full) } else files[relative(dir, full).split('\\').join('/')] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return files
}

const { data } = deserializeFromMdFolder(folderFiles(join(central, '.radical', 'model')))
const run = JSON.parse(readFileSync(join(central, '.radical', 'assay', 'run.json'), 'utf8')) as { repositories?: Array<{ name: string; dir: string }>; written: Array<WrittenItem & { evidence?: Array<{ fact?: string }> }> }
// The deployed services, units of tests and join tables of the run's repositories, from their facts (in the repository, or
// the central one's for a folder of code).
const services: Record<string, { name: string; unit?: string }> = {}
const facts: Required<RunFacts> = { services, tests: [], joins: [] }
for (const r of run.repositories ?? []) {
  for (const file of [join(central, r.dir, '.radical', 'assay', 'facts.json'), join(central, '.radical', 'assay', 'facts', `${r.name}.json`)]) {
    try {
      const read = JSON.parse(readFileSync(file, 'utf8')) as { services?: Array<{ id: string; name: string; unit?: string }>; units?: Array<{ id: string; kind: string }>; tables?: Array<{ id: string } & Parameters<typeof joinsOnly>[0]> }
      for (const s of read.services ?? []) services[s.id] = { name: s.name, ...(s.unit ? { unit: s.unit } : {}) }
      facts.tests.push(...(read.units ?? []).filter((u) => u.kind === 'tests').map((u) => u.id))
      facts.joins.push(...(read.tables ?? []).filter(joinsOnly).map((t) => t.id))
      break
    } catch { /* not there */ }
  }
}
const written = run.written.map((w) => ({ ...w, facts: w.facts ?? (w.evidence ?? []).map((e) => e.fact).filter((f): f is string => !!f) }))
const pct = (a: number, b: number): string => (b ? `${Math.round((100 * a) / b)}%` : '—')

const totals = { units: [0, 0, 0], calls: [0, 0, 0], tables: [0, 0] }
for (const name of names) {
  const expected = [...bench.repositories, ...bench.heldOut].find((r) => r.name === name)
  if (!expected) { console.error(`no bench entry ${name}`); process.exit(2) }
  const s = scoreModel(expected, data.nodes, data.relations, written, facts)
  console.log(`\n${name}`)
  console.log(`  units: ${s.units.found}/${s.units.expected} in elements (recall ${pct(s.units.found, s.units.expected)}), ${s.units.read} built from (precision ${pct(s.units.found, s.units.read)})`)
  for (const u of s.units.missed) console.log(`    missed unit ${u}`)
  for (const u of s.units.extra) console.log(`    extra unit ${u}`)
  if (s.units.tests) console.log(`    not counted (tests, no elements by the procedure): ${s.units.tests.join(', ')}`)
  console.log(`  calls: recall ${pct(s.calls.right, s.calls.expected)} (${s.calls.right}/${s.calls.expected}), precision ${pct(s.calls.right, s.calls.right + s.calls.wrong.length)} (${s.calls.wrong.length} not stated)`)
  for (const c of s.calls.missed) console.log(`    missed ${c}`)
  for (const c of s.calls.wrong) console.log(`    not stated ${c}`)
  if (s.tables) console.log(`  tables as entities: ${s.tables.found}/${s.tables.expected}${s.tables.missed.length ? `, missed ${s.tables.missed.join(', ')}` : ''}`)
  if (s.tables?.joins) console.log(`    not counted (join tables, no entities by the procedure): ${s.tables.joins.join(', ')}`)
  totals.units = [totals.units[0] + s.units.found, totals.units[1] + s.units.expected, totals.units[2] + s.units.read]
  totals.calls = [totals.calls[0] + s.calls.right, totals.calls[1] + s.calls.expected, totals.calls[2] + s.calls.right + s.calls.wrong.length]
  if (s.tables) totals.tables = [totals.tables[0] + s.tables.found, totals.tables[1] + s.tables.expected]
}
console.log(`\nModel: units recall ${pct(totals.units[0], totals.units[1])}, precision ${pct(totals.units[0], totals.units[2])}; calls recall ${pct(totals.calls[0], totals.calls[1])}, precision ${pct(totals.calls[0], totals.calls[2])}${totals.tables[1] ? `; tables as entities ${pct(totals.tables[0], totals.tables[1])}` : ''}`)
