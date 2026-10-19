import { describe, it, expect } from 'vitest'
import { buildMetamodelMessage } from '../src/ai/metamodelContext'
import { createModelFacade } from '../src/ai/modelFacade'
import { runTool } from '../src/ai/tools/index'
import type { ToolRunContext } from '../src/ai/tools/types'
import type { C4Node, C4Relation, DiagramView, ViewPipeline } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel, type Metamodel } from '../src/metamodel/index'
import * as model from '../src/model'
import { pipelineOf, runPipeline } from '../src/viewPipeline'
import { radicalViewpoints } from '../src/metamodel/presets/viewpoints'
import {
  UNGROUPED_VIEWPOINTS, viewpointGroups, chainOfViewpoint, chainSummary, newViewName, newViewpointId, sameChain, saveAsViewpoint, subjectViewName, viewpointsOf, withViewpoint, withoutViewpoint,
} from '../src/viewpoints'

const needs: ViewPipeline = {
  levels: [
    { ways: [{ types: ['need'] }] },
    { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
  ],
}

function stateWith(metamodel: Metamodel, views: DiagramView[] = []): model.ModelState {
  return { c4Nodes: {}, c4Relations: {}, views: Object.fromEntries(views.map((v) => [v.id, v])), activeViewId: null, metamodel }
}

const el = (id: string, type: string, label: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 160, height: 80, collapsed: false, ...extra }) as C4Node

const rel = (id: string, sourceId: string, targetId: string, relationType: string): C4Relation =>
  ({ id, sourceId, targetId, relationType }) as C4Relation

/** A Radical model holding `nodes` and `relations`. */
function modelOf(nodes: C4Node[], relations: C4Relation[] = []): model.ModelState {
  const state = stateWith(builtInGovernanceMetamodel())
  for (const n of nodes) state.c4Nodes[n.id] = n
  for (const r of relations) state.c4Relations[r.id] = r
  return state
}

/** The ids the view shows, sorted. */
function shownIds(state: model.ModelState, viewId: string): string[] {
  return runPipeline(state.views[viewId], { nodes: state.c4Nodes, relations: state.c4Relations, metamodel: state.metamodel! }).nodes.map((n) => n.id).sort()
}

describe('viewpoints', () => {
  it('come with both presets, grouped by concern: all of them with Radical, the C4 ones with C4', () => {
    const radical = viewpointsOf(builtInGovernanceMetamodel())
    expect(viewpointGroups(radical).map((g) => [g.group, g.viewpoints.length])).toEqual([['C4', 6], ['Domain', 4], ['Requirements', 5], ['Decisions', 3], ['UX', 2], ['States', 3], ['Process', 2]])
    expect(radical.find((v) => v.id === 'traceability')).toMatchObject({ kind: 'table', group: 'Requirements' })
    expect(viewpointsOf(builtInC4Metamodel()).map((v) => v.id)).toEqual(['system-context', 'containers', 'system-containers', 'components', 'container-components', 'container-dependencies'])
  })

  it('stay with a document on a preset when the preset is swapped in on load', () => {
    const saved = saveAsViewpoint(builtInGovernanceMetamodel(), 'Needs', 'wiki', needs).metamodel
    const loaded = model.documentMetamodel(JSON.parse(JSON.stringify(saved)))
    expect(viewpointsOf(loaded).map((t) => t.label)).toEqual([...radicalViewpoints().map((v) => v.label), 'Needs'])
    expect(viewpointGroups(viewpointsOf(loaded)).at(-1)).toMatchObject({ group: UNGROUPED_VIEWPOINTS, viewpoints: [expect.objectContaining({ label: 'Needs' })] })
    // Deleting one of the preset's keeps it deleted after loading too.
    expect(viewpointsOf(model.documentMetamodel(withoutViewpoint(loaded, 'traceability'))).map((t) => t.id)).not.toContain('traceability')
    // A document saved with an older preset's list gets the viewpoints the
    // preset has gained, and keeps its own changes to the others.
    const older = { ...builtInGovernanceMetamodel(), viewpoints: viewpointsOf(builtInGovernanceMetamodel()).filter((v) => v.id === 'traceability').map((v) => ({ ...v, description: 'Ours' })) }
    const reloaded = viewpointsOf(model.documentMetamodel(JSON.parse(JSON.stringify(older))))
    expect(reloaded.map((v) => v.id)).toEqual(radicalViewpoints().map((v) => v.id))
    expect(reloaded.find((v) => v.id === 'traceability')!.description).toBe('Ours')
    // A document saved before viewpoints gets the preset's.
    const { viewpoints: _none, ...none } = builtInGovernanceMetamodel()
    expect(viewpointsOf(model.documentMetamodel(none))).toHaveLength(radicalViewpoints().length)
  })

  it('make a view one of them, and the view follows the viewpoint when it changes', () => {
    const state = stateWith(builtInGovernanceMetamodel(), [{ id: 'v', name: 'V', nodeIds: [], positions: {} }])
    expect(model.applyViewpoint(state, 'v', 'traceability')).toBe(true)
    expect(state.views.v).toMatchObject({ viewpoint: 'traceability', kind: 'table' })
    expect(pipelineOf(state.views.v)!.levels).toHaveLength(3)
    // Its own copy: changing it does not change the viewpoint.
    state.views.v.pipeline!.levels!.pop()
    expect(viewpointsOf(state.metamodel).find((v) => v.id === 'traceability')!.pipeline.levels).toHaveLength(3)

    // The viewpoint changes: the view follows.
    const type = viewpointsOf(state.metamodel).find((v) => v.id === 'traceability')!
    state.metamodel = withViewpoint(state.metamodel!, { ...type, kind: 'wiki', pipeline: needs })
    expect(model.syncViewpoints(state)).toEqual(['v'])
    expect(state.views.v.kind).toBe('wiki')
    expect(sameChain(state.views.v.pipeline, needs)).toBe(true)
    expect(model.syncViewpoints(state)).toEqual([])

    // The viewpoint is deleted: the view keeps its kind and chain, of no viewpoint.
    state.metamodel = withoutViewpoint(state.metamodel!, 'traceability')
    expect(model.syncViewpoints(state)).toEqual(['v'])
    expect(state.views.v.viewpoint).toBeUndefined()
    expect(state.views.v.kind).toBe('wiki')
  })

  it('are left by a view whose kind or chain is set by hand', () => {
    const state = stateWith(builtInGovernanceMetamodel(), [{ id: 'a', name: 'A', nodeIds: [], positions: {} }, { id: 'b', name: 'B', nodeIds: [], positions: {} }])
    model.applyViewpoint(state, 'a', 'decisions')
    model.applyViewpoint(state, 'b', 'decisions')
    model.setViewKind(state, 'a', 'wiki')
    model.setViewPipeline(state, 'b', needs)
    expect(state.views.a.viewpoint).toBeUndefined()
    expect(state.views.b.viewpoint).toBeUndefined()
  })

  it('are saved from a view under a new name, or replace the viewpoint of that name', () => {
    const first = saveAsViewpoint(builtInGovernanceMetamodel(), 'Needs', 'table', needs)
    const again = saveAsViewpoint(first.metamodel, ' needs ', 'wiki', { ...needs, sort: { by: 'label' } })
    expect(again.type.id).toBe(first.type.id)
    expect(viewpointsOf(again.metamodel).filter((t) => t.id === 'needs')).toEqual([expect.objectContaining({ kind: 'wiki', pipeline: { ...needs, sort: { by: 'label' } } })])
    expect(newViewpointId('Needs', viewpointsOf(again.metamodel))).toBe('needs-2')
    expect(newViewpointId('Żółć & co.', [])).toBe('zolc-co')
  })

  it('name a new view after the viewpoint, and say their chain in words', () => {
    const metamodel = builtInGovernanceMetamodel()
    const traceability = viewpointsOf(metamodel).find((v) => v.id === 'traceability')!
    expect(newViewName(traceability, { x: { id: 'x', name: 'Traceability', nodeIds: [], positions: {} } })).toBe('Traceability 2')
    expect(chainSummary(chainOfViewpoint(traceability), { nodes: {}, relations: {}, metamodel }))
      .toBe('Need → Refined into → Requirement → Verified by → Scenario')
  })
})

describe('built-in viewpoints', () => {
  it('name only the types, relations and properties their metamodel has', () => {
    for (const metamodel of [builtInGovernanceMetamodel(), builtInC4Metamodel()]) {
      const properties = new Set(Object.values(metamodel.nodeTypes).flatMap((t) => (t.properties ?? []).map((p) => p.key)))
      for (const v of viewpointsOf(metamodel)) {
        const where = `${metamodel.id} › ${v.id}`
        expect(v.pipeline.levels?.length, where).toBeGreaterThan(0)
        for (const level of v.pipeline.levels!) {
          for (const way of level.ways) {
            for (const t of way.types ?? []) expect(metamodel.nodeTypes[t], `${where}: type ${t}`).toBeDefined()
            if (way.via && 'relationType' in way.via) expect(metamodel.relationTypes[way.via.relationType], `${where}: ${way.via.relationType}`).toBeDefined()
          }
          for (const f of level.filters ?? []) if (f.kind === 'relation') expect(metamodel.relationTypes[f.relationType], `${where}: ${f.relationType}`).toBeDefined()
        }
        if (v.pipeline.sort?.by === 'property') expect(properties.has(v.pipeline.sort.key!), `${where}: sort ${v.pipeline.sort.key}`).toBe(true)
        for (const t of v.subject?.types ?? []) expect(metamodel.nodeTypes[t], `${where}: subject ${t}`).toBeDefined()
        // What a view of it holds is the chain as the view reads it.
        expect(sameChain(chainOfViewpoint(v), v.pipeline), where).toBe(true)
      }
    }
  })
})

describe('built-in viewpoints of one element', () => {
  it('draw one state machine, process, system, container and domain', () => {
    const state = modelOf([
      el('user', 'person', 'Customer'),
      el('shop', 'system', 'Shop'), el('web', 'webapp', 'Web', { parentId: 'shop' }), el('api', 'container', 'API', { parentId: 'shop' }), el('db', 'database', 'DB', { parentId: 'shop' }),
      el('c1', 'component', 'Orders', { parentId: 'api' }), el('c2', 'component', 'Prices', { parentId: 'api' }),
      el('bank', 'system', 'Bank'), el('gateway', 'container', 'Gateway', { parentId: 'bank' }),
      el('sales', 'domain', 'Sales'), el('ord', 'entity', 'Order', { parentId: 'sales' }),
      el('billing', 'domain', 'Billing'), el('invoice', 'entity', 'Invoice', { parentId: 'billing' }),
      el('m1', 'state-machine', 'Order lifecycle'), el('s1', 'state', 'Open', { parentId: 'm1' }), el('s2', 'state', 'Closed', { parentId: 'm1' }),
      el('m2', 'state-machine', 'Invoice lifecycle'), el('s3', 'state', 'Due', { parentId: 'm2' }),
      el('p1', 'process', 'Checkout'), el('a', 'step', 'Pay', { parentId: 'p1' }), el('b', 'step', 'Confirm', { parentId: 'a' }),
      el('p2', 'process', 'Refund'), el('c', 'step', 'Return', { parentId: 'p2' }),
    ], [
      rel('r1', 'user', 'web', 'interacts'), rel('r2', 'web', 'api', 'interacts'), rel('r3', 'api', 'db', 'interacts'), rel('r4', 'api', 'gateway', 'interacts'),
      rel('r5', 'c1', 'c2', 'interacts'), rel('r6', 'c1', 'db', 'interacts'),
      rel('r7', 'invoice', 'ord', 'references'), rel('r8', 'm1', 'ord', 'lifecycle-of'), rel('r9', 's1', 's2', 'transition'),
    ])
    const of = (viewpoint: string, subject: string) => {
      model.insertView(state, `${viewpoint}:${subject}`, subject)
      expect(model.applyViewpoint(state, `${viewpoint}:${subject}`, viewpoint, subject)).toBe(true)
      return shownIds(state, `${viewpoint}:${subject}`)
    }
    expect(of('state-machine', 'm1')).toEqual(['m1', 'ord', 's1', 's2'])
    expect(of('process', 'p1')).toEqual(['a', 'b', 'p1'])
    expect(of('system-containers', 'shop')).toEqual(['api', 'db', 'gateway', 'shop', 'user', 'web'])
    expect(of('container-components', 'api')).toEqual(['api', 'c1', 'c2', 'db', 'gateway', 'web'])
    expect(of('domain-entities', 'billing')).toEqual(['billing', 'invoice', 'ord'])
  })
})

describe('viewpoint subjects', () => {
  const machines = () => modelOf([
    el('order', 'state-machine', 'Order'), el('placed', 'state', 'Placed', { parentId: 'order' }), el('paid', 'state', 'Paid', { parentId: 'order' }),
    el('payment', 'state-machine', 'Payment'), el('pending', 'state', 'Pending', { parentId: 'payment' }),
  ], [rel('t1', 'placed', 'paid', 'transition')])

  it('keep a view to its element, in step with the viewpoint, and keep the chain on Detach', () => {
    const state = machines()
    model.insertView(state, 'v', 'Order')
    // A state is not what the viewpoint draws.
    expect(model.applyViewpoint(state, 'v', 'state-machine', 'placed')).toBe(false)
    expect(model.applyViewpoint(state, 'v', 'state-machine', 'order')).toBe(true)
    expect(state.views.v).toMatchObject({ viewpoint: 'state-machine', subject: 'order', kind: 'static' })
    expect(shownIds(state, 'v')).toEqual(['order', 'paid', 'placed'])
    // The viewpoint changes: the view follows, still of Order.
    const def = viewpointsOf(state.metamodel).find((t) => t.id === 'state-machine')!
    state.metamodel = withViewpoint(state.metamodel!, { ...def, kind: 'table' })
    expect(model.syncViewpoints(state)).toEqual(['v'])
    expect(state.views.v).toMatchObject({ kind: 'table', subject: 'order' })
    expect(shownIds(state, 'v')).toEqual(['order', 'paid', 'placed'])
    // Another element: the same chain, kept to it, and the element's name.
    expect(model.applyViewpoint(state, 'v', 'state-machine', 'payment')).toBe(true)
    expect(shownIds(state, 'v')).toEqual(['payment', 'pending'])
    expect(state.views.v.name).toBe('Payment')
    // Detach: what it shows stays, of no viewpoint and no element.
    model.detachViewpoint(state, 'v')
    expect(state.views.v.viewpoint).toBeUndefined()
    expect(state.views.v.subject).toBeUndefined()
    expect(shownIds(state, 'v')).toEqual(['payment', 'pending'])
    expect(model.syncViewpoints(state)).toEqual([])
    // A caller that syncs the views alone, with no elements, does not fail.
    model.applyViewpoint(state, 'v', 'state-machine', 'order')
    expect(() => model.syncViewpoints({ views: state.views, metamodel: state.metamodel } as unknown as model.ModelState)).not.toThrow()
  })

  it('make a group hold a view of each element that is not external, made and removed with the elements', () => {
    let next = 0
    const newId = () => `v${++next}`
    const state = machines()
    state.c4Nodes.ext = el('ext', 'state-machine', 'Theirs', { external: true })
    model.insertView(state, 'g', 'Machines')
    model.setViewFolder(state, 'g', 'States')
    expect(model.applyViewpoint(state, 'g', 'state-machine', null)).toBe(true)
    expect(model.isViewGroup(state.views.g, state.metamodel)).toBe(true)
    expect(model.syncViewGroups(state, newId)).toBe(true)
    const members = () => model.viewsOfGroup(state.views, 'g').map((v) => [v.name, v.subject, v.folder]).sort()
    expect(members()).toEqual([['Order', 'order', 'States'], ['Payment', 'payment', 'States']])
    // Each shows its element open, folded on the model or not.
    expect(model.viewsOfGroup(state.views, 'g').map((v) => v.expandedNodeIds)).toEqual([['order'], ['payment']])
    expect(model.planViewGroups(state)).toEqual({ add: [], remove: [], refolder: [] })
    // A new machine: a new view; the group moves: its views follow.
    state.c4Nodes.refund = el('refund', 'state-machine', 'Refund')
    model.setViewFolder(state, 'g', 'Life')
    model.syncViewGroups(state, newId)
    expect(members()).toEqual([['Order', 'order', 'Life'], ['Payment', 'payment', 'Life'], ['Refund', 'refund', 'Life']])
    // Deleted, or made external: its view goes.
    model.deleteNode(state, 'payment')
    state.c4Nodes.refund.external = true
    model.syncViewGroups(state, newId)
    expect(members()).toEqual([['Order', 'order', 'Life']])
    // The group detached: its views go too.
    model.detachViewpoint(state, 'g')
    model.syncViewGroups(state, newId)
    expect(Object.keys(state.views)).toEqual(['g'])
  })

  it('name a view after its element until it is renamed, and delete it with the element', () => {
    const state = machines()
    const def = viewpointsOf(state.metamodel).find((t) => t.id === 'state-machine')!
    for (const id of ['order', 'payment']) {
      model.insertView(state, `v-${id}`, subjectViewName(state.c4Nodes[id], def))
      model.applyViewpoint(state, `v-${id}`, def.id, id)
    }
    expect(state.views['v-order'].name).toBe('Order')
    model.patchNode(state, 'order', { label: 'Purchase' })
    expect(state.views['v-order'].name).toBe('Purchase')
    model.renameView(state, 'v-order', 'Buying')
    model.patchNode(state, 'order', { label: 'Sale' })
    expect(state.views['v-order'].name).toBe('Buying')
    // Deleting Payment takes its view along, the one on screen too.
    state.activeViewId = 'v-payment'
    model.deleteNode(state, 'payment')
    expect(state.views['v-payment']).toBeUndefined()
    expect(state.activeViewId).toBeNull()
    expect(state.views['v-order']).toBeDefined()
  })
})

describe('viewpoint tools', () => {
  function setup(nodes: C4Node[] = []) {
    const facade = createModelFacade({ nodes, relations: [], metamodel: builtInGovernanceMetamodel() })
    const temps = new Map<string, string>()
    const ctx: ToolRunContext = {
      diagram: facade,
      resolveId: (id) => temps.get(id) ?? id,
      registerTempId: (t, r) => { temps.set(t, r) },
      resetTempIds: () => temps.clear(),
      placeNext: () => ({ x: 0, y: 0 }),
    }
    const view = (name: string) => Object.values(facade.getViews!()).find((v) => v.name === name)!
    return { facade, view, call: (name: string, input: unknown) => runTool(name, input, ctx) }
  }

  it('create a view of a viewpoint by id or name, detach it, and refuse what does not fit', async () => {
    const { view, call } = setup()
    expect((await call('create_view', { tempId: 'v', name: 'Trace', viewpoint: 'Traceability' })).ok).toBe(true)
    expect(view('Trace')).toMatchObject({ viewpoint: 'traceability', kind: 'table' })
    expect((await call('update_view', { id: 'v', viewpoint: 'decisions' })).ok).toBe(true)
    expect(pipelineOf(view('Trace'))!.levels![0].ways[0].types).toEqual(['adr'])
    expect((await call('update_view', { id: 'v', viewpoint: null })).ok).toBe(true)
    expect(view('Trace').viewpoint).toBeUndefined()
    expect(view('Trace').kind).toBe('table')
    expect((await call('update_view', { id: 'v', viewpoint: 'nope' })).resultText).toContain('unknown viewpoint')
    expect((await call('update_view', { id: 'v', viewpoint: 'decisions', kind: 'wiki' })).resultText).toContain('not both')
  })

  it('add a viewpoint from a view, change it so its views follow, and delete it, without copying the preset', async () => {
    const { facade, view, call } = setup()
    await call('create_view', { tempId: 'v', name: 'Needs', kind: 'wiki', pipeline: needs })
    const added = await call('upsert_viewpoint', { label: 'Needs', description: 'Needs and their requirements', fromViewId: 'v' })
    expect(added.ok, added.resultText).toBe(true)
    expect(facade.getMetamodel!()!.id).toBe('c4-ddd-governance-builtin')
    expect(viewpointsOf(facade.getMetamodel!()).find((t) => t.id === 'needs')).toMatchObject({ label: 'Needs', kind: 'wiki', description: 'Needs and their requirements' })
    expect(buildMetamodelMessage(facade.getMetamodel!())).toContain('"viewpoints"')

    expect((await call('update_view', { id: 'v', viewpoint: 'needs' })).ok).toBe(true)
    const changed = await call('upsert_viewpoint', { id: 'needs', kind: 'table' })
    expect(changed.resultText).toContain('1 view(s) of it follow')
    expect(view('Needs').kind).toBe('table')

    expect((await call('upsert_viewpoint', { label: 'Traceability', kind: 'table', pipeline: needs })).resultText).toContain('already has the name')
    expect((await call('upsert_viewpoint', { label: 'Bad', kind: 'table', pipeline: { levels: [{ ways: [{ types: ['spaceship'] }] }] } })).resultText).toContain('unknown node type')
    expect((await call('upsert_viewpoint', { label: 'Flow', kind: 'dynamic', pipeline: needs })).resultText).toContain('kind must be one of')
    expect((await call('delete_viewpoint', { id: 'needs' })).ok).toBe(true)
    expect(view('Needs')).toMatchObject({ kind: 'table' })
    expect(view('Needs').viewpoint).toBeUndefined()
    expect((await call('delete_viewpoint', { id: 'needs' })).resultText).toContain('unknown viewpoint')
  })

  it('make a group of views of one element, kept in step with the model, and refuse to delete or change one of its views', async () => {
    const { facade, view, call } = setup([el('order', 'state-machine', 'Order'), el('placed', 'state', 'Placed', { parentId: 'order' })])
    const made = await call('create_view', { tempId: 'g', name: 'Machines', viewpoint: 'state-machine' })
    expect(made.ok, made.resultText).toBe(true)
    expect(made.resultText).toContain('a group holding a view of each state-machine (1 now: Order')
    const group = view('Machines')
    expect(view('Order')).toMatchObject({ viewpoint: 'state-machine', subject: 'order', partOf: group.id })
    expect(pipelineOf(view('Order'))!.levels![0].filters).toContainEqual({ kind: 'within', nodeId: 'order', self: true })
    // A new machine gets its view in the group; a deleted one takes it along.
    expect((await call('add_node', { tempId: 'pay', type: 'state-machine', label: 'Payment' })).ok).toBe(true)
    expect(view('Payment')).toMatchObject({ partOf: group.id })
    expect((await call('delete_view', { id: view('Order').id })).resultText).toContain('goes with its element')
    expect((await call('update_view', { id: view('Order').id, kind: 'table' })).resultText).toContain('one of the views of the group Machines')
    // The group keeps its viewpoint: another kind or none would end it.
    expect((await call('update_view', { id: 'g', kind: 'table' })).resultText).toContain('is a group of views per element')
    expect((await call('update_view', { id: 'g', viewpoint: null })).resultText).toContain('is a group of views per element')
    expect(view('Machines')).toMatchObject({ viewpoint: 'state-machine', kind: 'static' })
    expect((await call('delete_node', { id: 'pay' })).ok).toBe(true)
    expect(Object.values(facade.getViews!()).map((v) => v.name).sort()).toEqual(['Machines', 'Order'])
    // Deleting the group deletes its views.
    expect((await call('delete_view', { id: 'g' })).resultText).toContain('and the 1 views of the group')
    expect(Object.keys(facade.getViews!())).toEqual([])
    expect(buildMetamodelMessage(facade.getMetamodel!())).toContain('"subjectTypes":["state-machine"]')
    // A viewpoint of one element made over MCP.
    expect((await call('upsert_viewpoint', { id: 'domain-map', subjectTypes: ['domain'] })).ok).toBe(true)
    expect(viewpointsOf(facade.getMetamodel!()).find((t) => t.id === 'domain-map')!.subject).toEqual({ types: ['domain'] })
    expect((await call('upsert_viewpoint', { id: 'domain-map', subjectTypes: ['spaceship'] })).resultText).toContain('unknown node type')
  })
})
