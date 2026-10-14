#!/usr/bin/env node
import { main } from './cli'
import type { Io } from './check'

const io: Io = {
  cwd: process.cwd(),
  out: (text) => { process.stdout.write(text + '\n') },
  err: (text) => { process.stderr.write(text + '\n') },
}

main(process.argv.slice(2), io).then(
  (code) => { process.exitCode = code },
  (error: unknown) => { io.err(`radical: ${error instanceof Error ? error.stack ?? error.message : String(error)}`); process.exitCode = 2 },
)
