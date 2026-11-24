// The gate job ci of ci.yml (fitness function "The gate is required on
// main"): it fails unless every job it needs succeeded, and it needs every
// other checking job of the workflow.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { gateProblems } from './gate.mjs'

const ROOT = join(import.meta.dirname, '../..')
const ci = yaml.load(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8'))

describe('The gate is required on main', () => {
  it('Skipped job does not pass: a failed job and the job skipped after it fail the gate', () => {
    expect(gateProblems({ test: { result: 'failure' }, architecture: { result: 'skipped' }, workflows: { result: 'success' } })).toEqual([
      'test: failure',
      'architecture: skipped',
    ])
    expect(gateProblems({ test: { result: 'cancelled' } })).toEqual(['test: cancelled'])
    expect(gateProblems({})).toHaveLength(1)
  })

  it('Skipped job does not pass: passes when every job succeeded, and E2E skipped only by the skip-e2e label', () => {
    const needs = { test: { result: 'success' }, e2e: { result: 'skipped' }, architecture: { result: 'success' } }
    expect(gateProblems(needs)).toEqual(['e2e: skipped'])
    expect(gateProblems(needs, ['e2e'])).toEqual([])
  })

  it('ci.yml ends in the gate job ci: it always runs, needs every other checking job, and lets only E2E skip by the label', () => {
    const gate = ci.jobs.ci
    expect(gate.if).toMatch(/always\(\)/)
    // The screenshots job commits baselines; it checks nothing.
    const checking = Object.keys(ci.jobs).filter((id) => id !== 'ci' && id !== 'screenshots').sort()
    expect([...gate.needs].sort()).toEqual(checking)
    const step = gate.steps.find((s) => s.run)
    expect(step.run).toBe('node tools/ci/gate.mjs')
    expect(step.env.NEEDS).toBe('${{ toJSON(needs) }}')
    expect(step.env.MAY_SKIP).toBe("${{ contains(github.event.pull_request.labels.*.name, 'skip-e2e') && 'e2e' || '' }}")
  })
})
