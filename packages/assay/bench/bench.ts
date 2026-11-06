// Radical Assay's bench: clones (once, into $ASSAY_BENCH or ~/.cache/radical-assay-bench) the
// pinned public repositories of bench.json, reads and links their facts, and compares them
// with the units, calls and tables a person wrote down. Run: npx tsx packages/assay/bench/bench.ts
// It needs the network the first time; it is no test of CI.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractRepository, linkRepositories, type Link, type RepositoryFacts } from '../src/index'

interface Expected { name: string; url?: string; commit?: string; repositories?: Array<{ name: string; url: string; commit: string }>; stacks: string; units: string[]; calls: Array<[string, string]>; optional: Array<[string, string]>; tables?: string[]; judge?: 'runtime' }
const bench = JSON.parse(readFileSync(fileURLToPath(new URL('./bench.json', import.meta.url)), 'utf8')) as { repositories: Expected[]; heldOut: Expected[] }
// --held-out: the repositories no rule was tuned on.
const heldOut = process.argv.includes('--held-out')
const cache = process.env.ASSAY_BENCH ?? join(homedir(), '.cache', 'radical-assay-bench')
mkdirSync(cache, { recursive: true })

/** The names a call's end may have as the bench writes them: a unit's folder, service:<name>, db:<name> (lower-cased);
 *  a database also by the deployed service it runs on. */
function endpoints(facts: RepositoryFacts, id: string, via?: string): string[] {
  const unit = facts.units.find((u) => u.id === id)
  if (unit) return [unit.path]
  const service = facts.services.find((s) => s.id === id)
  if (service) {
    const db = facts.databases.find((d) => d.service === service.id)
    return [service.unit ? facts.units.find((u) => u.id === service.unit)!.path : `service:${service.name}`, ...(db ? [`db:${(db.name ?? service.name).toLowerCase()}`] : [])]
  }
  const db = facts.databases.find((d) => d.id === id)
  if (db) return [`db:${(db.name ?? db.server ?? db.engine).toLowerCase()}`, ...(via ? endpoints(facts, via) : []), ...(db.service ? endpoints(facts, db.service) : [])]
  return [id]
}
const lower = (call: string): string => call.replace(/db:[^ ]+/g, (m) => m.toLowerCase())

const pct = (a: number, b: number): string => (b ? `${Math.round((100 * a) / b)}%` : '—')
let totals = { units: [0, 0, 0], calls: [0, 0, 0] }
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'))
for (const repo of (heldOut ? bench.heldOut : bench.repositories).filter((r) => !filter || r.name === filter)) {
  // One repository, or several read and linked together (their units named <repository> or <repository>/<folder>).
  const parts = repo.repositories ?? [{ name: repo.name, url: repo.url!, commit: repo.commit! }]
  const dirs = parts.map((p) => {
    const dir = repo.repositories ? join(cache, repo.name, p.name) : join(cache, p.name)
    if (!existsSync(dir)) execFileSync('git', ['clone', '-q', '--filter=blob:none', '--no-checkout', p.url, dir])
    execFileSync('git', ['-c', 'advice.detachedHead=false', 'checkout', '-q', p.commit], { cwd: dir })
    return dir
  })
  const started = Date.now()
  const all = dirs.map((d) => extractRepository(d))
  const links: Link[] = linkRepositories(all)
  const ms = Date.now() - started
  const facts: RepositoryFacts = { ...all[0], units: [], services: [], databases: [], tables: [], notes: [] }
  const multi = !!repo.repositories
  for (const f of all) {
    facts.units.push(...f.units.map((u) => ({ ...u, path: multi ? (u.path === '.' ? f.repository : `${f.repository}/${u.path}`) : u.path })))
    facts.services.push(...f.services)
    facts.databases.push(...f.databases)
    facts.tables.push(...f.tables)
    facts.notes.push(...f.notes.map((n) => (multi ? `${f.repository}: ${n}` : n)))
  }

  const units = new Set(facts.units.map((u) => u.path))
  const unitHits = repo.units.filter((u) => units.has(u)).length
  // judge runtime: references between projects are structure, judged neither way.
  const expected = new Set(repo.calls.map(([a, b]) => lower(`${a} → ${b}`)))
  const optional = new Set(repo.optional.map(([a, b]) => lower(`${a} → ${b}`)))
  // Each link once: as the expected call one of its names makes, else as its first name.
  const found = new Set<string>()
  // Calls to observability (tracing, metrics, logs) are true but no part of what the system does: judged neither way.
  const observability = new Set(facts.services.filter((s) => s.role === 'observability').map((s) => s.id))
  for (const l of links.filter((x) => (repo.judge !== 'runtime' || x.kind !== 'package') && !observability.has(x.to))) {
    const names = endpoints(facts, l.from).flatMap((a) => endpoints(facts, l.to, l.via).map((b) => `${a} → ${b}`))
    found.add(names.find((n) => expected.has(n)) ?? names.find((n) => optional.has(n)) ?? names[0])
  }
  const right = [...found].filter((c) => expected.has(c)).length
  const wrong = [...found].filter((c) => !expected.has(c) && !optional.has(c))
  const missed = [...expected].filter((c) => !found.has(c))
  totals = { units: [totals.units[0] + unitHits, totals.units[1] + repo.units.length, totals.units[2] + units.size], calls: [totals.calls[0] + right, totals.calls[1] + expected.size, totals.calls[2] + right + wrong.length] }

  console.log(`\n${repo.name} (${repo.stacks}) — ${ms} ms`)
  console.log(`  units: ${unitHits}/${repo.units.length} found (recall ${pct(unitHits, repo.units.length)}), ${units.size} read (precision ${pct(unitHits, units.size)})`)
  for (const u of repo.units.filter((x) => !units.has(x))) console.log(`    missed unit ${u}`)
  for (const u of [...units].filter((x) => !repo.units.includes(x))) console.log(`    extra unit ${u}`)
  console.log(`  calls: recall ${pct(right, expected.size)} (${right}/${expected.size}), precision ${pct(right, right + wrong.length)} (${wrong.length} not stated)`)
  for (const c of missed) console.log(`    missed ${c}`)
  for (const c of wrong) console.log(`    not stated ${c}`)
  if (repo.tables) {
    const tables = new Set(facts.tables.map((t) => t.table.toLowerCase()))
    console.log(`  tables: ${repo.tables.filter((t) => tables.has(t)).length}/${repo.tables.length}${[...tables].filter((t) => !repo.tables!.includes(t)).length ? `, extra ${[...tables].filter((t) => !repo.tables!.includes(t)).join(', ')}` : ''}`)
  }
  if (facts.notes.length) console.log(`  notes: ${facts.notes.slice(0, 3).join(' | ')}`)
}
console.log(`\nAll: units recall ${pct(totals.units[0], totals.units[1])}, precision ${pct(totals.units[0], totals.units[2])}; calls recall ${pct(totals.calls[0], totals.calls[1])}, precision ${pct(totals.calls[0], totals.calls[2])}`)
