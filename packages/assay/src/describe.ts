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
    ...r.states.map((s) => `  - ${s.id}: ${s.name}${s.flags ? ` (columns ${s.flags.map((f) => f.column).join(', ')})` : s.table ? ` (${s.table}.${s.column})` : ''}: ${s.values.join(', ')}${s.initial ? ` (a new one starts ${s.initial})` : ''}; ${count(s.sets.length, 'line sets', 'lines set')} a value`),
    ...(r.routines?.length ? [`  stored routines: ${[...routineKinds(r)].map(([k, n]) => count(n, k)).join(', ')} (assay_facts with kind routines; routineCalls for the code's calls)`] : []),
    ...(r.entries.length ? [`  entry points: ${[...kinds].map(([k, n]) => count(n, ...names[k])).join(', ')} (assay_facts with kind entries)`] : []),
  ]
}

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** A repository's stored routines counted by kind, the ones only its code calls apart. */
const routineKinds = (r: RepositoryFacts): Map<string, number> => {
  const kinds = new Map<string, number>()
  for (const x of r.routines ?? []) {
    const kind = x.called ? 'routine only called' : x.name.includes('.') && x.kind !== 'package' ? `package ${x.kind}` : x.kind
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  }
  return kinds
}

/** At most this many units, services and databases of a repository are named in a brief description. */
const BRIEF = 25

/** The repositories' facts and the links, with folders shown from `from`; `brief`: each repository's first units,
 *  services and databases, and the links counted by kind (an agent's client keeps a long answer out of its view). */
export function describeFacts(repositories: RepositoryFacts[], links: Link[], from: string, brief = false): string[] {
  const first = <T>(list: T[], kind: string, repository: string): Array<T | string> =>
    brief && list.length > BRIEF ? [...list.slice(0, BRIEF), `  - … ${list.length - BRIEF} more ${kind} (assay_facts with repository ${repository}, kind ${kind})`] : list
  const kinds = new Map<string, number>()
  for (const l of links) kinds.set(`${l.kind}, ${l.confidence}`, (kinds.get(`${l.kind}, ${l.confidence}`) ?? 0) + 1)
  return [
    ...repositories.flatMap((r) => [
      `${r.repository} (${relative(from, r.dir) || '.'}${r.commit ? `, ${r.commit.slice(0, 7)}` : ', no commit'}): ${[
        count(r.units.length, 'unit'), count(r.dependencies.length, 'dependency', 'dependencies'), count(r.apis.length, 'API operation'),
        count(r.urls.length, 'URL path'), count(r.clients.length, 'gRPC client'), count(r.addresses.length, 'address', 'addresses'),
        count(r.services.length, 'deployed service'), count(r.databases.length, 'database'), count(r.tables.length, 'table'), count((r.routines ?? []).length, 'stored routine'),
        count(r.states.length, 'status', 'statuses'), count(r.screens.length, 'form'), count(r.entries.length, 'entry point'), count(r.groups.length, 'group'), count(r.tests.length, 'test'), count(r.documents.length, 'document'),
      ].filter((c, i) => i === 0 || !c.startsWith('0 ')).join(', ')}.`,
      ...first(r.units, 'units', r.repository).map((u) => (typeof u === 'string' ? u : unitLine(u))),
      ...first(r.services, 'services', r.repository).map((s) => (typeof s === 'string' ? s : `  - ${s.id}: ${s.role}${s.image ? ` ${s.image}` : ''}${s.unit ? `, runs ${s.unit}` : ''}`)),
      ...first(r.databases, 'databases', r.repository).map((d) => (typeof d === 'string' ? d : `  - ${d.id}: ${d.engine}${d.server ? ` on ${d.server}` : ''}${d.name ? `, ${d.name}` : ''}`)),
      ...r.groups.map((g) => `  - ${g.id}: ${g.name} (${g.units.length} units)`),
      ...(brief ? [] : domainLines(r)),
      ...(brief && r.notes.length > BRIEF ? [...r.notes.slice(0, BRIEF).map((n) => `  ! ${n}`), `  ! … ${r.notes.length - BRIEF} more notes (in its facts file)`] : r.notes.map((n) => `  ! ${n}`)),
    ]),
    '',
    `Links (${links.length}):`,
    ...(brief ? [...kinds].map(([k, n]) => `  - ${n} ${k} (assay_facts with kind links)`) : links.map((l) => `  - ${l.id}: ${l.from} → ${l.to}, ${l.kind}, ${l.confidence}: ${l.detail}`)),
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
