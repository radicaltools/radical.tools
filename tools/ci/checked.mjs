#!/usr/bin/env node
// A tree checked once is not checked again (ADR of that name). ci.yml runs
// on a pull request, on the tree as it would land; deploy.yml on main used
// to run the E2E suite and the tests on that very tree a second time.
//
//   node tools/ci/checked.mjs mark    in ci.yml's gate job, after the gate
//   node tools/ci/checked.mjs known   in deploy.yml's first job
//
// mark: when the run may mark its tree, writes the mark's file and its
// name (checked-<the tree's git hash>) to GITHUB_OUTPUT; ci.yml uploads the
// file as an artifact of that name. A run that wrote new screenshot
// baselines marks nothing: it compared the screenshots loosely.
//
// known: writes tree=<hash> and checked=true|false to GITHUB_OUTPUT. A tree
// is checked when an artifact named after it has not expired and was kept
// by a completed, successful run of ci.yml of this repository itself (a
// fork's run is not believed). Whatever goes wrong while asking, the answer
// is false, and the tree is checked whole.
//
// Both read GITHUB_REPOSITORY, GITHUB_REPOSITORY_ID, GITHUB_RUN_ID and
// GH_TOKEN (the job's token, with actions: read).

import { execFileSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The workflow whose runs may mark a tree. */
export const CHECKING_WORKFLOW = '.github/workflows/ci.yml'
/** The file a mark is kept as. */
export const MARK_FILE = 'checked-tree.txt'
/** The artifacts a run that rewrote screenshot baselines keeps (e2e.yml). */
const NEW_BASELINES = /^e2e-screenshots-/

/** The name of the mark of `tree`. */
export const markName = (tree) => `checked-${tree}`

/** Whether a run may mark its tree, by the artifacts it kept: not when its
 *  E2E suite wrote new screenshot baselines. */
export function mayMark(runArtifacts) {
  const rewritten = (runArtifacts ?? []).map((a) => a.name).filter((name) => NEW_BASELINES.test(name))
  return rewritten.length
    ? { mark: false, why: `the E2E suite wrote new screenshot baselines (${rewritten.sort().join(', ')}): this run compared them loosely` }
    : { mark: true, why: 'every job passed, and no screenshot baseline was rewritten' }
}

/** Whether `tree` was checked before: among `artifacts` (those named after
 *  it) one that has not expired, of a run in `runs` (by id) that is a
 *  completed, successful run of the checking workflow of the repository
 *  `repositoryId` itself. */
export function checkedBefore(tree, artifacts, runs, repositoryId) {
  const named = (artifacts ?? []).filter((a) => a.name === markName(tree))
  if (!named.length) return { checked: false, why: 'no run marked this tree' }
  const reasons = []
  for (const a of named) {
    if (a.expired) { reasons.push(`mark ${a.id} expired`); continue }
    const run = runs?.[a.workflow_run?.id]
    if (!run) { reasons.push(`mark ${a.id}: its run is not known`); continue }
    const repository = String(repositoryId)
    if (String(run.repository?.id) !== repository || String(run.head_repository?.id) !== repository) { reasons.push(`run ${run.id} is of a fork`); continue }
    if (run.path !== CHECKING_WORKFLOW) { reasons.push(`run ${run.id} is of ${run.path}, not of ${CHECKING_WORKFLOW}`); continue }
    if (run.status !== 'completed' || run.conclusion !== 'success') { reasons.push(`run ${run.id} is ${run.status}${run.conclusion ? `, ${run.conclusion}` : ''}`); continue }
    return { checked: true, why: `run ${run.id} checked this tree`, run: { id: run.id, url: run.html_url } }
  }
  return { checked: false, why: reasons.join('; ') }
}

/** The tree of HEAD. */
const treeOf = (cwd) => execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim()

async function api(path) {
  const base = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const response = await fetch(`${base}/repos/${process.env.GITHUB_REPOSITORY}/${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? ''}`, 'x-github-api-version': '2022-11-28' },
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`)
  return response.json()
}

const output = (lines) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`) }

async function mark(cwd) {
  const tree = treeOf(cwd)
  let may, why
  try {
    const { artifacts } = await api(`actions/runs/${process.env.GITHUB_RUN_ID}/artifacts?per_page=100`)
    ;({ mark: may, why } = mayMark(artifacts))
  } catch (error) {
    // No mark is no failure of the gate: deploy.yml then checks the tree whole.
    may = false; why = `could not read this run's artifacts (${error.message})`
  }
  if (!may) { console.log(`Tree ${tree} is not marked: ${why}.`); return }
  writeFileSync(resolve(cwd, MARK_FILE), `tree ${tree}\ncommit ${process.env.GITHUB_SHA ?? ''}\nrun ${process.env.GITHUB_RUN_ID ?? ''}\n`)
  output([`name=${markName(tree)}`, `file=${MARK_FILE}`])
  console.log(`Tree ${tree} is marked as checked (${why}): deploy.yml will not check it again.`)
}

async function known(cwd) {
  const tree = treeOf(cwd)
  let answer
  try {
    const { artifacts } = await api(`actions/artifacts?name=${markName(tree)}&per_page=100`)
    const runs = {}
    for (const a of artifacts) {
      const id = a.workflow_run?.id
      if (id && !a.expired && !runs[id]) runs[id] = await api(`actions/runs/${id}`)
    }
    answer = checkedBefore(tree, artifacts, runs, process.env.GITHUB_REPOSITORY_ID)
  } catch (error) {
    answer = { checked: false, why: `could not ask (${error.message})` }
  }
  output([`tree=${tree}`, `checked=${answer.checked}`])
  console.log(`Tree ${tree}, checked before: ${answer.checked} (${answer.why}).${answer.run ? ` ${answer.run.url}` : ''}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const command = { mark, known }[process.argv[2]]
  if (!command) { console.error('usage: node tools/ci/checked.mjs mark|known'); process.exit(2) }
  await command(process.cwd())
}
