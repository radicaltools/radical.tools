import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { builtInDddC4Metamodel, builtInGovernanceMetamodel, validateModel } from '../src/metamodel'

const ddd = builtInDddC4Metamodel()
const pairsOf = (rel: string) => ddd.relationTypes[rel].allowedPairs.map((p) => `${p.from}->${p.to}`)

const entity = (id: string, kind: string, parentId = 'shop'): C4Node =>
  ({ id, type: 'entity', label: id, kind, parentId, collapsed: false, x: 0, y: 0, width: 170, height: 56 }) as unknown as C4Node
const rel = (id: string, sourceId: string, targetId: string, relationType: string, extra: Record<string, string> = {}): C4Relation =>
  ({ id, sourceId, targetId, relationType, ...extra }) as C4Relation
const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]))
const shop = { id: 'shop', type: 'domain', label: 'Ordering', collapsed: false, x: 0, y: 0, width: 400, height: 300 } as C4Node
const ids = (nodes: C4Node[], relations: C4Relation[]) =>
  validateModel(byId([shop, ...nodes]), byId(relations), builtInGovernanceMetamodel()).map((i) => i.id)

describe('domain model types', () => {
  it('relate entities as parts of an aggregate and as references across aggregates', () => {
    expect(pairsOf('part-of')).toEqual(['entity->entity'])
    expect(pairsOf('references')).toEqual(['entity->entity'])
    expect(ddd.relationTypes.references.properties?.find((p) => p.key === 'cardinality')?.options).toEqual(['one', 'many'])
    expect(ddd.nodeTypes.entity.hierarchyRelation).toBe('part-of')
    expect(builtInGovernanceMetamodel().relationTypes.satisfies.allowedPairs).toContainEqual({ from: 'entity', to: 'requirement' })
  })
})

describe('aggregate rules', () => {
  const order = entity('Order', 'aggregate-root')
  const line = entity('OrderLine', 'entity')
  const customer = entity('Customer', 'aggregate-root')

  it('accept a part in one aggregate and a reference between aggregates', () => {
    expect(ids([order, line, customer], [
      rel('p', 'OrderLine', 'Order', 'part-of'),
      rel('r', 'Order', 'Customer', 'references', { cardinality: 'one' }),
    ])).toEqual([])
  })

  it('flag a part of no aggregate, of two, of a non-root, and a root inside another', () => {
    const note = entity('Note', 'entity')
    expect(ids([order, line, customer, note], [])).toEqual(['ddd-loose-entity:OrderLine', 'ddd-loose-entity:Note'])
    expect(ids([order, line, customer, note], [
      rel('p1', 'OrderLine', 'Order', 'part-of'),
      rel('p2', 'OrderLine', 'Customer', 'part-of'),
      rel('p3', 'Note', 'OrderLine', 'part-of'),
      rel('p4', 'Customer', 'Order', 'part-of'),
    ]).sort()).toEqual(['ddd-many-roots:OrderLine', 'ddd-part-of-entity:p3', 'ddd-root-part-of:p4'])
  })
})
