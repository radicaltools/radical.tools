#!/usr/bin/env node
// The gate job ci of ci.yml (fitness function "The gate is required on
// main"): it runs whatever happened before it and fails unless every job it
// needs succeeded. GitHub reports a skipped job as passed, so a failed job
// and the skipped jobs after it would otherwise pass as green. A job named
// in MAY_SKIP (comma-separated) may be skipped: e2e, when the pull request
// has the label skip-e2e.
//
//   NEEDS='${{ toJSON(needs) }}' MAY_SKIP=e2e node tools/ci/gate.mjs

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The jobs that did not pass: `needs` as toJSON(needs) gives it
 *  ({ job: { result, outputs } }). */
export function gateProblems(needs, maySkip = []) {
  const jobs = Object.entries(needs ?? {})
  if (!jobs.length) return ['the gate needs no job: name every other job of the workflow in its needs']
  return jobs
    .filter(([job, { result } = {}]) => !(result === 'success' || (result === 'skipped' && maySkip.includes(job))))
    .map(([job, { result } = {}]) => `${job}: ${result ?? 'no result'}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let needs
  try { needs = JSON.parse(process.env.NEEDS ?? '') } catch { console.error('NEEDS holds no JSON: set it to ${{ toJSON(needs) }}'); process.exit(2) }
  const maySkip = (process.env.MAY_SKIP ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const problems = gateProblems(needs, maySkip)
  for (const [job, { result }] of Object.entries(needs)) console.log(`${job}: ${result}`)
  if (problems.length) {
    console.error(`Not every job succeeded (a skipped or cancelled job is no pass):\n${problems.map((p) => `  ${p}`).join('\n')}`)
    process.exit(1)
  }
  console.log('Every job succeeded.')
}
