// What a run found, for people and agents: per repository its units and the
// counts of its other facts, then the links; per source its documents. The
// CLI prints it; assay_start and assay_add_sources return it.

import { relative } from 'node:path'
import type { Link, RepositoryFacts, Unit } from './facts'

const unitLine = (u: Unit): string =>
  `  - ${u.id}: ${u.name} (${u.stack} ${u.kind}: ${u.why}${u.technology.length ? `; ${u.technology.join(', ')}` : ''}${u.ports?.length ? `; listens on ${u.ports.join(', ')}` : ''})${u.description ? ` — ${u.description}` : ''}`

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** The repositories' facts and the links, with folders shown from `from`. */
export function describeFacts(repositories: RepositoryFacts[], links: Link[], from: string): string[] {
  return [
    ...repositories.flatMap((r) => [
      `${r.repository} (${relative(from, r.dir) || '.'}${r.commit ? `, ${r.commit.slice(0, 7)}` : ', no commit'}): ${[
        count(r.units.length, 'unit'), count(r.dependencies.length, 'dependency', 'dependencies'), count(r.apis.length, 'API operation'),
        count(r.urls.length, 'URL path'), count(r.clients.length, 'gRPC client'), count(r.addresses.length, 'address', 'addresses'),
        count(r.services.length, 'deployed service'), count(r.databases.length, 'database'), count(r.tables.length, 'table'),
        count(r.groups.length, 'group'), count(r.tests.length, 'test'), count(r.documents.length, 'document'),
      ].filter((c, i) => i === 0 || !c.startsWith('0 ')).join(', ')}.`,
      ...r.units.map(unitLine),
      ...r.services.map((s) => `  - ${s.id}: ${s.role}${s.image ? ` ${s.image}` : ''}${s.unit ? `, runs ${s.unit}` : ''}`),
      ...r.databases.map((d) => `  - ${d.id}: ${d.engine}${d.server ? ` on ${d.server}` : ''}${d.name ? `, ${d.name}` : ''}`),
      ...r.groups.map((g) => `  - ${g.id}: ${g.name} (${g.units.length} units)`),
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
