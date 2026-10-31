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
async function repository(): Promise<{ cwd: string; merged: string; head: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-ci-'))
  dirs.push(cwd)
  await git(cwd, 'init', '-q', '-b', 'main')
  const files = serializeToMdFolder({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('req', 'requirement', 'Pay', { action: 'take the payment' }),
      node('sc', 'scenario', 'Paying', { given: 'g', when: 'w', then: 't', metrics: 'test(src/pay.test.ts › pays) passed\ntest(e2e/pay.spec.ts › pays in the browser) passed' }),
    ],
    relations: [{ id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'req' }],
  }, 'Shop')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
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
function fakeGh(merged: string, calls: string[][] = []): Gh {
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

const results = async (cwd: string) => JSON.parse(await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8'))

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

  it('keeps results read at a later commit', async () => {
    const { cwd, merged, head } = await repository()
    await writeFile(join(cwd, 'local.json'), report('src/pay.test.ts', 'pays', 'failed'))
    await run(cwd, fakeGh(merged), 'check', 'model', '--report', 'local.json')
    expect(await results(cwd)).toMatchObject({ commit: head, reports: ['local.json'] })
    const before = await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8')

    const checked = await run(cwd, fakeGh(merged), 'check', 'model', '--from-ci')
    expect(checked.err).toContain(`Kept the test results read with --report at ${head.slice(0, 7)}: CI's (run 11 (pull request #7)) are of ${merged.slice(0, 7)}, before it.`)
    // The check reads the results kept.
    expect(checked.code).toBe(1)
    expect(await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8')).toBe(before)

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
})
