import { describe, it, expect } from 'vitest'
import { keepOtherModelsPlaces, viewCanvasPositions, type C4Node, type C4Relation, type DiagramData, type DiagramView } from '../src/c4'
import { builtInC4Metamodel } from '../src/metamodel/index'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  checkAddNode, checkAddRelation, checkNodeUpdate, checkPatchRelation, checkRemove, checkReparent, checkUnwrap,
  copyOtherModelView, originModel, originOf, ownModel, viewRefusal, type ModelState,
} from '../src/model'
import { composeFederation, otherModelView, otherModelsAt, parseDeps, parseFederationFile, serializeFederationFile, withOtherModels, type FetchedDependency } from '../src/federation'
import { viewShownNodes } from '../src/viewPipeline'
import { serializeToMdFolder } from '../src/formats/mdFolder'

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

  it("adds the fetched models to the model read from the folder, at the places its layout keeps", () => {
    const fetched = composeFederation(payments(), [orders()]).data
    const file = parseFederationFile(serializeFederationFile({
      version: 2, name: 'payments', fetchedAt: '2026-11-01T10:00:00Z', notes: [],
      dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: COMMIT }],
      nodes: fetched.nodes.filter((n) => originOf(n)), relations: fetched.relations.filter((r) => originOf(r)),
    }))!
    const own = { ...payments(), defaultPositions: { ord: { x: 640, y: 80, width: 200, height: 100 } } }
    const data = withOtherModels(own, file)
    expect(data.nodes.map((n) => [n.id, originOf(n) ?? null])).toEqual([['pay', null], ['ord', 'orders@abc1234'], ['ord-api', 'orders@abc1234'], ['cust', 'orders@abc1234']])
    expect(data.nodes.find((n) => n.id === 'ord')).toMatchObject({ x: 640, y: 80 })
    expect(data.relations.map((r) => r.id)).toEqual(['r-own', 'r-dep'])
    // An own element wins over one fetched with its id.
    expect(withOtherModels({ ...own, nodes: [...own.nodes, node('cust', 'person', 'Payer')] }, file).nodes.filter((n) => n.id === 'cust')).toEqual([node('cust', 'person', 'Payer')])
    expect(parseFederationFile('{"version":1}')).toBeNull()
    expect(parseFederationFile('not json')).toBeNull()
  })

  it('never writes another model\'s element into the model folder, nor into a milestone', () => {
    const data = composeFederation(payments(), [orders()]).data
    data.snapshots = [{ id: 's1', name: 'As-is', timestamp: 1, nodes: Object.fromEntries(data.nodes.map((n) => [n.id, n])), relations: Object.fromEntries(data.relations.map((r) => [r.id, r])) }]
    const own = ownModel(data)
    expect(own.nodes.map((n) => n.id)).toEqual(['pay'])
    expect(own.relations.map((r) => r.id)).toEqual(['r-own'])
    expect(Object.keys(own.snapshots![0].nodes)).toEqual(['pay'])
    // A slide's own copy of the model keeps only the model's own too.
    const slides = ownModel({ ...data, presentations: [{ id: 'p1', name: 'Deck', slides: [{ id: 'sl1', name: 'One', snapshotId: null, viewId: null, modelSnapshot: { nodes: Object.fromEntries(data.nodes.map((n) => [n.id, n])), relations: {} } }] }] } as unknown as DiagramData)
    expect(Object.keys(slides.presentations![0].slides[0].modelSnapshot!.nodes)).toEqual(['pay'])
    const files = serializeToMdFolder(data, 'payments')
    expect(Object.keys(files).filter((path) => path.startsWith('nodes/'))).toEqual(['nodes/payments/_index.md'])
    expect(files['relations.json']).not.toContain('r-dep')
    expect(files['snapshots.json']).not.toContain('orders@')
    // The views keep what they show of them, and where.
    expect(JSON.parse(files['views.json'])[0]).toMatchObject({ nodeIds: ['pay', 'ord'], positions: { ord: { x: 400 } } })
    // A model with nothing of theirs is the same object.
    const plain = payments()
    expect(ownModel(plain)).toBe(plain)
  })

  it("keeps the places of another model's elements where nothing was fetched", () => {
    // Payments opened on a fresh clone: Orders, listed and related to, is no element here.
    const own = payments()
    const nodes = Object.fromEntries(own.nodes.map((n) => [n.id, n]))
    const view = own.views![0]
    expect(viewCanvasPositions(view, nodes, { pay: { x: 0, y: 0, width: 200, height: 100 } })).toEqual({
      pay: { x: 0, y: 0, width: 200, height: 100 },
      ord: { x: 400, y: 0, width: 200, height: 100 },
    })
    const previous = { pay: { x: 0, y: 0, width: 200, height: 100 }, ord: { x: 640, y: 80, width: 200, height: 100 }, gone: { x: 9, y: 9, width: 1, height: 1 } }
    const next = { pay: { x: 10, y: 0, width: 200, height: 100 } }
    expect(keepOtherModelsPlaces(next, previous, nodes, own.relations, own.views!)).toEqual({ ...next, ord: previous.ord })
    expect(keepOtherModelsPlaces(next, undefined, nodes, own.relations, own.views!)).toBe(next)
  })

  it("brings another model's views into a folder of its name, showing only that model's elements", () => {
    const at = (model: string) => `${model}@abc1234`
    const containers = (id: string) => ({ id, name: 'Containers', folder: 'Logical', nodeIds: [], positions: {}, pipeline: { levels: [{ filter: { kind: 'type', types: ['container'] } }] } }) as unknown as DiagramView
    const file = parseFederationFile(serializeFederationFile({
      version: 2, name: 'payments', fetchedAt: '2026-11-01T10:00:00Z', notes: [],
      dependencies: [
        { name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: COMMIT, dependsOn: ['stock'] },
        { name: 'billing', repo: '../billing', path: 'architecture', ref: 'main', commit: COMMIT },
        { name: 'stock', repo: '../stock', path: 'architecture', ref: 'main', commit: COMMIT, via: 'orders' },
      ],
      nodes: [
        node('ord-api', 'container', 'Orders API', { origin: at('orders') }),
        node('stock-api', 'container', 'Stock API', { origin: at('stock') }),
        node('bill-api', 'container', 'Billing API', { origin: at('billing') }),
      ],
      relations: [],
      views: [otherModelView(containers('v-ord'), at('orders'))!, otherModelView(containers('v-bill'), at('billing'))!, otherModelView({ id: 'v-x', name: 'Explore', nodeIds: [], positions: {}, kind: 'explore' }, at('orders'))].filter(Boolean) as DiagramView[],
    }))!
    const own = { ...payments(), nodes: [...payments().nodes, node('pay-api', 'container', 'Payments API', { parentId: 'pay' })], views: [{ id: 'v-own', name: 'Containers', nodeIds: [], positions: {} } as DiagramView] }
    const data = withOtherModels(own, file)
    expect(data.views!.map((v) => [v.name, v.folder ?? null, v.origin ?? null])).toEqual([
      ['Containers', null, null],
      ['Containers', 'orders/Logical', 'orders@abc1234'],
      ['Containers', 'billing/Logical', 'billing@abc1234'],
    ])
    const nodes = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
    const relations = Object.fromEntries(data.relations.map((r) => [r.id, r]))
    // orders' view: its containers and those of stock, which it depends on; none of payments' or billing's.
    expect([...viewShownNodes(data.views![1], nodes, relations)!].sort()).toEqual(['ord-api', 'stock-api'])
    expect([...viewShownNodes(data.views![2], nodes, relations)!]).toEqual(['bill-api'])
    // A change to it is refused, naming its model; the model's own view is not.
    expect(viewRefusal(data.views![1])).toBe('The view "Containers" belongs to the model orders (orders@abc1234): change it in that model\'s repository, or copy it into this model to change the copy.')
    expect(viewRefusal(data.views![0])).toBeNull()
    // Nothing of theirs is saved.
    expect(JSON.parse(serializeToMdFolder(data, 'payments')['views.json']).map((v: DiagramView) => v.id)).toEqual(['v-own'])
  })

  it("copies another model's view into the model, named apart when the name is taken", () => {
    const theirs = { id: 'v-ord', name: 'Containers', folder: 'orders/Logical', origin: 'orders@abc1234', originScope: ['orders'], nodeIds: ['ord'], positions: { ord: { x: 1, y: 2, width: 200, height: 100 } } } as DiagramView
    const views: Record<string, DiagramView> = { 'v-own': { id: 'v-own', name: 'Containers', nodeIds: [], positions: {} }, 'v-ord': theirs }
    expect(copyOtherModelView({ views }, 'v-ord', 'copy1')).toEqual({ name: 'Containers (orders)' })
    expect(views.copy1).toEqual({ id: 'copy1', name: 'Containers (orders)', folder: 'Logical', nodeIds: ['ord'], positions: { ord: { x: 1, y: 2, width: 200, height: 100 } } })
    expect(copyOtherModelView({ views }, 'v-ord', 'copy2')).toEqual({ name: 'Containers (orders 2)' })
    expect(copyOtherModelView({ views }, 'v-own', 'copy3')).toEqual({ refused: 'Only another model\'s view is copied into the model.' })
    // The copy is the model's own: saved with it, and the original stays as it was.
    expect(viewRefusal(views.copy1)).toBeNull()
    expect(views['v-ord']).toBe(theirs)
  })

  it("a milestone keeps the commits of the other models and only the model's own elements", () => {
    const fetched = composeFederation(payments(), [orders()]).data
    const file = parseFederationFile(serializeFederationFile({
      version: 2, name: 'payments', fetchedAt: '2026-11-01T10:00:00Z', notes: [],
      dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: COMMIT }],
      nodes: fetched.nodes.filter((n) => originOf(n)), relations: fetched.relations.filter((r) => originOf(r)),
    }))!
    const facade = createModelFacade(withOtherModels(payments(), file))
    facade.createMilestone!('As-is')
    const milestone = facade.toDiagramData().snapshots![0]
    expect(Object.keys(milestone.nodes)).toEqual(['pay'])
    expect(Object.keys(milestone.relations)).toEqual(['r-own'])
    expect(milestone.otherModels).toEqual([{ name: 'orders', commit: COMMIT }])
    expect(serializeToMdFolder(facade.toDiagramData(), 'payments')['snapshots.json']).not.toContain('Orders API')

    // Shown: at the commit it keeps, from the current fetch or one kept for milestones.
    expect(otherModelsAt(file, milestone.otherModels).nodes.map((n) => n.id)).toEqual(['ord', 'ord-api', 'cust'])
    const older = { name: 'orders', commit: 'fff0000aaaa1111' }
    const moved = { ...file, atCommits: { 'orders@fff0000': { nodes: [node('ord', 'system', 'Old Orders', { origin: 'orders@fff0000' })], relations: [] } } }
    expect(otherModelsAt(moved, [older]).nodes.map((n) => n.label)).toEqual(['Old Orders'])
    expect(otherModelsAt(file, [older])).toEqual({ nodes: [], relations: [], missing: [older] })
    // A milestone made before keeps no versions: the other models as fetched now.
    expect(otherModelsAt(file, undefined).nodes).toHaveLength(3)
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
