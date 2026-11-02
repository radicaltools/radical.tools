// ─── Repository mapping ──────────────────────────────────────────────────────
//
// Which elements of the model a repository builds, and where (ADR The
// repository maps the model to its code): .radical/radical.json at the
// repository's root, { "implements": [{ "element", "name", "paths" }] },
// paths from the repository's root. Read by the CLI on disk and by Studio
// beside the model; what both need of it is here.

/** The file, from the repository's root. */
export const REPOSITORY_FILE = '.radical/radical.json'

/** One element the repository builds: its id, its name for people, and the
 *  paths from the repository's root that build it. */
export interface MappedElement {
  element: string
  name?: string
  paths: string[]
}

/** The entries of a .radical/radical.json; throws, naming `file`, when it
 *  does not read. */
export function parseRepositoryMapping(text: string, file = REPOSITORY_FILE): MappedElement[] {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (error) { throw new Error(`${file}: ${(error as Error).message}`) }
  const list = (raw as { implements?: unknown })?.implements ?? []
  if (!Array.isArray(list)) throw new Error(`${file}: "implements" is no list`)
  return list.map((entry, i): MappedElement => {
    const e = entry as Partial<MappedElement>
    const paths = typeof e?.paths === 'string' ? [e.paths] : e?.paths
    if (typeof e?.element !== 'string' || !e.element || !Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) {
      throw new Error(`${file}: implements[${i}] needs "element" (an id) and "paths" (a list of folders)`)
    }
    return { element: e.element, ...(typeof e.name === 'string' ? { name: e.name } : {}), paths }
  })
}

/** The file as radical implement writes it: one entry a line. */
export function serializeRepositoryMapping(mapped: MappedElement[]): string {
  const entry = (m: MappedElement) => `{ "element": ${JSON.stringify(m.element)}${m.name !== undefined ? `, "name": ${JSON.stringify(m.name)}` : ''}, "paths": [${m.paths.map((p) => JSON.stringify(p)).join(', ')}] }`
  return mapped.length ? `{\n  "implements": [\n${mapped.map((m) => `    ${entry(m)}`).join(',\n')}\n  ]\n}\n` : '{\n  "implements": []\n}\n'
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

/** The command that maps `node` to a folder: by its name when no other
 *  element has it, else by its id. */
export function implementCommand(nodes: Iterable<{ id: string; label: string }>, node: { id: string; label: string }): string {
  const name = node.label.trim().toLowerCase()
  const shared = [...nodes].some((n) => n.id !== node.id && n.label.trim().toLowerCase() === name)
  const named = !shared && name && !/["$`\\]/.test(node.label) ? `"${node.label}"` : node.id
  return `radical implement ${named} --path <folder>`
}
