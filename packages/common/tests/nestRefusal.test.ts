/**
 * Where elements may be moved into: one rule for the card's Parent field
 * (parentCandidates) and the canvas's special key, Move to… (nestRefusal).
 * The special key offered "inside" on an external system, and on a group
 * where the move was then refused (F-0038).
 */
import { describe, it, expect } from 'vitest'
import { checkReparent, nestRefusal, parentCandidates, reparentNodes, type ModelState } from '../src/model'
import { builtInC4Metamodel } from '../src/metamodel'
import type { C4Node } from '../src/c4'

const node = (id: string, type: string, props: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, description: '', x: 0, y: 0, width: 100, height: 60, collapsed: false, ...props }) as C4Node

function bookstore(): ModelState {
  return {
    c4Nodes: {
      shop: node('shop', 'system'),
      front: node('front', 'group', { parentId: 'shop' }),
      web: node('web', 'webapp', { parentId: 'front' }),
      api: node('api', 'container', { parentId: 'shop' }),
      bank: node('bank', 'system', { external: true }),
      zone: node('zone', 'group'),
      other: node('other', 'system'),
      shoppers: node('shoppers', 'group'),
      customer: node('customer', 'person', { parentId: 'shoppers' }),
    },
    c4Relations: {},
    views: {},
    activeViewId: null,
    metamodel: builtInC4Metamodel(),
  }
}

describe('where elements may be nested (nestRefusal)', () => {
  it('refuses an external element, as the card does', () => {
    const s = bookstore()
    expect(nestRefusal(s, ['api'], 'bank')).toMatch(/Cannot place Container "api" inside Software System "bank": it is external/)
    expect(parentCandidates(s, 'api').map((n) => n.id)).not.toContain('bank')
    expect(nestRefusal(s, ['api'], 'other')).toBeNull()
  })

  it('refuses a group whose contents would have no place there', () => {
    const s = bookstore()
    expect(nestRefusal(s, ['front'], 'zone')).toMatch(/Cannot move Group "front" there: its Web App "web" would have no place/)
    expect(parentCandidates(s, 'front').map((n) => n.id)).not.toContain('zone')
  })

  it('takes elements of different parents, each checked with its siblings', () => {
    const s = bookstore()
    expect(nestRefusal(s, ['web', 'api'], 'other')).toBeNull()
    // The top of the model: a person may stand there, a container may not.
    expect(nestRefusal(s, ['customer'], null)).toBeNull()
    expect(nestRefusal(s, ['customer', 'api'], null)).toMatch(/Cannot place Container "api" inside the canvas root\. Allowed parents: Software System, Group\./)
  })

  it('leaves out those already there', () => {
    const s = bookstore()
    expect(nestRefusal(s, ['api'], 'shop')).toBeNull()
    expect(nestRefusal(s, ['web', 'api'], 'shop')).toBeNull()
  })

  it('gives the card the same list as before: every parent it takes, and the one it is in', () => {
    const s = bookstore()
    expect(parentCandidates(s, 'api').map((n) => n.id).sort()).toEqual(['front', 'other', 'shop'])
    // The external element it is in already stays on the list.
    s.c4Nodes.api.parentId = 'bank'
    expect(parentCandidates(s, 'api').map((n) => n.id)).toContain('bank')
  })
})

describe('a move into an external element (checkReparent)', () => {
  it('is refused by the engine too, so the store and move_node refuse what the card does not offer', () => {
    const s = bookstore()
    expect(checkReparent(s, ['api'], 'bank')).toMatch(/Cannot place Container "api" inside Software System "bank": it is external/)
    expect(checkReparent(s, ['api'], 'other')).toBeNull()
  })

  it('leaves what an external element already holds where it is', () => {
    const s = bookstore()
    s.c4Nodes.gateway = node('gateway', 'container', { parentId: 'bank' })
    expect(checkReparent(s, ['gateway'], 'bank')).toBeNull()
    reparentNodes(s, ['gateway'], 'bank')
    expect(s.c4Nodes.gateway.parentId).toBe('bank')
  })
})

