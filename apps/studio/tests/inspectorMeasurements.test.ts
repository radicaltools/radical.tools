/**
 * The Inspector's Measurements tab, apart from how it is drawn: the readers
 * of each measurement from the check's evidence, the conditions nothing
 * measured, the groups by metric (failing first, newest first within one)
 * and the tab's badge.
 */
import { describe, expect, it } from 'vitest'
import type { EvidenceEntry, Measurement } from '@radical/common/check'
import { groupByMetric, measurementsBadge, readersOf } from '../src/renderer/src/components/inspector/measurements'

const at = (hoursAgo: number): string => new Date(Date.now() - hoursAgo * 3600e3).toISOString()
const latency: Measurement = { metric: 'checkout.latency.p95', value: 0.42, unit: 's', labels: { env: 'staging' }, source: 'json', at: at(2) }
const errors: Measurement = { metric: 'checkout.errors.rate', value: 0.2, unit: '%', labels: { env: 'staging' }, source: 'json', at: at(0) }
const exitApi: Measurement = { metric: 'openapi.exit_code', value: 0, labels: { element: 'api' }, source: 'command', at: at(5) }
const exitWeb: Measurement = { metric: 'openapi.exit_code', value: 1, labels: { element: 'web' }, source: 'command', at: at(1) }

const evidence: Record<string, EvidenceEntry> = {
  ff: {
    type: 'fitness-fn', label: 'Checkout latency', status: 'failed',
    conditions: [
      { condition: 'checkout.latency.p95{env=staging} <= 300 ms', outcome: 'failed', measurement: latency },
      { condition: 'checkout.errors.rate{env=staging} < 1 %', outcome: 'passed', measurement: errors },
      { condition: 'test(tests/pay.test.ts › pays by card) passed', test: 'tests/pay.test.ts › pays by card', outcome: 'passed' },
    ],
  },
  sc: {
    type: 'scenario', label: 'Paying by card', status: 'not-run',
    conditions: [{ condition: 'checkout.queue.depth{env=staging} <= 100', outcome: 'not-run' }],
  },
  spec: {
    type: 'fitness-fn', label: 'OpenAPI spec', status: 'failed',
    conditions: [],
    elements: [
      { id: 'api', label: 'API', status: 'passed', conditions: [{ condition: 'openapi.exit_code == 0', outcome: 'passed', measurement: exitApi }] },
      { id: 'web', label: 'Web', status: 'failed', conditions: [{ condition: 'openapi.exit_code == 0', outcome: 'failed', measurement: exitWeb, detail: 'exit 1' }] },
    ],
  },
}

describe('readersOf', () => {
  it('names, for each measurement, the scenario or fitness function whose condition it decided', () => {
    const { readers } = readersOf(evidence)
    expect(readers.get('checkout.latency.p95{env=staging}')).toEqual([{ id: 'ff', condition: 'checkout.latency.p95{env=staging} <= 300 ms', outcome: 'failed' }])
    expect(readers.get('checkout.errors.rate{env=staging}')).toEqual([{ id: 'ff', condition: 'checkout.errors.rate{env=staging} < 1 %', outcome: 'passed' }])
  })

  it('keeps, for a fitness function measured for each element, the element each condition was read for', () => {
    const { readers } = readersOf(evidence)
    expect(readers.get('openapi.exit_code{element=web}')).toEqual([{ id: 'spec', element: 'web', condition: 'openapi.exit_code == 0', outcome: 'failed', detail: 'exit 1' }])
    expect(readers.get('openapi.exit_code{element=api}')?.[0].element).toBe('api')
  })

  it('lists the metric conditions nothing measured, and no test condition', () => {
    const { unmeasured, readers } = readersOf(evidence)
    expect(unmeasured).toEqual([{ id: 'sc', condition: 'checkout.queue.depth{env=staging} <= 100', metric: 'checkout.queue.depth' }])
    expect([...readers.values()].flat().some((r) => r.condition.startsWith('test('))).toBe(false)
  })

  it('has nothing without evidence', () => {
    expect(readersOf(undefined)).toEqual({ readers: new Map(), unmeasured: [] })
  })
})

describe('groupByMetric', () => {
  it('groups by metric, those with a failing reader first, newest first within one', () => {
    const { readers } = readersOf(evidence)
    const groups = groupByMetric([errors, exitApi, latency, exitWeb], readers)
    expect(groups.map((g) => g.metric)).toEqual(['checkout.latency.p95', 'openapi.exit_code', 'checkout.errors.rate'])
    const exit = groups[1]
    expect(exit.rows.map((r) => r.m.labels.element)).toEqual(['web', 'api'])
    expect(exit.failed).toBe(1)
    expect(exit.sources).toEqual(['command'])
    expect(exit.unit).toBeUndefined()
    expect(groups[0].unit).toBe('s')
  })

  it('marks a measurement no condition reads', () => {
    const { readers } = readersOf(evidence)
    const stray: Measurement = { metric: 'brand-mark.duration', value: 0.2, unit: 's', labels: { element: 'web' }, source: 'command', at: at(1) }
    const groups = groupByMetric([stray], readers)
    expect(groups[0].rows[0].readers).toEqual([])
  })
})

describe('measurementsBadge', () => {
  it('counts the measurements and the readers that fail or find them stale', () => {
    const stale: Record<string, EvidenceEntry> = { ...evidence, old: { type: 'scenario', label: 'Old', status: 'stale', conditions: [{ condition: 'x <= 1', outcome: 'stale', measurement: { metric: 'x', value: 0, labels: {}, source: 'json', at: at(200) } }] } }
    expect(measurementsBadge([latency, errors, exitApi, exitWeb], stale)).toEqual({ count: 4, failed: 2, stale: 1 })
  })

  it('is nothing without a store beside the model', () => {
    expect(measurementsBadge(null, evidence)).toBeNull()
  })
})
