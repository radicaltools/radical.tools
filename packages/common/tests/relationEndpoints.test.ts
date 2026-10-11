import { describe, it, expect } from 'vitest'
import { checkPatchRelation, patchRelation, type ModelState } from '../src/model'
import { builtInGovernanceMetamodel } from '../src/metamodel'
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
