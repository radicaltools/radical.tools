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

  it('scores a relation to an element resting on a deployed service as a call of the unit it runs, else of the service', () => {
    const expected = { name: 'piggy', units: ['account', 'mongodb'], calls: [['account', 'service:rabbitmq'], ['account', 'mongodb']] as Array<[string, string]>, optional: [] }
    const nodes = [{ id: 'n-account', type: 'container', label: 'Account' }, { id: 'n-mq', type: 'queue', label: 'RabbitMQ' }, { id: 'n-db', type: 'database', label: 'Account DB' }]
    const relations = [{ sourceId: 'n-account', targetId: 'n-mq', relationType: 'interacts' }, { sourceId: 'n-account', targetId: 'n-db', relationType: 'interacts' }]
    const written = [
      { id: 'n-account', kind: 'element', facts: ['piggy:unit:account'] },
      { id: 'n-mq', kind: 'element', facts: ['piggy:service:rabbitmq'] },
      { id: 'n-db', kind: 'element', facts: ['piggy:service:account-mongodb'] },
    ]
    const services = { 'piggy:service:rabbitmq': { name: 'rabbitmq' }, 'piggy:service:account-mongodb': { name: 'account-mongodb', unit: 'piggy:unit:mongodb' } }
    expect(scoreModel(expected, nodes, relations, written, services).calls).toEqual({ right: 2, expected: 2, wrong: [], missed: [] })
  })

  it('scores a library bundled into a container as the container calling the library', () => {
    const expected = { name: 'pitstop', units: ['src/Invoice', 'src/Messaging'], calls: [['src/Invoice', 'src/Messaging']] as Array<[string, string]>, optional: [] }
    const nodes = [{ id: 'n-invoice', type: 'container', label: 'Invoice' }, { id: 'n-lib', type: 'component', label: 'Messaging' }]
    const relations = [{ sourceId: 'n-lib', targetId: 'n-invoice', relationType: 'interacts', label: 'bundled into' }]
    // Drawn the other way, it is the same dependency.
    const drawnBack = [{ sourceId: 'n-invoice', targetId: 'n-lib', relationType: 'interacts', label: 'bundled into' }]
    expect(scoreModel(expected, nodes, drawnBack, [{ id: 'n-invoice', kind: 'element', facts: ['pitstop:unit:src/Invoice'] }, { id: 'n-lib', kind: 'element', facts: ['pitstop:unit:src/Messaging'] }]).calls).toEqual({ right: 1, expected: 1, wrong: [], missed: [] })
    const written = [{ id: 'n-invoice', kind: 'element', facts: ['pitstop:unit:src/Invoice'] }, { id: 'n-lib', kind: 'element', facts: ['pitstop:unit:src/Messaging'] }]
    expect(scoreModel(expected, nodes, relations, written).calls).toEqual({ right: 1, expected: 1, wrong: [], missed: [] })
  })
})
