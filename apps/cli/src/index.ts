#!/usr/bin/env node
import { main } from './cli'
import type { Io } from './check'

const io: Io = {
  cwd: process.cwd(),
  out: (text) => { process.stdout.write(text + '\n') },
  err: (text) => { process.stderr.write(text + '\n') },
  // The hooks run this very script, wherever it was installed.
  command: `"${process.execPath.replace(/\\/g, '/')}" "${process.argv[1].replace(/\\/g, '/')}"`,
}

main(process.argv.slice(2), io).then(
  (code) => { process.exitCode = code },
  (error: unknown) => { io.err(`radical: ${error instanceof Error ? error.stack ?? error.message : String(error)}`); process.exitCode = 2 },
)
