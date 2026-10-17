import { CHECK_USAGE, checkCommand, type Io } from './check'
import { DIFF_USAGE, diffCommand } from './diff'
import { HOOKS_USAGE, hooksCommand } from './hooks'
import { EXPORT_USAGE, exportCommand } from './confluence'
import { version } from '../package.json'

const USAGE = `Usage: radical <command> [options]

Commands:
  check [folder]   check a Radical Markdown model folder (radical check --help)
  diff [folder]    what changed in the model since its version in git
                   (radical diff --help)
  hooks install    git hooks that keep the base Studio compares with
                   (radical hooks --help)
  export confluence [folder]
                   export a wiki view, or publish it to Confluence Cloud
                   (radical export confluence --help)

  --version        print the version`

/** Runs the `radical` command line with `args` (without node and the script). */
export async function main(args: string[], io: Io): Promise<number> {
  const [command, ...rest] = args
  if (command === 'check') return checkCommand(rest, io)
  if (command === 'diff') return diffCommand(rest, io)
  if (command === 'hooks') return hooksCommand(rest, io)
  if (command === 'export') return exportCommand(rest, io)
  if (command === '--version' || command === '-v') { io.out(version); return 0 }
  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.out(rest[0] === 'check' ? CHECK_USAGE : rest[0] === 'diff' ? DIFF_USAGE : rest[0] === 'hooks' ? HOOKS_USAGE : rest[0] === 'export' ? EXPORT_USAGE : USAGE)
    return 0
  }
  io.err(`Unknown command: ${command}\n\n${USAGE}`)
  return 2
}
