// Q4: radical implement (and radical verify, set_implementation, set_verification,
// Assay, harden: all write through serializeRepositoryFile) rewrites
// .radical/radical.json with only the keys it knows: a "$schema", an "owner" at the
// top, and an "owner" on an entry, written by hand or by a newer version, are gone.
// Usage: node q4-radical-json-keys-dropped.mjs [--scratch <dir>] [--keep]
import { cleanUp, git, join, mkdirSync, readFileSync, scratch, show, writeFileSync, writeModel } from './flib.mjs'

try {
  const root = scratch('keys')
  git(root, 'init', '-q', '-b', 'main')
  writeModel(join(root, '.radical', 'model'), [
    { id: 'sys', type: 'system', label: 'Shop', path: 'shop/_index.md' },
    { id: 'api', type: 'container', label: 'API', path: 'shop/api/_index.md' },
  ], [])
  mkdirSync(join(root, 'src'))
  const before = { $schema: 'https://example.invalid/radical.schema.json', owner: 'team-payments', implements: [{ element: 'api', name: 'API', paths: ['src'], owner: 'alice' }] }
  writeFileSync(join(root, '.radical', 'radical.json'), JSON.stringify(before, null, 2) + '\n')
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'shop')
  console.log('before:\n' + readFileSync(join(root, '.radical', 'radical.json'), 'utf8'))
  show('repo', root, ['implement', 'Shop', '--path', 'src'])
  const after = JSON.parse(readFileSync(join(root, '.radical', 'radical.json'), 'utf8'))
  console.log('after:\n' + JSON.stringify(after, null, 2))
  const lost = ['$schema', 'owner'].filter((k) => !(k in after)).concat('owner' in (after.implements.find((e) => e.element === 'api') ?? {}) ? [] : ['implements[api].owner'])
  console.log(`\nExpected (?): the keys the command does not change stay. Actual: lost ${lost.join(', ') || 'nothing'}.`)
  console.log(`REPRODUCED: ${lost.length === 3 ? 'yes' : 'no'}`)
} finally { cleanUp() }
