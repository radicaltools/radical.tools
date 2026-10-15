import { describe, it, expect } from 'vitest'
import { buildToolDefs, buildToolHandlers } from '../src/ai/tools/index'
import type { ToolRunContext } from '../src/ai/tools/types'
import { createModelFacade } from '../src/ai/modelFacade'
import { runModelQuery } from '../src/ai/queryLanguage'
import { builtInC4Metamodel } from '../src/metamodel/index'

function setup() {
  const facade = createModelFacade({ nodes: [], relations: [], metamodel: builtInC4Metamodel() })
  const temps = new Map<string, string>()
  const ctx: ToolRunContext = {
    diagram: facade,
    resolveId: (id) => temps.get(id) ?? id,
    registerTempId: (t, r) => { temps.set(t, r) },
    resetTempIds: () => temps.clear(),
    placeNext: () => ({ x: 0, y: 0 }),
  }
  const handlers = buildToolHandlers()
  const call = (name: string, input: unknown) => handlers.get(name)!(input, ctx)
  call('add_node', { tempId: 'user', type: 'person', label: 'User' })
  call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
  call('add_node', { tempId: 'bank', type: 'system', label: 'Bank' })
  call('add_relation', { sourceId: 'user', targetId: 'shop', label: 'Orders' })
  call('add_relation', { sourceId: 'shop', targetId: 'bank', label: 'Charges' })
  const rel = (label: string) => Object.values(facade.getRelations()).find((r) => r.label === label)!.id
  return { facade, ctx, call, rel }
}

describe('sequence tools', () => {
  it('are in the catalogue', () => {
    const names = buildToolDefs(builtInC4Metamodel()).map((d) => d.name)
    expect(names).toEqual(expect.arrayContaining(['create_sequence', 'update_sequence', 'delete_sequence', 'update_view']))
  })

  it('create a sequence, play it in a dynamic view, and persist both', () => {
    const { facade, call, ctx, rel } = setup()
    const created = call('create_sequence', {
      tempId: 'checkout', name: 'Checkout',
      steps: [{ relationId: rel('Orders'), description: 'User places an order' }, { relationId: rel('Charges') }],
    })
    expect(created.ok, created.resultText).toBe(true)
    const view = call('create_view', { tempId: 'v', name: 'Checkout flow', kind: 'dynamic', sequenceId: 'checkout' })
    expect(view.ok, view.resultText).toBe(true)

    const data = facade.toDiagramData()
    expect(data.sequences).toEqual([expect.objectContaining({
      name: 'Checkout', relationIds: [rel('Orders'), rel('Charges')],
      // Descriptions run up to the last described step, like Studio's step list.
      stepDescriptions: ['User places an order'],
    })])
    const dyn = data.views!.find((v) => v.name === 'Checkout flow')!
    expect(dyn).toMatchObject({ kind: 'dynamic', sequenceId: ctx.resolveId('checkout') })
    // Defaults to the sequence's endpoints.
    expect(new Set(dyn.nodeIds)).toEqual(new Set(['user', 'shop', 'bank'].map((t) => ctx.resolveId(t))))

    const listed = runModelQuery('LIST SEQUENCES', { nodes: facade.getNodes(), relations: facade.getRelations(), sequences: facade.getSequences!() })
    expect(listed.result).toEqual({ total: 1, rows: [expect.objectContaining({ name: 'Checkout', stepCount: 2 })] })
    const got = runModelQuery(`GET SEQUENCE ${ctx.resolveId('checkout')}`, {
      nodes: facade.getNodes(), relations: facade.getRelations(), views: facade.getViews!(), sequences: facade.getSequences!(),
    }).result as { steps: Array<{ step: number; stepDescription?: string }>; views: unknown[] }
    expect(got.steps[0]).toMatchObject({ step: 1, stepDescription: 'User places an order' })
    expect(got.views).toHaveLength(1)
  })

  it('refuses a dynamic view without a sequence and steps with unknown relations', () => {
    const { call } = setup()
    expect(call('create_view', { tempId: 'v', name: 'X', kind: 'dynamic' }).resultText).toContain('needs a sequenceId')
    expect(call('create_sequence', { tempId: 's', name: 'S', steps: [{ relationId: 'nope' }] }).resultText).toContain('unknown relationId')
  })

  it('update_sequence replaces steps; delete_sequence unlinks its views', () => {
    const { facade, call, ctx, rel } = setup()
    call('create_sequence', { tempId: 's', name: 'S', steps: [{ relationId: rel('Orders') }] })
    call('create_view', { tempId: 'v', name: 'V', kind: 'dynamic', sequenceId: 's' })
    expect(call('update_sequence', { id: 's', name: 'Renamed', steps: [{ relationId: rel('Charges') }, { relationId: rel('Charges') }] }).ok).toBe(true)
    expect(facade.getSequences!()[ctx.resolveId('s')]).toMatchObject({ name: 'Renamed', relationIds: [rel('Charges'), rel('Charges')] })
    expect(call('delete_sequence', { id: 's' }).ok).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')].sequenceId).toBeUndefined()
  })
})

describe('update_view', () => {
  it('renames, changes kind and sets hidden relations', () => {
    const { facade, call, ctx, rel } = setup()
    call('create_view', { tempId: 'v', name: 'Context' })
    const result = call('update_view', { id: 'v', name: 'System context', kind: 'matrix', hiddenRelationIds: [rel('Charges')] })
    expect(result.ok, result.resultText).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')]).toMatchObject({ name: 'System context', kind: 'matrix', hiddenRelationIds: [rel('Charges')] })
    expect(call('update_view', { id: 'v', hiddenRelationIds: [] }).ok).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')].hiddenRelationIds).toEqual([])
  })

  it('shows elements open or folded in the view only, over their fold on the model', () => {
    const { facade, call, ctx } = setup()
    call('add_node', { tempId: 'grp', type: 'group', label: 'Layer' })
    call('add_node', { tempId: 'inner', type: 'system', label: 'Inner', parentId: 'grp' })
    call('create_view', { tempId: 'v', name: 'Layer view', nodeIds: ['grp', 'inner'] })
    const grp = ctx.resolveId('grp')
    // Folded on the model, as a collapse in Studio's All elements leaves it.
    facade.getNodes()[grp].collapsed = true
    const opened = call('update_view', { id: 'v', expand: ['grp'] })
    expect(opened.ok, opened.resultText).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')]).toMatchObject({ expandedNodeIds: [grp], collapsedNodeIds: [] })
    expect(call('update_view', { id: 'v', collapse: ['grp'] }).ok).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')]).toMatchObject({ expandedNodeIds: [], collapsedNodeIds: [grp] })
    // Open on the model: opening it in the view needs no override.
    facade.getNodes()[grp].collapsed = false
    expect(call('update_view', { id: 'v', expand: ['grp'] }).ok).toBe(true)
    expect(facade.getViews!()[ctx.resolveId('v')]).toMatchObject({ expandedNodeIds: [], collapsedNodeIds: [] })
    expect(call('update_view', { id: 'v', expand: ['nope'] }).resultText).toContain('unknown element')
  })

  it('puts views into folders of the list of views, and back at the top', () => {
    const { facade, call, ctx } = setup()
    expect(call('create_view', { tempId: 'v', name: 'Studio', folder: ' C4 / Components/ ' }).ok).toBe(true)
    const v = () => facade.getViews!()[ctx.resolveId('v')]
    expect(v().folder).toBe('C4/Components')
    expect(call('update_view', { id: 'v', folder: 'C4' }).ok).toBe(true)
    expect(v().folder).toBe('C4')
    expect(call('update_view', { id: 'v', folder: '' }).ok).toBe(true)
    expect(v()).not.toHaveProperty('folder')
    expect(call('update_view', { id: 'v', folder: 3 }).resultText).toContain('folder must be a string')
  })

  it('orders views among the places they hold, which orders folders too', () => {
    const { facade, call } = setup()
    call('create_view', { tempId: 'a', name: 'A', folder: 'One' })
    call('create_view', { tempId: 'b', name: 'B' })
    call('create_view', { tempId: 'c', name: 'C', folder: 'Two' })
    call('create_view', { tempId: 'd', name: 'D', folder: 'One' })
    const names = () => Object.values(facade.getViews!()).map((v) => v.name)
    expect(call('order_views', { ids: ['d', 'c', 'a'] }).ok).toBe(true)
    expect(names()).toEqual(['D', 'B', 'C', 'A'])
    expect(call('order_views', { ids: ['c', 'nope'] }).resultText).toContain('unknown view')
    expect(call('order_views', { ids: ['c', 'c'] }).resultText).toContain('listed twice')
  })

  it('sets how a view draws relations, or hands it back to the model', () => {
    const { facade, call, ctx } = setup()
    expect(call('create_view', { tempId: 'v', name: 'Ortho', edgeStyle: 'orthogonal' }).ok).toBe(true)
    const v = () => facade.getViews!()[ctx.resolveId('v')]
    expect(v().edgeStyle).toBe('orthogonal')
    expect(call('update_view', { id: 'v', edgeStyle: 'model' }).ok).toBe(true)
    expect(v()).not.toHaveProperty('edgeStyle')
    expect(call('update_view', { id: 'v', edgeStyle: 'wavy' }).resultText).toContain('edgeStyle must be')
  })

  it('refuses switching to dynamic without a sequence, and unknown relations', () => {
    const { call } = setup()
    call('create_view', { tempId: 'v', name: 'Context' })
    expect(call('update_view', { id: 'v', kind: 'dynamic' }).resultText).toContain('needs a sequenceId')
    expect(call('update_view', { id: 'v', hiddenRelationIds: ['nope'] }).resultText).toContain('unknown relation')
    expect(call('update_view', { id: 'v' }).resultText).toContain('nothing to change')
  })
})
