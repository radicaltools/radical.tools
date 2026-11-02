import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { REPOSITORY_FILE, serializeRepositoryFile, testsBoundTo } from '@radical/common/repositoryMapping'
import type { Io } from './check'
import { openElement, shown } from './implement'

export const VERIFY_USAGE = `Usage: radical verify <scenario or fitness function> [--test "<file> › <title>"]… [--drop "<test>"]… [--remove] [--folder <dir>]

Binds tests of the repository to a scenario or fitness function of the model,
in its ${REPOSITORY_FILE} ("verifies"), which radical check, the Inspector
and Studio's card read: it passes when every test bound to it passed and its
metric conditions hold. The element is its id or its name; a name two
elements share needs the id.

  --test <id>      a test to bind, as Vitest and Playwright print it, from
                   the repository's root: <file> › <describe> › <title>, or
                   <file> for every test in it; more than once for several
  --drop <id>      a test to take off
  --remove         takes the element's entry out
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
  const adds = (values.test ?? []).map((t) => t.trim()).filter(Boolean)
  const drops = (values.drop ?? []).map((t) => t.trim()).filter(Boolean)
  if (!wanted || (values.remove && (adds.length || drops.length))) { io.err(VERIFY_USAGE); return 2 }

  const opened = await openElement(io, values.folder, wanted, ['scenario', 'fitness-fn'])
  if (typeof opened === 'number') return opened
  const { node, file, where, repository } = opened
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
    const tests = [...bound.filter((t) => !drops.includes(t)), ...adds.filter((t) => !bound.includes(t))]
    const entry = { element: node.id, name: node.label, tests }
    if (!tests.length) repository.verifies.splice(at, 1)
    else if (at < 0) repository.verifies.push(entry)
    else repository.verifies[at] = entry
  }
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, serializeRepositoryFile(repository))
  const now = testsBoundTo(repository.verifies, node.id)
  io.out(values.remove ? `- ${shown(node)} taken out of ${where}` : `${shown(node)} is checked by ${now.length ? `${now.length} test${now.length === 1 ? '' : 's'}` : 'no test'} (${where})${now.length ? `:\n${now.map((t) => `  ${t}`).join('\n')}` : ''}`)
  return 0
}
