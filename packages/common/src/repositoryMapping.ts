// ─── Repository mapping ──────────────────────────────────────────────────────
//
// Which elements of the model a repository builds, and where (ADR The
// repository maps the model to its code), and which of its tests check the
// model's scenarios and fitness functions (ADR Tests are bound outside the
// model): .radical/radical.json at the repository's root,
// { "implements": [{ "element", "name", "paths" }],
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

/** What a .radical/radical.json says. */
export interface RepositoryFile {
  implements: MappedElement[]
  verifies: VerifiedElement[]
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
  return {
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
  return `{\n${section('implements', implemented)}${file.verifies.length ? `,\n${section('verifies', verified)}` : ''}\n}\n`
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
