import { realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { modelChangesSince } from '@radical/node-files/gitModel'
import type { Io } from './check'
import { modelFolderArg } from './modelFolder'

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
  --part              only the repository's part of the model, by its
                      .radical/radical.json, as it is now and as it was at the
                      base: what the repository has left to build when the base
                      is the commit its code has reached
  --save-base         also save the model at the base to .state/base.json in
                      the folder, for Studio to show the changes (radical hooks
                      install keeps it fresh)
  --quiet             with --save-base: print nothing

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
        'save-base': { type: 'boolean', default: false },
        part: { type: 'boolean', default: false },
        quiet: { type: 'boolean', default: false },
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
  const folder = await modelFolderArg(positionals[0], io.cwd)
  try {
    const root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(root), { writeCache: false }).readAll()).data
    const changes = await modelChangesSince(root, data, values.since, { saveBase: values['save-base'], part: values.part })
    if (values.quiet && values['save-base']) return 0
    if (values['save-base']) io.err(`Saved the base (${changes.base.commit.slice(0, 7)}) to ${folder}/.state/base.json.`)
    io.out(values.format === 'json'
      ? JSON.stringify({ base: changes.base, ...changes.report }, null, 2)
      : changes.text)
    return 0
  } catch (error) {
    io.err(`radical diff: ${folder}: ${(error as Error).message}`)
    return 2
  }
}
