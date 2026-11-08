import { describe, expect, it } from 'vitest'
import { scoreModel } from '../bench/score'

describe("radical assay: an agent's model on the bench", () => {
  it('scores the units its elements are built from, its relations as calls and its entities as tables, naming what it missed', () => {
    const expected = { name: 'shop', units: ['web', 'api'], calls: [['web', 'api'], ['api', 'db:Shop.mdb']] as Array<[string, string]>, optional: [], tables: ['orders', 'customers'] }
    const nodes = [
      { id: 'n-web', type: 'webapp', label: 'Web' }, { id: 'n-db', type: 'database', label: 'Shop DB' },
      { id: 'n-sys', type: 'system', label: 'Shop' }, { id: 'n-order', type: 'entity', label: 'Order' },
    ]
    const relations = [
      { sourceId: 'n-web', targetId: 'n-db', relationType: 'interacts' },
      // A system holding the web application calls nothing.
      { sourceId: 'n-sys', targetId: 'n-web', relationType: 'contains' },
    ]
    const written = [
      { id: 'n-web', kind: 'element', facts: ['shop:unit:web'] },
      { id: 'n-db', kind: 'element', facts: ['shop:db:api:Access/shop.mdb'] },
      { id: 'n-sys', kind: 'element', facts: ['shop:unit:web', 'shop:unit:api'] },
      { id: 'n-order', kind: 'entity', facts: ['shop:table:api:orders'] },
    ]
    expect(scoreModel(expected, nodes, relations, written)).toEqual({
      units: { found: 1, expected: 2, read: 1, missed: ['api'], extra: [] },
      calls: { right: 0, expected: 2, wrong: ['web → db:shop.mdb'], missed: ['web → api', 'api → db:shop.mdb'] },
      tables: { found: 1, expected: 2, missed: ['customers'] },
    })
  })
})
