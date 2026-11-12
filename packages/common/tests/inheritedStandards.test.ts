import { describe, expect, it } from 'vitest'
import { checkModel } from '../src/check'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

const ACCEPTED = { status: 'accepted', date: '2026-11-12', context: 'c', decision: 'd', consequences: 'q' }
const THEIRS = { origin: 'standards@abc1234' }

/** Shop's model, depending on standards: two of standards' accepted ADRs
 *  and one proposed, fetched with their origin. */
function shop(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('shop', 'system', 'Shop'),
      node('api', 'container', 'Shop API', { parentId: 'shop' }),
      node('ledger', 'adr', 'Append-only records', { ...ACCEPTED, ...THEIRS }),
      node('gateway', 'adr', 'One gateway per provider kind', { ...ACCEPTED, ...THEIRS }),
      node('draft', 'adr', 'Event sourcing everywhere', { status: 'proposed', ...THEIRS }),
    ],
    relations: [],
  }
}
const found = (data: DiagramData, ...rules: string[]) => checkModel(data).findings
  .filter((f) => rules.includes(f.rule)).map((f) => [f.rule, f.nodeId ?? null, f.message])

describe('inherited standards', () => {
  it('reports a standard applied to none of the model\'s elements and waived by none, as an error (Unapplied standard is an error)', () => {
    const result = checkModel(shop())
    expect(found(shop(), 'inherited-adr-unapplied')).toEqual([
      ['inherited-adr-unapplied', null, 'ADR "Append-only records" of standards@abc1234 binds this model and applies to none of its elements: link it with constrains to the elements it governs, or record an accepted ADR of this model that waives it and says why.'],
      ['inherited-adr-unapplied', null, 'ADR "One gateway per provider kind" of standards@abc1234 binds this model and applies to none of its elements: link it with constrains to the elements it governs, or record an accepted ADR of this model that waives it and says why.'],
    ])
    expect(result.findings.find((f) => f.rule === 'inherited-adr-unapplied')!.relatedIds).toEqual(['ledger'])
    expect(result.ok).toBe(false)
    // Nothing found about standards' ADRs themselves is left in.
    expect(result.findings.filter((f) => f.nodeId && ['ledger', 'gateway', 'draft'].includes(f.nodeId))).toEqual([])
  })

  it('passes a standard an accepted ADR of the model waives, and asks that waiver for no fitness function (Waived standard passes)', () => {
    const data = shop()
    data.nodes.push(node('no-providers', 'adr', 'No outside providers', ACCEPTED))
    data.relations.push(rel('w', 'waives', 'no-providers', 'gateway'), rel('c', 'constrains', 'ledger', 'api'), rel('c2', 'constrains', 'no-providers', 'shop'))
    data.nodes.push(node('ff', 'fitness-fn', 'Ledger is append-only', { metrics: 'ledger.updates == 0' }))
    data.relations.push(rel('i', 'implements', 'ff', 'ledger'))
    expect(found(data, 'inherited-adr-unapplied', 'inherited-adr-unchecked')).toEqual([])
    expect(found(data, 'adr-without-fitness-fn')).toEqual([])

    // A waiver that is only proposed does not count.
    Object.assign(data.nodes.find((n) => n.id === 'no-providers')!, { status: 'proposed' })
    expect(found(data, 'inherited-adr-unapplied').map((f) => f[2])).toEqual([
      expect.stringContaining('"One gateway per provider kind"'),
    ])
  })

  it('reports an applied standard no fitness function checks on each element it constrains (Applied standard without a check is an error)', () => {
    const data = shop()
    data.nodes.push(node('no-providers', 'adr', 'No outside providers', ACCEPTED))
    data.relations.push(rel('w', 'waives', 'no-providers', 'gateway'), rel('c', 'constrains', 'ledger', 'api'))
    expect(found(data, 'inherited-adr-unchecked')).toEqual([
      ['inherited-adr-unchecked', 'api', 'Nothing checks ADR "Append-only records" of standards@abc1234 on container "Shop API": add a fitness function that implements the ADR and names its check (metrics, or tests .radical/radical.json binds to it).'],
    ])

    // A fitness function that names no check does not count either.
    data.nodes.push(node('ff', 'fitness-fn', 'Ledger is append-only'))
    data.relations.push(rel('i', 'implements', 'ff', 'ledger'))
    expect(found(data, 'inherited-adr-unchecked')).toHaveLength(1)

    // The model's own fitness function with a metric condition checks it.
    Object.assign(data.nodes.find((n) => n.id === 'ff')!, { metrics: 'ledger.updates == 0' })
    expect(found(data, 'inherited-adr-unapplied', 'inherited-adr-unchecked')).toEqual([])
  })

  it('takes a fitness function fetched with the standard, and tests the repository binds to the model\'s own', () => {
    const data = shop()
    data.nodes = data.nodes.filter((n) => n.id !== 'gateway')
    data.nodes.push(node('their-ff', 'fitness-fn', 'Ledger is append-only', { metrics: 'ledger.updates == 0', ...THEIRS }))
    data.relations.push(rel('c', 'constrains', 'ledger', 'api'), rel('i', 'implements', 'their-ff', 'ledger'))
    expect(found(data, 'inherited-adr-unapplied', 'inherited-adr-unchecked')).toEqual([])

    const bound = shop()
    bound.nodes = bound.nodes.filter((n) => n.id !== 'gateway')
    bound.nodes.push(node('ff', 'fitness-fn', 'Ledger is append-only'))
    bound.relations.push(rel('c', 'constrains', 'ledger', 'api'), rel('i', 'implements', 'ff', 'ledger'))
    const result = checkModel(bound, {}, { repository: { file: '.radical/radical.json', implements: [], verifies: [{ element: 'ff', tests: ['tests/ledger.test.ts › never updates'] }] } })
    expect(result.findings.filter((f) => f.rule === 'inherited-adr-unchecked')).toEqual([])
  })

  it('says nothing in a model that depends on no other model', () => {
    const data = shop()
    data.nodes = data.nodes.filter((n) => !n.origin)
    expect(found(data, 'inherited-adr-unapplied', 'inherited-adr-unchecked')).toEqual([])
  })

  it('lowers to a warning in check.json', () => {
    const result = checkModel(shop(), { rules: { 'inherited-adr-unapplied': 'warning' } })
    expect(result.findings.filter((f) => f.rule === 'inherited-adr-unapplied').map((f) => f.severity)).toEqual(['warning', 'warning'])
    expect(result.ok).toBe(true)
  })
})
