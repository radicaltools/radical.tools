import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { FACTS_FILE, FOLDER_FACTS_DIR, UNPACKED_DIR, describeFacts, extractRepository, factsFileOf, ignored, isRepository, linkRepositories, repositoriesIn, serializeFacts, type RepositoryFacts } from '@radical/assay'
import type { Io } from './check'

export const ASSAY_USAGE = `Usage: radical assay extract <directory or .zip>… [--report <repository>=<path>]… [--json]

Radical Assay finds the model in existing code. extract is its deterministic
part: it reads the facts of each code repository in the directories (a
directory that holds repositories stands for each of them, one that holds
none is a folder of code, and a .zip file is unpacked into
${UNPACKED_DIR}/ first; nothing is fetched or cloned): its units of
every stack Assay reads, each an app, a library or tests, and their
dependencies, deployments, APIs, addresses, databases, documents and the
tests its reports name, each with its file and line. It writes them to the
repository's ${FACTS_FILE} (a folder of code's, which it leaves as it
was, to ${FOLDER_FACTS_DIR}/ of the current directory), links the units across the
repositories, and prints what it found. It writes no model: an agent turns
the facts into one over MCP (assay_start), where documentation can be given
too.

  --report <repository>=<path>
                   a test report of that repository (Vitest, Jest or
                   Playwright JSON, JUnit XML; a file or a directory, from
                   its root); more than once for more. Default: each
                   repository's reports/
  --json           print the facts and the links as JSON instead

Exit status: 0 read, 2 it could not (no such directory, no code, a .zip file
with an entry outside its folder).`

/** Runs `radical assay` with `args` (after the command name); returns the exit status. */
export async function assayCommand(args: string[], io: Io): Promise<number> {
  const [sub, ...rest] = args
  if (sub === '--help' || sub === '-h' || sub === undefined) {
    io.out(ASSAY_USAGE)
    return sub === undefined ? 2 : 0
  }
  if (sub !== 'extract') {
    io.err(`Unknown assay command: ${sub}\n\n${ASSAY_USAGE}`)
    return 2
  }
  let parsed
  try {
    parsed = parseArgs({ args: rest, allowPositionals: true, options: { report: { type: 'string', multiple: true }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${ASSAY_USAGE}`)
    return 2
  }
  if (parsed.values.help) { io.out(ASSAY_USAGE); return 0 }
  if (!parsed.positionals.length) { io.err(`radical assay extract needs a directory.\n\n${ASSAY_USAGE}`); return 2 }
  const reports = new Map<string, string[]>()
  for (const spec of parsed.values.report ?? []) {
    const at = spec.indexOf('=')
    if (at <= 0 || at === spec.length - 1) { io.err(`--report ${spec}: write it as <repository>=<path>`); return 2 }
    reports.set(spec.slice(0, at), [...(reports.get(spec.slice(0, at)) ?? []), spec.slice(at + 1)])
  }
  let found
  try {
    if (parsed.positionals.some((p) => /\.zip$/i.test(p))) ignored(join(io.cwd, UNPACKED_DIR))
    found = repositoriesIn(parsed.positionals, io.cwd, join(io.cwd, UNPACKED_DIR))
  } catch (error) {
    io.err((error as Error).message)
    return 2
  }
  if (!found.dirs.length) { io.err(`No code in ${parsed.positionals.join(', ')} (Assay clones nothing).`); return 2 }
  const unknown = [...reports.keys()].filter((name) => !found.dirs.some((d) => d.endsWith(`/${name}`) || d.endsWith(`\\${name}`)))
  if (unknown.length) { io.err(`--report names no repository of the run: ${unknown.join(', ')}`); return 2 }

  const repositories: RepositoryFacts[] = []
  for (const dir of found.dirs) {
    const facts = extractRepository(dir, reports.size ? { reports: reports.get(dir.split(/[\\/]/).pop()!) } : {})
    repositories.push(facts)
    // A folder of code is left as it was: its facts go to this directory's .radical/assay/facts/.
    const file = factsFileOf(dir, facts.repository, io.cwd)
    try {
      if (!isRepository(dir)) ignored(join(io.cwd, FOLDER_FACTS_DIR))
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, serializeFacts(facts))
    } catch (error) {
      facts.notes.push(`${file} not written: ${(error as Error).message}`)
    }
  }
  const links = linkRepositories(repositories)
  if (parsed.values.json) {
    io.out(JSON.stringify({ repositories: repositories.map(({ dir: _dir, ...r }) => r), links }, null, 2))
    return 0
  }
  for (const dir of found.empty) io.out(`Nothing in ${dir}.`)
  for (const note of found.notes) io.out(note)
  for (const line of describeFacts(repositories, links, io.cwd)) io.out(line)
  io.out(`\nFacts written to ${FACTS_FILE} in each repository (a folder of code's to ${FOLDER_FACTS_DIR}/ here). An agent turns them into a model over MCP: assay_start.`)
  return 0
}
