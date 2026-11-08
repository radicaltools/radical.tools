// ─── Radical Assay's bench: an agent's model scored ─────────────────────────
//
// The bench judges the facts; this judges the model an agent wrote from them
// against the same expectations: the units its containers, components and
// web applications are built from, the calls its relations between those
// elements and the databases make, and the tables its entities are. What
// each element is built from or stands for comes from the run's evidence
// (.radical/assay/run.json), the facts it cites. It asks what Assay's
// procedure asks: units of tests are no elements, join tables no entities.

/** A bench entry's expectations, as bench.json writes them. */
export interface Expectations {
  name: string
  units: string[]
  calls: Array<[string, string]>
  optional: Array<[string, string]>
  tables?: string[]
  url?: string
  /** Several repositories read together: their units named <repository>/<folder>. */
  repositories?: Array<{ name: string; url?: string }>
}

/** A repository's names: the bench's, and the folder a clone of its URL makes. */
const cloned = (r: { name: string; url?: string }): string[] => [r.name, ...(r.url ? [r.url.replace(/\.git$/, '').split('/').pop()!] : [])]

export interface ModelNode { id: string; type: string; label: string }
export interface ModelRelation { sourceId: string; targetId: string; relationType?: string; label?: string | null }
export interface WrittenItem { id: string; kind: string; facts: string[] }

/** What the run's repositories' facts say, beyond the model: deployed services, units of tests, join tables. */
export interface RunFacts {
  /** Deployed services by fact id: the name, the unit it runs. */
  services?: Record<string, { name: string; unit?: string }>
  /** Unit facts of kind tests. */
  tests?: string[]
  /** Table facts that only join two others. */
  joins?: string[]
}

export interface Score {
  /** tests: expected units that are tests, which the procedure makes no elements. */
  units: { found: number; expected: number; read: number; missed: string[]; extra: string[]; tests?: string[] }
  calls: { right: number; expected: number; wrong: string[]; missed: string[] }
  /** joins: expected tables that only join two others, which the procedure makes no entities. */
  tables?: { found: number; expected: number; missed: string[]; joins?: string[] }
}

/** A table that only joins others: foreign keys to two tables or more, and no column of its own beyond them and its key
 *  or bookkeeping (id, created_at, sort_order). */
export function joinsOnly(t: { references?: Array<{ column?: string; table: string }>; columns?: Array<{ name: string }> }): boolean {
  const refs = t.references ?? []
  if (new Set(refs.map((r) => r.table.toLowerCase())).size < 2 && refs.length < 2) return false
  const keys = new Set(refs.map((r) => r.column?.toLowerCase()).filter((c): c is string => !!c))
  return (t.columns ?? []).every((c) => keys.has(c.name.toLowerCase()) || /^(id|created_at|updated_at|inserted_at|sort_order|position)$/i.test(c.name))
}

const BUILT = new Set(['container', 'component', 'webapp'])
/** Relations that say nothing of a call. */
const STRUCTURE = new Set(['contains', 'part-of', 'references', 'realises', 'satisfies', 'verifies', 'derives', 'constrains', 'traces-to', 'presented-by', 'navigates-to', 'illustrates', 'performed-by', 'implements', 'lifecycle-of', 'transition'])

const lower = (call: string): string => call.replace(/db:[^ ]+/g, (m) => m.toLowerCase())

/** The model's score for one bench entry: its elements' units, its relations as calls, its entities as tables. */
export function scoreModel(expected: Expectations, nodes: ModelNode[], relations: ModelRelation[], written: WrittenItem[], run: RunFacts = {}): Score {
  const services = run.services ?? {}
  const repos = expected.repositories?.flatMap(cloned) ?? cloned(expected)
  const multi = !!expected.repositories
  /** The bench's name of a repository a fact names. */
  const benchName = (repo: string): string => expected.repositories?.find((r) => cloned(r).includes(repo))?.name ?? repo
  const type = new Map(nodes.map((n) => [n.id, n.type]))
  /** A unit fact as the bench names it: its folder, or <repository>/<folder> for several repositories. */
  const unitName = (fact: string): string | undefined => {
    const m = /^(.+?):unit:(.+)$/.exec(fact)
    if (!m || !repos.includes(m[1])) return undefined
    return multi ? (m[2] === '.' ? benchName(m[1]) : `${benchName(m[1])}/${m[2]}`) : m[2]
  }
  /** A database fact as the bench names it: db:<name>, else its engine. */
  const dbName = (fact: string): string | undefined => {
    const m = /^(.+?):db:[^:]*:([^/]+)\/(.*)$/.exec(fact)
    if (!m || !repos.includes(m[1])) return undefined
    return `db:${(m[3] || m[2]).toLowerCase()}`
  }
  /** A deployed service fact as the bench names it: the unit it runs, else service:<name>. */
  const serviceName = (fact: string): string | undefined => {
    const m = /^(.+?):service:(.+)$/.exec(fact)
    if (!m || !repos.includes(m[1])) return undefined
    const unit = services[fact]?.unit
    return unit ? unitName(unit) : `service:${(services[fact]?.name ?? m[2]).toLowerCase()}`
  }
  const facts = new Map(written.filter((w) => w.kind === 'element' || w.kind === 'entity').map((w) => [w.id, w.facts]))
  /** The names an element is called by: its units' folders, the databases it stands for. */
  const names = (id: string): string[] => {
    const f = facts.get(id) ?? []
    const units = BUILT.has(type.get(id) ?? '') ? f.map(unitName).filter((x): x is string => !!x) : []
    const dbs = type.get(id) === 'database' ? f.map(dbName).filter((x): x is string => !!x) : []
    // An element resting on a deployed service (a queue, a database's container) stands for it.
    const deployed = f.map(serviceName).filter((x): x is string => !!x)
    return [...new Set([...units, ...dbs, ...deployed])]
  }

  // The units elements are built from, and those a database or queue rests on through the service running it (an image of
  // the repository's).
  const built = new Set(nodes.flatMap((n) => (BUILT.has(n.type) ? names(n.id) : (facts.get(n.id) ?? []).map(serviceName).filter((x): x is string => !!x))
    .filter((x) => !x.startsWith('db:') && !x.startsWith('service:'))))
  const tests = new Set((run.tests ?? []).map(unitName).filter((x): x is string => !!x))
  const wanted = expected.units.filter((u) => !tests.has(u) || built.has(u))
  const units = {
    found: wanted.filter((u) => built.has(u)).length,
    expected: wanted.length,
    read: built.size,
    missed: wanted.filter((u) => !built.has(u)),
    extra: [...built].filter((u) => !expected.units.includes(u)),
    ...(wanted.length < expected.units.length ? { tests: expected.units.filter((u) => !wanted.includes(u)) } : {}),
  }

  const want = new Set(expected.calls.map(([a, b]) => lower(`${a} → ${b}`)))
  const optional = new Set(expected.optional.map(([a, b]) => lower(`${a} → ${b}`)))
  const found = new Set<string>()
  for (const r of relations) {
    if (STRUCTURE.has(r.relationType ?? '')) continue
    // A library "bundled into" a container is the container's dependency on it, whichever way an agent drew it
    // (Assay's procedure draws it from the library).
    const pair = (from: string, to: string): string[] => names(from).flatMap((a) => names(to).filter((b) => b !== a).map((b) => lower(`${a} → ${b}`)))
    const pairs = /^bundled into$/i.test(r.label?.trim() ?? '') ? [...pair(r.targetId, r.sourceId), ...pair(r.sourceId, r.targetId)] : pair(r.sourceId, r.targetId)
    if (!pairs.length) continue
    found.add(pairs.find((p) => want.has(p)) ?? pairs.find((p) => optional.has(p)) ?? pairs[0])
  }
  const calls = {
    right: [...found].filter((c) => want.has(c)).length,
    expected: want.size,
    wrong: [...found].filter((c) => !want.has(c) && !optional.has(c)),
    missed: [...want].filter((c) => !found.has(c)),
  }

  let tables: Score['tables']
  if (expected.tables) {
    const entities = new Set(nodes.filter((n) => n.type === 'entity').flatMap((n) => (facts.get(n.id) ?? [])
      .map((f) => /^(.+?):table:[^:]*:(.+)$/.exec(f)).filter((m): m is RegExpExecArray => !!m && repos.includes(m[1])).map((m) => m[2].toLowerCase())))
    const joins = new Set((run.joins ?? []).map((f) => /^(.+?):table:[^:]*:(.+)$/.exec(f)).filter((m): m is RegExpExecArray => !!m && repos.includes(m[1])).map((m) => m[2].toLowerCase()))
    const want = expected.tables.filter((t) => !joins.has(t) || entities.has(t))
    tables = {
      found: want.filter((t) => entities.has(t)).length, expected: want.length, missed: want.filter((t) => !entities.has(t)),
      ...(want.length < expected.tables.length ? { joins: expected.tables.filter((t) => !want.includes(t)) } : {}),
    }
  }
  return { units, calls, ...(tables ? { tables } : {}) }
}
