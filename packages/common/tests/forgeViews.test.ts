import { describe, expect, it } from 'vitest'
import { landscapeGridColumns, landscapeSlot, type C4Node, type DiagramData } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  arrangeForgeGroup,
  defaultForgeStructure,
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

describe('radical structure', () => {
  const radical = (facade: ReturnType<typeof facadeOf>, without: string[] = []): ForgeStructure => {
    const structure = defaultForgeStructure(facade.getMetamodel!(), facade.getViews!())
    if (structure.kind !== 'radical') throw new Error('expected the Radical structure')
    return { kind: 'radical', viewpoints: structure.viewpoints.filter((v) => !without.includes(v)) }
  }

  it('lists the viewpoints in the folders of the radical model, every one chosen', () => {
    const choices = radicalViewpoints(builtInGovernanceMetamodel())
    expect([...new Set(choices.map((c) => c.folder))]).toEqual(['Conceptual', 'Logical', 'Governance'])
    expect(choices.filter((c) => c.folder === 'Logical').map((c) => c.label)).toEqual([
      'System context', 'Containers', 'Components', 'Container dependencies', 'Domain realisation', 'Responsibilities',
    ])
    expect(choices.every((c) => c.chosen)).toBe(true)
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

  it('offers to arrange the new elements a canvas of a viewpoint shows', () => {
    const facade = facadeOf([node('user', 'person'), node('sys', 'system'), node('api', 'container', { parentId: 'sys' })])
    const structure = radical(facade)
    const filed = fileIntoForgeViews(facade, ['user', 'sys', 'api'], 'c4', structure)
    expect(filed.filter((f) => f.canvas).map((f) => [f.viewName, f.nodeIds])).toEqual([
      ['System context', ['user', 'sys']],
      ['Containers', ['user', 'sys', 'api']],
      ['Components', ['api']],
    ])
    expect(facade.getViews!()[filed[0].viewId].folder).toBe('Logical')
    expect(forgeStageView(facade.getViews!(), 'c4', structure)?.name).toBe('Containers')
    expect(forgeArrangeGroups(facade, ['user', 'sys', 'api'], 'c4', structure).map((g) => [g.viewName, g.nodeIds])).toEqual([
      ['System context', ['user', 'sys']],
      ['Containers', ['user', 'sys']],
      ['Components', ['api']],
    ])
  })
})
