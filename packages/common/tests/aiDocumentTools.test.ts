import { describe, it, expect } from 'vitest'
import { buildToolDefs, hasTool, runTool } from '../src/ai/tools/index'
import type { ToolRunContext } from '../src/ai/tools/types'
import { createModelFacade, type ModelFacadeOptions } from '../src/ai/modelFacade'
import { builtInGovernanceMetamodel } from '../src/metamodel/index'
import { documentMetamodel } from '../src/model'
import type { DiagramData } from '../src/c4'

function setup(options: ModelFacadeOptions = {}) {
  const facade = createModelFacade({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, options)
  const temps = new Map<string, string>()
  const ctx: ToolRunContext = {
    diagram: facade,
    resolveId: (id) => temps.get(id) ?? id,
    registerTempId: (t, r) => { temps.set(t, r) },
    resetTempIds: () => temps.clear(),
    placeNext: () => ({ x: 0, y: 0 }),
  }
  return { facade, ctx, call: (name: string, input: unknown) => runTool(name, input, ctx) }
}

describe('tool groups', () => {
  it('leave out the excluded groups, keeping the rest in order', () => {
    const all = buildToolDefs(builtInGovernanceMetamodel()).map((d) => d.name)
    expect(all).toEqual(expect.arrayContaining(['smart_layout', 'create_presentation', 'upsert_node_type']))
    const forge = buildToolDefs(builtInGovernanceMetamodel(), { exclude: ['metamodel', 'presentation'] }).map((d) => d.name)
    expect(forge).not.toContain('upsert_node_type')
    expect(forge).not.toContain('create_presentation')
    expect(forge).toContain('smart_layout')
    expect(forge).toEqual(all.filter((name) => forge.includes(name)))
    expect(hasTool('smart_layout')).toBe(true)
  })
})

describe('metamodel tools', () => {
  it('copy a preset on the first edit, and the copy survives reloading', async () => {
    const { facade, call } = setup()
    const added = await call('upsert_node_type', {
      id: 'risk', label: 'Risk', baseType: 'adr', tableTab: true,
      properties: [{ key: 'severity', label: 'Severity', type: 'enum', options: ['low', 'high'] }],
    })
    expect(added.ok, added.resultText).toBe(true)
    expect(added.resultText).toContain('copied to the custom metamodel')
    const mm = facade.getMetamodel!()!
    expect(mm.id).toBe('c4-ddd-governance-custom')
    expect(mm.nodeTypes.risk).toMatchObject({ label: 'Risk', builtin: false, tableTab: true })
    expect(mm.nodeTypes.risk.wizard).toBeUndefined()
    // The next edit works on the custom copy and says nothing about copying.
    const second = await call('upsert_node_type', { id: 'risk', color: '#ff0000' })
    expect(second.resultText).not.toContain('copied')
    expect(documentMetamodel(facade.toDiagramData().metamodel).nodeTypes.risk.color).toBe('#ff0000')
    expect(buildToolDefs(facade.getMetamodel!()).find((d) => d.name === 'add_node')!.inputSchema).toMatchObject({
      properties: { type: { enum: expect.arrayContaining(['risk']) } },
    })
  })

  it('refuse bad input, built-in deletes and types still in use', async () => {
    const { call } = setup()
    expect((await call('upsert_node_type', { id: 'Bad Id', label: 'X' })).resultText).toContain('lowercase')
    expect((await call('upsert_node_type', { id: 'x', label: 'X', allowedParents: ['nope'] })).resultText).toContain('unknown parent')
    expect((await call('upsert_node_type', { id: 'x', label: 'X', properties: [{ key: 'k', label: 'K', type: 'enum' }] })).resultText).toContain('needs string options')
    expect((await call('upsert_relation_type', { id: 'r', label: 'R', allowedPairs: [{ from: 'nope', to: 'adr' }] })).resultText).toContain('unknown source')
    expect((await call('delete_node_type', { id: 'system' })).resultText).toContain('built in')
    await call('upsert_node_type', { id: 'risk', label: 'Risk', allowedAtRoot: true })
    await call('add_node', { tempId: 'r', type: 'risk', label: 'Outage' })
    expect((await call('delete_node_type', { id: 'risk' })).resultText).toContain('still use')
  })

  it('delete a custom type and its parent and pair references', async () => {
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'risk', label: 'Risk', allowedAtRoot: true })
    await call('upsert_node_type', { id: 'control', label: 'Control', allowedParents: ['risk'] })
    await call('upsert_relation_type', { id: 'mitigates', label: 'Mitigates', allowedPairs: [{ from: 'adr', to: 'risk' }] })
    expect((await call('delete_node_type', { id: 'risk' })).ok).toBe(true)
    const mm = facade.getMetamodel!()!
    expect(mm.nodeTypes.control.allowedParents).toEqual([])
    expect(mm.relationTypes.mitigates.allowedPairs).toEqual([])
    expect((await call('delete_relation_type', { id: 'mitigates' })).ok).toBe(true)
  })
})

describe('presentation tools', () => {
  it('create, update (keeping a slide) and delete presentations', async () => {
    const { facade, call, ctx } = setup()
    await call('add_node', { tempId: 's', type: 'system', label: 'Shop' })
    await call('create_view', { tempId: 'v', name: 'Context', nodeIds: ['s'] })
    const created = await call('create_presentation', { name: 'Pitch', slides: [{ name: 'All' }, { name: 'Context', viewId: 'v' }] })
    expect(created.ok, created.resultText).toBe(true)
    const pitch = facade.getPresentations!()[0]
    expect(pitch.slides).toEqual([
      expect.objectContaining({ name: 'All', viewId: null, viewport: { x: 0, y: 0, zoom: 0 } }),
      expect.objectContaining({ name: 'Context', viewId: ctx.resolveId('v') }),
    ])
    const kept = pitch.slides[1]
    expect((await call('update_presentation', { id: pitch.id, name: 'Pitch v2', slides: [{ id: kept.id, name: 'Context!', viewId: 'v' }] })).ok).toBe(true)
    expect(facade.toDiagramData().presentations).toEqual([expect.objectContaining({ name: 'Pitch v2', slides: [{ ...kept, name: 'Context!' }] })])
    expect((await call('update_presentation', { id: pitch.id, slides: [{ name: 'X', viewId: 'nope' }] })).resultText).toContain('unknown viewId')
    expect((await call('delete_presentation', { id: pitch.id })).ok).toBe(true)
    expect(facade.getPresentations!()).toEqual([])
  })
})

describe('presentation focus', () => {
  it('zooms slides of one view onto its parts and validates the focus', async () => {
    const { facade, call, ctx } = setup()
    await call('add_node', { tempId: 's', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'a', type: 'container', label: 'API', parentId: 's' })
    await call('add_node', { tempId: 'd', type: 'container', label: 'DB', parentId: 's' })
    await call('add_node', { tempId: 'x', type: 'system', label: 'Bank' })
    await call('create_view', { tempId: 'v', name: 'Containers', nodeIds: ['a', 'd'] })
    const created = await call('create_presentation', {
      name: 'Tour',
      slides: [
        { name: 'Overview', viewId: 'v' },
        { name: 'API', viewId: 'v', focus: ['a'] },
        // The system is shown as the containers' ancestor.
        { name: 'Shop', viewId: 'v', focus: ['s', 'd'] },
      ],
    })
    expect(created.ok, created.resultText).toBe(true)
    const tour = facade.getPresentations!()[0]
    expect(tour.slides.map((slide) => slide.focusNodeIds)).toEqual([undefined, [ctx.resolveId('a')], [ctx.resolveId('s'), ctx.resolveId('d')]])
    expect(tour.slides.every((slide) => slide.viewId === ctx.resolveId('v') && slide.viewport.zoom === 0)).toBe(true)

    expect((await call('update_presentation', { id: tour.id, slides: [{ name: 'Bank', viewId: 'v', focus: ['x'] }] })).resultText).toContain('not in view "Containers"')
    expect((await call('update_presentation', { id: tour.id, slides: [{ name: 'Gone', viewId: 'v', focus: ['nope'] }] })).resultText).toContain('unknown node')

    // A slide framed in Studio keeps its camera until a new focus replaces it.
    const captured = { ...tour.slides[1], viewport: { x: 1, y: 2, zoom: 3 } }
    facade.setPresentations!([{ ...tour, slides: [captured] }])
    await call('update_presentation', { id: tour.id, slides: [{ id: captured.id, name: 'API!', viewId: 'v' }] })
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ ...captured, name: 'API!' })
    await call('update_presentation', { id: tour.id, slides: [{ id: captured.id, name: 'DB', viewId: 'v', focus: ['d'] }] })
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ ...captured, name: 'DB', viewport: { x: 0, y: 0, zoom: 0 }, focusNodeIds: [ctx.resolveId('d')] })
    await call('update_presentation', { id: tour.id, slides: [{ id: captured.id, name: 'All', viewId: 'v', focus: [] }] })
    expect(facade.getPresentations!()[0].slides[0].focusNodeIds).toBeUndefined()
  })
})

describe('smart_layout', () => {
  it('runs the injected layout and loads its result', async () => {
    const seen: Array<string | undefined> = []
    const { facade, call } = setup({
      runLayout: async (doc: DiagramData, viewId?: string) => {
        seen.push(viewId)
        return { ok: true, text: 'laid out', data: { ...doc, nodes: doc.nodes.map((n) => ({ ...n, x: 999 })) } }
      },
    })
    await call('add_node', { tempId: 's', type: 'system', label: 'Shop' })
    await call('create_view', { tempId: 'v', name: 'Context', nodeIds: ['s'] })
    await call('create_view', { tempId: 't', name: 'Records', kind: 'table' })
    expect(await call('smart_layout', {})).toMatchObject({ ok: true, resultText: 'laid out' })
    expect(Object.values(facade.getNodes())[0].x).toBe(999)
    await call('smart_layout', { viewId: 'v' })
    expect(seen).toEqual([undefined, Object.keys(facade.getViews!()).find((id) => facade.getViews!()[id].name === 'Context')])
    expect((await call('smart_layout', { viewId: 't' })).resultText).toContain('table view')
  })

  it('reports when the context cannot lay out', async () => {
    const { call } = setup()
    expect((await call('smart_layout', {})).resultText).toContain('not available')
  })
})
