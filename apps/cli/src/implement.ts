import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { C4Node } from '@radical/common/c4'
import { FEDERATION_FILE, parseFederationFile } from '@radical/common/federation'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { originModel, originOf } from '@radical/common/model'
import { REPOSITORY_FILE, builtIn, parseRepositoryFile, serializeRepositoryFile, type RepositoryFile } from '@radical/common/repositoryMapping'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { repositoryRoot } from '@radical/node-files/repositoryLayout'
import { readEditorStateFile } from '@radical/node-files/selectionFile'
import type { Io } from './check'
import { modelFolderArg } from './modelFolder'

export const IMPLEMENT_USAGE = `Usage: radical implement <element> [--path <folder>]… [--remove] [--folder <dir>]

Says where the repository builds an element of the model, in its
${REPOSITORY_FILE}, which the repository's sensors (element.paths in their
--context), radical check and Studio read. The element is its id or its name
(an element of another model of the federation, as fetched, too); a name
two elements share needs the id.

  --path <folder>  a folder that builds the element, from the working
                   directory; more than once for several. Replaces the
                   element's paths
  --remove         takes the element out of the file
  --folder <dir>   the model folder (default: the working directory when it
                   is one, else the repository's .radical/model)

Without --path and --remove it says where the element is built: its own
paths, or those it inherits from its nearest parent with an entry.

Exit status: 0 done, 2 it could not (no such element, or several).`

export const shown = (node: C4Node): string => `${node.type} "${node.label}" (${node.id})${originOf(node) ? ` of ${originModel(originOf(node)!)}` : ''}`

/** The model's element named `wanted` (its id or its name; of `types`
 *  when given) and the repository's .radical/radical.json, for radical
 *  implement and radical verify; an exit status when either cannot be had,
 *  said on io.err. */
export async function openElement(io: Io, folderArg: string | undefined, wanted: string, types?: string[]): Promise<number | {
  node: C4Node; byId: Map<string, C4Node>; root: string; file: string; where: string; repository: RepositoryFile
}> {
  const folder = resolve(io.cwd, await modelFolderArg(folderArg, io.cwd))
  let nodes: C4Node[]
  try {
    const own = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder), { writeCache: false }).readAll()).data.nodes
    // The other models' elements as last fetched (radical federation fetch).
    const fetched = parseFederationFile(await readEditorStateFile(folder, FEDERATION_FILE))
    nodes = [...own, ...(fetched?.nodes ?? [])]
  } catch (error) {
    io.err(`Cannot read the model folder ${relative(io.cwd, folder) || '.'}: ${(error as Error).message}`)
    return 2
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const kinds = types ? nodes.filter((n) => types.includes(n.type)) : nodes
  const named = byId.get(wanted) && (!types || types.includes(byId.get(wanted)!.type)) ? [byId.get(wanted)!] : kinds.filter((n) => n.label.trim().toLowerCase() === wanted.toLowerCase())
  if (named.length !== 1) {
    const near = named.length ? named : kinds.filter((n) => n.label.toLowerCase().includes(wanted.toLowerCase())).slice(0, 8)
    const what = types ? types.join(' or ') : 'element'
    io.err(named.length
      ? `${named.length} elements are named "${wanted}": name one by its id.\n${near.map((n) => `  ${shown(n)}`).join('\n')}`
      : `No ${what} named "${wanted}" in the model.${near.length ? ` Did you mean:\n${near.map((n) => `  ${shown(n)}`).join('\n')}` : ''}`)
    return 2
  }
  const root = await repositoryRoot(folder) ?? await repositoryRoot(io.cwd) ?? dirname(dirname(folder))
  const file = join(root, REPOSITORY_FILE)
  const where = relative(io.cwd, file) || REPOSITORY_FILE
  try {
    const repository = existsSync(file) ? parseRepositoryFile(await readFile(file, 'utf8'), where) : { implements: [], verifies: [] }
    return { node: named[0], byId, root, file, where, repository }
  } catch (error) {
    io.err((error as Error).message)
    return 2
  }
}

/** `radical implement`: an entry of the repository's .radical/radical.json. */
export async function implementCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { path: { type: 'string', multiple: true }, remove: { type: 'boolean', default: false }, folder: { type: 'string' }, help: { type: 'boolean', short: 'h', default: false } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${IMPLEMENT_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(IMPLEMENT_USAGE); return 0 }
  const wanted = positionals.join(' ').trim()
  if (!wanted || (values.remove && values.path?.length)) { io.err(IMPLEMENT_USAGE); return 2 }

  const opened = await openElement(io, values.folder, wanted)
  if (typeof opened === 'number') return opened
  const { node, byId, root, file, where, repository } = opened
  const mapped = repository.implements
  const parentOf = (id: string) => byId.get(id)?.parentId

  if (!values.remove && !values.path?.length) {
    const found = builtIn(mapped, node.id, parentOf)
    if (!found) io.out(`${shown(node)} is built nowhere ${where} says: radical implement ${node.id} --path <folder>`)
    else io.out(`${shown(node)} is built in ${found.paths.join(', ')}${found.from === node.id ? '' : `, as ${shown(byId.get(found.from)!)} is`}`)
    return 0
  }

  const at = mapped.findIndex((m) => m.element === node.id)
  if (values.remove) {
    if (at < 0) { io.out(`${where} has no entry for ${shown(node)}.`); return 0 }
    mapped.splice(at, 1)
    await writeFile(file, serializeRepositoryFile(repository))
    io.out(`- ${shown(node)} taken out of ${where}`)
    return 0
  }
  // Paths from the working directory, kept from the repository's root.
  const paths = values.path!.map((p) => relative(root, resolve(io.cwd, p)).split('\\').join('/') || '.')
  const outside = paths.filter((p) => p.startsWith('..'))
  if (outside.length) { io.err(`${outside.join(', ')} ${outside.length === 1 ? 'is' : 'are'} outside the repository (${root}).`); return 2 }
  for (const p of paths) if (!existsSync(join(root, p))) io.err(`! ${p} is not in the repository yet; radical check warns about it until it is.`)
  const entry = { element: node.id, name: node.label, paths }
  if (at < 0) mapped.push(entry)
  else mapped[at] = entry
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, serializeRepositoryFile(repository))
  io.out(`+ ${shown(node)} is built in ${paths.join(', ')} (${where})`)
  return 0
}
