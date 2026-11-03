// Exercise the npm tarball from a temporary project outside the monorepo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'))
const npmCli = process.env.npm_execpath
assert(npmCli, 'Run this check with npm run test:package')
const args = process.argv.slice(2)
assert(args.length === 0 || (args.length === 2 && args[0] === '--out-dir'), 'Usage: npm run test:package -- [--out-dir <dir>]')
const output = args.length ? resolve(args[1]) : undefined
const temporary = await mkdtemp(join(tmpdir(), 'radical-crucible-package-'))
const project = join(temporary, 'consumer')
const env = { ...process.env }
delete env.NODE_PATH

function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd, env, encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
  })
}

const FUZZ_FILE = `import { describe, expect, it } from 'vitest'
import { Fuzzer, fc, fuzzOptionsFromEnv } from '@radicaltools/crucible'
import { fuzzSuite } from '@radicaltools/crucible/vitest'
import { readFindings } from '@radicaltools/crucible/findings'

const suite = (bug) => ({
  name: 'counter',
  rules: ['bounded'],
  actions: fc.record({ by: fc.integer({ min: 1, max: 9 }) }),
  worlds: { zero: { seed: 7, runs: 100, maxLength: 8 } },
  prepare: () => null,
  start: () => ({ n: 0 }),
  step(run, action, ctx) {
    ctx.actions.push(action)
    run.n = bug ? run.n + action.by : Math.min(20, run.n + action.by)
    ctx.trace.push('to ' + run.n)
    if (run.n > 20) ctx.fail({ rule: 'bounded', detail: run.n + ' is past 20', differences: [] })
  },
})

fuzzSuite(suite(false), { title: 'counter' })

describe('the engine', () => {
  it('shrinks a broken rule and names it', async () => {
    const fuzzer = new Fuzzer(suite(true), fuzzOptionsFromEnv({}))
    await expect(fuzzer.runWorld('zero')).rejects.toThrow('bounded')
    expect([...fuzzer.brokenIn('zero')]).toEqual(['bounded'])
  })
  it('reads the finding files', () => {
    expect(typeof readFindings).toBe('function')
  })
})
`

try {
  const [packed] = JSON.parse(npm(['pack', '--json', '--foreground-scripts=false', '--pack-destination', temporary], workspace))
  const tarball = join(temporary, packed.filename)
  const paths = packed.files.map((f) => f.path)
  for (const file of ['README.md', 'LICENSE', 'package.json', 'dist/index.js', 'dist/index.d.ts', 'dist/vitest.js', 'dist/vitest.d.ts', 'dist/findings.js', 'dist/findings.d.ts']) {
    assert(paths.includes(file), `the archive has ${file}`)
  }
  const stray = paths.filter((p) => !p.startsWith('dist/') && !['README.md', 'LICENSE', 'package.json'].includes(p))
  assert.deepEqual(stray, [], 'the archive holds only dist/, README.md, LICENSE and package.json')
  assert.equal(manifest.license, 'MIT')
  for (const name of Object.keys(manifest.dependencies ?? {})) assert(!name.startsWith('@radical/'), `${name} is bundled, not a dependency`)
  for (const file of paths.filter((p) => p.endsWith('.js') || p.endsWith('.d.ts'))) {
    assert(!(await readFile(join(workspace, file), 'utf8')).includes('@radical/crucible'), `${file} names no private package`)
  }

  await mkdir(join(project, 'tests'), { recursive: true })
  await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2))
  await writeFile(join(project, 'tests', 'counter.fuzz.test.js'), FUZZ_FILE)
  // What the README tells people to write has to work as it stands.
  const readme = await readFile(join(workspace, 'README.md'), 'utf8')
  const example = readme.match(/```ts\n([\s\S]*?)```/)
  assert(example, 'the README has a fuzz file')
  await writeFile(join(project, 'tests', 'cart.fuzz.test.ts'), example[1])
  npm(['install', '--no-audit', '--no-fund', tarball, 'vitest@^4'], project)
  const report = join(temporary, 'report.json')
  npm(['exec', '--offline', '--workspaces=false', '--', 'vitest', 'run', '--reporter=json', `--outputFile=${report}`], project)
  const { testResults } = JSON.parse(await readFile(report, 'utf8'))
  const cases = testResults.flatMap((f) => f.assertionResults).map((t) => [t.title, t.status])
  assert.deepEqual(cases.find(([title]) => title === 'in world zero: bounded holds'), ['in world zero: bounded holds', 'passed'], 'a case per rule of a world')
  assert.deepEqual(cases.find(([title]) => title === 'in world zero'), ['in world zero', 'passed'], 'a case per world')
  assert.deepEqual(cases.find(([title]) => title === 'in world empty: totalMatchesLines holds'), ['in world empty: totalMatchesLines holds', 'passed'], "the README's fuzz file runs")
  assert(cases.every(([, status]) => status === 'passed'), `every case passes: ${JSON.stringify(cases)}`)

  if (output) {
    await mkdir(output, { recursive: true })
    await copyFile(tarball, join(output, packed.filename))
  }
  console.log(`${packed.filename}: installs outside the monorepo and runs a fuzz file (${cases.length} cases).`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
