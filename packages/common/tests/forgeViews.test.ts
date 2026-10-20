import { describe, expect, it } from 'vitest'
import { landscapeGridColumns, landscapeSlot, viewShowsEveryNode, type C4Node, type DiagramData } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  arrangeForgeGroup,
  defaultForgeStructure,
  dropEmptyForgeViews,
  openForgeStageViews,
  describeForgeStructure,
  fileIntoForgeViews,
  findForgeView,
  forgeArrangeGroups,
  forgeStageView,
  forgeViewOf,
  forgeViewsOf,
  outermostNodes,
  radicalViewpoints,
  type FiledNodes,
  type ForgeStructure,
} from '../src/ai/forge'

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node

/** Where filed nodes went, without the view's name and kind. */
const brief = (filed: FiledNodes[]) => filed.map(({ key, viewId, nodeIds }) => ({ key, viewId, nodeIds }))

function facadeOf(nodes: C4Node[], views: DiagramData['views'] = [], relations: DiagramData['relations'] = []) {
  let next = 0
  return createModelFacade({ nodes, relations, views, metamodel: builtInGovernanceMetamodel() }, { newId: () => `id${++next}` })
}

describe('landscapeSlot', () => {
  it('grows a block wider than tall without moving cells already handed out', () => {
    const cells = Array.from({ length: 12 }, (_, i) => landscapeSlot(i))
    expect(cells.slice(0, 8)).toEqual([
      { column: 0, row: 0 }, { column: 1, row: 0 },
      { column: 0, row: 1 }, { column: 1, row: 1 },
      { column: 2, row: 0 }, { column: 2, row: 1 },
      { column: 3, row: 0 }, { column: 3, row: 1 },
    ])
    // Twice as many columns as rows: the next cells start a new row.
    expect(cells.slice(8)).toEqual([0, 1, 2, 3].map((column) => ({ column, row: 2 })))
    expect(new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(landscapeSlot(i)))).size).toBe(50)
  })

  it('sizes a grid the same way', () => {
    expect([1, 2, 3, 4, 5, 12, 30].map(landscapeGridColumns)).toEqual([1, 2, 2, 2, 3, 4, 8])
  })
})

describe('Forge views', () => {
  it('maps node types to the four views, falling back to the stage', () => {
    expect(forgeViewOf('requirement')).toBe('conceptual')
    expect(forgeViewOf('state-machine')).toBe('states')
    expect(forgeViewOf('event', 'c4')).toBe('states')
    expect(forgeViewOf('group', 'states')).toBe('states')
    expect(forgeViewOf('mockup', 'c4')).toBe('conceptual')
    expect(forgeViewOf('fitness-fn')).toBe('governance')
    expect(forgeViewOf('container', 'c4')).toBe('logical')
    expect(forgeViewOf('blueprint', 'fitness')).toBe('governance')
  })

  it('files the domain model into the Domain view and Conceptual, and a machine\'s entity into States', () => {
    expect(forgeViewsOf('entity')).toEqual(['domain', 'conceptual'])
    expect(forgeViewsOf('domain', 'c4')).toEqual(['domain', 'conceptual'])
    expect(forgeViewOf('entity')).toBe('domain')
    const facade = facadeOf(
      [node('shop', 'domain'), node('order', 'entity', { parentId: 'shop' }), node('m', 'state-machine')],
      [],
      [{ id: 'l', sourceId: 'm', targetId: 'order', relationType: 'lifecycle-of' }],
    )
    expect(brief(fileIntoForgeViews(facade, ['shop', 'order'], 'domain'))).toEqual([
      { key: 'domain', viewId: 'id1', nodeIds: ['shop', 'order'] },
      { key: 'conceptual', viewId: 'id2', nodeIds: ['shop', 'order'] },
    ])
    expect(brief(fileIntoForgeViews(facade, ['m'], 'states'))).toEqual([{ key: 'states', viewId: 'id3', nodeIds: ['m', 'order'] }])
    expect(forgeArrangeGroups(facade, ['shop', 'order'], 'domain').map((g) => [g.viewName, g.nodeIds])).toEqual([
      ['Conceptual', ['shop']], ['Domain', ['shop']],
    ])
  })

  it('mockups go onto a Screen flow canvas of their own', () => {
    expect(forgeViewsOf('mockup')).toEqual(['conceptual', 'screens'])
    const facade = facadeOf(
      [node('need', 'need'), node('r1', 'requirement'), node('home', 'mockup'), node('cart', 'mockup')],
      [{ id: 'c', name: 'Conceptual', nodeIds: ['need', 'r1'], positions: {} }],
      [
        { id: 'i1', sourceId: 'home', targetId: 'r1', relationType: 'illustrates' },
        { id: 'i2', sourceId: 'cart', targetId: 'r1', relationType: 'illustrates' },
        { id: 'nav', sourceId: 'home', targetId: 'cart', relationType: 'navigates-to', label: 'Add to cart' },
      ],
    )
    expect(brief(fileIntoForgeViews(facade, ['home', 'cart'], 'mockups'))).toEqual([
      { key: 'conceptual', viewId: 'c', nodeIds: ['home', 'cart'] },
      { key: 'screens', viewId: 'id1', nodeIds: ['home', 'cart'] },
    ])
    const views = facade.getViews!()
    // The screens alone: their flow, not the requirement they illustrate.
    expect(views.id1).toMatchObject({ name: 'Screen flow', nodeIds: ['home', 'cart'] })
    expect(forgeStageView(views, 'mockups', { kind: 'layers' })?.id).toBe('id1')
    expect(forgeArrangeGroups(facade, ['home', 'cart'], 'mockups').map((g) => [g.viewName, g.nodeIds])).toEqual([
      ['Conceptual', ['home', 'cart']], ['Screen flow', ['home', 'cart']],
    ])
  })

  it('files nodes into their views, creating a view only when it gets elements and reusing one by name', () => {
    const facade = facadeOf(
      [node('need', 'need'), node('r1', 'requirement'), node('f1', 'fitness-fn')],
      [{ id: 'mine', name: 'conceptual ', nodeIds: ['need'], positions: {} }],
    )
    const filed = fileIntoForgeViews(facade, ['need', 'r1', 'f1'], 'requirements')
    expect(brief(filed)).toEqual([
      { key: 'conceptual', viewId: 'mine', nodeIds: ['r1'] },
      { key: 'governance', viewId: 'id1', nodeIds: ['f1'] },
    ])
    const views = facade.getViews!()
    expect(views.mine.nodeIds).toEqual(['need', 'r1'])
    expect(views.id1).toMatchObject({ name: 'Governance', nodeIds: ['f1'] })
    expect(findForgeView(views, 'logical')).toBeUndefined()
    // Again: nothing new.
    expect(brief(fileIntoForgeViews(facade, ['r1'], 'requirements'))).toEqual([{ key: 'conceptual', viewId: 'mine', nodeIds: [] }])
  })

  it('arranges only the outermost new elements of each view', () => {
    const facade = facadeOf([
      node('sys', 'system'),
      node('api', 'container', { parentId: 'sys' }),
      node('web', 'webapp', { parentId: 'sys' }),
      node('user', 'person'),
      node('bank', 'system'),
    ])
    const added = ['sys', 'api', 'web', 'user', 'bank']
    expect(outermostNodes(facade.getNodes(), added)).toEqual(['sys', 'user', 'bank'])
    fileIntoForgeViews(facade, added, 'c4')
    const [group] = forgeArrangeGroups(facade, added, 'c4')
    expect(group).toMatchObject({ viewName: 'Logical & physical', nodeIds: ['sys', 'user', 'bank'] })

    expect(arrangeForgeGroup(facade, group, 'row')).toEqual({ ok: true, text: 'Logical & physical: 3 elements in a row.' })
    expect(facade.getLayoutConstraints!(group.viewId)).toEqual([
      { id: expect.any(String), type: 'align', axis: 'horizontal', nodeIds: ['sys', 'user', 'bank'], ordered: true },
    ])
    expect(arrangeForgeGroup(facade, group, 'row').ok).toBe(false)
  })

  it('makes a landscape grid', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const facade = facadeOf(ids.map((id) => node(id, 'requirement')))
    fileIntoForgeViews(facade, ids, 'requirements')
    const [group] = forgeArrangeGroups(facade, ids, 'requirements')
    expect(arrangeForgeGroup(facade, group, 'grid')).toEqual({ ok: true, text: 'Conceptual: 12 elements in a grid of 4 columns.' })
    expect(facade.getLayoutConstraints!(group.viewId)[0]).toMatchObject({ type: 'grid', columns: 4, nodeIds: ids })
  })
})

describe('processes go into a Warnier view', () => {
  it('files processes and steps into a Processes view of the viewpoint Process (Warnier), lists none of them and offers nothing to arrange', () => {
    expect(forgeViewsOf('process')).toEqual(['processes'])
    expect(forgeViewsOf('step', 'c4')).toEqual(['processes'])
    const facade = facadeOf([node('checkout', 'process'), node('take', 'step', { parentId: 'checkout' }), node('r1', 'requirement')])
    expect(brief(fileIntoForgeViews(facade, ['checkout', 'take'], 'processes'))).toEqual([{ key: 'processes', viewId: 'id1', nodeIds: [] }])
    const view = facade.getViews!().id1
    expect(view).toMatchObject({ name: 'Processes', kind: 'warnier', viewpoint: 'process-warnier', nodeIds: [] })
    expect(findForgeView(facade.getViews!(), 'processes')?.id).toBe('id1')
    // A second run reuses it; the canvas views are not mistaken for it.
    expect(brief(fileIntoForgeViews(facade, ['checkout'], 'processes'))).toEqual([{ key: 'processes', viewId: 'id1', nodeIds: [] }])
    expect(forgeArrangeGroups(facade, ['checkout', 'take'], 'processes')).toEqual([])
  })
})

describe('stage views before the stage', () => {
  const fresh = (type: string, label: string): Omit<C4Node, 'id'> => ({ type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false }) as Omit<C4Node, 'id'>

  it('makes a layer canvas that lists nothing yet, which keeps what is filed and goes when left empty', () => {
    const facade = facadeOf([node('need', 'need')])
    const [domain] = openForgeStageViews(facade, 'domain', { kind: 'layers' })
    const view = facade.getViews!()[domain]
    expect(view).toMatchObject({ name: 'Domain', nodeIds: [] })
    expect(viewShowsEveryNode(view)).toBe(false)
    // Made once: a second stage that files there finds it.
    expect(openForgeStageViews(facade, 'domain', { kind: 'layers' })).toEqual([])
    facade.addNode(fresh('domain', 'Shop'))
    const shop = Object.values(facade.getNodes()).find((n) => n.type === 'domain')!.id
    fileIntoForgeViews(facade, [shop], 'domain')
    expect(dropEmptyForgeViews(facade, [domain])).toEqual([])
    expect(facade.getViews!()[domain].nodeIds).toEqual([shop])

    const [states] = openForgeStageViews(facade, 'states', { kind: 'layers' })
    expect(dropEmptyForgeViews(facade, [states])).toEqual([states])
    expect(facade.getViews!()[states]).toBeUndefined()
  })

  it('makes the views and groups of the stage\'s chosen viewpoints, which fill as elements come, and takes back the empty ones', () => {
    const facade = facadeOf([node('need', 'need')])
    const structure: ForgeStructure = { kind: 'radical', viewpoints: ['state-machine', 'entity-lifecycles', 'traceability'] }
    const opened = openForgeStageViews(facade, 'states', structure)
    const views = () => Object.values(facade.getViews!())
    expect(opened.map((id) => facade.getViews!()[id].name)).toEqual(['State machine', 'Entity lifecycles'])
    expect(facade.getViews!()[opened[0]]).toMatchObject({ folder: 'Conceptual', viewpoint: 'state-machine' })
    // A machine added during the stage gets its view in the group at once.
    facade.addNode(fresh('state-machine', 'Order lifecycle'))
    expect(views().filter((v) => v.partOf === opened[0]).map((v) => v.name)).toEqual(['Order lifecycle'])
    // No entity has a lifecycle: Entity lifecycles shows nothing and goes.
    expect(dropEmptyForgeViews(facade, opened)).toEqual([opened[1]])
    expect(views().map((v) => v.name).sort()).toEqual(['Order lifecycle', 'State machine'])

    // A group no element joined goes too.
    const empty = facadeOf([node('need', 'need')])
    const group = openForgeStageViews(empty, 'states', { kind: 'radical', viewpoints: ['state-machine'] })
    expect(dropEmptyForgeViews(empty, group)).toEqual(group)
    expect(Object.keys(empty.getViews!())).toEqual([])
  })
})

describe('radical structure', () => {
  const radical = (facade: ReturnType<typeof facadeOf>, without: string[] = []): ForgeStructure => {
    const structure = defaultForgeStructure(facade.getMetamodel!(), facade.getViews!())
    if (structure.kind !== 'radical') throw new Error('expected the Radical structure')
    return { kind: 'radical', viewpoints: structure.viewpoints.filter((v) => !without.includes(v)) }
  }

  it('lists the viewpoints in the folders of the radical model, all but the whole-model ones a view per element stands in for chosen', () => {
    const choices = radicalViewpoints(builtInGovernanceMetamodel())
    expect([...new Set(choices.map((c) => c.folder))]).toEqual(['Conceptual', 'Logical', 'Governance'])
    expect(choices.filter((c) => c.folder === 'Logical').map((c) => c.label)).toEqual([
      'System context', 'Containers', 'Containers of a system', 'Components', 'Components of a container', 'Container dependencies', 'Domain realisation', 'Responsibilities',
    ])
    expect(choices.filter((c) => !c.chosen).map((c) => c.id)).toEqual(['domain-model', 'process-warnier', 'containers', 'components'])
    expect(choices.find((c) => c.id === 'process-warnier')?.folder).toBe('Conceptual')
    // Another metamodel's viewpoint: a folder after its group, not chosen.
    const metamodel = builtInGovernanceMetamodel()
    metamodel.viewpoints = [...metamodel.viewpoints!, { id: 'mine', label: 'Mine', group: 'Ops', kind: 'table', pipeline: { levels: [] } }]
    expect(radicalViewpoints(metamodel).at(-1)).toEqual({ id: 'mine', label: 'Mine', folder: 'Ops', chosen: false })
    expect(describeForgeStructure({ kind: 'radical', viewpoints: ['traceability', 'containers', 'mine'] }, metamodel))
      .toBe('Radical: Conceptual (Traceability); Logical (Containers); Ops (Mine).')
  })

  it('is the default unless the model has the layer canvases of a run and no view of a viewpoint', () => {
    const metamodel = builtInGovernanceMetamodel()
    expect(defaultForgeStructure(metamodel, {}).kind).toBe('radical')
    const layers = { c: { id: 'c', name: 'Conceptual', nodeIds: ['n'], positions: {} } }
    expect(defaultForgeStructure(metamodel, layers)).toEqual({ kind: 'layers' })
    expect(defaultForgeStructure(metamodel, { ...layers, t: { id: 't', name: 'T', nodeIds: [], positions: {}, viewpoint: 'traceability' } }).kind).toBe('radical')
    expect(defaultForgeStructure({ ...metamodel, viewpoints: [] }, {})).toEqual({ kind: 'layers' })
  })

  it('makes a view of a chosen viewpoint in its folder once it shows something, and reuses the model\'s', () => {
    const facade = facadeOf([node('need', 'need'), node('r1', 'requirement'), node('r2', 'requirement')], [
      { id: 'mine', name: 'My coverage', nodeIds: [], positions: {}, viewpoint: 'requirement-coverage', kind: 'table' },
    ])
    const structure = radical(facade, ['specification'])
    // The need: Traceability starts from needs.
    const atStart = fileIntoForgeViews(facade, ['need'], undefined, structure)
    expect(atStart.map((f) => [f.viewName, f.made, f.nodeIds])).toEqual([
      ['Traceability', true, ['need']],
      ['My coverage', false, []],
      ['Requirement gaps', true, []],
    ])
    const traceability = facade.getViews!()[atStart[0].viewId]
    expect(traceability).toMatchObject({ folder: 'Conceptual', kind: 'table', viewpoint: 'traceability', nodeIds: [] })
    expect(facade.getViews!()[atStart[2].viewId].folder).toBe('Governance')
    // Nothing is made for what shows nothing, or was left out.
    expect(Object.values(facade.getViews!()).map((v) => v.name).sort()).toEqual(['My coverage', 'Requirement gaps', 'Traceability'])

    // Requirements derived from the need: in Traceability under it, and in the views of requirements.
    facade.addRelation({ sourceId: 'r1', targetId: 'need', relationType: 'derives', label: '' })
    const filed = fileIntoForgeViews(facade, ['r1', 'r2'], 'requirements', structure)
    expect(filed.map((f) => [f.viewName, f.made, f.canvas, f.nodeIds])).toEqual([
      ['Traceability', false, false, ['r1']],
      ['My coverage', false, false, ['r1', 'r2']],
      ['Requirement gaps', false, false, ['r1', 'r2']],
    ])
    expect(forgeStageView(facade.getViews!(), 'requirements', structure)?.name).toBe('Traceability')
    expect(forgeStageView(facade.getViews!(), 'c4', structure)).toBeUndefined()
    // No canvas shows them: nothing to arrange.
    expect(forgeArrangeGroups(facade, ['r1', 'r2'], 'requirements', structure)).toEqual([])
  })

  it('makes a group of views of each state machine, process, system, container and domain, which a later element joins', () => {
    const facade = facadeOf([
      node('m1', 'state-machine', { label: 'Order' }), node('m2', 'state-machine', { label: 'Payment' }),
      node('p1', 'process', { label: 'Booking' }), node('p2', 'process', { label: 'Cancelling' }),
      node('sys', 'system', { label: 'Shop' }), node('api', 'container', { label: 'API', parentId: 'sys' }), node('web', 'webapp', { label: 'Web', parentId: 'sys' }),
      node('d1', 'domain', { label: 'Sales' }), node('d2', 'domain', { label: 'Billing' }),
      // No view of an external system.
      node('bank', 'system', { label: 'Bank', external: true }),
    ])
    const structure = radical(facade)
    fileIntoForgeViews(facade, Object.keys(facade.getNodes()), undefined, structure)
    const views = () => Object.values(facade.getViews!())
    const group = (viewpoint: string) => {
      const g = views().find((v) => v.viewpoint === viewpoint && !v.partOf)!
      return [g.name, g.folder, views().filter((v) => v.partOf === g.id).map((v) => v.name).sort()]
    }
    expect(group('state-machine')).toEqual(['State machine', 'Conceptual', ['Order', 'Payment']])
    expect(group('process')).toEqual(['Process', 'Conceptual', ['Booking', 'Cancelling']])
    expect(group('domain-entities')).toEqual(['Entities of a domain', 'Conceptual', ['Billing', 'Sales']])
    expect(group('system-containers')).toEqual(['Containers of a system', 'Logical', ['Shop']])
    expect(group('container-components')).toEqual(['Components of a container', 'Logical', ['API', 'Web']])
    for (const whole of ['containers', 'components', 'process-warnier', 'domain-model']) expect(views().filter((v) => v.viewpoint === whole)).toEqual([])
    // A later stage's machine joins the group as it is added, and the
    // stage's filing finds it there; nothing is made twice.
    const m3 = facade.addNode({ type: 'state-machine', label: 'Refund', x: 0, y: 0, width: 200, height: 100, collapsed: false })
    const filed = fileIntoForgeViews(facade, [m3], 'states', structure)
    expect(filed.filter((f) => f.nodeIds.length).map((f) => [f.viewName, f.nodeIds])).toEqual([['Refund', [m3]]])
    expect(group('state-machine')[2]).toEqual(['Order', 'Payment', 'Refund'])
    expect(forgeStageView(facade.getViews!(), 'states', structure)?.name).toBe('Order')
  })

  it('offers to arrange the new elements a canvas of a viewpoint shows', () => {
    const facade = facadeOf([node('user', 'person'), node('sys', 'system'), node('api', 'container', { parentId: 'sys' })])
    const structure = radical(facade)
    const filed = fileIntoForgeViews(facade, ['user', 'sys', 'api'], 'c4', structure)
    // The system's containers and the container's components: a view each,
    // in a group, named after the element.
    expect(filed.filter((f) => f.canvas).map((f) => [f.viewName, f.nodeIds])).toEqual([
      ['System context', ['user', 'sys']],
      ['sys', ['sys', 'api']],
      ['api', ['api']],
    ])
    expect(facade.getViews!()[filed[0].viewId].folder).toBe('Logical')
    expect(forgeStageView(facade.getViews!(), 'c4', structure)?.name).toBe('sys')
    expect(forgeArrangeGroups(facade, ['user', 'sys', 'api'], 'c4', structure).map((g) => [g.viewName, g.nodeIds])).toEqual([
      ['System context', ['user', 'sys']],
      ['sys', ['sys']],
      ['api', ['api']],
    ])
  })
})
