import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel, inferRelationType, validateModel, type Metamodel } from '../src/metamodel'

// What the validation says about the values elements and relations hold:
// a required one missing, one the metamodel no longer offers, several
// references where one is taken, and relations left without a type.

const node = (id: string, type: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, collapsed: false, ...props }) as C4Node
const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]))
const ids = (nodes: C4Node[], relations: C4Relation[], mm: Metamodel, prefix: string) =>
  validateModel(byId(nodes), byId(relations), mm).filter((i) => i.id.startsWith(prefix)).map((i) => i.id)

/** The Radical metamodel with a property added to a type. */
function withProperty(type: string, prop: Record<string, unknown>, of: 'node' | 'relation' = 'node'): Metamodel {
  const mm = builtInGovernanceMetamodel()
  const def = of === 'node' ? mm.nodeTypes[type] : mm.relationTypes[type]
  def.properties = [...(def.properties ?? []).filter((p) => p.key !== prop.key), prop as never]
  return mm
}

describe('a required property', () => {
  it('emptied to an empty list is missing (item 211)', () => {
    const mm = withProperty('container', { key: 'owners', label: 'Owners', type: 'ref', refType: 'person', multiple: true, required: true })
    const nodes = [node('alice', 'person'), node('api', 'container', { owners: [] }), node('web', 'container', { owners: ['alice'] })]
    expect(ids(nodes, [], mm, 'missing-prop')).toEqual(['missing-prop:api:owners'])
  })

  it('with a default is not missing: the default stands in, as the card shows it (item 225)', () => {
    const mm = builtInGovernanceMetamodel()
    const kind = mm.relationTypes.transition.properties!.find((p) => p.key === 'kind')!
    expect(kind.default).toBe('external')
    kind.required = true
    const machine = node('m', 'state-machine')
    const nodes = [machine, node('a', 'state', { parentId: 'm' }), node('b', 'state', { parentId: 'm' })]
    const relations: C4Relation[] = [{ id: 't', sourceId: 'a', targetId: 'b', relationType: 'transition' }]
    expect(ids(nodes, relations, mm, 'missing-prop')).toEqual([])
    // Without a default it is missing.
    delete kind.default
    expect(ids(nodes, relations, mm, 'missing-prop')).toEqual(['missing-prop:t:kind'])
  })
})

describe('a value the metamodel no longer takes', () => {
  it('an enum option removed while an element holds it is flagged (item 208)', () => {
    const mm = withProperty('container', { key: 'tier', label: 'Tier', type: 'enum', options: ['gold', 'bronze'] })
    const nodes = [node('api', 'container', { tier: 'silver' }), node('web', 'container', { tier: 'gold' }), node('db', 'container')]
    const issues = validateModel(byId(nodes), {}, mm).filter((i) => i.id.startsWith('bad-option'))
    expect(issues.map((i) => i.id)).toEqual(['bad-option:api:tier'])
    expect(issues[0].message).toBe('Container "api": "Tier" is "silver", which is not one of its options (gold, bronze).')
  })

  it('a reference switched from many to one that holds several is flagged', () => {
    const mm = withProperty('container', { key: 'owners', label: 'Owners', type: 'ref', refType: 'person' })
    const nodes = [node('alice', 'person'), node('bob', 'person'), node('api', 'container', { owners: ['alice', 'bob'] }), node('web', 'container', { owners: ['alice'] })]
    expect(ids(nodes, [], mm, 'many-refs')).toEqual(['many-refs:api:owners'])
  })
})

describe('a relation without a type', () => {
  it('is flagged where the metamodel has several types for its pair (D5)', () => {
    const mm = builtInGovernanceMetamodel()
    const nodes = [node('order', 'entity', { kind: 'aggregate-root' }), node('customer', 'entity', { kind: 'aggregate-root' }), node('shop', 'system'), node('user', 'person')]
    const relations: C4Relation[] = [
      { id: 'untyped', sourceId: 'order', targetId: 'customer' },
      { id: 'typed', sourceId: 'customer', targetId: 'order', relationType: 'references' },
      // One type fits: that one is meant.
      { id: 'uses', sourceId: 'user', targetId: 'shop' },
    ]
    const issues = validateModel(byId(nodes), byId(relations), mm).filter((i) => i.id.startsWith('untyped-rel'))
    expect(issues.map((i) => i.id)).toEqual(['untyped-rel:untyped'])
    expect(issues[0].message).toBe('Relation "order" → "customer" has no type; give it one of "Part of", "References".')
  })

  // Decided 2026-10-21 (runs 65 to 69): a type with no pairs fits every
  // pair, and counts as one of the types that fit (it was left out: an
  // untyped relation between two of the C4 types it shares went unflagged).
  const withAnyPair = (): Metamodel => {
    const mm = builtInC4Metamodel()
    mm.relationTypes.misc = { id: 'misc', label: 'Misc', allowedPairs: [] }
    return mm
  }

  it('is flagged where an any-pair type fits besides another', () => {
    const nodes = [node('shop', 'system'), node('user', 'person'), node('db', 'database')]
    const relations: C4Relation[] = [
      { id: 'two', sourceId: 'user', targetId: 'shop' },
      // Only the any-pair type fits: that one is meant.
      { id: 'one', sourceId: 'db', targetId: 'user' },
    ]
    const issues = validateModel(byId(nodes), byId(relations), withAnyPair()).filter((i) => i.id.startsWith('untyped-rel'))
    expect(issues.map((i) => i.id)).toEqual(['untyped-rel:two'])
    expect(issues[0].message).toBe('Relation "user" → "shop" has no type; give it one of "Interacts", "Misc".')
  })

  it('is given the one type that fits, an any-pair type included', () => {
    expect(inferRelationType(withAnyPair(), 'database', 'person')).toBe('misc')
    expect(inferRelationType(withAnyPair(), 'person', 'system')).toBeUndefined()
    expect(inferRelationType(builtInC4Metamodel(), 'person', 'system')).toBe('interacts')
  })
})
