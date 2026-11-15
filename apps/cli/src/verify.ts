import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { canonicalTestId } from '@radical/common/check'
import { REPOSITORY_FILE, serializeRepositoryFile, testsBoundTo } from '@radical/common/repositoryMapping'
import type { Io } from './check'
import { openElement, shown, shownOrphan } from './implement'

export const VERIFY_USAGE = `Usage: radical verify <scenario or fitness function> [--test "<file> › <title>"]… [--drop "<test>"]… [--remove] [--folder <dir>]

Binds tests of the repository to a scenario or fitness function of the model,
in its ${REPOSITORY_FILE} ("verifies"), which radical check, the Inspector
and Studio's card read: it passes when every test bound to it passed and its
metric conditions hold. The element is its id or its name; a name two
elements share needs the id.

  --test <id>      a test to bind, as Vitest and Playwright print it, from
                   the repository's root: <file> › <describe> › <title>, or
                   <file> for every test in it; more than once for several.
                   Vitest's <file> > <describe> > <title> is kept with ›
  --drop <id>      a test to take off
  --remove         takes the element's entry out; one the model no longer
                   has too, by its id or name
  --folder <dir>   the model folder (default: the working directory when it
                   is one, else the repository's .radical/model)

Without options it lists the tests bound to the element.

Exit status: 0 done, 2 it could not (no such scenario or fitness function).`

/** `radical verify`: an entry of "verifies" in .radical/radical.json. */
export async function verifyCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { test: { type: 'string', multiple: true }, drop: { type: 'string', multiple: true }, remove: { type: 'boolean', default: false }, folder: { type: 'string' }, help: { type: 'boolean', short: 'h', default: false } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${VERIFY_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(VERIFY_USAGE); return 0 }
  const wanted = positionals.join(' ').trim()
  // One form of each id, so a test written either way is the same test.
  const adds = [...new Set((values.test ?? []).map(canonicalTestId).filter(Boolean))]
  const drops = (values.drop ?? []).map(canonicalTestId).filter(Boolean)
  if (!wanted || (values.remove && (adds.length || drops.length))) { io.err(VERIFY_USAGE); return 2 }

  const opened = await openElement(io, values.folder, wanted, ['scenario', 'fitness-fn'], values.remove ? 'verifies' : undefined)
  if (typeof opened === 'number') return opened
  const { file, where, repository } = opened
  if (opened.orphan) {
    repository.verifies.splice(repository.verifies.findIndex((v) => v.element === opened.orphan.element), 1)
    await writeFile(file, serializeRepositoryFile(repository))
    io.out(`- ${shownOrphan(opened.orphan)} taken out of ${where}`)
    return 0
  }
  const node = opened.node
  const bound = testsBoundTo(repository.verifies, node.id)

  if (!values.remove && !adds.length && !drops.length) {
    io.out(bound.length ? `${shown(node)} is checked by:\n${bound.map((t) => `  ${t}`).join('\n')}` : `${where} binds no test to ${shown(node)}: radical verify ${node.id} --test "<file> › <title>"`)
    return 0
  }
  const at = repository.verifies.findIndex((v) => v.element === node.id)
  if (values.remove) {
    if (at < 0) { io.out(`${where} has no entry for ${shown(node)}.`); return 0 }
    repository.verifies.splice(at, 1)
  } else {
    const kept = bound.filter((t) => !drops.includes(canonicalTestId(t)))
    const tests = [...kept, ...adds.filter((t) => !kept.some((k) => canonicalTestId(k) === t))]
    const entry = { element: node.id, name: node.label, tests }
    if (!tests.length) { if (at >= 0) repository.verifies.splice(at, 1) }
    else if (at < 0) repository.verifies.push(entry)
    else repository.verifies[at] = { ...repository.verifies[at], ...entry }
  }
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, serializeRepositoryFile(repository))
  const now = testsBoundTo(repository.verifies, node.id)
  io.out(values.remove ? `- ${shown(node)} taken out of ${where}` : `${shown(node)} is checked by ${now.length ? `${now.length} test${now.length === 1 ? '' : 's'}` : 'no test'} (${where})${now.length ? `:\n${now.map((t) => `  ${t}`).join('\n')}` : ''}`)
  return 0
}
