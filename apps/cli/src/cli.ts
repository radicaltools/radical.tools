import { DISCUSSIONS_USAGE, discussionsCommand } from './discussionsCommand'
import { CHECK_USAGE, checkCommand, type Io } from './check'
import { DIFF_USAGE, diffCommand } from './diff'
import { HOOKS_USAGE, hooksCommand } from './hooks'
import { EXPORT_USAGE, exportCommand } from './confluence'
import { FUZZ_USAGE, fuzzCommand } from './fuzz'
import { HARDEN_USAGE, hardenCommand } from './harden'
import { EXPLORE_USAGE, exploreCommand } from './explore'
import { SETUP_USAGE, setupCommand } from './setup'
import { SENSE_USAGE, senseCommand } from './sense'
import { displayVersion } from '@radical/common/version'

const USAGE = `Usage: radical <command> [options]

Commands:
  setup [folder]   connect your coding agents to a model folder, step by step;
                   with --status, check what an agent needs, changing nothing
                   (radical setup --help)
  check [folder]   check a Radical Markdown model folder (radical check --help)
  sense <adapter>  measure with a sensor adapter, for the model's metric
                   conditions (radical sense --help)
  diff [folder]    what changed in the model since its version in git
                   (radical diff --help)
  hooks install    git hooks that keep the base Studio compares with
                   (radical hooks --help)
  export confluence [folder]
                   export a wiki view, or publish it to Confluence Cloud
                   (radical export confluence --help)
  discussions confluence connect|sync|status [folder]
                   preview or sync managed wiki footer discussions
  fuzz [plan]      run the fuzz files crucible.json lists (Radical Crucible;
                   radical fuzz --help)
  harden <finding> turn a finding into a test, and gate a test: it fails
                   without the fix and passes with it every time
                   (radical harden --help)
  explore prepare|verify|record
                   prepare an exploratory round, run its scripts, record its
                   findings (radical explore --help)

  --version        print the version`

/** Runs the `radical` command line with `args` (without node and the script). */
export async function main(args: string[], io: Io): Promise<number> {
  const [command, ...rest] = args
  if (command === 'setup') return setupCommand(rest, io)
  if (command === 'check') return checkCommand(rest, io)
  if (command === 'sense') return senseCommand(rest, io)
  if (command === 'diff') return diffCommand(rest, io)
  if (command === 'hooks') return hooksCommand(rest, io)
  if (command === 'discussions') return discussionsCommand(rest, io)
  if (command === 'export') return exportCommand(rest, io)
  if (command === 'fuzz') return fuzzCommand(rest, io)
  if (command === 'harden') return hardenCommand(rest, io)
  if (command === 'explore') return exploreCommand(rest, io)
  if (command === '--version' || command === '-v') { io.out(displayVersion()); return 0 }
  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    io.out(rest[0] === 'discussions' ? DISCUSSIONS_USAGE : rest[0] === 'setup' ? SETUP_USAGE : rest[0] === 'check' ? CHECK_USAGE : rest[0] === 'sense' ? SENSE_USAGE : rest[0] === 'diff' ? DIFF_USAGE : rest[0] === 'hooks' ? HOOKS_USAGE : rest[0] === 'export' ? EXPORT_USAGE : rest[0] === 'fuzz' ? FUZZ_USAGE : rest[0] === 'harden' ? HARDEN_USAGE : rest[0] === 'explore' ? EXPLORE_USAGE : USAGE)
    return 0
  }
  io.err(`Unknown command: ${command}\n\n${USAGE}`)
  return 2
}
