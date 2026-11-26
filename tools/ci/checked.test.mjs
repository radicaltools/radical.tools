// A tree checked once is not checked again (ADR of that name, fitness
// function "A checked tree is not checked again"): a run of ci.yml that
// passed every job marks the tree it checked, and deploy.yml on main leaves
// its checks out only for a tree with a mark it may believe.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { CHECKING_WORKFLOW, MARK_FILE, checkedBefore, markName, mayMark } from './checked.mjs'

const ROOT = join(import.meta.dirname, '../..')
const workflow = (name) => yaml.load(readFileSync(join(ROOT, '.github/workflows', name), 'utf8'))

const TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const REPOSITORY = 1001
const mark = (id, runId, extra = {}) => ({ id, name: markName(TREE), expired: false, workflow_run: { id: runId }, ...extra })
const run = (id, extra = {}) => ({
  id, path: CHECKING_WORKFLOW, status: 'completed', conclusion: 'success', html_url: `https://github.com/o/r/actions/runs/${id}`,
  repository: { id: REPOSITORY }, head_repository: { id: REPOSITORY }, ...extra,
})

describe('A checked tree is not checked again', () => {
  it('A checked tree deploys without a second check: a mark of a completed, successful run of ci.yml of this repository counts', () => {
    expect(markName(TREE)).toBe(`checked-${TREE}`)
    expect(checkedBefore(TREE, [mark(1, 11)], { 11: run(11) }, REPOSITORY)).toEqual({
      checked: true, why: 'run 11 checked this tree', run: { id: 11, url: 'https://github.com/o/r/actions/runs/11' },
    })
    // The repository's id as the environment gives it, a string.
    expect(checkedBefore(TREE, [mark(1, 11)], { 11: run(11) }, String(REPOSITORY)).checked).toBe(true)
    // One mark that counts is enough, whatever the others are.
    expect(checkedBefore(TREE, [mark(1, 10, { expired: true }), mark(2, 11)], { 11: run(11) }, REPOSITORY).checked).toBe(true)
  })

  it('A checked tree deploys without a second check: a tree with no mark, an expired one, or one of another tree is checked whole', () => {
    expect(checkedBefore(TREE, [], {}, REPOSITORY)).toEqual({ checked: false, why: 'no run marked this tree' })
    expect(checkedBefore(TREE, undefined, undefined, REPOSITORY).checked).toBe(false)
    expect(checkedBefore(TREE, [mark(1, 11, { expired: true })], { 11: run(11) }, REPOSITORY)).toEqual({ checked: false, why: 'mark 1 expired' })
    // The artifacts API matches names loosely: only the tree's own name is its mark.
    expect(checkedBefore(TREE, [{ ...mark(1, 11), name: `${markName(TREE)}-other` }], { 11: run(11) }, REPOSITORY).checked).toBe(false)
  })

  it('A checked tree deploys without a second check: a mark of a failed or unfinished run, of another workflow or of a fork is not believed', () => {
    const asked = (theRun) => checkedBefore(TREE, [mark(1, 11)], { 11: theRun }, REPOSITORY)
    expect(asked(run(11, { conclusion: 'failure' }))).toEqual({ checked: false, why: 'run 11 is completed, failure' })
    expect(asked(run(11, { status: 'in_progress', conclusion: null }))).toEqual({ checked: false, why: 'run 11 is in_progress' })
    expect(asked(run(11, { path: '.github/workflows/other.yml' })).why).toBe(`run 11 is of .github/workflows/other.yml, not of ${CHECKING_WORKFLOW}`)
    // A pull request from a fork: its run is the fork's code, in this repository.
    expect(asked(run(11, { head_repository: { id: 2002 } }))).toEqual({ checked: false, why: 'run 11 is of a fork' })
    expect(asked(run(11, { repository: { id: 2002 }, head_repository: { id: 2002 } })).checked).toBe(false)
    // Its run is gone, or was not asked for.
    expect(checkedBefore(TREE, [mark(1, 11)], {}, REPOSITORY)).toEqual({ checked: false, why: 'mark 1: its run is not known' })
  })

  it('A checked tree deploys without a second check: a run that wrote new screenshot baselines marks nothing', () => {
    expect(mayMark([{ name: 'test-reports' }, { name: 'e2e-report' }, { name: 'e2e-blob-1' }])).toEqual({ mark: true, why: 'every job passed, and no screenshot baseline was rewritten' })
    expect(mayMark([])).toMatchObject({ mark: true })
    expect(mayMark(undefined)).toMatchObject({ mark: true })
    expect(mayMark([{ name: 'e2e-report' }, { name: 'e2e-screenshots-3' }, { name: 'e2e-screenshots-1' }])).toEqual({
      mark: false, why: 'the E2E suite wrote new screenshot baselines (e2e-screenshots-1, e2e-screenshots-3): this run compared them loosely',
    })
  })

  it('ci.yml marks the tree in its gate job, after the gate, and not when E2E was skipped by the label', () => {
    const gate = workflow('ci.yml').jobs.ci
    expect(gate.permissions).toEqual({ contents: 'read', actions: 'read' })
    const steps = gate.steps
    const at = (name) => steps.findIndex((s) => s.name === name)
    const gateStep = steps.findIndex((s) => s.run === 'node tools/ci/gate.mjs')
    expect(gateStep).toBeGreaterThanOrEqual(0)
    expect(at('Mark the tree as checked')).toBeGreaterThan(gateStep)
    const marking = steps[at('Mark the tree as checked')]
    expect(marking.run).toBe('node tools/ci/checked.mjs mark')
    expect(marking.id).toBe('mark')
    // Only once the gate passed, and never for a run that skipped the suite.
    expect(marking.if).toBe("${{ success() && !contains(github.event.pull_request.labels.*.name, 'skip-e2e') }}")
    const keeping = steps[at('Keep the mark')]
    expect(at('Keep the mark')).toBe(at('Mark the tree as checked') + 1)
    expect(keeping.uses).toMatch(/^actions\/upload-artifact@/)
    expect(keeping.if).toBe("${{ steps.mark.outputs.name != '' }}")
    expect(keeping.with).toMatchObject({ name: '${{ steps.mark.outputs.name }}', path: '${{ steps.mark.outputs.file }}' })
    expect(keeping.with['retention-days']).toBeGreaterThanOrEqual(1)
    expect(MARK_FILE).toBe('checked-tree.txt')
  })

  it('deploy.yml asks first, leaves its checks out only for a checked tree, and deploys what passed here or there', () => {
    const { jobs } = workflow('deploy.yml')
    const { known, e2e, deploy } = jobs
    expect(known.permissions).toEqual({ contents: 'read', actions: 'read' })
    expect(known.steps.find((s) => s.run).run).toBe('node tools/ci/checked.mjs known')
    expect(known.outputs.checked).toBe('${{ steps.known.outputs.checked }}')
    expect(known.steps.find((s) => s.run).id).toBe('known')

    // The suite: after the question, and whenever its answer is not yes
    // (also when the job that asks failed).
    expect(e2e.needs).toBe('known')
    expect(e2e.if).toBe("${{ !cancelled() && needs.known.outputs.checked != 'true' }}")

    // The deploy: when the suite passed, or was left out for a checked tree; never after a failed one.
    expect([...deploy.needs].sort()).toEqual(['e2e', 'known'])
    expect(deploy.if).toBe("${{ !cancelled() && (needs.e2e.result == 'success' || (needs.e2e.result == 'skipped' && needs.known.outputs.checked == 'true')) }}")

    // Its checking steps are left out for a checked tree, each of them; what
    // builds and uploads is not.
    const unchecked = "${{ needs.known.outputs.checked != 'true' }}"
    const checking = deploy.steps.filter((s) => /^(npm run check:workspaces|npm run typecheck|npx playwright install .*|npm test)$/.test(s.run ?? ''))
    expect(checking.map((s) => s.run)).toEqual(['npm run check:workspaces', 'npm run typecheck', 'npx playwright install --with-deps chromium', 'npm test'])
    for (const step of checking) expect(step.if, step.name).toBe(unchecked)
    const rest = deploy.steps.filter((s) => !checking.includes(s))
    expect(rest.length).toBeGreaterThan(10)
    for (const step of rest) expect(step.if, step.name).toBeUndefined()
    expect(rest.some((s) => s.run === 'npm run build:web')).toBe(true)
  })
})
