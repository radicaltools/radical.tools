// ─── Radical Assay's bench: an agent's model scored ─────────────────────────
//
// The bench judges the facts; this judges the model an agent wrote from them
// against the same expectations: the units its containers, components and
// web applications are built from, the calls its relations between those
// elements and the databases make, and the tables its entities are. What
// each element is built from or stands for comes from the run's evidence
// (.radical/assay/run.json), the facts it cites.

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
export interface ModelRelation { sourceId: string; targetId: string; relationType?: string }
export interface WrittenItem { id: string; kind: string; facts: string[] }

export interface Score {
  units: { found: number; expected: number; read: number; missed: string[]; extra: string[] }
  calls: { right: number; expected: number; wrong: string[]; missed: string[] }
  tables?: { found: number; expected: number; missed: string[] }
}

const BUILT = new Set(['container', 'component', 'webapp'])
/** Relations that say nothing of a call. */
const STRUCTURE = new Set(['contains', 'part-of', 'references', 'realises', 'satisfies', 'verifies', 'derives', 'constrains', 'traces-to', 'presented-by', 'navigates-to', 'illustrates', 'performed-by', 'implements', 'lifecycle-of', 'transition'])

const lower = (call: string): string => call.replace(/db:[^ ]+/g, (m) => m.toLowerCase())

/** The model's score for one bench entry: its elements' units, its relations as calls, its entities as tables. */
export function scoreModel(expected: Expectations, nodes: ModelNode[], relations: ModelRelation[], written: WrittenItem[]): Score {
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
  const facts = new Map(written.filter((w) => w.kind === 'element' || w.kind === 'entity').map((w) => [w.id, w.facts]))
  /** The names an element is called by: its units' folders, the databases it stands for. */
  const names = (id: string): string[] => {
    const f = facts.get(id) ?? []
    const units = BUILT.has(type.get(id) ?? '') ? f.map(unitName).filter((x): x is string => !!x) : []
    const dbs = type.get(id) === 'database' ? f.map(dbName).filter((x): x is string => !!x) : []
    return [...new Set([...units, ...dbs])]
  }

  const built = new Set(nodes.filter((n) => BUILT.has(n.type)).flatMap((n) => names(n.id).filter((x) => !x.startsWith('db:'))))
  const units = {
    found: expected.units.filter((u) => built.has(u)).length,
    expected: expected.units.length,
    read: built.size,
    missed: expected.units.filter((u) => !built.has(u)),
    extra: [...built].filter((u) => !expected.units.includes(u)),
  }

  const want = new Set(expected.calls.map(([a, b]) => lower(`${a} → ${b}`)))
  const optional = new Set(expected.optional.map(([a, b]) => lower(`${a} → ${b}`)))
  const found = new Set<string>()
  for (const r of relations) {
    if (STRUCTURE.has(r.relationType ?? '')) continue
    const pairs = names(r.sourceId).flatMap((a) => names(r.targetId).filter((b) => b !== a).map((b) => lower(`${a} → ${b}`)))
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
    tables = { found: expected.tables.filter((t) => entities.has(t)).length, expected: expected.tables.length, missed: expected.tables.filter((t) => !entities.has(t)) }
  }
  return { units, calls, ...(tables ? { tables } : {}) }
}
