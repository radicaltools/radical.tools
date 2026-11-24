// A pipeline's speed and reliability and its branch's protection, as
// GitHub keeps them: the workflow runs of the last days and the rules of
// the branch, read with the GitHub CLI (gh, signed in, or GH_TOKEN). It
// judges nothing: the CI/CD pipeline pack's conditions do
// (`ci.pr.duration.p90 <= 15 min`, `ci.required-checks >= 1`).

import { spawn } from 'node:child_process'
import { commandWords } from '@radical/common/check'
import type { SensorAdapter, SensorValue } from './types'

const GH = 'gh'
const DAYS = 30
const BRANCH = 'main'

interface Run {
  name?: string | null
  path?: string
  event?: string
  head_branch?: string | null
  head_sha?: string
  status?: string | null
  conclusion?: string | null
  run_attempt?: number
  run_started_at?: string
  created_at?: string
  updated_at?: string
}

interface Gh { code: number; stdout: string; stderr: string }

function runGh(command: string, base: string[], args: string[], cwd: string): Promise<Gh> {
  return new Promise((done, fail) => {
    const child = spawn(command, [...base, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (d: string) => { stdout += d })
    child.stderr.setEncoding('utf8').on('data', (d: string) => { stderr += d })
    child.on('error', (error) => fail(new Error(`cannot run ${command}: ${error.message}${command === GH ? ' (install the GitHub CLI, https://cli.github.com, and sign in with gh auth login)' : ''}`)))
    child.on('close', (status, signal) => done({ code: status ?? (signal ? 128 : 1), stdout, stderr }))
  })
}

/** The JSON values of a text that holds several one after another: the
 *  pages `gh api --paginate` prints back to back (`}{`, `][`, or a value
 *  a line). */
export function jsonValues(text: string): unknown[] {
  const out: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; if (start < 0) start = i; continue }
    if (ch === '{' || ch === '[') { if (depth === 0) start = i; depth++; continue }
    if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && start >= 0) { out.push(JSON.parse(text.slice(start, i + 1))); start = -1 }
      continue
    }
    if (depth === 0 && /\s/.test(ch) && start >= 0) { out.push(JSON.parse(text.slice(start, i))); start = -1; continue }
    if (depth === 0 && !/\s/.test(ch) && start < 0) start = i
  }
  if (start >= 0) out.push(JSON.parse(text.slice(start)))
  return out
}

const httpStatus = (r: Gh): number | undefined => { const m = /\(HTTP (\d{3})\)/.exec(r.stderr); return m ? Number(m[1]) : undefined }

const time = (iso: string | undefined): number => (iso ? Date.parse(iso) : NaN)

/** The `p`-th percentile (0-1) of `values`, interpolated between ranks. */
function percentile(values: number[], p: number): number {
  const v = [...values].sort((a, b) => a - b)
  const at = (v.length - 1) * p
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return v[lo] + (v[hi] - v[lo]) * (at - lo)
}

const round = (n: number, digits: number): number => Math.round(n * 10 ** digits) / 10 ** digits

/** Runs of one commit, cancelled and skipped runs left out; undefined while
 *  one of them has not completed (or none is left). */
function settled(runs: Run[]): Run[] | undefined {
  const counted = runs.filter((r) => !(r.status === 'completed' && (r.conclusion === 'cancelled' || r.conclusion === 'skipped')))
  return counted.length && counted.every((r) => r.status === 'completed') ? counted : undefined
}

function bySha(runs: Run[]): Run[][] {
  const groups = new Map<string, Run[]>()
  for (const r of runs) {
    if (!r.head_sha) continue
    groups.set(r.head_sha, [...(groups.get(r.head_sha) ?? []), r])
  }
  return [...groups.values()]
}

const matchesWorkflow = (run: Run, names: string[]): boolean => !names.length || names.some((w) =>
  run.name === w || run.path === w || (run.path ?? '').endsWith(`/${w}`))

/** The measurements of the runs read (and the branch's rules). */
export function runValues(runs: Run[], branch: string): SensorValue[] {
  const values: SensorValue[] = []
  const pr: number[] = []
  for (const group of bySha(runs.filter((r) => r.event === 'pull_request'))) {
    const done = settled(group)
    if (!done) continue
    const start = Math.min(...done.map((r) => time(r.run_started_at ?? r.created_at)))
    const end = Math.max(...done.map((r) => time(r.updated_at)))
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) pr.push((end - start) / 60_000)
  }
  if (pr.length) {
    values.push({ metric: 'ci.pr.duration.p50', value: round(percentile(pr, 0.5), 2), unit: 'min' })
    values.push({ metric: 'ci.pr.duration.p90', value: round(percentile(pr, 0.9), 2), unit: 'min' })
  }
  const commits = bySha(runs.filter((r) => r.event === 'push' && r.head_branch === branch)).map(settled).filter((g): g is Run[] => !!g)
  if (commits.length) {
    const green = commits.filter((g) => g.every((r) => r.conclusion === 'success')).length
    values.push({ metric: 'ci.main.success.rate', value: round((green / commits.length) * 100, 1), unit: '%' })
  }
  const completed = runs.filter((r) => r.status === 'completed')
  if (completed.length) {
    const reruns = completed.filter((r) => (r.run_attempt ?? 1) > 1).length
    values.push({ metric: 'ci.rerun.rate', value: round((reruns / completed.length) * 100, 1), unit: '%' })
  }
  values.push({ metric: 'ci.runs', value: completed.length })
  return values
}

/** Required status checks and approving reviews of a branch: the rulesets
 *  that apply to it and its classic protection together. */
function branchRules(rules: unknown[], protection: unknown): { checks: number; reviews: number } {
  const checks = new Set<string>()
  let reviews = 0
  for (const rule of rules.flatMap((page) => (Array.isArray(page) ? page : [page])) as Array<{ type?: string; parameters?: Record<string, unknown> }>) {
    if (rule?.type === 'required_status_checks') {
      for (const c of (rule.parameters?.required_status_checks as Array<{ context?: unknown }> | undefined) ?? []) if (typeof c?.context === 'string') checks.add(c.context)
    } else if (rule?.type === 'pull_request') {
      const n = rule.parameters?.required_approving_review_count
      if (typeof n === 'number') reviews = Math.max(reviews, n)
    }
  }
  const p = protection as { required_status_checks?: { contexts?: unknown[]; checks?: Array<{ context?: unknown }> }; required_pull_request_reviews?: { required_approving_review_count?: unknown } } | null
  for (const c of p?.required_status_checks?.contexts ?? []) if (typeof c === 'string') checks.add(c)
  for (const c of p?.required_status_checks?.checks ?? []) if (typeof c?.context === 'string') checks.add(c.context)
  const n = p?.required_pull_request_reviews?.required_approving_review_count
  if (typeof n === 'number') reviews = Math.max(reviews, n)
  return { checks: checks.size, reviews }
}

const option = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

const run = (o: Partial<Run> & { id: number }): Run & { id: number } => ({
  workflow_id: 0, run_number: o.id, status: 'completed', conclusion: 'success', run_attempt: 1, ...o,
} as Run & { id: number })

// GitHub's answers in the fixture: a CI, Lint, E2E and Deploy workflow on
// three pull-request commits (and one still running) and five pushes to main.
const FIXTURE_RUNS = [
  run({ id: 101, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', head_branch: 'feat/cart', head_sha: 'a1', run_started_at: '2026-11-20T10:00:00Z', created_at: '2026-11-20T10:00:00Z', updated_at: '2026-11-20T10:08:00Z' }),
  run({ id: 102, name: 'Lint', path: '.github/workflows/lint.yml', event: 'pull_request', head_branch: 'feat/cart', head_sha: 'a1', run_started_at: '2026-11-20T10:00:30Z', created_at: '2026-11-20T10:00:30Z', updated_at: '2026-11-20T10:03:00Z' }),
  run({ id: 103, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', head_branch: 'feat/cart', head_sha: 'a2', run_started_at: '2026-11-20T11:00:00Z', created_at: '2026-11-20T11:00:00Z', updated_at: '2026-11-20T11:12:00Z' }),
  run({ id: 104, name: 'E2E', path: '.github/workflows/e2e.yml', event: 'pull_request', head_branch: 'feat/cart', head_sha: 'a2', run_attempt: 2, run_started_at: '2026-11-20T11:01:00Z', created_at: '2026-11-20T11:00:10Z', updated_at: '2026-11-20T11:20:00Z' }),
  run({ id: 105, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', head_branch: 'fix/tax', head_sha: 'a3', run_started_at: '2026-11-21T12:00:00Z', created_at: '2026-11-21T12:00:00Z', updated_at: '2026-11-21T12:05:00Z' }),
  run({ id: 106, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', head_branch: 'fix/tax', head_sha: 'a3', conclusion: 'cancelled', run_started_at: '2026-11-21T11:58:00Z', created_at: '2026-11-21T11:58:00Z', updated_at: '2026-11-21T12:30:00Z' }),
  run({ id: 107, name: 'CI', path: '.github/workflows/ci.yml', event: 'pull_request', head_branch: 'fix/tax', head_sha: 'a4', status: 'in_progress', conclusion: null, run_started_at: '2026-11-24T08:00:00Z', created_at: '2026-11-24T08:00:00Z', updated_at: '2026-11-24T08:02:00Z' }),
  run({ id: 201, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: 'm1', run_started_at: '2026-11-20T13:00:00Z', created_at: '2026-11-20T13:00:00Z', updated_at: '2026-11-20T13:09:00Z' }),
  run({ id: 202, name: 'Deploy', path: '.github/workflows/deploy.yml', event: 'push', head_branch: 'main', head_sha: 'm1', run_started_at: '2026-11-20T13:00:05Z', created_at: '2026-11-20T13:00:05Z', updated_at: '2026-11-20T13:04:00Z' }),
  run({ id: 203, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: 'm2', conclusion: 'failure', run_started_at: '2026-11-21T09:00:00Z', created_at: '2026-11-21T09:00:00Z', updated_at: '2026-11-21T09:07:00Z' }),
  run({ id: 204, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: 'm3', run_started_at: '2026-11-22T09:00:00Z', created_at: '2026-11-22T09:00:00Z', updated_at: '2026-11-22T09:08:00Z' }),
  run({ id: 205, name: 'Deploy', path: '.github/workflows/deploy.yml', event: 'push', head_branch: 'main', head_sha: 'm3', conclusion: 'cancelled', run_started_at: '2026-11-22T09:00:05Z', created_at: '2026-11-22T09:00:05Z', updated_at: '2026-11-22T09:01:00Z' }),
  run({ id: 206, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: 'm4', conclusion: 'cancelled', run_started_at: '2026-11-22T10:00:00Z', created_at: '2026-11-22T10:00:00Z', updated_at: '2026-11-22T10:01:00Z' }),
  run({ id: 207, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: 'm5', run_attempt: 2, run_started_at: '2026-11-23T09:20:00Z', created_at: '2026-11-23T09:00:00Z', updated_at: '2026-11-23T09:29:00Z' }),
  run({ id: 208, name: 'CI', path: '.github/workflows/ci.yml', event: 'push', head_branch: 'feat/cart', head_sha: 'a1', conclusion: 'failure', run_started_at: '2026-11-20T09:50:00Z', created_at: '2026-11-20T09:50:00Z', updated_at: '2026-11-20T09:55:00Z' }),
]

/** Canned answers for the stand-in gh: the first pattern found in its
 *  arguments answers (`out` printed, `pages` printed back to back as
 *  --paginate does, or `status` an HTTP error). */
export const FIXTURE_ANSWERS: Record<string, { out?: unknown; pages?: unknown[]; status?: number; message?: string }> = {
  'repo view': { out: 'acme/shop' },
  'actions/runs': { pages: [
    { total_count: FIXTURE_RUNS.length, workflow_runs: FIXTURE_RUNS.slice(0, 8) },
    { total_count: FIXTURE_RUNS.length, workflow_runs: FIXTURE_RUNS.slice(8) },
  ] },
  'rules/branches/': { pages: [[
    { type: 'deletion', ruleset_source_type: 'Repository', ruleset_source: 'acme/shop', ruleset_id: 42 },
    { type: 'required_status_checks', ruleset_source_type: 'Repository', ruleset_source: 'acme/shop', ruleset_id: 42, parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: 'CI / test', integration_id: 15368 }, { context: 'Lint' }] } },
    { type: 'pull_request', ruleset_source_type: 'Organization', ruleset_source: 'acme', ruleset_id: 7, parameters: { required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false } },
  ]] },
  '/protection': { out: {
    url: 'https://api.github.com/repos/acme/shop/branches/main/protection',
    required_status_checks: { strict: true, contexts: ['CI / test', 'E2E'], checks: [{ context: 'CI / test', app_id: 15368 }, { context: 'E2E', app_id: 15368 }] },
    required_pull_request_reviews: { dismiss_stale_reviews: false, require_code_owner_reviews: false, required_approving_review_count: 2 },
    enforce_admins: { enabled: false },
  } },
}

// The stand-in for gh: logs its arguments, answers from gh-answers.json.
const FIXTURE_GH = `import { appendFileSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync('gh-calls.log', JSON.stringify(args) + '\\n')
const line = args.join(' ')
const answers = JSON.parse(readFileSync('gh-answers.json', 'utf8'))
const found = Object.entries(answers).find(([pattern]) => line.includes(pattern))
if (!found) { process.stderr.write('gh: no answer for ' + line + '\\n'); process.exit(1) }
const answer = found[1]
if (answer.status) {
  process.stdout.write(JSON.stringify({ message: answer.message, status: String(answer.status) }))
  process.stderr.write('gh: ' + answer.message + ' (HTTP ' + answer.status + ')\\n')
  process.exit(1)
}
if (answer.pages) process.stdout.write(answer.pages.map((p) => JSON.stringify(p, null, 2)).join(''))
else process.stdout.write(typeof answer.out === 'string' ? answer.out + '\\n' : JSON.stringify(answer.out))
`

export const githubActionsAdapter: SensorAdapter = {
  name: 'github-actions',
  description: 'reads a repository\'s GitHub Actions runs and branch rules with the GitHub CLI (gh): pipeline time, success, reruns, required checks',
  usage: `radical sense github-actions [--repo <owner/name>] [--branch <name>] [--days <n>] [--workflow <name>]… [--gh <command>]

  --repo <owner/name>  the repository (default: the one gh finds in the working
                       directory, gh repo view)
  --branch <name>      the branch that is pushed to and protected (default: ${BRANCH})
  --days <n>           the runs created in the last n days (default: ${DAYS};
                       GitHub lists at most 1000 runs)
  --workflow <name>    only the runs of this workflow, by its name or its file
                       (ci.yml); repeat for more (default: every workflow)
  --gh <command>       the command that runs the GitHub CLI (default: ${GH}); it
                       must be signed in (gh auth login, or GH_TOKEN)
  Measures, with no labels:
    ci.pr.duration.p50, ci.pr.duration.p90 (min): the wall time of one pull
      request commit, from the first start to the last end of its runs (event
      pull_request, by head commit), over the commits whose runs completed
    ci.main.success.rate (%): the share of the commits pushed to the branch
      whose completed runs all succeeded
    ci.rerun.rate (%): the share of completed runs that ran more than once
    ci.runs: the completed runs read
    ci.required-checks: the required status checks of the branch, its classic
      protection and its rulesets together (protection gh may not read, which
      needs admin rights, counts as none)
    ci.required-reviews: the required approving reviews, the larger of the two
  Cancelled and skipped runs are left out of the time and the success rate.`,
  options: {
    repo: { type: 'string' },
    branch: { type: 'string' },
    days: { type: 'string' },
    workflow: { type: 'string', multiple: true },
    gh: { type: 'string' },
  },
  async measure({ args, options, cwd }) {
    if (args.length) throw new Error(`github-actions takes no input (${args.join(' ')}): name the repository with --repo`)
    const [command, ...base] = commandWords(option(options.gh) ?? GH)
    const gh = async (...a: string[]): Promise<Gh> => runGh(command, base, a, cwd)
    const failed = (what: string, r: Gh): Error => new Error(`${what}: ${r.stderr.trim() || `${command} exited with ${r.code}`}`)
    const branch = option(options.branch) ?? BRANCH
    const daysText = option(options.days) ?? String(DAYS)
    const days = Number(daysText)
    if (!Number.isInteger(days) || days < 1) throw new Error(`--days ${daysText} is not a whole number of days`)
    const workflows = (Array.isArray(options.workflow) ? options.workflow : []).map((w) => w.trim()).filter(Boolean)

    let repo = option(options.repo)
    if (!repo) {
      const r = await gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner')
      if (r.code !== 0) throw failed('cannot tell the repository (name it with --repo)', r)
      repo = r.stdout.trim()
    }
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`${repo} is not <owner>/<name>`)

    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const listed = await gh('api', '--paginate', `repos/${repo}/actions/runs?created=%3E%3D${since}&exclude_pull_requests=true&per_page=100`)
    if (listed.code !== 0) throw failed(`cannot read the workflow runs of ${repo}`, listed)
    let pages: unknown[]
    try { pages = jsonValues(listed.stdout) } catch (error) {
      throw new Error(`the workflow runs of ${repo} are no JSON: ${(error as Error).message}`)
    }
    const runs = pages.flatMap((page) => {
      if (Array.isArray(page)) return page as Run[]
      const list = (page as { workflow_runs?: unknown })?.workflow_runs
      return Array.isArray(list) ? (list as Run[]) : [page as Run]
    }).filter((r) => r && typeof r === 'object' && matchesWorkflow(r, workflows))

    const ref = encodeURIComponent(branch)
    // Not found or forbidden: no rules, or rules gh may not read.
    const optional = async (path: string, what: string, paginate: boolean): Promise<unknown[]> => {
      const r = await gh('api', ...(paginate ? ['--paginate'] : []), path)
      if (r.code === 0) return jsonValues(r.stdout)
      const status = httpStatus(r)
      if (status === 404 || status === 403) {
        if (status === 403) process.stderr.write(`radical sense github-actions: cannot read the ${what} of ${branch} (HTTP 403); counted as none\n`)
        return []
      }
      throw failed(`cannot read the ${what} of ${branch}`, r)
    }
    const rules = await optional(`repos/${repo}/rules/branches/${ref}`, 'rulesets', true)
    const [protection] = await optional(`repos/${repo}/branches/${ref}/protection`, 'branch protection', false)
    const { checks, reviews } = branchRules(rules, protection ?? null)

    return [
      ...runValues(runs, branch),
      { metric: 'ci.required-checks', value: checks },
      { metric: 'ci.required-reviews', value: reviews },
    ]
  },
  fixture: {
    args: [],
    options: { gh: `"${process.execPath}" gh.mjs`, branch: 'main', days: '30' },
    files: {
      'gh.mjs': FIXTURE_GH,
      'gh-answers.json': JSON.stringify(FIXTURE_ANSWERS, null, 2),
    },
  },
}
