#!/usr/bin/env node
import { main } from './cli'
import type { Io } from './check'

// The reader went away (radical … | head): write nothing more, and end with
// the command's own exit status rather than a stack trace.
let readerGone = false
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') throw error
  readerGone = true
})

const io: Io = {
  cwd: process.cwd(),
  out: (text) => { if (!readerGone) process.stdout.write(text + '\n') },
  err: (text) => { process.stderr.write(text + '\n') },
  // The hooks run this very script with the node on the PATH, else the one
  // running now (a versioned path that an upgrade of node may remove).
  cli: { node: `"$(command -v node || echo '${process.execPath.replace(/\\/g, '/')}')"`, script: process.argv[1] },
}

main(process.argv.slice(2), io).then(
  (code) => { process.exitCode = code },
  (error: unknown) => { io.err(`radical: ${error instanceof Error ? error.stack ?? error.message : String(error)}`); process.exitCode = 2 },
)
