import { realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { modelChangesSince } from '@radical/node-files/gitModel'
import type { Io } from './check'

export const DIFF_USAGE = `Usage: radical diff [folder] [options]

Lists what changed in a Radical Markdown model folder since its version in
git: the elements and relations added, removed and changed, uncommitted edits
included, with each changed field's old and new value and each element's
place and relations. Only the model is compared; views, positions, sizes and
folding are left out. The MCP server's get_changes tool gives the same list.

  folder              the model folder (default: the working directory)
  --since <ref>       the git branch, tag or commit to compare with (default:
                      the merge base with the default branch, origin/main)
  --format <format>   text (default) or json

Exit status: 0 the list was written, 2 it could not be made.`

/** Runs `radical diff` with `args` (after the command name); returns the exit status. */
export async function diffCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        since: { type: 'string' },
        format: { type: 'string', default: 'text' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${DIFF_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(DIFF_USAGE); return 0 }
  if (positionals.length > 1 || !['text', 'json'].includes(values.format)) {
    io.err(DIFF_USAGE)
    return 2
  }
  const folder = positionals[0] ?? '.'
  try {
    const root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(root)).readAll()).data
    const changes = await modelChangesSince(root, data, values.since)
    io.out(values.format === 'json'
      ? JSON.stringify({ base: changes.base, ...changes.report }, null, 2)
      : changes.text)
    return 0
  } catch (error) {
    io.err(`radical diff: ${folder}: ${(error as Error).message}`)
    return 2
  }
}
