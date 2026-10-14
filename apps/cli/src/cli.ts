import { CHECK_USAGE, checkCommand, type Io } from './check'
import { version } from '../package.json'

const USAGE = `Usage: radical <command> [options]

Commands:
  check [folder]   check a Radical Markdown model folder (radical check --help)

  --version        print the version`

/** Runs the `radical` command line with `args` (without node and the script). */
export async function main(args: string[], io: Io): Promise<number> {
  const [command, ...rest] = args
  if (command === 'check') return checkCommand(rest, io)
  if (command === '--version' || command === '-v') { io.out(version); return 0 }
  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.out(rest[0] === 'check' ? CHECK_USAGE : USAGE)
    return 0
  }
  io.err(`Unknown command: ${command}\n\n${USAGE}`)
  return 2
}
