// F4: radical explore verify says "the bug shows" for a script that is not
// there: node exits 1 with "Cannot find module", which the verdict takes for
// the bug. Two ways to get there:
//  A. a script name with a typo (f1-dragg.mjs for f1-drag.mjs);
//  B. radical explore prepare --from 4 when an earlier round already has run 4
//     (accepted, round-4-5 made): verify 4 then runs the script in the
//     earlier round's run-4 folder, where it is not.
// Usage: node f4-explore-verify-missing-script.mjs [--scratch <dir>] [--keep]
import { existsSync } from 'node:fs'
import { cleanUp, git, join, readFileSync, scratch, show, writeFileSync } from './flib.mjs'
import { project } from './exlib.mjs'

const verdictOf = (root, roundDir, script) => JSON.parse(readFileSync(join(roundDir, 'round.json'), 'utf8')).runs.flatMap((r) => r.verified).find((v) => v.script === script)

try {
  // A: a typo.
  const a = scratch('typo')
  const { round, runFolder } = project(a)
  writeFileSync(join(runFolder(1), 'f1-drag.mjs'), "console.log('REPRODUCED: no'); process.exit(0)\n")
  show('A', a, ['explore', 'verify', '1', 'f1-dragg.mjs'])
  const typo = verdictOf(a, round, 'f1-dragg.mjs')

  // B: a run number two rounds have.
  const b = scratch('overlap')
  git(b, 'init', '-q', '-b', 'main')
  const first = project(b, [3, 4])
  writeFileSync(join(b, 'a.txt'), 'a'); git(b, 'add', '-A'); git(b, 'commit', '-qm', 'a')
  const prepared = show('B', b, ['explore', 'prepare', '--runs', '2', '--from', '4', '--no-build'])
  const second = join(b, '.radical', 'crucible', 'rounds', 'round-4-5')
  let overlap
  if (prepared.code === 0 && existsSync(join(second, 'run-4'))) {
    writeFileSync(join(second, 'run-4', 'f2-pin.mjs'), "console.log('REPRODUCED: no'); process.exit(0)\n")
    show('B', b, ['explore', 'verify', '4', 'f2-pin.mjs'])
    overlap = verdictOf(b, first.round, 'f2-pin.mjs') ?? verdictOf(b, second, 'f2-pin.mjs')
  }
  console.log('\nExpected: verify says it found no such script (and prepare refuses run numbers a round has), never "the bug shows".')
  console.log(`Actual: A typo → shown ${typo?.shown} (exit ${typo?.exit}); B prepare --from 4 exit ${prepared.code}, verify 4 → shown ${overlap?.shown} (exit ${overlap?.exit}).`)
  const bug = typo?.shown === true || overlap?.shown === true
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
