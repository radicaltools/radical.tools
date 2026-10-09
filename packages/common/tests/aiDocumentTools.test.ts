import { describe, it, expect } from 'vitest'
import { buildToolDefs, hasTool, runTool } from '../src/ai/tools/index'
import type { ToolRunContext } from '../src/ai/tools/types'
import { createModelFacade, type ModelFacadeOptions } from '../src/ai/modelFacade'
import { builtInGovernanceMetamodel } from '../src/metamodel/index'
import { compareModels, documentMetamodel } from '../src/model'
import type { C4Node, DiagramData } from '../src/c4'

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
    const forge = buildToolDefs(builtInGovernanceMetamodel(), { exclude: ['metamodel', 'presentation', 'milestone'] }).map((d) => d.name)
    expect(forge).not.toContain('upsert_node_type')
    expect(forge).not.toContain('create_presentation')
    expect(forge).not.toContain('create_milestone')
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

describe('milestone tools', () => {
  it('save phases of the model, rename, compare and delete them', async () => {
    const { facade, call, ctx } = setup()
    expect((await call('list_milestones', {})).resultText).toContain('no milestones yet')
    await call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'erp', type: 'system', label: 'ERP' })
    await call('add_relation', { sourceId: 'shop', targetId: 'erp', label: 'orders' })
    const asIs = await call('create_milestone', { name: 'As-is' })
    expect(asIs.ok, asIs.resultText).toBe(true)
    expect(asIs.resultText).toContain('2 element(s), 1 relation(s)')
    const asIsId = facade.getMilestones!()[0].id

    // The next phase: a new system, a renamed one, the old relation gone.
    await call('add_node', { tempId: 'pay', type: 'system', label: 'Payments' })
    await call('update_node', { id: 'shop', label: 'Web shop' })
    await call('delete_relation', { id: Object.keys(facade.getRelations())[0] })
    await call('add_relation', { sourceId: 'shop', targetId: 'pay', label: 'pays' })
    // Layout changes are not changes to the system.
    facade.updateNode(ctx.resolveId('erp'), { x: 500 })
    expect((await call('create_milestone', { name: 'Target' })).ok).toBe(true)
    const [saved, target] = facade.getMilestones!()
    expect(saved.nodes[ctx.resolveId('shop')].label).toBe('Shop')
    expect(Object.keys(target.nodes)).toHaveLength(3)

    const listed = JSON.parse((await call('list_milestones', {})).resultText)
    expect(listed).toEqual([
      expect.objectContaining({ id: asIsId, name: 'As-is', nodes: 2, relations: 1 }),
      expect.objectContaining({ id: target.id, name: 'Target', nodes: 3, relations: 1 }),
    ])

    const compared = await call('compare_milestones', { from: asIsId, to: target.id })
    expect(compared.ok, compared.resultText).toBe(true)
    expect(compared.resultText).toContain('From milestone "As-is" to milestone "Target"')
    expect(compared.resultText).toMatch(/Elements added:\n- Payments \(system, /)
    expect(compared.resultText).toMatch(/Elements changed:\n- Web shop \(system, [^)]+\): label\n/)
    expect(compared.resultText).toContain('Relations removed:\n- Shop → ERP "orders"')
    expect(compared.resultText).toContain('Relations added:\n- Web shop → Payments "pays"')
    expect(compared.resultText).not.toContain('ERP (system')
    expect((await call('compare_milestones', { from: target.id })).resultText).toContain('No changes from milestone "Target" to the current model')
    expect((await call('compare_milestones', { from: 'nope' })).ok).toBe(false)

    expect((await call('update_milestone', { id: asIsId, name: 'Today' })).ok).toBe(true)
    expect((await call('update_milestone', { id: asIsId, name: ' ' })).ok).toBe(false)
    expect((await call('delete_milestone', { id: target.id })).ok).toBe(true)
    expect(facade.toDiagramData().snapshots).toEqual([expect.objectContaining({ id: asIsId, name: 'Today' })])
    expect((await call('delete_milestone', { id: target.id })).resultText).toContain('unknown milestone')
    // The current model never changes.
    expect(Object.keys(facade.getNodes())).toHaveLength(3)
  })

  it('let a slide show a milestone, its focus checked against that model', async () => {
    const { facade, call, ctx } = setup()
    await call('add_node', { tempId: 'old', type: 'system', label: 'Mainframe' })
    await call('create_milestone', { name: 'As-is' })
    const asIs = facade.getMilestones!()[0].id
    await call('delete_node', { id: 'old' })
    await call('add_node', { tempId: 'new', type: 'system', label: 'Cloud' })
    const created = await call('create_presentation', {
      name: 'Roadmap',
      slides: [{ name: 'Today', milestone: asIs, focus: ['old'] }, { name: 'Tomorrow', focus: ['new'] }],
    })
    expect(created.ok, created.resultText).toBe(true)
    const roadmap = facade.getPresentations!()[0]
    expect(roadmap.slides.map((slide) => slide.snapshotId)).toEqual([asIs, null])
    expect(roadmap.slides[0].focusNodeIds).toEqual([ctx.resolveId('old')])
    // A kept slide keeps its milestone unless told otherwise.
    await call('update_presentation', { id: roadmap.id, slides: [{ id: roadmap.slides[0].id, name: 'Before' }] })
    expect(facade.getPresentations!()[0].slides[0].snapshotId).toBe(asIs)
    await call('update_presentation', { id: roadmap.id, slides: [{ id: roadmap.slides[0].id, name: 'Now', milestone: null }] })
    expect(facade.getPresentations!()[0].slides[0].snapshotId).toBeNull()
    expect((await call('update_presentation', { id: roadmap.id, slides: [{ name: 'X', milestone: 'nope' }] })).resultText).toContain('unknown milestone')
    expect((await call('update_presentation', { id: roadmap.id, slides: [{ name: 'X', focus: ['old'] }] })).resultText).toContain('unknown node')
  })

  it('re-frame a Studio slide moved to another milestone and unlink slides from a deleted one', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 'old', type: 'system', label: 'Mainframe' })
    await call('create_milestone', { name: 'As-is' })
    await call('create_milestone', { name: 'Target' })
    const [asIs, target] = facade.getMilestones!().map((m) => m.id)
    // A slide added in Studio: captured camera, canvas and model copy.
    const captured = {
      id: 's1', name: 'Today', snapshotId: asIs, viewId: null, viewport: { x: 10, y: 20, zoom: 1.5 },
      canvasState: { nodes: {} }, modelSnapshot: { nodes: {}, relations: {} }, focusNodeIds: ['gone'],
    }
    facade.setPresentations!([{ id: 'p1', name: 'Roadmap', slides: [captured] }])

    // Renaming keeps what Studio captured.
    await call('update_presentation', { id: 'p1', slides: [{ id: 's1', name: 'Now' }] })
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ ...captured, name: 'Now' })
    // Another milestone: the captured framing belonged to the old model.
    const moved = await call('update_presentation', { id: 'p1', slides: [{ id: 's1', name: 'Later', milestone: target }] })
    expect(moved.ok, moved.resultText).toBe(true)
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ id: 's1', name: 'Later', snapshotId: target, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } })

    expect((await call('delete_milestone', { id: target })).ok).toBe(true)
    expect(facade.getPresentations!()[0].slides[0].snapshotId).toBeNull()
    expect(facade.getMilestones!().map((m) => m.id)).toEqual([asIs])
  })

  it('refuse to read the current model while Studio has a milestone loaded over it', async () => {
    const { facade, call, ctx } = setup()
    await call('add_node', { tempId: 'a', type: 'system', label: 'A' })
    await call('create_milestone', { name: 'As-is' })
    await call('create_milestone', { name: 'Target' })
    const [asIs, target] = facade.getMilestones!()
    ctx.diagram = { ...facade, openMilestone: () => asIs }
    const created = await call('create_milestone', { name: 'Next' })
    expect(created.ok).toBe(false)
    expect(created.resultText).toContain('milestone "As-is" is open in Studio\'s timeline')
    expect((await call('compare_milestones', { from: asIs.id })).resultText).toContain('is open in Studio\'s timeline')
    // Between two milestones the open one does not matter.
    expect((await call('compare_milestones', { from: asIs.id, to: target.id })).ok).toBe(true)
    expect(facade.getMilestones!()).toHaveLength(2)
  })
})

describe('compareModels', () => {
  const node = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, type: 'adr', label: id, collapsed: false, x: 0, y: 0, width: 100, height: 50, ...extra }) as C4Node
  it('counts any field but the layout as a change, properties and relation types included', () => {
    const shared = node('same')
    const before = { nodes: { a: node('a', { status: 'proposed' }), b: node('b'), same: shared }, relations: { r: { id: 'r', sourceId: 'a', targetId: 'b' } } }
    const after = {
      nodes: { a: node('a', { status: 'accepted', x: 300, collapsed: true }), c: node('c'), same: shared },
      relations: { r: { id: 'r', sourceId: 'a', targetId: 'b', relationType: 'constrains' } },
    }
    expect(compareModels(before, after)).toEqual({
      nodes: { added: ['c'], removed: ['b'], changed: [{ id: 'a', fields: ['status'] }] },
      relations: { added: [], removed: [], changed: [{ id: 'r', fields: ['relationType'] }] },
    })
    // Moving or collapsing is not a change; a missing field equals an undefined one.
    expect(compareModels({ nodes: { a: node('a') }, relations: {} }, { nodes: { a: node('a', { x: 9, description: undefined }) }, relations: {} }).nodes.changed).toEqual([])
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
