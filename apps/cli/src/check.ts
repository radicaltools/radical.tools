import { readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { CHECK_RULES, FOLDER_RULES, formatCheckGithub, formatCheckText, ratchetConfig, runCheck, type CheckConfig } from '@radical/common/check'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

export const CHECK_USAGE = `Usage: radical check [folder] [options]

Checks a Radical Markdown model folder: its files, its metamodel, and that it
is complete (requirements have scenarios, accepted ADRs fitness functions, …).

  folder              the model folder (default: the working directory)
  --config <file>     rule settings (default: radical-check.json in the working
                      directory, when there is one)
  --format <format>   text (default), json, or github (annotations for Actions)
  --ratchet           lower each baseline (max) in the config to the count found
                      now, so a rule that got better cannot get worse again
  --verbose           list every warning, not the first five of each rule
  --list-rules        list the rules and their default severity

Exit status: 0 no errors, 1 errors found, 2 the check could not run.`

export const DEFAULT_CONFIG = 'radical-check.json'

export interface Io {
  cwd: string
  out: (text: string) => void
  err: (text: string) => void
}

/** Runs `radical check` with `args` (after the command name); returns the exit status. */
export async function checkCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        config: { type: 'string' },
        format: { type: 'string', default: 'text' },
        ratchet: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        'list-rules': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${CHECK_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(CHECK_USAGE); return 0 }
  if (values['list-rules']) {
    for (const rule of [...FOLDER_RULES, ...CHECK_RULES]) io.out(`${rule.id.padEnd(30)} ${rule.severity.padEnd(8)} ${rule.description}`)
    return 0
  }
  if (positionals.length > 1 || !['text', 'json', 'github'].includes(values.format)) {
    io.err(CHECK_USAGE)
    return 2
  }

  const folder = positionals[0] ?? '.'
  const configPath = values.config ? resolve(io.cwd, values.config) : resolve(io.cwd, DEFAULT_CONFIG)
  let config: CheckConfig = {}
  try {
    config = JSON.parse(await readFile(configPath, 'utf8')) as CheckConfig
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    if (!missing || values.config || values.ratchet) {
      io.err(missing ? `No config at ${configPath}.` : `Cannot read the config ${configPath}: ${(error as Error).message}`)
      return 2
    }
  }

  let files
  try {
    const path = await realpath(resolve(io.cwd, folder))
    if (!(await stat(path)).isDirectory()) throw new Error('not a directory')
    files = await new MdFolderSession(diskFolderStorage(path)).readAll()
  } catch (error) {
    io.err(`Cannot read the model folder ${folder}: ${(error as Error).message}`)
    return 2
  }

  const result = runCheck(files, config)
  const options = { folder, verbose: values.verbose }
  io.out(values.format === 'json' ? JSON.stringify(result, null, 2)
    : values.format === 'github' ? formatCheckGithub(result, options)
      : formatCheckText(result, options))

  if (values.ratchet) {
    const { config: next, lowered } = ratchetConfig(config, result)
    if (lowered.length) {
      await writeFile(configPath, JSON.stringify(next, null, 2) + '\n')
      // To stderr: stdout may be the JSON result.
      io.err(`Ratchet: ${lowered.map((l) => `${l.id} ${l.from} → ${l.to}`).join(', ')} (written to ${configPath}).`)
    }
  }
  return result.ok ? 0 : 1
}
