/**
 * The Inspector's Overview and header: the findings by severity and then
 * rule, a rule's name as a person reads it, how old the evidence is and
 * when it is marked, and the fields of a changed element by their labels.
 */
import { describe, expect, it } from 'vitest'
import { computeEvidence, testsRanAt, type CheckFinding, type CheckResult, type Measurement, type TestCase, type TestResults } from '@radical/common/check'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, C4Relation } from '@radical/common/c4'
import {
  DAY, attentionGroups, fieldLabel, isOutdated, latestOf, measureCommands, measuredWhen, modelChangedAt, notRunItems, ruleName, testsAge, testsCommand, testsSource, ciTestsCommand,
  triggerOf, unverifiedBreakdown, valueText, waitingForMeasurement,
} from '../src/renderer/src/components/inspector/attention'

const finding = (rule: string, severity: 'error' | 'warning', nodeId?: string, extra: Partial<CheckFinding> = {}): CheckFinding =>
  ({ rule, key: rule, severity, message: `${rule} ${nodeId ?? ''}`, ...(nodeId ? { nodeId } : {}), ...extra })

describe('what needs attention', () => {
  const check: Pick<CheckResult, 'findings' | 'rules'> = {
    rules: [
      { id: 'metamodel', count: 0, severity: 'error', failed: false },
      { id: 'requirement-without-scenario', count: 2, severity: 'warning', max: 3, failed: false },
      { id: 'adr-without-fitness-fn', count: 1, severity: 'warning', failed: false },
      { id: 'test-failed', count: 1, severity: 'error', failed: true },
    ],
    findings: [
      finding('requirement-without-scenario', 'warning', 'r1'),
      finding('adr-without-fitness-fn', 'warning', 'adr'),
      finding('requirement-without-scenario', 'warning', 'r2'),
      finding('test-failed', 'error', 'sc', { relatedIds: ['r3'] }),
    ],
  }

  it('lists errors first, then warnings, each severity by rule in the order the check ran them', () => {
    const groups = attentionGroups(check)
    expect(groups.map((g) => [g.severity, g.key, g.findings.length])).toEqual([
      ['error', 'test-failed', 1],
      ['warning', 'requirement-without-scenario', 2],
      ['warning', 'adr-without-fitness-fn', 1],
    ])
    expect(groups[1].max).toBe(3)
    expect(groups[0].max).toBeUndefined()
  })

  it('keeps a rule whose findings are of both severities in a group of each', () => {
    const mixed = { ...check, findings: [finding('metamodel', 'warning', 'a'), finding('metamodel', 'error', 'b')] }
    expect(attentionGroups(mixed).map((g) => `${g.severity}:${g.key}`)).toEqual(['error:metamodel', 'warning:metamodel'])
  })

  it('narrows to the findings about the elements given: their own or one they name', () => {
    expect(attentionGroups(check, new Set(['r2', 'r3'])).map((g) => [g.key, g.findings.map((f) => f.nodeId)])).toEqual([
      ['test-failed', ['sc']],
      ['requirement-without-scenario', ['r2']],
    ])
    expect(attentionGroups(check, new Set())).toEqual([])
  })

  it('names a rule as a person reads it', () => {
    expect(ruleName('requirement-without-scenario')).toBe('Requirement without scenario')
    expect(ruleName('adr-without-fitness-fn')).toBe('ADR without fitness function')
    expect(ruleName('fitness-fn-unlinked')).toBe('Fitness function unlinked')
    expect(ruleName('goal-unmet')).toBe('Goal not met')
    expect(ruleName('metamodel/sm-unreachable')).toBe('Breaks the metamodel: sm-unreachable')
  })
})

describe('how old the evidence is', () => {
  const now = Date.parse('2026-10-31T15:00:00')

  it('says the age of the test results in days, or today', () => {
    expect(testsAge(now - 8 * DAY, now)).toBe('8 d old')
    expect(testsAge(now - 2 * 3600e3, now)).toBe('today')
    expect(testsAge(Date.parse('2026-10-30T22:00:00'), now)).toBe('17 h old')
  })

  it('marks evidence read before the model changed, and without that time evidence older than a day', () => {
    expect(isOutdated(now - 8 * DAY, now)).toBe(true)
    expect(isOutdated(now - 3600e3, now)).toBe(false)
    // The model changed after: marked, however fresh.
    expect(isOutdated(now - 3600e3, now, now - 60e3)).toBe(true)
    // Nothing changed since: not marked, however old.
    expect(isOutdated(now - 8 * DAY, now, now - 9 * DAY)).toBe(false)
  })

  it('takes the time the model changed from an edit, or from the base when the branch changed it', () => {
    const base = { savedAt: new Date(now - DAY).toISOString() }
    expect(modelChangedAt(null, null, 0)).toBeNull()
    expect(modelChangedAt(null, base, 0)).toBeNull()
    expect(modelChangedAt(null, base, 3)).toBe(now - DAY)
    expect(modelChangedAt(now - 60e3, base, 3)).toBe(now - 60e3)
  })

  it('tells the measurements a sensor took from the reviews', () => {
    const m = (source: string, at: number): Measurement => ({ metric: 'x', value: 1, labels: {}, source, at: new Date(at).toISOString() })
    const all = [m('json', now - 3 * 3600e3), m('k6', now - 2 * 3600e3), m('review', now - 2 * DAY)]
    expect(latestOf(all, false)).toEqual({ at: now - 2 * 3600e3, count: 2, sources: ['json', 'k6'] })
    expect(latestOf(all, true)).toEqual({ at: now - 2 * DAY, count: 1, sources: ['review'] })
    expect(latestOf([m('json', now)], true)).toBeNull()
    expect(latestOf(null, false)).toBeNull()
  })

  it('says the commit and run the results of CI come from', () => {
    const base: TestResults = { version: 1, readAt: '2026-10-31T11:00:00Z', reports: [], cases: [] }
    const run = { id: 41192813920, url: 'https://github.com/o/r/actions/runs/41192813920', sha: '70b7350d3705', ranAt: '2026-10-31T10:30:00Z', workflow: 'CI', artifacts: ['e2e-report', 'test-reports'] }
    const fromCi = { ...base, ci: { provider: 'github' as const, commit: '0023cdb7f79f', behind: 2, runs: [{ ...run, pr: 299 }] } }
    expect(testsSource(fromCi)).toBe('From CI, pull request #299, run 41192813920, for commit 0023cdb (2 commits before HEAD)')
    expect(testsSource({ ...fromCi, ci: { ...fromCi.ci, behind: 0, runs: [run, { ...run, id: 7 }] } })).toBe('From CI, runs 41192813920, 7, for commit 0023cdb (HEAD)')
    expect(testsSource({ ...base, commit: 'abcdef123456' })).toBe('Read with --report at commit abcdef1')
    expect(testsSource(base)).toBe('Read with --report')
    // As old as the run that made them, not as the download.
    expect(testsRanAt(fromCi)).toBe('2026-10-31T10:30:00Z')
    expect(testsRanAt(base)).toBe('2026-10-31T11:00:00Z')
  })

  it('gives the commands that read them again for the model folder', () => {
    expect(testsCommand('architecture')).toBe('npm run test:reports && radical check architecture --report reports')
    expect(ciTestsCommand('architecture')).toBe('radical check architecture --from-ci')
    expect(measureCommands('architecture')).toEqual([
      'radical sense run --trigger <event> --folder architecture --out reports/metrics',
      'radical check architecture --metrics reports/metrics',
    ])
  })
})

describe('the fields of a changed element', () => {
  it('names a field by its label in the metamodel, else as Studio does', () => {
    const props = [{ key: 'action', label: 'The system shall (action)' }]
    expect(fieldLabel('action', props)).toBe('The system shall (action)')
    expect(fieldLabel('label', props)).toBe('Name')
    expect(fieldLabel('parentId', undefined)).toBe('Place')
    expect(fieldLabel('custom_key', props)).toBe('custom_key')
  })

  it('shows a value as text: a place by its label, yes or no, lists joined', () => {
    const labelOf = (id: string): string | undefined => ({ shop: 'Shop' } as Record<string, string>)[id]
    expect(valueText('parentId', 'shop', labelOf)).toBe('Shop')
    expect(valueText('parentId', null, labelOf)).toBe('Top level')
    expect(valueText('external', true, labelOf)).toBe('yes')
    expect(valueText('tags', ['a', 'b'], labelOf)).toBe('a, b')
    expect(valueText('description', '', labelOf)).toBeNull()
    expect(valueText('action', 'take card payments', labelOf)).toBe('take card payments')
  })
})

describe('what did not run, and why a decision is not verified', () => {
  const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
    ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
  const adr = (id: string, label: string): C4Node => node(id, 'adr', label, { status: 'accepted' })
  const list = [
    adr('a-none', 'No check at all'),
    adr('a-empty', 'Names nothing'), node('f-empty', 'fitness-fn', 'Empty check'),
    adr('a-night', 'Fast open'), node('f-night', 'fitness-fn', 'Open time', { cadence: 'triggered', trigger: 'nightly', metrics: 'studio.open_ms <= 11000 ms' }),
    adr('a-pr', 'Workspaces build'), node('f-pr', 'fitness-fn', 'Workspaces', { cadence: 'triggered', trigger: 'pull-request', metrics: 'workspaces.exit_code == 0' }),
    adr('a-fail', 'Layering'), node('f-fail', 'fitness-fn', 'Layers', { metrics: 'test(tests/layers.test.ts › layers) passed' }),
    adr('a-ok', 'Typed'), node('f-ok', 'fitness-fn', 'Types', { metrics: 'test(tests/types.test.ts › types) passed' }),
    node('a-draft', 'adr', 'Not accepted', { status: 'proposed' }),
    node('req', 'requirement', 'Pay'), node('req-none', 'requirement', 'Refund'),
    node('s-pay', 'scenario', 'Paying', { metrics: 'test(tests/pay.test.ts › pays) passed' }),
  ]
  const nodes = Object.fromEntries(list.map((n) => [n.id, n]))
  const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })
  const relations = Object.fromEntries([
    rel('i1', 'implements', 'f-empty', 'a-empty'), rel('i2', 'implements', 'f-night', 'a-night'), rel('i3', 'implements', 'f-pr', 'a-pr'),
    rel('i4', 'implements', 'f-fail', 'a-fail'), rel('i5', 'implements', 'f-ok', 'a-ok'), rel('v1', 'verifies', 's-pay', 'req'),
  ].map((r) => [r.id, r]))
  const tc = (file: string, title: string, status: TestCase['status']): TestCase => ({ file: `/repo/${file}`, title: [title], status })
  const tests = [tc('tests/layers.test.ts', 'layers', 'failed'), tc('tests/types.test.ts', 'types', 'passed')]
  const evidence = computeEvidence({ nodes, relations, metamodel: builtInGovernanceMetamodel(), tests }).nodes

  it('says when each runs: a scenario with the pull request, a fitness function by its cadence', () => {
    expect(triggerOf(nodes['s-pay'])).toBe('pull-request')
    expect(triggerOf(nodes['f-night'])).toBe('nightly')
    expect(triggerOf(nodes['f-fail'])).toBe('pull-request')
    expect(triggerOf(node('c', 'fitness-fn', 'C', { cadence: 'continual' }))).toBe('continual')
    expect(triggerOf(node('t', 'fitness-fn', 'T', { cadence: 'temporal', every: '90d' }))).toBe('every 90d')
    expect(measuredWhen('continual')).toBe('continually')
    expect(measuredWhen('release')).toBe('on release')
  })

  it('tells an accepted ADR without a fitness function from one whose fitness function did not run, and the parts add up', () => {
    const parts = unverifiedBreakdown('adr', evidence, nodes)
    expect(parts.map((p) => p.text)).toEqual(['1 no fitness function', '1 no check', '2 not run (1 measured nightly)', '1 failing'])
    // Five of the six accepted ADRs are not verified; the proposed one does not count.
    expect(parts.reduce((n, p) => n + p.count, 0)).toBe(5)
  })

  it('tells a requirement without a scenario from one whose test did not run', () => {
    expect(unverifiedBreakdown('requirement', evidence, nodes).map((p) => p.text)).toEqual(['1 no scenario', '1 test not run'])
    expect(unverifiedBreakdown('requirement', undefined, nodes)).toEqual([])
  })

  it('lists what nothing ran, the gaps first, and leaves out what a rule reports already', () => {
    const items = notRunItems(evidence, nodes, relations, [])
    expect(items.map((i) => [i.label, i.trigger, i.expected, i.why])).toEqual([
      ['Paying', 'pull-request', false, ['test tests/pay.test.ts › pays not in the test results']],
      ['Workspaces', 'pull-request', false, ['nothing measured workspaces.exit_code == 0']],
      ['Open time', 'nightly', true, ['nothing measured studio.open_ms <= 11000 ms']],
    ])
    expect(items.find((i) => i.label === 'Workspaces')!.checks).toEqual(['a-pr'])
    const reported: CheckFinding[] = [{ rule: 'test-not-run', key: 'test-not-run', severity: 'warning', nodeId: 's-pay', message: 'Scenario "Paying": no report has the file of test tests/pay.test.ts › pays.' }]
    expect(notRunItems(evidence, nodes, relations, reported).map((i) => i.label)).toEqual(['Workspaces', 'Open time'])
  })

  it('lists the fitness functions that wait for a measurement, those that run with a pull request first', () => {
    expect(waitingForMeasurement(evidence, nodes)).toEqual([
      { id: 'f-pr', label: 'Workspaces', trigger: 'pull-request' },
      { id: 'f-night', label: 'Open time', trigger: 'nightly' },
    ])
    expect(measureCommands('architecture', 'pull-request')[0]).toBe('radical sense run --trigger pull-request --folder architecture --out reports/metrics')
  })
})
