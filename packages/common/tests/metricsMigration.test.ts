import { describe, expect, it } from 'vitest'
import { deserializeFromMdFolder, serializeToMdFolder } from '../src/formats/mdFolder'
import { migrateChecks } from '../src/formats/checksMigration'
import { parseModelBase } from '../src/formats/modelBase'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A model as it was saved before `metrics`: tests and a threshold, in the
 *  live model, a milestone and the metamodel saved with it. */
function before(): DiagramData {
  const mm = builtInGovernanceMetamodel()
  const old = (type: string) => ({
    ...mm.nodeTypes[type],
    properties: [...mm.nodeTypes[type].properties!.filter((p) => !['metrics', 'combine', 'max_age'].includes(p.key)),
      ...(type === 'fitness-fn' ? [{ key: 'threshold', label: 'Threshold', type: 'text' as const }] : []),
      { key: 'tests', label: 'Tests', type: 'textarea' as const }],
  })
  const sc = node('sc', 'scenario', 'Paying', { given: 'g', when: 'w', then: 't', tests: 'tests/pay.test.ts › pays\n# later: the refund\ntests/pay.test.ts › declines' })
  const ff = node('ff', 'fitness-fn', 'Latency', { description: 'p95 of checkout.', tests: 'tests/load.test.ts', threshold: 'p95 < 300 ms in staging' })
  return {
    metamodel: { ...mm, nodeTypes: { ...mm.nodeTypes, scenario: old('scenario'), 'fitness-fn': old('fitness-fn') } },
    nodes: [sc, ff, node('plain', 'component', 'API', { tests: 'kept: no checked type' })],
    relations: [],
    snapshots: [{ id: 'm', name: 'As-is', timestamp: 0, nodes: { ff }, relations: {} }],
  }
}

describe('models from before metrics', () => {
  it('moves tests into test() lines and a threshold into the description, and the next save writes the new format', () => {
    const files = serializeToMdFolder(before(), 'Old')
    const { data } = deserializeFromMdFolder(files)
    const sc = data.nodes.find((n) => n.id === 'sc') as unknown as Record<string, unknown>
    const ff = data.nodes.find((n) => n.id === 'ff') as unknown as Record<string, unknown>
    expect(sc.metrics).toBe('test(tests/pay.test.ts › pays) passed\n# later: the refund\ntest(tests/pay.test.ts › declines) passed')
    expect(ff.metrics).toBe('test(tests/load.test.ts) passed')
    expect(ff.description).toBe('p95 of checkout.\n\nThreshold: p95 < 300 ms in staging')
    for (const n of [sc, ff]) expect(Object.keys(n).filter((k) => k === 'tests' || k === 'threshold')).toEqual([])
    expect((data.nodes.find((n) => n.id === 'plain') as unknown as Record<string, unknown>).tests).toBe('kept: no checked type')
    expect((data.snapshots![0].nodes.ff as unknown as Record<string, unknown>).metrics).toBe('test(tests/load.test.ts) passed')
    const keys = (type: string) => data.metamodel!.nodeTypes[type].properties!.map((p) => p.key)
    expect(keys('fitness-fn')).toEqual(['description', 'characteristic', 'scope', 'cadence', 'trigger', 'every', 'invocation', 'measure', 'metrics', 'combine', 'max_age'])
    expect(keys('scenario')).toEqual(['given', 'when', 'then', 'gherkin', 'metrics', 'combine', 'max_age'])
    const saved = serializeToMdFolder(data, 'Old')
    const ffFile = Object.entries(saved).find(([path]) => path.endsWith('latency.md'))![1]
    expect(ffFile).toContain('metrics: "test(tests/load.test.ts) passed"')
    expect(ffFile).not.toMatch(/^(tests|threshold):/m)
    // Read again, nothing moves: the same object back.
    const again = deserializeFromMdFolder(saved).data
    expect(migrateChecks(again)).toBe(again)
  })

  it('reads a base saved before metrics as the model now reads, so nothing counts as changed for it', () => {
    const text = JSON.stringify({ version: 1, commit: 'abc', described: 'main', branch: 'main', savedAt: '2026-10-28T10:00:00Z', nodes: before().nodes, relations: [] })
    const base = parseModelBase(text)!
    const now = deserializeFromMdFolder(serializeToMdFolder(before(), 'Old')).data
    const fields = (n: C4Node | undefined) => {
      const { metrics, description, tests, threshold } = n as unknown as Record<string, unknown>
      return { metrics, description, tests, threshold }
    }
    for (const id of ['sc', 'ff']) expect(fields(base.nodes.find((n) => n.id === id))).toEqual(fields(now.nodes.find((n) => n.id === id)))
  })
})
