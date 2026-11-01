import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'
import { builtInC4Metamodel } from '../src/metamodel/index'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  checkAddNode, checkAddRelation, checkNodeUpdate, checkPatchRelation, checkRemove, checkReparent, checkUnwrap,
  originModel, originOf, type ModelState,
} from '../src/model'
import { composeFederation, formatRefused, parseDeps, splitFederation, type FetchedDependency } from '../src/federation'

const node = (id: string, type: string, label: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label, collapsed: false, x: 0, y: 0, width: 200, height: 100, ...extra }) as C4Node
const rel = (id: string, sourceId: string, targetId: string, extra: Partial<C4Relation> = {}): C4Relation =>
  ({ id, sourceId, targetId, ...extra })

const COMMIT = 'abc1234def5678'
const metamodel = builtInC4Metamodel()

const payments = (): DiagramData => ({
  metamodel,
  nodes: [node('pay', 'system', 'Payments')],
  relations: [rel('r-own', 'pay', 'ord', { label: 'reads orders' })],
  views: [{ id: 'v1', name: 'Landscape', nodeIds: ['pay', 'ord'], positions: { ord: { x: 400, y: 0, width: 200, height: 100 } } }],
})

const orders = (): FetchedDependency => ({
  name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: COMMIT,
  data: {
    nodes: [
      node('ord', 'system', 'Orders', { description: 'Takes orders.' }),
      node('ord-api', 'container', 'Orders API', { parentId: 'ord' }),
      node('cust', 'person', 'Customer'),
    ],
    relations: [rel('r-dep', 'cust', 'ord', { label: 'orders' }), rel('r-far', 'ord', 'stock')],
  },
})

describe('federation', () => {
  it('reads deps.json and says what is wrong in it', () => {
    expect(parseDeps(JSON.stringify({ name: 'payments', dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main' }] })))
      .toEqual({ name: 'payments', dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main' }] })
    expect(parseDeps('{"name":"p","dependencies":[{"name":"o","repo":"r","ref":"v1"}]}').dependencies[0].path).toBe('.')
    expect(() => parseDeps('{')).toThrow('deps.json does not parse')
    expect(() => parseDeps('{"name":"p","dependencies":[{"name":"p","repo":"r","ref":"main"}]}')).toThrow('the name "p" is used twice')
    expect(() => parseDeps('{"name":"p","dependencies":[{"name":"o","repo":"r","path":"../x","ref":"main"}]}')).toThrow('"path" must be')
    expect(() => parseDeps('{"name":"p","dependencies":[{"name":"o","repo":"r","ref":"--upload-pack=x"}]}')).toThrow('"ref" must be')
  })

  it('composes the own model with the dependencies, marked with their origin', () => {
    const { data, notes } = composeFederation(payments(), [orders()])
    const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
    expect(originOf(byId.pay)).toBeUndefined()
    expect(byId.ord).toMatchObject({ label: 'Orders', origin: 'orders@abc1234', description: 'Takes orders.' })
    expect(byId['ord-api']).toMatchObject({ parentId: 'ord', origin: 'orders@abc1234' })
    expect(data.relations.map((r) => [r.id, r.origin])).toEqual([['r-own', undefined], ['r-dep', 'orders@abc1234']])
    expect(data.views).toEqual(payments().views)
    expect(data.metamodel).toBe(metamodel)
    expect(notes).toEqual(['orders: 1 relation to elements of models not composed here is left out.'])
    expect(originModel('orders@abc1234')).toBe('orders')
  })

  it('keeps an id two models have for the own model, and names it', () => {
    const own = payments()
    own.nodes.push(node('cust', 'person', 'Payer'))
    const { data, notes } = composeFederation(own, [orders()])
    expect(data.nodes.find((n) => n.id === 'cust')).toMatchObject({ label: 'Payer' })
    expect(notes[0]).toBe('orders: element "Customer" (cust) is left out: this model has an element with its id.')
  })

  it('splits the composed model: own changes go home, theirs are refused and named', () => {
    const composed = composeFederation(payments(), [orders()]).data
    const workspace = structuredClone(composed)
    const at = (id: string) => workspace.nodes.find((n) => n.id === id)!
    workspace.nodes.push(node('ledger', 'system', 'Ledger'))
    workspace.relations.push(rel('r-new', 'ledger', 'ord'))
    at('ord').label = 'Orders 2'
    at('cust').x = 900 // layout: free
    workspace.nodes = workspace.nodes.filter((n) => n.id !== 'ord-api')
    workspace.relations.find((r) => r.id === 'r-dep')!.label = 'buys'
    workspace.nodes.push(node('fake', 'person', 'Claimed', { origin: 'orders@abc1234' }))

    const { own, refused } = splitFederation(workspace, composed)
    expect(own.nodes.map((n) => n.id)).toEqual(['pay', 'ledger'])
    expect(own.relations.map((r) => r.id)).toEqual(['r-own', 'r-new'])
    expect(own.views).toEqual(workspace.views)
    expect(refused.map((r) => [r.kind, r.id, r.change])).toEqual([
      ['element', 'ord', 'changed'],
      ['element', 'fake', 'added'],
      ['relation', 'r-dep', 'changed'],
      ['element', 'ord-api', 'removed'],
    ])
    expect(refused[0].fields).toEqual([{ field: 'label', before: 'Orders', after: 'Orders 2' }])
    expect(formatRefused(refused)[0]).toBe('Kept out: the change to element "Orders" of orders@abc1234 (label); change it in that model\'s repository.')
    expect(formatRefused(refused)[3]).toBe('Kept: the deletion of element "Orders API" of orders@abc1234; delete it in that model\'s repository.')
  })

  it('splits an unchanged federation into the own model exactly', () => {
    const composed = composeFederation(payments(), [orders()]).data
    const { own, refused } = splitFederation(structuredClone(composed), composed)
    expect(refused).toEqual([])
    expect(own).toEqual(payments())
  })
})

describe('elements of other models are read-only', () => {
  const state = (): ModelState => {
    const { data } = composeFederation(payments(), [orders()])
    return {
      c4Nodes: Object.fromEntries(data.nodes.map((n) => [n.id, n])),
      c4Relations: Object.fromEntries(data.relations.map((r) => [r.id, r])),
      views: Object.fromEntries((data.views ?? []).map((v) => [v.id, v])),
      activeViewId: null,
      metamodel,
    }
  }
  const refusal = /^("Orders"|"Orders API"|"Customer"|The relation "Customer" → "Orders") belongs to the model orders \(orders@abc1234\): change it in that model's repository\.$/

  it('refuses a change, a rename, a move, a deletion and a child, naming the model', () => {
    const s = state()
    expect(checkNodeUpdate(s, 'ord', { description: 'Other.' })).toMatch(refusal)
    expect(checkNodeUpdate(s, 'ord', { label: 'Orders 2' })).toMatch(refusal)
    expect(checkNodeUpdate(s, 'ord-api', { parentId: undefined })).toMatch(refusal)
    expect(checkReparent(s, ['cust'], 'pay')).toMatch(refusal)
    expect(checkRemove(s, ['ord-api'])).toMatch(refusal)
    expect(checkRemove(s, [], ['r-dep'])).toMatch(refusal)
    expect(checkUnwrap(s, 'ord')).toMatch(refusal)
    expect(checkAddNode(s, node('x', 'container', 'Billing', { parentId: 'ord' }))).toBe('Cannot put anything inside "Orders": it belongs to the model orders (orders@abc1234).')
    expect(checkPatchRelation(s, 'r-dep', { label: 'buys' })).toMatch(refusal)
    expect(checkPatchRelation(s, 'r-dep', { targetId: 'pay' })).toMatch(refusal)
  })

  it('allows layout, own relations to them and own elements', () => {
    const s = state()
    expect(checkNodeUpdate(s, 'ord', { x: 300, y: 40, width: 260, collapsed: true })).toBeNull()
    expect(checkNodeUpdate(s, 'ord', { label: 'Orders' })).toBeNull() // no change
    expect(checkAddRelation(s, { sourceId: 'pay', targetId: 'ord' })).toBeNull()
    expect(checkPatchRelation(s, 'r-own', { label: 'reads' })).toBeNull()
    expect(checkRemove(s, ['pay'], ['r-own'])).toBeNull()
    expect(checkNodeUpdate(s, 'pay', { label: 'Payments 2' })).toBeNull()
  })

  it('refuses an own element taking or losing an origin', () => {
    const s = state()
    expect(checkNodeUpdate(s, 'pay', { origin: 'orders@abc1234' })).toBe('An element\'s origin is set by radical federation, not by an edit.')
    expect(checkAddNode(s, node('y', 'person', 'Payer', { origin: 'orders@abc1234' }))).toBe('An element\'s origin is set by radical federation, not by an edit.')
    expect(checkAddRelation(s, { sourceId: 'pay', targetId: 'ord', origin: 'orders@abc1234' })).toBe('A relation\'s origin is set by radical federation, not by an edit.')
  })

  it('refuses through the model facade the MCP server edits with', () => {
    const { data } = composeFederation(payments(), [orders()])
    const f = createModelFacade(data, { newId: () => 'new' })
    f.removeNode('cust')
    expect(f.lastError).toMatch(refusal)
    expect(f.getNodes().cust).toBeDefined()
    f.removeRelation('r-dep')
    expect(f.getRelations()['r-dep']).toBeDefined()
    f.updateNode('ord', { label: 'Orders 2' })
    expect(f.getNodes().ord.label).toBe('Orders')
    f.moveNodes!(['ord-api'], null)
    expect(f.getNodes()['ord-api'].parentId).toBe('ord')
    f.updateNode('ord', { x: 500 })
    expect(f.getNodes().ord.x).toBe(500)
  })
})
