// F3: radical explore verify judges a script that prints "BUG: no undo step
// is made …" (or "FINDING: 0 of 3 elements keep their place …") and exits 1
// as "the bug does not show", because the line starts with no / 0. Its help
// says a line "BUG: …" or "FINDING: …" says the bug shows, and only
// "REPRODUCED: no" that it does not; the line wins over the exit.
// Usage: node f3-explore-verify-bug-no.mjs [--scratch <dir>] [--keep]
import { cleanUp, join, readFileSync, scratch, show, writeFileSync } from './flib.mjs'
import { project } from './exlib.mjs'

try {
  const root = scratch('says')
  const { round, runFolder } = project(root)
  const scripts = {
    'bug-no.mjs': "console.log('BUG: no undo step is made for the drag'); process.exit(1)",
    'finding-0.mjs': "console.log('FINDING: 0 of 3 elements keep their place after a reload'); process.exit(1)",
    'bug-other.mjs': "console.log('BUG: the drag made two undo steps'); process.exit(1)",
  }
  for (const [name, text] of Object.entries(scripts)) writeFileSync(join(runFolder(1), name), text + '\n')
  show('', root, ['explore', 'verify', '1', ...Object.keys(scripts)])
  const verified = JSON.parse(readFileSync(join(round, 'round.json'), 'utf8')).runs[0].verified
  const shown = Object.fromEntries(verified.map((v) => [v.script, v.shown]))
  console.log('\nExpected: all three scripts show the bug (each exits 1 and says BUG: … or FINDING: …).')
  console.log(`Actual (round.json "shown"): ${Object.entries(shown).map(([s, v]) => `${s} ${v}`).join(', ')}.`)
  const bug = shown['bug-other.mjs'] === true && (shown['bug-no.mjs'] === false || shown['finding-0.mjs'] === false)
  console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
  process.exitCode = bug ? 1 : 0
} finally { cleanUp() }
