import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { C4Node } from '@radical/common/c4'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { main } from './cli'

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A git repository with its model in .radical/model: a scenario, a fitness
 *  function, and a requirement named as the scenario is. */
async function repository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'radical-verify-')))
  dirs.push(root)
  await exec('git', ['init', '-q'], { cwd: root })
  const nodes = [node('pay', 'scenario', 'Pays by card'), node('ff', 'fitness-fn', 'No cycles'), node('req', 'requirement', 'Pays by card')]
  for (const [path, content] of Object.entries(serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes, relations: [] }, 'shop'))) {
    await mkdir(dirname(join(root, '.radical', 'model', path)), { recursive: true })
    await writeFile(join(root, '.radical', 'model', path), content)
  }
  // The repository already says where it builds something.
  await writeFile(join(root, '.radical', 'radical.json'), '{\n  "implements": [\n    { "element": "req", "paths": ["."] }\n  ]\n}\n')
  return root
}

async function run(cwd: string, ...args: string[]) {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical verify', () => {
  it('binds tests to a scenario or fitness function, drops one, lists and removes them', async () => {
    const root = await repository()
    // A requirement shares the name: only a scenario or fitness function is meant.
    const bound = await run(root, 'verify', 'pays by card', '--test', 'tests/pay.test.ts › pays', '--test', 'tests/pay.test.ts › declines')
    expect(bound).toMatchObject({ code: 0, err: '' })
    expect(bound.out).toContain('scenario "Pays by card" (pay) is checked by 2 tests (.radical/radical.json):\n  tests/pay.test.ts › pays\n  tests/pay.test.ts › declines')
    await run(root, 'verify', 'No cycles', '--test', 'tests/deps.test.ts')
    // The file keeps what it says where the repository builds things.
    expect(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).toBe(`{
  "implements": [
    { "element": "req", "paths": ["."] }
  ],
  "verifies": [
    { "element": "pay", "name": "Pays by card", "tests": [
      "tests/pay.test.ts › pays",
      "tests/pay.test.ts › declines"
    ] },
    { "element": "ff", "name": "No cycles", "tests": [
      "tests/deps.test.ts"
    ] }
  ]
}
`)
    expect((await run(root, 'verify', 'pay', '--drop', 'tests/pay.test.ts › declines')).out).toContain('is checked by 1 test')
    expect((await run(root, 'verify', 'Pays by card')).out).toBe('scenario "Pays by card" (pay) is checked by:\n  tests/pay.test.ts › pays\n')
    expect((await run(root, 'verify', 'ff', '--remove')).out).toContain('- fitness-fn "No cycles" (ff) taken out of .radical/radical.json')
    expect((await run(root, 'verify', 'ff')).out).toContain('.radical/radical.json binds no test to fitness-fn "No cycles" (ff): radical verify ff --test "<file> › <title>"')
    const none = await run(root, 'verify', 'Refunds', '--test', 'x')
    expect(none.code).toBe(2)
    expect(none.err).toContain('No scenario or fitness-fn named "Refunds" in the model.')
  })

  it('in a model checked out in the repository, writes the repository\'s file and reads the model\'s history', async () => {
    const root = await repository()
    const model = join(root, '.radical', 'model')
    await exec('git', ['init', '-q'], { cwd: model })
    await exec('git', ['add', '-A'], { cwd: model })
    await exec('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'The model'], { cwd: model })
    const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: model })
    expect((await run(root, 'verify', 'pay', '--test', 'a.test.ts › pays')).code).toBe(0)
    expect(JSON.parse(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).verifies[0].tests).toEqual(['a.test.ts › pays'])
    const diff = await run(root, 'diff', '.radical/model', '--since', stdout.trim())
    expect(diff.code).toBe(0)
    expect(diff.out).toContain('No model changes since')
  })
})
