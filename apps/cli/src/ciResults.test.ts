import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node } from '@radical/common/c4'
import { main } from './cli'
import type { Gh } from './ciResults'

// radical check --from-ci in a real git repository, against a stand-in for
// the GitHub CLI that answers as GitHub's API does.

const exec = promisify(execFile)
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const git = async (cwd: string, ...args: string[]) =>
  (await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })).stdout.trim()

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const report = (file: string, title: string, status = 'passed') =>
  JSON.stringify({ testResults: [{ name: `/home/runner/work/repo/${file}`, assertionResults: [{ ancestorTitles: [], title, status }] }] })

/** A repository whose model names two tests: the commit merged from pull
 *  request #7, then two more. */
async function repository(metrics?: string): Promise<{ cwd: string; merged: string; head: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-ci-'))
  dirs.push(cwd)
  await git(cwd, 'init', '-q', '-b', 'main')
  const files = serializeToMdFolder({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('req', 'requirement', 'Pay', { action: 'take the payment' }),
      node('sc', 'scenario', 'Paying', { given: 'g', when: 'w', then: 't', ...(metrics ? { metrics } : {}) }),
    ],
    relations: [{ id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'req' }],
  }, 'Shop')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  // The repository binds the scenario's tests.
  await mkdir(join(cwd, '.radical'), { recursive: true })
  await writeFile(join(cwd, '.radical', 'radical.json'), JSON.stringify({ implements: [], verifies: [{ element: 'sc', name: 'Paying', tests: ['src/pay.test.ts › pays', 'e2e/pay.spec.ts › pays in the browser'] }] }))
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-q', '-m', 'model')
  await git(cwd, 'commit', '-q', '--allow-empty', '-m', 'Pay (#7)')
  const merged = await git(cwd, 'rev-parse', 'HEAD')
  await git(cwd, 'commit', '-q', '--allow-empty', '-m', 'one')
  await git(cwd, 'commit', '-q', '--allow-empty', '-m', 'two')
  return { cwd, merged, head: await git(cwd, 'rev-parse', 'HEAD') }
}

/** Stands in for gh: pull request #7, merged as `merged`, was tested at its
 *  head by run 11, which kept both reports; run 12 on it is still going, and
 *  run 5's artifact expired. Records what it was asked. */
function fakeGh(merged: string, calls: string[][] = [], artifacts: (dir: string, name: string) => Promise<boolean> = async () => false): Gh {
  const PR_HEAD = 'feedface'.repeat(5)
  return async (args) => {
    calls.push(args)
    const [command, path] = args
    if (command === 'api') {
      if (path.includes('/actions/artifacts?')) {
        return JSON.stringify({ artifacts: [
          { name: 'test-reports', expired: false, workflow_run: { id: 11, head_sha: PR_HEAD } },
          { name: 'e2e-report', expired: false, workflow_run: { id: 11, head_sha: PR_HEAD } },
          { name: 'test-reports', expired: false, workflow_run: { id: 12, head_sha: PR_HEAD } },
          { name: 'test-reports', expired: true, workflow_run: { id: 5, head_sha: merged } },
          // A deploy of the merged commit, still going, has kept its report.
          { name: 'e2e-report', expired: false, workflow_run: { id: 13, head_sha: merged } },
        ] })
      }
      const pulls = /\/commits\/(\w+)\/pulls$/.exec(path)
      if (pulls) return JSON.stringify(pulls[1] === merged ? [{ number: 7, merge_commit_sha: merged, head: { sha: PR_HEAD } }] : [])
      const run = /\/actions\/runs\/(\d+)$/.exec(path)
      if (run) {
        const id = Number(run[1])
        return JSON.stringify({ id, status: id === 12 || id === 13 ? 'in_progress' : 'completed', html_url: `https://github.com/o/r/actions/runs/${id}`, updated_at: '2026-10-31T10:30:00Z', name: 'CI', head_sha: PR_HEAD, pull_requests: [] })
      }
    }
    if (command === 'run' && path === 'download') {
      const dir = args[args.indexOf('--dir') + 1]
      const name = args[args.indexOf('--name') + 1]
      if (await artifacts(dir, name)) return ''
      if (name === 'test-reports') {
        await mkdir(join(dir, 'metrics'), { recursive: true })
        await writeFile(join(dir, 'radical-shop.json'), report('src/pay.test.ts', 'pays'))
        await writeFile(join(dir, 'metrics/workspaces.json'), '{"format":"radical-metrics","version":1,"measurements":[]}')
      } else {
        await mkdir(join(dir, 'reports'), { recursive: true })
        await mkdir(join(dir, 'playwright-report'), { recursive: true })
        await writeFile(join(dir, 'reports/e2e.json'), report('e2e/pay.spec.ts', 'pays in the browser'))
        await writeFile(join(dir, 'playwright-report/index.html'), '<html></html>')
      }
      return ''
    }
    throw new Error(`gh ${args.join(' ')}: not answered`)
  }
}

async function run(cwd: string, gh: Gh | undefined, ...args: string[]) {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, gh, env: gh ? undefined : { PATH: join(cwd, 'no-gh-here') }, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

const results = async (cwd: string) => JSON.parse(await readFile(join(cwd, 'model/.state/test-results.json'), 'utf8'))
const fetchRecord = async (cwd: string) => JSON.parse(await readFile(join(cwd, 'model/.state/ci-fetch.json'), 'utf8'))
const exists = (path: string) => readFile(path).then(() => true, () => false)
const metricsFile = (at: string, value: number) => JSON.stringify({ format: 'radical-metrics', version: 1, source: 'coverage', at, measurements: [{ metric: 'coverage.lines', value, unit: '%' }] })

describe('radical check --from-ci', () => {
  it('reads the reports of the nearest commit CI ran, a squash merge standing for its pull request', async () => {
    const { cwd, merged, head } = await repository()
    const calls: string[][] = []
    const checked = await run(cwd, fakeGh(merged, calls), 'check', 'model', '--from-ci')
    expect(checked.err).toContain(`Test results of CI run 11 (pull request #7) for ${merged.slice(0, 7)}, 2 commits before HEAD.`)
    expect(checked.code).toBe(0)
    expect(checked.out).not.toContain('Paying')
    const kept = await results(cwd)
    expect(kept).toMatchObject({
      commit: head,
      reports: ['run 11 e2e-report/reports/e2e.json', 'run 11 test-reports/radical-shop.json'],
      ci: { provider: 'github', commit: merged, behind: 2, runs: [{ id: 11, pr: 7, sha: 'feedface'.repeat(5), ranAt: '2026-10-31T10:30:00Z', workflow: 'CI', url: 'https://github.com/o/r/actions/runs/11', artifacts: ['e2e-report', 'test-reports'] }] },
    })
    expect(kept.cases).toHaveLength(2)
    // The runs still going and the expired artifact are passed over.
    expect(calls.filter(([c]) => c === 'run').map((a) => a[2])).toEqual(['11', '11'])

    // The same runs again: nothing downloaded, the distance brought up to date.
    await git(cwd, 'commit', '-q', '--allow-empty', '-m', 'three')
    calls.length = 0
    expect((await run(cwd, fakeGh(merged, calls), 'check', 'model', '--from-ci', '--quiet')).code).toBe(0)
    expect(calls.some(([c]) => c === 'run')).toBe(false)
    expect((await results(cwd)).ci.behind).toBe(3)
  })

  it('replaces whole the results a run of some test files left', async () => {
    const { cwd, merged } = await repository()
    // Before the commit CI ran: a run of one file, then of another, which
    // keeps the first.
    await git(cwd, 'checkout', '-q', `${merged}~1`)
    await writeFile(join(cwd, 'ship.json'), report('src/ship.test.ts', 'ships', 'passed'))
    await writeFile(join(cwd, 'local.json'), report('src/pay.test.ts', 'pays', 'failed'))
    await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'ship.json')
    await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'local.json')
    expect((await results(cwd)).kept).toMatchObject({ cases: 1, files: 1 })
    expect((await results(cwd)).cases).toHaveLength(2)
    await git(cwd, 'checkout', '-q', 'main')

    // CI's results are of a whole run: nothing of before is kept with them.
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci')).code).toBe(0)
    const fromCi = await results(cwd)
    expect(fromCi.ci.commit).toBe(merged)
    expect(fromCi.kept).toBeUndefined()
    expect(fromCi.cases.map((c: { file: string }) => c.file).some((file: string) => file.endsWith('ship.test.ts'))).toBe(false)
  })

  it('downloads the artifacts .radical/radical.json names', async () => {
    const { cwd, merged } = await repository()
    const file = JSON.parse(await readFile(join(cwd, '.radical', 'radical.json'), 'utf8'))
    await writeFile(join(cwd, '.radical', 'radical.json'), JSON.stringify({ ...file, ci: { artifacts: ['test-reports'] } }))
    const calls: string[][] = []
    expect((await run(cwd, fakeGh(merged, calls), 'check', 'model', '--from-ci')).code).toBe(0)
    // GitHub is asked for those artifacts by name.
    expect(calls.filter(([c, path]) => c === 'api' && path.includes('/actions/artifacts?')).map(([, path]) => /name=([\w-]+)/.exec(path)?.[1])).toEqual(['test-reports'])
  })

  it('keeps results read at a later commit', async () => {
    const { cwd, merged, head } = await repository()
    await writeFile(join(cwd, 'local.json'), report('src/pay.test.ts', 'pays', 'failed'))
    await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'local.json')
    expect(await results(cwd)).toMatchObject({ commit: head, reports: ['local.json'] })
    const before = await readFile(join(cwd, 'model/.state/test-results.json'), 'utf8')

    const checked = await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci')
    expect(checked.err).toContain(`Kept the test results read with --report at ${head.slice(0, 7)}: CI's (run 11 (pull request #7)) are of ${merged.slice(0, 7)}, before it.`)
    // The check reads the results kept.
    expect(checked.code).toBe(1)
    expect(await readFile(join(cwd, 'model/.state/test-results.json'), 'utf8')).toBe(before)

    // Results read at an earlier commit give way.
    await git(cwd, 'checkout', '-q', `${merged}~1`)
    await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'local.json')
    await git(cwd, 'checkout', '-q', 'main')
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci')).code).toBe(0)
    expect((await results(cwd)).ci.commit).toBe(merged)
  })

  it('says what is missing without gh or a run', async () => {
    const { cwd } = await repository()
    const noGh = await run(cwd, undefined, 'check', 'model', '--from-ci')
    expect(noGh.code).toBe(2)
    expect(noGh.err).toContain('radical check --from-ci: needs the GitHub CLI (gh), signed in (gh auth login)')
    expect(await run(cwd, undefined, 'check', 'model', '--from-ci', '--quiet')).toEqual({ code: 2, out: '', err: '' })

    const none: Gh = async () => JSON.stringify({ artifacts: [] })
    const noRun = await run(cwd, none, 'check', 'model', '--from-ci')
    expect(noRun.code).toBe(2)
    expect(noRun.err).toContain('found no CI artifact in the repository\'s runs (they expire)')
    // Not with --report: one source of test results at a time.
    expect((await run(cwd, none, 'check', 'model', '--from-ci', '--report', 'local.json')).code).toBe(2)
  })

  it('records what a fetch found, with --quiet too, and when it found no test report', async () => {
    const { cwd, merged, head } = await repository()
    // CI keeps its reports elsewhere: the artifacts hold an HTML report only.
    const elsewhere = fakeGh(merged, [], async (dir) => {
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'index.html'), '<html></html>')
      return true
    })
    expect(await run(cwd, elsewhere, 'check', 'model', '--from-ci', '--quiet')).toEqual({ code: 2, out: '', err: '' })
    const failed = await fetchRecord(cwd)
    expect(failed).toMatchObject({ version: 1, head, outcome: 'failed' })
    expect(failed.message).toContain('radical check --from-ci: the artifacts of run 11 hold no test report and no radical-metrics/1 file')
    expect(Date.parse(failed.at)).not.toBeNaN()
    expect(await exists(join(cwd, 'model/.state/test-results.json'))).toBe(false)

    // Without gh: what it said is kept too.
    await run(cwd, undefined, 'check', 'model', '--from-ci', '--quiet')
    expect((await fetchRecord(cwd)).message).toContain('needs the GitHub CLI (gh)')

    // Once CI keeps its reports, the record says what was read, and from which run.
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci', '--quiet')).code).toBe(0)
    expect(await fetchRecord(cwd)).toMatchObject({ outcome: 'read', head, commit: merged, runs: [{ id: 11, url: 'https://github.com/o/r/actions/runs/11' }], tests: 2, measurements: 0 })
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci', '--quiet')).code).toBe(0)
    expect((await fetchRecord(cwd)).outcome).toBe('same')
  })

  it('adds the measurements in the artifacts of CI to those kept', async () => {
    const { cwd, merged } = await repository('coverage.lines >= 80 %')
    // Measured here earlier, and again in CI later.
    await mkdir(join(cwd, 'model/.state'), { recursive: true })
    await writeFile(join(cwd, 'model/.state/measurements.json'), JSON.stringify({ version: 1, measurements: [
      { metric: 'coverage.lines', value: 50, unit: '%', labels: {}, source: 'coverage', at: '2026-10-30T08:00:00.000Z' },
      { metric: 'bundle.size', value: 300, unit: 'kB', labels: {}, source: 'bundle', at: '2026-10-30T08:00:00.000Z' },
    ] }))
    const withMetrics = fakeGh(merged, [], async (dir, name) => {
      if (name !== 'test-reports') return false
      await mkdir(join(dir, 'metrics'), { recursive: true })
      await writeFile(join(dir, 'radical-shop.json'), report('src/pay.test.ts', 'pays'))
      await writeFile(join(dir, 'metrics/coverage.json'), metricsFile('2026-10-31T10:20:00Z', 91))
      return true
    })
    const checked = await run(cwd, withMetrics, 'check', 'model', '--from-ci', '--format', 'json')
    expect(checked.err).toContain('; 1 measurement.')
    const store = JSON.parse(await readFile(join(cwd, 'model/.state/measurements.json'), 'utf8')).measurements
    expect(store).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: 'coverage.lines', value: 91, context: { 'ci.run': '11', 'ci.commit': merged } }),
      expect.objectContaining({ metric: 'bundle.size', value: 300 }),
    ]))
    expect(store).toHaveLength(2)
    // The condition on it is evaluated with the value from CI.
    const evidence = JSON.parse(checked.out).evidence.nodes.sc
    expect(JSON.stringify(evidence)).toContain('91')
    expect(await fetchRecord(cwd)).toMatchObject({ outcome: 'read', tests: 2, measurements: 1 })
    expect((await results(cwd)).ci.measurements).toBe(1)
  })

  it('keeps nothing beside the model with --no-keep', async () => {
    const { cwd, merged } = await repository()
    await writeFile(join(cwd, 'broken.json'), report('src/pay.test.ts', 'pays', 'failed'))
    await writeFile(join(cwd, 'metrics.json'), metricsFile('2026-10-31T10:20:00Z', 10))
    // Results and measurements kept from before.
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci', '--quiet')).code).toBe(0)
    const state = join(cwd, 'model/.state')
    await writeFile(join(state, 'measurements.json'), JSON.stringify({ version: 1, measurements: [] }))
    const before = await Promise.all(['test-results.json', 'measurements.json', 'ci-fetch.json'].map((f) => readFile(join(state, f), 'utf8')))

    // A test of the gate: a broken report fails it, and Studio sees nothing of it.
    const gate = await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'broken.json', '--metrics', 'metrics.json', '--no-keep', '--format', 'json')
    expect(gate.code).toBe(1)
    expect(gate.out).toContain('pays')
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci', '--no-keep', '--quiet')).code).toBe(0)
    expect(await Promise.all(['test-results.json', 'measurements.json', 'ci-fetch.json'].map((f) => readFile(join(state, f), 'utf8')))).toEqual(before)

    // Without it, both are kept.
    expect((await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'broken.json', '--metrics', 'metrics.json', '--quiet')).code).toBe(1)
    expect((await results(cwd)).reports).toEqual(['broken.json'])
    expect(JSON.parse(await readFile(join(state, 'measurements.json'), 'utf8')).measurements).toHaveLength(1)
  })
})
