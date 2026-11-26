/**
 * What the Inspector says is to fix, and what it keeps as debt: only what
 * fails the check is to fix, counted as what has to be settled for the
 * check to pass (one finding over a baseline is one to fix, not every
 * finding of its rule); the findings about what the branch changed come
 * first; a goal not met says how many more elements reach it. What does
 * not fail the check is debt: within baselines, warnings, and what was read
 * from old test results.
 */
import { describe, expect, it } from 'vitest'
import { checkModel, type CheckFinding, type CheckMetricResult, type CheckResult } from '@radical/common/check'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { byCause, debt, neededFor, settleCount, toFix } from '../src/renderer/src/components/inspector/toFix'

type Checked = Pick<CheckResult, 'findings' | 'rules' | 'metrics'>

const finding = (rule: string, severity: 'error' | 'warning', nodeId?: string, extra: Partial<CheckFinding> = {}): CheckFinding =>
  ({ rule, key: rule, severity, message: `${rule} ${nodeId ?? ''}`, ...(nodeId ? { nodeId } : {}), ...extra })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A need, and `n` requirements derived from it and satisfied, none with a scenario. */
function modelWithout(n: number): DiagramData {
  const reqs = Array.from({ length: n }, (_, i) => `r${i + 1}`)
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('api', 'container', 'API'),
      node('need', 'need', 'Pay online'),
      ...reqs.map((id) => node(id, 'requirement', `Requirement ${id}`, { ears_type: 'ubiquitous', action: `do ${id}` })),
    ],
    relations: reqs.flatMap((id) => [
      { id: `d-${id}`, relationType: 'derives', sourceId: id, targetId: 'need' },
      { id: `s-${id}`, relationType: 'satisfies', sourceId: 'api', targetId: id },
    ]),
    views: [],
  }
}

describe('what is to fix', () => {
  it('is only what fails the check, by rule in the order the check ran them', () => {
    const check: Checked = {
      metrics: [],
      rules: [
        { id: 'requirement-without-scenario', count: 2, severity: 'warning', failed: false },
        { id: 'test-failed', count: 2, severity: 'error', failed: true },
        { id: 'metamodel', count: 1, severity: 'error', failed: true },
      ],
      findings: [finding('test-failed', 'error', 'sc1'), finding('requirement-without-scenario', 'warning', 'r1'), finding('metamodel', 'error', 'x'), finding('test-failed', 'error', 'sc2'), finding('requirement-without-scenario', 'warning', 'r2')],
    }
    const items = toFix(check)
    expect(items.map((i) => [i.key, i.toSettle, i.findings.length])).toEqual([['test-failed', 2, 2], ['metamodel', 1, 1]])
    expect(settleCount(items)).toBe(3)
  })

  it('counts a rule over its baseline as the number over it, as the check itself makes every finding an error', () => {
    // The engine: three findings with a baseline of two are three errors.
    const check = checkModel(modelWithout(3), { rules: { 'requirement-without-scenario': { severity: 'error', max: 2 } } })
    expect(check.findings.filter((f) => f.rule === 'requirement-without-scenario').map((f) => f.severity)).toEqual(['error', 'error', 'error'])
    const [item] = toFix(check).filter((i) => i.rule === 'requirement-without-scenario')
    expect(item).toMatchObject({ toSettle: 1, count: 3, max: 2 })
    expect(item.findings).toHaveLength(3)
    // Within its baseline it is not to fix at all.
    const within = checkModel(modelWithout(2), { rules: { 'requirement-without-scenario': { severity: 'error', max: 2 } } })
    expect(toFix(within).some((i) => i.rule === 'requirement-without-scenario')).toBe(false)
    // Without a baseline every error is to be settled.
    const none = checkModel(modelWithout(3), { rules: { 'requirement-without-scenario': 'error' } })
    expect(toFix(none).find((i) => i.rule === 'requirement-without-scenario')).toMatchObject({ toSettle: 3, count: 3 })
    expect(toFix(none).find((i) => i.rule === 'requirement-without-scenario')?.max).toBeUndefined()
  })

  it('puts the findings about what the branch changed first, their own element or one they name', () => {
    const check: Checked = {
      metrics: [],
      rules: [{ id: 'requirement-without-scenario', count: 4, severity: 'error', max: 2, failed: true }],
      findings: [
        finding('requirement-without-scenario', 'error', 'old1'), finding('requirement-without-scenario', 'error', 'new1'),
        finding('requirement-without-scenario', 'error', 'old2'), finding('requirement-without-scenario', 'error', 'old3', { relatedIds: ['new2'] }),
      ],
    }
    const [item] = toFix(check, new Set(['new1', 'new2']))
    expect(item.findings.map((f) => f.nodeId)).toEqual(['new1', 'old3', 'old1', 'old2'])
    expect(item).toMatchObject({ onBranch: 2, toSettle: 2 })
    // Without a base nothing is known of the branch: the check's order.
    expect(toFix(check, null)[0]).toMatchObject({ onBranch: 0 })
    expect(toFix(check)[0].findings.map((f) => f.nodeId)).toEqual(['old1', 'new1', 'old2', 'old3'])
  })

  it('leaves out the findings that warn of a rule that fails, and never settles more than its errors', () => {
    const check: Checked = {
      metrics: [],
      rules: [{ id: 'test-not-found', count: 5, severity: 'error', max: 1, failed: true }],
      findings: [
        finding('test-not-found', 'error', 'a'), finding('test-not-found', 'error', 'b'),
        finding('test-not-found', 'warning', 'c', { asOf: '2026-11-01T00:00:00Z' }), finding('test-not-found', 'warning', 'd', { asOf: '2026-11-01T00:00:00Z' }), finding('test-not-found', 'warning', 'e', { asOf: '2026-11-01T00:00:00Z' }),
      ],
    }
    const [item] = toFix(check)
    expect(item.findings.map((f) => f.nodeId)).toEqual(['a', 'b'])
    expect(item.toSettle).toBe(2)
    expect(debt(check).old.map((g) => g.findings.length)).toEqual([3])
  })

  it('makes a goal not met one item that says how many more reach it', () => {
    const metric = (count: number, total: number, min: number): CheckMetricResult =>
      ({ id: 'requirements-with-scenario', label: 'Requirements with a scenario', dimension: 'traceability', rule: 'requirement-without-scenario', count, total, percent: Math.floor((count * 100) / total), min, met: count * 100 >= min * total })
    expect(neededFor(metric(1, 2, 100))).toBe(1)
    expect(neededFor(metric(671, 754, 91))).toBe(16)
    expect(neededFor(metric(687, 754, 91))).toBe(0)
    expect(neededFor({ count: 1, total: 2 })).toBe(0)
    // Through the engine: one requirement of two has a scenario, the goal is all.
    const model = modelWithout(2)
    model.nodes.push(node('sc', 'scenario', 'Doing r1', { given: 'g', when: 'w', then: 't' }))
    model.relations.push({ id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'r1' })
    const check = checkModel(model, { rules: { 'requirement-without-scenario': 'warning' }, goals: { 'requirements-with-scenario': { min: 100 } } })
    const goals = toFix(check).filter((i) => i.goal)
    expect(goals).toHaveLength(1)
    expect(goals[0]).toMatchObject({ key: 'goal-unmet/requirements-with-scenario', name: 'Goal not met: Requirements with a scenario', toSettle: 1 })
    expect(goals[0].goal).toMatchObject({ needed: 1, metric: { count: 1, total: 2, min: 100, rule: 'requirement-without-scenario' } })
    // The requirement that misses it is debt: its rule warns.
    expect(debt(check).warnings.find((g) => g.rule === 'requirement-without-scenario')?.findings.map((f) => f.nodeId)).toEqual(['r2'])
  })
})

describe('one cause', () => {
  const at = '2026-11-25T10:00:00.000Z'
  const measured = { metric: 'tests.unit.over_100ms', value: 2, labels: {}, source: 'json', at }
  const condition = 'tests.unit.over_100ms == 0'

  it('is one thing to fix, however many elements name it: a condition on one measurement, a test', () => {
    const findings: CheckFinding[] = [
      finding('metric-failed', 'error', 'scenario', { condition, measured, relatedIds: ['req'] }),
      finding('metric-failed', 'error', 'other', { condition: 'tests.e2e.share <= 15 %', measured: { ...measured, metric: 'tests.e2e.share', value: 30 } }),
      finding('metric-failed', 'error', 'ff', { condition, measured, relatedIds: ['adr'] }),
    ]
    // In their order, the second of a cause joining the first.
    expect(byCause(findings).map((group) => group.map((f) => f.nodeId))).toEqual([['scenario', 'ff'], ['other']])
    const check: Checked = { metrics: [], rules: [{ id: 'metric-failed', count: 3, severity: 'error', failed: true }], findings }
    const [item] = toFix(check)
    expect(item).toMatchObject({ toSettle: 2, count: 3 })
    expect(item.findings).toHaveLength(3)
    expect(settleCount(toFix(check))).toBe(2)

    // One test two scenarios name, however each writes its id.
    const tests = [
      finding('test-failed', 'error', 's1', { test: 'tests/pay.test.ts › pays' }),
      finding('test-failed', 'error', 's2', { test: 'tests/pay.test.ts > pays' }),
      finding('test-failed', 'error', 's3', { test: 'tests/pay.test.ts › refunds' }),
    ]
    expect(byCause(tests).map((group) => group.map((f) => f.nodeId))).toEqual([['s1', 's2'], ['s3']])
  })

  it('is not shared by another measurement, another rule, or findings that name no test or condition', () => {
    // The same condition decided by measurements of two elements, or of two times.
    const perElement = [
      finding('metric-failed', 'error', 'api', { condition, measured: { ...measured, labels: { element: 'api' } } }),
      finding('metric-failed', 'error', 'web', { condition, measured: { ...measured, labels: { element: 'web' } } }),
      finding('metric-failed', 'error', 'late', { condition, measured: { ...measured, at: '2026-11-26T10:00:00.000Z' } }),
    ]
    expect(byCause(perElement)).toHaveLength(3)
    // Nothing measured: one cause for those that state the condition.
    expect(byCause([finding('metric-not-measured', 'warning', 'a', { condition }), finding('metric-not-measured', 'warning', 'b', { condition })])).toHaveLength(1)
    // A test that failed for one scenario and did not run for another: two rules, two causes.
    expect(byCause([finding('test-failed', 'error', 's1', { test: 't.ts › a' }), finding('test-not-run', 'warning', 's2', { test: 't.ts › a' })])).toHaveLength(2)
    // Two requirements without a scenario are two things to settle.
    expect(byCause([finding('requirement-without-scenario', 'error', 'r1'), finding('requirement-without-scenario', 'error', 'r2')])).toHaveLength(2)
    expect(byCause([])).toEqual([])
  })

  it('does not change what a rule over its baseline has to settle', () => {
    const findings = ['s1', 's2', 's3'].map((id) => finding('test-not-found', 'error', id, { test: 'tests/pay.test.ts › gone' }))
    const check: Checked = { metrics: [], rules: [{ id: 'test-not-found', count: 3, severity: 'error', max: 1, failed: true }], findings }
    expect(toFix(check)[0]).toMatchObject({ toSettle: 2, count: 3, max: 1 })
  })
})

describe('the debt', () => {
  const check: Checked = {
    metrics: [],
    rules: [
      { id: 'requirement-without-scenario', count: 2, severity: 'error', max: 5, failed: false },
      { id: 'adr-without-fitness-fn', count: 0, severity: 'error', max: 2, failed: false },
      { id: 'scenario-value-untested', count: 1, severity: 'error', max: 1, failed: false },
      { id: 'test-skipped', count: 1, severity: 'warning', failed: false },
      { id: 'test-not-found', count: 1, severity: 'error', failed: false },
      { id: 'test-failed', count: 1, severity: 'error', failed: true },
      { id: 'concern-unaddressed', count: 0, severity: 'off', max: 9, failed: false },
    ],
    findings: [
      finding('requirement-without-scenario', 'warning', 'r1'), finding('requirement-without-scenario', 'warning', 'r2'),
      finding('scenario-value-untested', 'warning', 'sc'),
      finding('test-skipped', 'warning', 'sc2'),
      finding('test-not-found', 'warning', 'sc3', { asOf: '2026-11-01T00:00:00Z' }),
      finding('test-failed', 'error', 'sc4'),
    ],
  }

  it('is what does not fail the check: within baselines, warnings, and what old test results say', () => {
    const d = debt(check)
    expect(d.baselines.map((g) => [g.key, g.findings.length, g.max])).toEqual([['requirement-without-scenario', 2, 5], ['scenario-value-untested', 1, 1]])
    expect(d.warnings.map((g) => g.key)).toEqual(['test-skipped'])
    expect(d.old.map((g) => g.key)).toEqual(['test-not-found'])
    expect(d.total).toBe(5)
    // And nothing of it is to fix.
    expect(toFix(check).map((i) => i.key)).toEqual(['test-failed'])
  })

  it('names the baselines above what the check finds now, which Ratchet lowers', () => {
    expect(debt(check).slack).toEqual([
      { id: 'requirement-without-scenario', name: 'Requirement without scenario', count: 2, max: 5 },
      { id: 'adr-without-fitness-fn', name: 'ADR without fitness function', count: 0, max: 2 },
    ])
  })

  it('narrows to the findings about the elements given', () => {
    const d = debt(check, new Set(['r2', 'sc3']))
    expect(d.baselines.map((g) => g.findings.map((f) => f.nodeId))).toEqual([['r2']])
    expect(d.warnings).toEqual([])
    expect(d.old.map((g) => g.findings.map((f) => f.nodeId))).toEqual([['sc3']])
    expect(d.total).toBe(2)
  })
})
