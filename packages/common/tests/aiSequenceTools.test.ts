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

  it('refuses switching to dynamic without a sequence, and unknown relations', () => {
    const { call } = setup()
    call('create_view', { tempId: 'v', name: 'Context' })
    expect(call('update_view', { id: 'v', kind: 'dynamic' }).resultText).toContain('needs a sequenceId')
    expect(call('update_view', { id: 'v', hiddenRelationIds: ['nope'] }).resultText).toContain('unknown relation')
    expect(call('update_view', { id: 'v' }).resultText).toContain('nothing to change')
  })
})
