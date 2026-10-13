import { describe, it, expect } from 'vitest'
import { checkAddRelation, checkNodeUpdate, checkPatchRelation, patchNode, patchRelation, type ModelState } from '../src/model'
import { builtInGovernanceMetamodel, validateModel } from '../src/metamodel'
import type { C4Node } from '../src/c4'

const node = (id: string, type: string): C4Node =>
  ({ id, type, label: id, description: '', x: 0, y: 0, width: 100, height: 60, collapsed: false }) as C4Node

function state(): ModelState {
  return {
    c4Nodes: {
      user: node('user', 'person'),
      admin: node('admin', 'person'),
      shop: node('shop', 'system'),
      adrOld: node('adrOld', 'adr'),
      adrNew: node('adrNew', 'adr'),
    },
    c4Relations: {
      uses: { id: 'uses', sourceId: 'user', targetId: 'shop', relationType: 'interacts' },
      rule: { id: 'rule', sourceId: 'adrNew', targetId: 'shop', relationType: 'constrains' },
    },
    views: {},
    activeViewId: null,
    metamodel: builtInGovernanceMetamodel(),
  }
}

describe('moving a relation end', () => {
  it('refuses a pair the metamodel does not allow', () => {
    expect(checkPatchRelation(state(), 'uses', { targetId: 'admin' })).toMatch(/Relation not allowed: Person → Person/)
  })

  it('allows an allowed pair and ignores updates that keep both ends', () => {
    const s = state()
    expect(checkPatchRelation(s, 'uses', { sourceId: 'admin' })).toBeNull()
    expect(checkPatchRelation(s, 'uses', { label: 'buys from' })).toBeNull()
  })

  it('infers the relation type again when the old one no longer fits', () => {
    const s = state()
    patchRelation(s, 'rule', { targetId: 'adrOld' })
    expect(s.c4Relations.rule).toMatchObject({ targetId: 'adrOld', relationType: 'supersedes' })
  })

  it('keeps a relation type that still fits', () => {
    const s = state()
    patchRelation(s, 'uses', { sourceId: 'admin' })
    expect(s.c4Relations.uses.relationType).toBe('interacts')
  })
})

// A relation that names its type is one its type has between its ends. The
// check asked only whether any type has the pair, so a relation could be
// given a type add_relation refuses for it (person → system "constrains",
// system → system "transition"), and the validation did not see it.
describe('a relation and its own type', () => {
  it('cannot be given a type that does not have its pair', () => {
    const s = state()
    expect(checkPatchRelation(s, 'uses', { relationType: 'constrains' })).toMatch(/"Constrains" does not connect Person → Software System/)
    expect(checkPatchRelation(s, 'uses', { relationType: 'transition' })).toMatch(/does not connect/)
    // The type it has, and a change that leaves the type alone, are fine.
    expect(checkPatchRelation(s, 'uses', { relationType: 'interacts' })).toBeNull()
    expect(checkPatchRelation(s, 'uses', { label: 'buys', relationType: undefined })).toBeNull()
  })

  it('cannot be added with a type that does not have its pair', () => {
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop', relationType: 'constrains' })).toMatch(/does not connect/)
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop', relationType: 'interacts' })).toBeNull()
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop' })).toBeNull()
  })

  it('is flagged by the validation when a model has one', () => {
    const s = state()
    s.c4Relations.uses.relationType = 'constrains'
    const issues = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!)
    expect(issues.filter((i) => i.relationId === 'uses').map((i) => i.id)).toEqual(['bad-rel-type:uses'])
    expect(validateModel(state().c4Nodes, state().c4Relations, state().metamodel!).some((i) => i.id.startsWith('bad-rel'))).toBe(false)
  })
})

describe('retyping an element that has relations', () => {
  it('is refused when one of them has no place between the new pair', () => {
    // person → system exists; adr → system "interacts" does not, but adr →
    // system "constrains" does, so the relation stays and changes type.
    const s = state()
    expect(checkNodeUpdate(s, 'user', { type: 'adr' } as never)).toBeNull()
    // Nothing connects a scenario to a system.
    expect(checkNodeUpdate(s, 'user', { type: 'scenario' } as never)).toMatch(/Cannot change "user" to Scenario: its relation to "shop"/)
  })

  it('gives its relations the type that has the new pair', () => {
    const s = state()
    patchNode(s, 'user', { type: 'adr' } as never)
    expect(s.c4Relations.uses.relationType).toBe('constrains')
    expect(validateModel(s.c4Nodes, s.c4Relations, s.metamodel!).some((i) => i.id.startsWith('bad-rel'))).toBe(false)
  })
})
