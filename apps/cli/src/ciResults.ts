// The test results of CI (radical check --from-ci): the test reports a CI
// run kept as artifacts, for the commit HEAD stands on or the nearest one
// before it that CI ran. Results are never committed, as a commit cannot
// hold the results of its own tests (ADR Test results from CI, not from git).
//
// GitHub Actions through the GitHub CLI (gh), which knows the repository from
// the git remote and is signed in. A pull request's run tests its head, so a
// commit merged from a pull request (a squash merge has no run of its own)
// stands for that head.

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, open, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { parseTestReport, type CiRun, type CiSource, type TestCase, type TestResults } from '@radical/common/check'
import { SELECTION_DIR } from '@radical/common/formats/canvasSelection'

const exec = promisify(execFile)

/** Runs gh with `args` in `cwd`; returns what it printed. */
export type Gh = (args: string[], cwd: string) => Promise<string>

/** How far back in HEAD's history to look, and how many of those commits
 *  may be asked for the pull request they were merged from. */
const HISTORY = 50
const PR_LOOKUPS = 20

/** The GitHub CLI on the PATH of `env`. */
export function ghCli(env: Record<string, string | undefined> = process.env): Gh {
  return async (args, cwd) => {
    try {
      return (await exec('gh', args, { cwd, env, windowsHide: true, maxBuffer: 64 << 20 })).stdout
    } catch (error) {
      const e = error as NodeJS.ErrnoException & { stderr?: string }
      if (e.code === 'ENOENT') throw new CiError('needs the GitHub CLI (gh), signed in (gh auth login): https://cli.github.com')
      throw new CiError(`gh ${args[0]} ${args[1] ?? ''}: ${(e.stderr || e.message).trim().split('\n')[0]}`)
    }
  }
}

/** What stops the results of CI from being read: said as it is, never a stack. */
export class CiError extends Error {}

const git = async (cwd: string, ...args: string[]): Promise<string> => (await exec('git', args, { cwd, windowsHide: true })).stdout.trim()

/** HEAD of the repository holding `root`, or null outside git. */
export async function headOf(root: string): Promise<string | null> {
  return git(root, 'rev-parse', 'HEAD').catch(() => null)
}

/** True when `ancestor` is `commit` or comes before it. */
async function isAncestor(root: string, ancestor: string, commit: string): Promise<boolean> {
  return git(root, 'merge-base', '--is-ancestor', ancestor, commit).then(() => true, () => false)
}

interface Artifact { name: string; expired: boolean; workflow_run?: { id: number; head_sha: string } }
interface Run { id: number; status: string; html_url: string; updated_at: string; name: string; head_sha: string; pull_requests?: Array<{ number: number }> }

const json = async <T>(gh: Gh, cwd: string, path: string): Promise<T> => JSON.parse(await gh(['api', path], cwd)) as T

/** The runs whose artifacts are still there, by the commit they tested,
 *  each with the names of its artifacts (`names` only, when given). */
async function artifactsByCommit(gh: Gh, cwd: string, names: string[] | undefined): Promise<Map<string, Map<number, string[]>>> {
  const found: Artifact[] = []
  for (const name of names ?? [undefined]) {
    const query = `per_page=100${name ? `&name=${encodeURIComponent(name)}` : ''}`
    // Every artifact of the latest runs: a few pages, newest first.
    for (let page = 1; page <= (name ? 1 : 3); page++) {
      const { artifacts } = await json<{ artifacts: Artifact[] }>(gh, cwd, `repos/{owner}/{repo}/actions/artifacts?${query}&page=${page}`)
      found.push(...artifacts)
      if (artifacts.length < 100) break
    }
  }
  const byCommit = new Map<string, Map<number, string[]>>()
  for (const a of found) {
    if (a.expired || !a.workflow_run) continue
    const runs = byCommit.get(a.workflow_run.head_sha) ?? new Map<number, string[]>()
    runs.set(a.workflow_run.id, [...new Set([...(runs.get(a.workflow_run.id) ?? []), a.name])])
    byCommit.set(a.workflow_run.head_sha, runs)
  }
  return byCommit
}

/** The runs whose reports stand for HEAD of the repository holding `root`:
 *  those of the nearest commit in its first-parent history that a completed
 *  run tested, or whose pull request's head one did. For each artifact,
 *  the latest completed run that kept it. */
export async function findCiRuns(root: string, gh: Gh, names?: string[]): Promise<CiSource> {
  const head = await headOf(root)
  if (!head) throw new CiError('is not in a git repository')
  const history = (await git(root, 'rev-list', '--first-parent', `--max-count=${HISTORY}`, 'HEAD')).split('\n').filter(Boolean)
  const byCommit = await artifactsByCommit(gh, root, names)
  if (!byCommit.size) throw new CiError(`found no CI artifact${names?.length ? ` named ${names.join(', ')}` : ''} in the repository's runs (they expire)`)
  let lookups = 0
  for (const [behind, commit] of history.entries()) {
    const candidates: Array<{ sha: string; pr?: number }> = byCommit.has(commit) ? [{ sha: commit }] : []
    if (lookups++ < PR_LOOKUPS) {
      // Merged from a pull request: its run tested the pull request's head
      // (the commit's own runs, a deploy, may be going still).
      const pulls = await json<Array<{ number: number; merge_commit_sha: string | null; head: { sha: string } }>>(gh, root, `repos/{owner}/{repo}/commits/${commit}/pulls`).catch(() => [])
      for (const pr of pulls) if (pr.merge_commit_sha === commit && byCommit.has(pr.head.sha)) candidates.push({ sha: pr.head.sha, pr: pr.number })
    }
    const runs: CiRun[] = []
    for (const { sha, pr } of candidates) {
      for (const [id, artifacts] of byCommit.get(sha)!) {
        const run = await json<Run>(gh, root, `repos/{owner}/{repo}/actions/runs/${id}`)
        if (run.status !== 'completed') continue
        const number = pr ?? run.pull_requests?.[0]?.number
        runs.push({ id, url: run.html_url, sha, ranAt: run.updated_at, workflow: run.name, ...(number ? { pr: number } : {}), artifacts: [...artifacts].sort() })
      }
    }
    if (!runs.length) continue
    // Each artifact from the latest run that kept it.
    runs.sort((a, b) => Date.parse(b.ranAt) - Date.parse(a.ranAt))
    const taken = new Set<string>()
    const chosen: CiRun[] = []
    for (const run of runs) {
      const artifacts = run.artifacts.filter((name) => !taken.has(name))
      if (!artifacts.length) continue
      artifacts.forEach((name) => taken.add(name))
      chosen.push({ ...run, artifacts })
    }
    return { provider: 'github', commit, behind, runs: chosen.sort((a, b) => a.id - b.id) }
  }
  throw new CiError(`found no completed CI run with artifacts for the last ${history.length} commits of HEAD`)
}

/** The report files in `dir` and below: .json and .xml. */
async function filesUnder(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (/\.(json|xml)$/i.test(entry.name)) files.push(path)
  }
  return files.sort()
}

/** Downloads the artifacts of `source`'s runs and reads the test reports in
 *  them; a file that is no test report is passed over. */
export async function downloadCiReports(root: string, gh: Gh, source: CiSource): Promise<{ cases: TestCase[]; reports: string[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'radical-ci-'))
  try {
    const cases: TestCase[] = []
    const reports: string[] = []
    for (const run of source.runs) {
      for (const artifact of run.artifacts) {
        const into = join(dir, String(run.id), artifact)
        await gh(['run', 'download', String(run.id), '--name', artifact, '--dir', into], root)
        for (const file of await filesUnder(into)) {
          let read: TestCase[]
          try { read = parseTestReport(await readFile(file, 'utf8'), file) } catch { continue }
          if (!read.length) continue
          cases.push(...read)
          reports.push(`run ${run.id} ${artifact}/${relative(into, file).replace(/\\/g, '/')}`)
        }
      }
    }
    if (!reports.length) throw new CiError(`the artifacts of run${source.runs.length > 1 ? 's' : ''} ${source.runs.map((r) => r.id).join(', ')} hold no test report`)
    return { cases, reports }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** The same runs and artifacts as `results` came from. */
export function sameRuns(results: TestResults | null, source: CiSource): boolean {
  const key = (s: CiSource) => s.runs.map((r) => `${r.id}:${r.artifacts.join(',')}`).join(' ')
  return !!results?.ci && key(results.ci) === key(source)
}

/** True when `results`, read locally with --report, are of `commit` or a
 *  later one: newer than CI's for it, so they stay. */
export async function readLater(root: string, results: TestResults | null, commit: string): Promise<boolean> {
  return !!results && !results.ci && !!results.commit && isAncestor(root, commit, results.commit)
}

/** Holds the folder's fetch lock while `work` runs; null when another fetch
 *  holds it (a lock older than ten minutes was left by one that died). */
export async function withFetchLock<T>(root: string, work: () => Promise<T>): Promise<T | null> {
  const path = join(root, SELECTION_DIR, 'ci-fetch.lock')
  await mkdir(dirname(path), { recursive: true })
  const take = () => open(path, 'wx').then((h) => h.close().then(() => true), (e: NodeJS.ErrnoException) => {
    if (e.code === 'EEXIST') return false
    throw e
  })
  if (!(await take())) {
    const age = Date.now() - (await stat(path).then((s) => s.mtimeMs, () => 0))
    if (age < 10 * 60e3) return null
    await rm(path, { force: true })
    if (!(await take())) return null
  }
  try {
    return await work()
  } finally {
    await rm(path, { force: true })
  }
}
