// ─── Repository mapping ──────────────────────────────────────────────────────
//
// Which elements of the model a repository builds, and where (ADR The
// repository maps the model to its code), and which of its tests check the
// model's scenarios and fitness functions (ADR Tests are bound outside the
// model): .radical/radical.json at the repository's root,
// { "model": { "repo", "ref" },
//   "implements": [{ "element", "name", "paths" }],
//   "verifies": [{ "element", "name", "tests" }] },
// paths and test ids from the repository's root. Read by the CLI on disk and
// by Studio beside the model; what both need of it is here.

/** The file, from the repository's root. */
export const REPOSITORY_FILE = '.radical/radical.json'

/** One element the repository builds: its id, its name for people, and the
 *  paths from the repository's root that build it. */
export interface MappedElement {
  element: string
  name?: string
  paths: string[]
}

/** One scenario or fitness function the repository's tests check: its id,
 *  its name for people, and the test ids (`<file> › <title>`, as Vitest and
 *  Playwright print them) from the repository's root. */
export interface VerifiedElement {
  element: string
  name?: string
  tests: string[]
}

/** The model of a system built in several repositories, when it lives in a
 *  repository of its own (ADR One system model across repositories). */
export interface ExternalModel {
  repo: string
  ref?: string
}

/** What a .radical/radical.json says: besides the mapping, the repository's
 *  own settings of the check (ADR The model folder holds nothing of the
 *  repository): the test files every test of which a scenario or fitness
 *  function must check (test-unbound), and CI's artifacts that hold the
 *  test reports (radical check --from-ci). */
export interface RepositoryFile {
  model?: ExternalModel
  implements: MappedElement[]
  verifies: VerifiedElement[]
  tests?: { include?: string[]; exclude?: string[] }
  ci?: { artifacts?: string[] }
}

/** A list of strings, or one string as a list of one. */
const strings = (v: unknown): string[] | null =>
  typeof v === 'string' ? [v] : Array.isArray(v) && v.every((x) => typeof x === 'string') ? v as string[] : null

/** A .radical/radical.json; throws, naming `file`, when it does not read. */
export function parseRepositoryFile(text: string, file = REPOSITORY_FILE): RepositoryFile {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (error) { throw new Error(`${file}: ${(error as Error).message}`) }
  const list = (key: 'implements' | 'verifies'): Array<Record<string, unknown>> => {
    const value = (raw as Record<string, unknown>)?.[key] ?? []
    if (!Array.isArray(value)) throw new Error(`${file}: "${key}" is no list`)
    return value as Array<Record<string, unknown>>
  }
  const name = (e: Record<string, unknown>) => (typeof e?.name === 'string' ? { name: e.name } : {})
  const settings = (key: string, lists: string[]): Record<string, string[]> | undefined => {
    const value = (raw as Record<string, unknown>)?.[key]
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object') throw new Error(`${file}: "${key}" is no object`)
    const out: Record<string, string[]> = {}
    for (const list of lists) {
      const v = (value as Record<string, unknown>)[list]
      if (v === undefined) continue
      const got = strings(v)
      if (!got) throw new Error(`${file}: "${key}.${list}" is no list`)
      out[list] = got
    }
    return out
  }
  const tests = settings('tests', ['include', 'exclude'])
  const ci = settings('ci', ['artifacts'])
  const model = (raw as Record<string, unknown>)?.model as Record<string, unknown> | undefined
  if (model !== undefined && (typeof model?.repo !== 'string' || !model.repo || (model.ref !== undefined && typeof model.ref !== 'string'))) {
    throw new Error(`${file}: "model" needs "repo" (the address of the model's repository), and "ref" is a branch or tag`)
  }
  return {
    ...(model ? { model: { repo: model.repo as string, ...(model.ref ? { ref: model.ref as string } : {}) } } : {}),
    ...(tests ? { tests } : {}),
    ...(ci ? { ci } : {}),
    implements: list('implements').map((e, i): MappedElement => {
      const paths = strings(e?.paths)
      if (typeof e?.element !== 'string' || !e.element || !paths) throw new Error(`${file}: implements[${i}] needs "element" (an id) and "paths" (a list of folders)`)
      return { element: e.element, ...name(e), paths }
    }),
    verifies: list('verifies').map((e, i): VerifiedElement => {
      const tests = strings(e?.tests)
      if (typeof e?.element !== 'string' || !e.element || !tests) throw new Error(`${file}: verifies[${i}] needs "element" (an id) and "tests" (a list of test ids)`)
      return { element: e.element, ...name(e), tests }
    }),
  }
}

/** The entries of "implements" (parseRepositoryFile's). */
export function parseRepositoryMapping(text: string, file = REPOSITORY_FILE): MappedElement[] {
  return parseRepositoryFile(text, file).implements
}

/** The file as radical implement and radical verify write it: an element of
 *  "implements" a line, a test of "verifies" a line. */
export function serializeRepositoryFile(file: RepositoryFile): string {
  const head = (m: { element: string; name?: string }) => `"element": ${JSON.stringify(m.element)}${m.name !== undefined ? `, "name": ${JSON.stringify(m.name)}` : ''}`
  const implemented = file.implements.map((m) => `    { ${head(m)}, "paths": [${m.paths.map((p) => JSON.stringify(p)).join(', ')}] }`)
  const verified = file.verifies.map((v) => `    { ${head(v)}, "tests": [${v.tests.length ? `\n${v.tests.map((t) => `      ${JSON.stringify(t)}`).join(',\n')}\n    ` : ''}] }`)
  const section = (key: string, lines: string[]) => `  "${key}": [${lines.length ? `\n${lines.join(',\n')}\n  ` : ''}]`
  const inline = (v: object) => `{ ${Object.entries(v).map(([k, list]) => `${JSON.stringify(k)}: [${(list as string[]).map((x) => JSON.stringify(x)).join(', ')}]`).join(', ')} }`
  const settings = [
    ...(file.model ? [`  "model": { ${Object.entries(file.model).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`] : []),
    ...(file.tests ? [`  "tests": ${inline(file.tests)}`] : []),
    ...(file.ci ? [`  "ci": ${inline(file.ci)}`] : []),
  ]
  return `{\n${[...settings, section('implements', implemented), ...(file.verifies.length ? [section('verifies', verified)] : [])].join(',\n')}\n}\n`
}

/** The tests the file binds to element `id`. */
export function testsBoundTo(verifies: VerifiedElement[], id: string): string[] {
  return verifies.find((v) => v.element === id)?.tests ?? []
}

/** Where element `id` is built: its own entry's paths, else those of its
 *  nearest ancestor with one (`parentOf` gives an element's parent), with
 *  the element whose entry they are; null when neither has one. */
export function builtIn(mapped: MappedElement[], id: string, parentOf: (id: string) => string | undefined): { paths: string[]; from: string } | null {
  const byElement = new Map(mapped.map((m) => [m.element, m.paths]))
  const seen = new Set<string>()
  for (let at: string | undefined = id; at && !seen.has(at); at = parentOf(at)) {
    seen.add(at)
    const paths = byElement.get(at)
    if (paths) return { paths, from: at }
  }
  return null
}

/** The paths that build element `id` (builtIn's), none when it has none. */
export function elementPaths(mapped: MappedElement[], id: string, parentOf: (id: string) => string | undefined): string[] {
  return builtIn(mapped, id, parentOf)?.paths ?? []
}

/** What marks what another repository of the system builds, as a dependency's
 *  name marks its elements. */
export const OTHER_REPOSITORIES = 'other repositories'

/** The ids of a repository's part of one system model (ADR One system model
 *  across repositories): the elements it builds, by the nearest mapped ancestor;
 *  the requirements they satisfy and what those derive from; the state machines
 *  they implement or that are the lifecycle of the entities they realise, with
 *  everything in those machines; those entities; the scenarios of those
 *  requirements and machines; the ADRs that constrain the elements and the
 *  fitness functions of those ADRs. */
export function repositoryPartIds(
  data: { nodes: Array<{ id: string; parentId?: string }>; relations: Array<{ relationType?: string; sourceId: string; targetId: string }> },
  mapped: MappedElement[],
): Set<string> {
  const parent = new Map(data.nodes.map((n) => [n.id, n.parentId]))
  const under = (id: string, roots: Set<string>) => {
    for (let at: string | undefined = id; at; at = parent.get(at)) if (roots.has(at)) return true
    return false
  }
  const from = (type: string, targets: Set<string>) => data.relations.filter((r) => r.relationType === type && targets.has(r.targetId)).map((r) => r.sourceId)
  const to = (type: string, sources: Set<string>) => data.relations.filter((r) => r.relationType === type && sources.has(r.sourceId)).map((r) => r.targetId)
  const elements = new Set(data.nodes.filter((n) => builtIn(mapped, n.id, (id) => parent.get(id))).map((n) => n.id))
  const requirements = new Set(to('satisfies', elements))
  // A requirement may derive from another: all the way up to its need.
  for (let size = -1; size !== requirements.size;) {
    size = requirements.size
    for (const id of to('derives', requirements)) requirements.add(id)
  }
  const realised = new Set(to('realises', elements))
  const machines = new Set([...to('implements', elements), ...from('lifecycle-of', realised)])
  const entities = [...realised, ...to('lifecycle-of', machines)]
  const behaviour = data.nodes.filter((n) => under(n.id, machines)).map((n) => n.id)
  const adrs = new Set(from('constrains', elements))
  return new Set([...elements, ...requirements, ...entities, ...behaviour,
    ...from('verifies', new Set([...requirements, ...machines])), ...adrs, ...from('implements', adrs)])
}

/** The model as a repository of one system model judges it: what is not of its
 *  part (repositoryPartIds) carries an origin, so it is read and not judged, as
 *  another model's elements are. */
export function repositoryPart<N extends { id: string; type: string; parentId?: string; origin?: unknown }, R extends { id: string; relationType?: string; sourceId: string; targetId: string; origin?: unknown }>(
  data: { nodes: N[]; relations: R[] },
  mapped: MappedElement[],
): { nodes: N[]; relations: R[] } {
  const here = repositoryPartIds(data, mapped)
  return {
    nodes: data.nodes.map((n) => (here.has(n.id) || n.origin ? n : { ...n, origin: OTHER_REPOSITORIES })),
    relations: data.relations.map((r) => ((here.has(r.sourceId) && here.has(r.targetId)) || r.origin ? r : { ...r, origin: OTHER_REPOSITORIES })),
  }
}

/** The command that binds a test to `node`, a scenario or fitness function:
 *  by its name when no other of them has it, else by its id. */
export function verifyCommand(nodes: Iterable<{ id: string; label: string; type: string }>, node: { id: string; label: string }): string {
  const name = node.label.trim().toLowerCase()
  const shared = [...nodes].some((n) => n.id !== node.id && (n.type === 'scenario' || n.type === 'fitness-fn') && n.label.trim().toLowerCase() === name)
  const named = !shared && name && !/["$`\\]/.test(node.label) ? `"${node.label}"` : node.id
  return `radical verify ${named} --test "<file> › <title>"`
}

/** The command that maps `node` to a folder: by its name when no other
 *  element has it, else by its id. */
export function implementCommand(nodes: Iterable<{ id: string; label: string }>, node: { id: string; label: string }): string {
  const name = node.label.trim().toLowerCase()
  const shared = [...nodes].some((n) => n.id !== node.id && n.label.trim().toLowerCase() === name)
  const named = !shared && name && !/["$`\\]/.test(node.label) ? `"${node.label}"` : node.id
  return `radical implement ${named} --path <folder>`
}
