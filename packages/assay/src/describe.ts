// What a run found, for people and agents: per repository its units and the
// counts of its other facts, then the links; per source its documents. The
// CLI prints it; assay_start and assay_add_sources return it.

import { relative } from 'node:path'
import type { Link, RepositoryFacts, Unit } from './facts'

const unitLine = (u: Unit): string =>
  `  - ${u.id}: ${u.name} (${u.stack} ${u.kind}: ${u.why}${u.technology.length ? `; ${u.technology.join(', ')}` : ''}${u.ports?.length ? `; listens on ${u.ports.join(', ')}` : ''}${u.testFramework ? `; tests with ${u.testFramework}` : ''})${u.description ? ` — ${u.description}` : ''}`

/** Its tables as a schema or ORM declares them, its statuses and its entry points, counted by kind. */
const domainLines = (r: RepositoryFacts): string[] => {
  const declared = r.tables.filter((t) => t.declared)
  const keys = r.tables.reduce((n, t) => n + (t.references?.length ?? 0), 0)
  const kinds = new Map<string, number>()
  for (const e of r.entries) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1)
  const names: Record<string, [string, string]> = { route: ['route', 'routes'], form: ['form', 'forms'], menu: ['menu item', 'menu items'], control: ['button', 'buttons'], job: ['scheduled job', 'scheduled jobs'], handler: ['message handler', 'message handlers'] }
  return [
    ...(declared.length ? [`  tables declared (${declared.map((t) => t.declared).filter((d, i, a) => a.indexOf(d) === i).join(', ')}): ${declared.map((t) => `${t.table} (${t.columns?.length ?? 0} columns${t.references?.length ? `, → ${t.references.map((x) => x.table).join(', ')}` : ''})`).join('; ')}${keys ? ` — ${count(keys, 'foreign key')}` : ''}`] : []),
    ...r.states.map((s) => `  - ${s.id}: ${s.name}${s.table ? ` (${s.table}.${s.column})` : ''}: ${s.values.join(', ')}${s.initial ? ` (a new one starts ${s.initial})` : ''}; ${count(s.sets.length, 'line sets', 'lines set')} a value`),
    ...(r.entries.length ? [`  entry points: ${[...kinds].map(([k, n]) => count(n, ...names[k])).join(', ')} (assay_facts with kind entries)`] : []),
  ]
}

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** The repositories' facts and the links, with folders shown from `from`. */
export function describeFacts(repositories: RepositoryFacts[], links: Link[], from: string): string[] {
  return [
    ...repositories.flatMap((r) => [
      `${r.repository} (${relative(from, r.dir) || '.'}${r.commit ? `, ${r.commit.slice(0, 7)}` : ', no commit'}): ${[
        count(r.units.length, 'unit'), count(r.dependencies.length, 'dependency', 'dependencies'), count(r.apis.length, 'API operation'),
        count(r.urls.length, 'URL path'), count(r.clients.length, 'gRPC client'), count(r.addresses.length, 'address', 'addresses'),
        count(r.services.length, 'deployed service'), count(r.databases.length, 'database'), count(r.tables.length, 'table'),
        count(r.states.length, 'status', 'statuses'), count(r.screens.length, 'form'), count(r.entries.length, 'entry point'), count(r.groups.length, 'group'), count(r.tests.length, 'test'), count(r.documents.length, 'document'),
      ].filter((c, i) => i === 0 || !c.startsWith('0 ')).join(', ')}.`,
      ...r.units.map(unitLine),
      ...r.services.map((s) => `  - ${s.id}: ${s.role}${s.image ? ` ${s.image}` : ''}${s.unit ? `, runs ${s.unit}` : ''}`),
      ...r.databases.map((d) => `  - ${d.id}: ${d.engine}${d.server ? ` on ${d.server}` : ''}${d.name ? `, ${d.name}` : ''}`),
      ...r.groups.map((g) => `  - ${g.id}: ${g.name} (${g.units.length} units)`),
      ...domainLines(r),
      ...r.notes.map((n) => `  ! ${n}`),
    ]),
    '',
    `Links (${links.length}):`,
    ...links.map((l) => `  - ${l.id}: ${l.from} → ${l.to}, ${l.kind}, ${l.confidence}: ${l.detail}`),
  ]
}

/** At most this many of a source's documents are named; assay_facts lists them all. */
const NAMED = 30

/** The sources of documents a run took, with folders shown from `from`. */
export function describeSources(sources: RepositoryFacts[], from: string): string[] {
  return sources.flatMap((s) => [
    `${s.repository} (kept in ${relative(from, s.dir)}, from ${s.origin}): ${count(s.documents.length, 'document')}.`,
    ...s.documents.slice(0, NAMED).map((d) => `  - ${d.id}: ${d.title} (${count(d.headings.length, 'heading')})`),
    ...(s.documents.length > NAMED ? [`  - … ${s.documents.length - NAMED} more (assay_facts with repository ${s.repository}, kind documents)`] : []),
    ...s.notes.map((n) => `  ! ${n}`),
  ])
}
