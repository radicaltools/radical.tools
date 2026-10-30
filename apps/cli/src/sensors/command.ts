// A command's exit status and how long it ran: for a check that is a
// script rather than a test runner (`node tools/check-workspaces.mjs`),
// stated in the model as `<name>.exit_code == 0`.

import { spawn } from 'node:child_process'
import type { SensorAdapter } from './types'

export const commandAdapter: SensorAdapter = {
  name: 'command',
  description: 'runs a command and measures its exit code and its duration in seconds',
  usage: `radical sense command [--name <metric>] -- <command> [args…]

  --name <metric>   the metric prefix (default: command): <metric>.exit_code
                    and <metric>.duration (s)
  The command's output goes to stderr; radical sense exits 0 whatever its
  exit code, which the model judges (\`<metric>.exit_code == 0\`).`,
  options: { name: { type: 'string' } },
  async measure({ args, options, cwd }) {
    if (!args.length) throw new Error('no command after --')
    const name = typeof options.name === 'string' && options.name ? options.name : 'command'
    const started = process.hrtime.bigint()
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(args[0], args.slice(1), { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' })
      // stdout belongs to radical sense (an --out file may be printed there).
      child.stdout?.pipe(process.stderr)
      child.on('error', (error) => reject(new Error(`cannot run ${args[0]}: ${error.message}`)))
      child.on('close', (status, signal) => resolve(status ?? (signal ? 128 : 1)))
    })
    const seconds = Number(process.hrtime.bigint() - started) / 1e9
    return [
      { metric: `${name}.exit_code`, value: code },
      { metric: `${name}.duration`, value: Math.round(seconds * 1000) / 1000, unit: 's' },
    ]
  },
  fixture: { args: [process.execPath, '-e', 'process.exit(3)'], options: { name: 'fixture' } },
}
