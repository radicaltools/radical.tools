// F3: the CLI's own help sends the user to what is not there:
// `radical --help` lists `federation <open|sync|watch>`, and each of the three is
// refused with the usage of `federation fetch` (exit 2); `radical sense --help`
// says a review goes into "the model folder's reviews.json", but radical sense
// review writes .radical/reviews.json at the repository's root.
// Usage: node f3-help-names-gone-commands.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, radical, scratch, show, writeFileSync, writeModel } from './flib.mjs'
import { existsSync } from 'node:fs'

try {
  const root = scratch('help')
  git(root, 'init', '-q', '-b', 'main')
  const model = join(root, '.radical', 'model')
  writeModel(model, [
    { id: 'sys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'ff', type: 'fitness-fn', label: 'Reviewed by security', path: 'ff.md', metrics: 'review(security) passed' },
  ], [])
  writeFileSync(join(model, 'deps.json'), JSON.stringify({ name: 'shop', dependencies: [] }, null, 2) + '\n')
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'shop')

  const help = radical(root, ['--help']).out
  const line = help.split('\n').find((l) => l.includes('federation')) ?? ''
  console.log(`radical --help: "${line.trim()}"`)
  const refused = []
  for (const action of ['open', 'sync', 'watch']) {
    const r = show('repo', root, ['federation', action])
    if (r.code === 2 && /Usage: radical federation fetch/.test(r.err)) refused.push(action)
  }
  const senseHelp = radical(root, ['sense', '--help']).out
  const said = senseHelp.split('\n').filter((l) => /^review records|reviews\.json, kept in git/.test(l)).join(' ')
  console.log(`radical sense --help: "${said.trim()}"`)
  show('repo', root, ['sense', 'review', 'security', '--passed', '--by', 'alice'])
  const inModel = existsSync(join(model, 'reviews.json'))
  const inRepository = existsSync(join(root, '.radical', 'reviews.json'))
  console.log(`reviews.json in the model folder: ${inModel}; .radical/reviews.json: ${inRepository}`)
  console.log('\nExpected: the help names the commands there are (federation fetch) and the file a review goes to.')
  console.log(`Actual: --help lists federation open|sync|watch; refused: ${refused.join(', ') || 'none'}; sense help says the model folder's reviews.json, the review went to ${inRepository ? '.radical/reviews.json' : inModel ? 'the model folder' : 'nowhere'}.`)
  console.log(`REPRODUCED: ${/open\|sync\|watch/.test(line) && refused.length === 3 && /model folder's reviews\.json/.test(said) && inRepository && !inModel ? 'yes' : 'no'}`)
} finally { cleanUp() }
