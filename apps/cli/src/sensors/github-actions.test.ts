import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIXTURE_ANSWERS, githubActionsAdapter, jsonValues } from './github-actions'
import type { SensorInput, SensorValue } from './types'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

/** Runs the adapter with the stand-in gh, answering `answers`. */
async function sense(options: SensorInput['options'] = {}, answers: typeof FIXTURE_ANSWERS = FIXTURE_ANSWERS): Promise<{ values: Record<string, number>; raw: SensorValue[]; calls: string[][] }> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-github-actions-'))
  dirs.push(cwd)
  await writeFile(join(cwd, 'gh.mjs'), githubActionsAdapter.fixture.files!['gh.mjs'])
  await writeFile(join(cwd, 'gh-answers.json'), JSON.stringify(answers))
  const raw = await githubActionsAdapter.measure({ args: [], options: { gh: githubActionsAdapter.fixture.options!.gh, ...options }, cwd })
  const calls = (await readFile(join(cwd, 'gh-calls.log'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as string[])
  return { values: Object.fromEntries(raw.map((v) => [v.metric, v.value])), raw, calls }
}

describe('Workflow runs measured', () => {
  it('measures the wall time of a pull-request commit, its runs grouped by head_sha, as p50 and p90 in minutes', async () => {
    const { values, raw } = await sense()
    // a1: 10:00 → 10:08 (CI and Lint) = 8; a2: 11:00 → 11:20 (CI and a rerun E2E) = 20;
    // a3: 12:00 → 12:05 (its cancelled run left out) = 5; a4 still running.
    expect(values['ci.pr.duration.p50']).toBe(8)
    expect(values['ci.pr.duration.p90']).toBe(17.6)
    expect(raw.find((v) => v.metric === 'ci.pr.duration.p90')).toEqual({ metric: 'ci.pr.duration.p90', value: 17.6, unit: 'min' })
  })

  it('measures the success rate of the commits pushed to the branch, cancelled and skipped runs left out', async () => {
    const { values, raw } = await sense()
    // m1 green, m2 failed, m3 green (its cancelled deploy left out), m4 only cancelled: not counted, m5 green.
    expect(values['ci.main.success.rate']).toBe(75)
    expect(raw.find((v) => v.metric === 'ci.main.success.rate')?.unit).toBe('%')
  })

  it('measures the rerun rate of the completed runs and counts them', async () => {
    const { values } = await sense()
    // 14 completed runs (one still running), two of them in their second attempt.
    expect(values['ci.runs']).toBe(14)
    expect(values['ci.rerun.rate']).toBe(14.3)
  })

  it('counts the required checks of the rulesets and the classic protection together, and the larger review count', async () => {
    const { values } = await sense()
    // Rulesets: CI / test, Lint, 1 review; protection: CI / test, E2E, 2 reviews.
    expect(values['ci.required-checks']).toBe(3)
    expect(values['ci.required-reviews']).toBe(2)
  })

  it('ignores a branch protection GitHub answers 404 (not protected) or 403 (not readable)', async () => {
    for (const status of [404, 403]) {
      const { values } = await sense({}, { ...FIXTURE_ANSWERS, '/protection': { status, message: status === 404 ? 'Branch not protected' : 'Resource not accessible by integration' } })
      expect(values['ci.required-checks']).toBe(2)
      expect(values['ci.required-reviews']).toBe(1)
    }
  })

  it('reads only the runs of the workflows named by --workflow, by name or file', async () => {
    const ci = (await sense({ workflow: ['CI'] })).values
    // a1 8, a2 12, a3 5 → p50 8, p90 11.2; 10 completed CI runs.
    expect(ci['ci.pr.duration.p50']).toBe(8)
    expect(ci['ci.pr.duration.p90']).toBe(11.2)
    expect(ci['ci.runs']).toBe(10)
    expect(ci['ci.main.success.rate']).toBe(75)
    const e2e = (await sense({ workflow: ['e2e.yml'] })).values
    expect(e2e['ci.runs']).toBe(1)
    expect(e2e['ci.rerun.rate']).toBe(100)
    expect(e2e['ci.main.success.rate']).toBeUndefined()
  })

  it('asks gh for the repository, the runs of the last --days and the rules of --branch', async () => {
    const { calls } = await sense({ days: '7', branch: 'release/2' })
    expect(calls[0]).toEqual(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    expect(calls[1]).toEqual(['api', '--paginate', `repos/acme/shop/actions/runs?created=%3E%3D${since}&exclude_pull_requests=true&per_page=100`])
    expect(calls[2]).toEqual(['api', '--paginate', 'repos/acme/shop/rules/branches/release%2F2'])
    expect(calls[3]).toEqual(['api', 'repos/acme/shop/branches/release%2F2/protection'])
    const named = await sense({ repo: 'acme/web' })
    expect(named.calls.some((c) => c[0] === 'repo')).toBe(false)
    expect(named.calls[0][2]).toMatch(/^repos\/acme\/web\/actions\/runs\?/)
  })

  it('fails with gh\'s own message when it cannot read the runs, and on a wrong --days', async () => {
    await expect(sense({}, { ...FIXTURE_ANSWERS, 'actions/runs': { status: 401, message: 'Bad credentials' } })).rejects.toThrow('cannot read the workflow runs of acme/shop: gh: Bad credentials (HTTP 401)')
    await expect(sense({ days: 'a week' })).rejects.toThrow('--days a week is not a whole number of days')
  })

  it('reads pages gh --paginate prints back to back, or one value a line', () => {
    expect(jsonValues('{"a":[1,"}{"]}\n{"b":2}[3][4]')).toEqual([{ a: [1, '}{'] }, { b: 2 }, [3], [4]])
    expect(jsonValues('{"id":1}\n{"id":2}\n')).toEqual([{ id: 1 }, { id: 2 }])
  })
})
