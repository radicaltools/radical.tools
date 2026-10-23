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
      id: 'risk', label: 'Risk', baseType: 'adr', summary: '[{status.cap}: ]{description}',
      properties: [{ key: 'severity', label: 'Severity', type: 'enum', options: ['low', 'high'] }],
    })
    expect(added.ok, added.resultText).toBe(true)
    expect(added.resultText).toContain('copied to the custom metamodel')
    const mm = facade.getMetamodel!()!
    expect(mm.id).toBe('c4-ddd-governance-custom')
    expect(mm.nodeTypes.risk).toMatchObject({ label: 'Risk', builtin: false, summary: '[{status.cap}: ]{description}' })
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

  it('refuse a property keyed like a field every element or relation has', async () => {
    // A property is a plain field of the element: keyed `type`, the
    // properties panel edited the element's type with it.
    const { facade, call } = setup()
    for (const key of ['type', 'id', 'parentId', 'x', 'collapsed']) {
      const res = await call('upsert_node_type', { id: 'risk', label: 'Risk', properties: [{ key, label: 'K', type: 'text' }] })
      expect(res.ok, key).toBe(false)
      expect(res.resultText).toContain(`"${key}" is a field every element has`)
    }
    expect(facade.getMetamodel!()!.nodeTypes.risk).toBeUndefined()
    const rel = await call('upsert_relation_type', { id: 'r', label: 'R', allowedPairs: [], properties: [{ key: 'sourceId', label: 'K', type: 'text' }] })
    expect(rel.resultText).toContain('"sourceId" is a field every relation has')
    // A relation has no `type` or `x` of its own.
    expect((await call('upsert_relation_type', { id: 'r', label: 'R', allowedPairs: [], properties: [{ key: 'type', label: 'K', type: 'text' }] })).ok).toBe(true)
  })

  it('delete a custom type and its parent and pair references', async () => {
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'risk', label: 'Risk', allowedAtRoot: true })
    await call('upsert_node_type', { id: 'control', label: 'Control', allowedParents: ['risk'] })
    await call('upsert_relation_type', { id: 'mitigates', label: 'Mitigates', allowedPairs: [{ from: 'adr', to: 'risk' }, { from: 'adr', to: 'control' }] })
    expect((await call('delete_node_type', { id: 'risk' })).ok).toBe(true)
    const mm = facade.getMetamodel!()!
    expect(mm.nodeTypes.control.allowedParents).toEqual([])
    expect(mm.relationTypes.mitigates.allowedPairs).toEqual([{ from: 'adr', to: 'control' }])
    expect((await call('delete_relation_type', { id: 'mitigates' })).ok).toBe(true)
  })

  it('refuse to delete a type the only pairs of a relation type name', async () => {
    // Left with no pair, the relation type allowed any pair: an ADR could
    // then be connected to a need, and nothing said so.
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'badge', label: 'Badge', allowedAtRoot: true })
    await call('upsert_relation_type', { id: 'issues', label: 'Issues', allowedPairs: [{ from: 'badge', to: 'badge' }] })
    const res = await call('delete_node_type', { id: 'badge' })
    expect(res.ok).toBe(false)
    expect(res.resultText).toContain('connects only Badge')
    expect(facade.getMetamodel!()!.relationTypes.issues.allowedPairs).toEqual([{ from: 'badge', to: 'badge' }])
  })

  it('refuse to delete a type a viewpoint or a view names', async () => {
    // The viewpoint kept subject and chain of a type gone, and upsert_viewpoint
    // then refused them as unknown.
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'service', label: 'Service', allowedAtRoot: true })
    await call('upsert_relation_type', { id: 'calls', label: 'Calls', allowedPairs: [{ from: 'service', to: 'service' }, { from: 'system', to: 'system' }] })
    expect((await call('upsert_viewpoint', { label: 'Service map', kind: 'static', subjectTypes: ['service'] })).ok).toBe(true)
    expect((await call('delete_node_type', { id: 'service' })).resultText).toContain('the viewpoint "Service map" makes a view per Service')
    const id = facade.getMetamodel!()!.viewpoints!.find((v) => v.label === 'Service map')!.id
    expect((await call('upsert_viewpoint', { id, subjectTypes: [], pipeline: { levels: [{ ways: [{ types: ['system'] }] }, { ways: [{ via: { relationType: 'calls', direction: 'out' } }] }] } })).ok).toBe(true)
    expect((await call('delete_relation_type', { id: 'calls' })).resultText).toContain('the filter of the viewpoint "Service map" names "Calls"')
    expect((await call('delete_viewpoint', { id })).ok).toBe(true)
    // The views keep the filter: they name it now.
    await call('create_view', { tempId: 'v', name: 'Calls', pipeline: { levels: [{ ways: [{ types: ['service'] }] }] } })
    expect((await call('delete_node_type', { id: 'service' })).resultText).toContain('the filter of the view "Calls" names Service')
    expect((await call('delete_view', { id: 'v' })).ok).toBe(true)
    expect((await call('delete_node_type', { id: 'service' })).ok).toBe(true)
    expect(facade.getMetamodel!()!.nodeTypes.service).toBeUndefined()
  })

  it('refuse to delete a type a milestone still holds elements or relations of', async () => {
    // Restore to live then brought back an element of an unknown type.
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'service', label: 'Service', allowedAtRoot: true })
    await call('upsert_relation_type', { id: 'calls', label: 'Calls', allowedPairs: [{ from: 'service', to: 'service' }] })
    await call('add_node', { tempId: 'a', type: 'service', label: 'Legacy Billing' })
    await call('add_node', { tempId: 'b', type: 'service', label: 'Ledger' })
    expect((await call('add_relation', { sourceId: 'a', targetId: 'b', relationType: 'calls' })).ok).toBe(true)
    expect((await call('create_milestone', { name: 'As-is' })).ok).toBe(true)
    for (const id of ['a', 'b']) expect((await call('delete_node', { id })).ok).toBe(true)
    expect((await call('delete_relation_type', { id: 'calls' })).resultText).toContain('the milestone "As-is" holds 1 relation of type "Calls"')
    expect((await call('delete_node_type', { id: 'service' })).resultText).toContain('the milestone "As-is" holds 2 elements of type Service')
    expect(facade.getMetamodel!()!.nodeTypes.service).toBeDefined()
    expect(facade.getMetamodel!()!.relationTypes.calls).toBeDefined()
  })

  it('describe a new type, without inheriting the description of its base type', async () => {
    const { facade, call } = setup()
    await call('upsert_node_type', { id: 'risk', label: 'Risk', baseType: 'adr', allowedAtRoot: true })
    expect(facade.getMetamodel!()!.nodeTypes.risk.description).toBeUndefined()
    await call('upsert_node_type', { id: 'risk', description: ' Something that may go wrong. ' })
    expect(facade.getMetamodel!()!.nodeTypes.risk.description).toBe('Something that may go wrong.')
    await call('upsert_relation_type', { id: 'mitigates', label: 'Mitigates', description: 'The control lowers the risk.' })
    expect(facade.getMetamodel!()!.relationTypes.mitigates.description).toBe('The control lowers the risk.')
  })

  it('set and clear how a relation type reads from either end', async () => {
    const { facade, call } = setup()
    await call('upsert_relation_type', { id: 'ownership', label: 'Ownership', forwardLabel: 'Owns', inverseLabel: ' Owned by ' })
    expect(facade.getMetamodel!()!.relationTypes.ownership).toMatchObject({ label: 'Ownership', forwardLabel: 'Owns', inverseLabel: 'Owned by' })
    await call('upsert_relation_type', { id: 'ownership', forwardLabel: '' })
    const def = facade.getMetamodel!()!.relationTypes.ownership
    expect(def.forwardLabel).toBeUndefined()
    expect(def.inverseLabel).toBe('Owned by')
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
    // A slide is listed once (Studio's delete then took both from the file).
    const twice = await call('update_presentation', { id: pitch.id, slides: [{ id: kept.id, name: 'A' }, { id: kept.id, name: 'B' }] })
    expect(twice.ok).toBe(false)
    expect(twice.resultText).toContain('repeats the id')
    expect((await call('delete_presentation', { id: pitch.id })).ok).toBe(true)
    expect(facade.getPresentations!()).toEqual([])
  })

  // Item 199: slides reordered by id and name lost every view and framing,
  // while a missing milestone or focus kept the old.
  it('keeps a kept slide\'s view and framing when viewId is left out', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 's', type: 'system', label: 'Shop' })
    await call('create_view', { tempId: 'v', name: 'Context', nodeIds: ['s'] })
    await call('create_view', { tempId: 'w', name: 'Other', nodeIds: ['s'] })
    await call('create_presentation', { name: 'Pitch', slides: [{ name: 'One', viewId: 'v' }, { name: 'Two', viewId: 'w' }] })
    const pitch = facade.getPresentations!()[0]
    const [one, two] = pitch.slides.map((slide) => ({ ...slide, viewport: { x: 1, y: 2, zoom: 3 }, canvasState: { nodes: {} } }))
    facade.setPresentations!([{ ...pitch, slides: [one, two] }])
    const reordered = await call('update_presentation', { id: pitch.id, slides: [{ id: two.id, name: 'Two' }, { id: one.id, name: 'One' }] })
    expect(reordered.ok, reordered.resultText).toBe(true)
    expect(facade.getPresentations!()[0].slides).toEqual([two, one])
    // viewId null still moves it to All elements.
    await call('update_presentation', { id: pitch.id, slides: [{ id: two.id, name: 'Two', viewId: null }] })
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ id: two.id, name: 'Two', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } })
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
        { name: 'Both', viewId: 'v', focus: ['a', 'd'] },
      ],
    })
    expect(created.ok, created.resultText).toBe(true)
    const tour = facade.getPresentations!()[0]
    expect(tour.slides.map((slide) => slide.focusNodeIds)).toEqual([undefined, [ctx.resolveId('a')], [ctx.resolveId('a'), ctx.resolveId('d')]])
    expect(tour.slides.every((slide) => slide.viewId === ctx.resolveId('v') && slide.viewport.zoom === 0)).toBe(true)

    expect((await call('update_presentation', { id: tour.id, slides: [{ name: 'Bank', viewId: 'v', focus: ['x'] }] })).resultText).toContain('not in view "Containers"')
    // The system holds the containers on the canvas, but the view does not show it.
    expect((await call('update_presentation', { id: tour.id, slides: [{ name: 'Shop', viewId: 'v', focus: ['s'] }] })).resultText).toContain('not in view "Containers"')
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

  // A slide with no view shows the All elements table, and a table, wiki,
  // matrix, hierarchy, flow or Warnier view has no canvas: a focus did nothing.
  it('refuses a focus on a slide that shows no canvas', async () => {
    const { call } = setup()
    await call('add_node', { tempId: 's', type: 'system', label: 'Shop' })
    await call('create_view', { tempId: 't', name: 'Table', nodeIds: ['s'], kind: 'table' })
    const onTable = await call('create_presentation', { name: 'T', slides: [{ name: 'Rows', viewId: 't', focus: ['s'] }] })
    expect(onTable.ok).toBe(false)
    expect(onTable.resultText).toContain('view "Table" is a table')
    const noView = await call('create_presentation', { name: 'T', slides: [{ name: 'All', focus: ['s'] }] })
    expect(noView.ok).toBe(false)
    expect(noView.resultText).toContain('All elements')
    // An empty focus (the whole view) is fine anywhere.
    expect((await call('create_presentation', { name: 'T', slides: [{ name: 'All', focus: [] }] })).ok).toBe(true)
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

  // Milestones keep sequences, and the comparison left them out: a flow
  // changed between two phases read as "No changes".
  it('compare the sequences too', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'erp', type: 'system', label: 'ERP' })
    await call('add_relation', { sourceId: 'shop', targetId: 'erp', label: 'orders' })
    const rel = Object.keys(facade.getRelations())[0]
    await call('create_sequence', { tempId: 'order', name: 'Order', steps: [{ relationId: rel, description: 'sends' }] })
    await call('create_milestone', { name: 'As-is' })
    const asIs = facade.getMilestones!()[0].id
    const seqId = Object.keys(facade.getSequences!())[0]
    await call('update_sequence', { id: seqId, steps: [{ relationId: rel, description: 'sends' }, { relationId: rel, description: 'sends again' }] })
    await call('create_sequence', { tempId: 'refund', name: 'Refund' })
    const compared = (await call('compare_milestones', { from: asIs })).resultText
    expect(compared).not.toContain('No changes')
    expect(compared).toMatch(/Sequences added:\n- Refund \(/)
    expect(compared).toMatch(/Sequences changed:\n- Order \([^)]+\): steps/)
  })

  it('let a slide show a milestone, its focus checked against that model', async () => {
    const { facade, call, ctx } = setup()
    await call('add_node', { tempId: 'old', type: 'system', label: 'Mainframe' })
    await call('create_milestone', { name: 'As-is' })
    const asIs = facade.getMilestones!()[0].id
    await call('delete_node', { id: 'old' })
    await call('add_node', { tempId: 'new', type: 'system', label: 'Cloud' })
    // A view listing no elements shows every element of the model it is shown with.
    expect((await call('create_view', { tempId: 'all', name: 'Landscape', nodeIds: [] })).ok).toBe(true)
    const created = await call('create_presentation', {
      name: 'Roadmap',
      slides: [{ name: 'Today', viewId: 'all', milestone: asIs, focus: ['old'] }, { name: 'Tomorrow', viewId: 'all', focus: ['new'] }],
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
    expect((await call('update_presentation', { id: roadmap.id, slides: [{ name: 'X', viewId: 'all', focus: ['old'] }] })).resultText).toContain('unknown node')
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

    // Captured on Target in Studio: once Target is deleted, nothing of it
    // stays (its copy of the model drew Target still).
    facade.setPresentations!([{ id: 'p1', name: 'Roadmap', slides: [{ ...captured, name: 'Later', snapshotId: target }] }])
    expect((await call('delete_milestone', { id: target })).ok).toBe(true)
    expect(facade.getPresentations!()[0].slides[0]).toEqual({ id: 's1', name: 'Later', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } })
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

  it('refuses a flow (dynamic) view: Studio plays its sequence and draws no canvas there', async () => {
    // It reported a better layout and wrote nothing, every time; align_nodes
    // and grid_nodes wrote alignments into a view no canvas shows.
    const seen: Array<string | undefined> = []
    const { facade, call } = setup({ runLayout: async (doc: DiagramData, viewId?: string) => { seen.push(viewId); return { ok: true, text: 'laid out', data: doc } } })
    await call('add_node', { tempId: 'a', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'b', type: 'system', label: 'Bank' })
    await call('add_relation', { sourceId: 'a', targetId: 'b', label: 'pays' })
    const seq = await call('create_sequence', { tempId: 'seq', name: 'Pay', steps: [{ relationId: Object.keys(facade.getRelations())[0] }] })
    expect(seq.ok, seq.resultText).toBe(true)
    expect((await call('create_view', { tempId: 'f', name: 'Place Order Flow', kind: 'dynamic', sequenceId: 'seq' })).ok).toBe(true)
    const flow = Object.values(facade.getViews!()).find((v) => v.name === 'Place Order Flow')!
    for (const [tool, input] of [['smart_layout', {}], ['align_nodes', { nodeIds: ['a', 'b'], axis: 'horizontal' }], ['grid_nodes', { nodeIds: ['a', 'b'] }]] as const) {
      const res = await call(tool, { ...input, viewId: 'f' })
      expect(res.ok, tool).toBe(false)
      expect(res.resultText).toContain(`${tool}: "Place Order Flow" is a dynamic view; only static views have a canvas layout`)
    }
    expect(seen).toEqual([])
    expect(facade.getViews!()[flow.id].layoutConstraints ?? []).toEqual([])
  })

  it('reports when the context cannot lay out', async () => {
    const { call } = setup()
    expect((await call('smart_layout', {})).resultText).toContain('not available')
  })
})

describe('reference properties through the tools', () => {
  it('turn tempIds into node ids and refuse nodes of another type', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 'm', type: 'state-machine', label: 'Order' })
    await call('add_node', { tempId: 'a', type: 'state', label: 'Pending', parentId: 'm' })
    await call('add_node', { tempId: 'b', type: 'state', label: 'Paid', parentId: 'm' })
    await call('add_node', { tempId: 'pay', type: 'event', label: 'PaymentReceived', parentId: 'm' })
    await call('add_node', { tempId: 'paid', type: 'event', label: 'OrderPaid', parentId: 'm' })
    const ok = await call('add_relation', { sourceId: 'a', targetId: 'b', relationType: 'transition', properties: { event: 'pay', raises: ['paid'] } })
    expect(ok.ok).toBe(true)
    const ids = Object.fromEntries(Object.values(facade.getNodes()).map((n) => [n.label, n.id]))
    const t = Object.values(facade.getRelations())[0] as unknown as Record<string, unknown>
    expect(t.event).toBe(ids.PaymentReceived)
    expect(t.raises).toEqual([ids.OrderPaid])

    const wrong = await call('update_relation', { id: t.id, properties: { event: ids.Pending } })
    expect(wrong.resultText).toContain('"Pending" is of type state, not event')
    expect((Object.values(facade.getRelations())[0] as unknown as Record<string, unknown>).event).toBe(ids.PaymentReceived)
  })

  it('need a node type to point at in the metamodel', async () => {
    const { call } = setup()
    const bad = await call('upsert_node_type', { id: 'risk', label: 'Risk', baseType: 'adr', properties: [{ key: 'owner', label: 'Owner', type: 'ref' }] })
    expect(bad.ok).toBe(false)
    const good = await call('upsert_node_type', { id: 'risk', label: 'Risk', baseType: 'adr', properties: [{ key: 'owner', label: 'Owner', type: 'ref', refType: 'person', multiple: true }] })
    expect(good.ok).toBe(true)
  })
})

describe('add_relation with no type and a properties bag', () => {
  // The bag was spread into the relation: `targetId` or `relationType` in
  // it replaced the checked ends and type, and get_issues said nothing.
  it('takes no end, type, label or id from the bag', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'bank', type: 'system', label: 'Bank' })
    const res = await call('add_relation', {
      sourceId: 'shop', targetId: 'bank', label: 'pays',
      properties: { targetId: 'ghost-node', relationType: 'nonexistent-type', id: 'x', note: 'kept' },
    })
    expect(res.ok, res.resultText).toBe(true)
    expect(res.resultText).toMatch(/ignored property "targetId"/)
    const rel = Object.values(facade.getRelations())[0] as unknown as Record<string, unknown>
    const nodes = facade.getNodes()
    expect(nodes[rel.targetId as string]?.label).toBe('Bank')
    expect(rel.relationType).not.toBe('nonexistent-type')
    // No type the bag could be checked against: nothing of it is stored.
    expect(rel.note).toBeUndefined()
    expect(res.resultText).toMatch(/ignored property "note"/)
  })

  it('checks the bag against the type inferred for the pair, and ignores it where no single type fits', async () => {
    // The bag was stored unchecked (an enum value no type has, a key no type
    // defines), and get_issues said nothing.
    const { facade, call } = setup()
    await call('add_node', { tempId: 'm', type: 'state-machine', label: 'Order' })
    await call('add_node', { tempId: 'a', type: 'state', label: 'Pending', parentId: 'm' })
    await call('add_node', { tempId: 'b', type: 'state', label: 'Paid', parentId: 'm' })
    await call('add_node', { tempId: 'o', type: 'entity', label: 'Order' })
    await call('add_node', { tempId: 'l', type: 'entity', label: 'Line' })
    const one = await call('add_relation', { sourceId: 'a', targetId: 'b', properties: { guard: 'paid', bogus: 1 } })
    expect(one.ok, one.resultText).toBe(true)
    expect(one.resultText).toMatch(/ignored property "bogus"/)
    const two = await call('add_relation', { sourceId: 'o', targetId: 'l', properties: { cardinality: 'bogus' } })
    expect(two.ok, two.resultText).toBe(true)
    expect(two.resultText).toMatch(/ignored property "cardinality"/)
    const [t, r] = Object.values(facade.getRelations()) as unknown as Record<string, unknown>[]
    expect(t).toMatchObject({ relationType: 'transition', guard: 'paid' })
    expect(t.bogus).toBeUndefined()
    expect(r.relationType).toBeUndefined()
    expect(r.cardinality).toBeUndefined()
  })
})

describe('update_node label', () => {
  it('refuses a blank label as add_node does, and trims one given', async () => {
    // "   " was taken: the element had no name, and its file became person.md.
    const { facade, call } = setup()
    await call('add_node', { tempId: 'a', type: 'person', label: 'Alice' })
    const id = Object.keys(facade.getNodes())[0]
    for (const label of ['', '   ']) {
      const res = await call('update_node', { id, label })
      expect(res.ok).toBe(false)
      expect(res.resultText).toBe('update_node: label cannot be empty')
    }
    expect((await call('update_node', { id, label: '  Alice Smith ' })).ok).toBe(true)
    expect(facade.getNodes()[id].label).toBe('Alice Smith')
  })
})

describe('update_relation types and properties', () => {
  const entities = async () => {
    const s = setup()
    // A line is a part (kind entity), which may be part of the order (a root).
    await s.call('add_node', { tempId: 'l', type: 'entity', label: 'Line', properties: { kind: 'entity' } })
    await s.call('add_node', { tempId: 'o', type: 'entity', label: 'Order' })
    await s.call('add_relation', { sourceId: 'l', targetId: 'o', relationType: 'references', properties: { cardinality: 'many', description: 'lines' } })
    const id = Object.keys(s.facade.getRelations())[0]
    const rel = () => s.facade.getRelations()[id] as unknown as Record<string, unknown>
    return { ...s, id, rel }
  }

  it('stores no type for an empty one, as Studio does', async () => {
    const { call, id, rel } = await entities()
    const res = await call('update_relation', { id, relationType: '' })
    expect(res.ok, res.resultText).toBe(true)
    expect('relationType' in rel()).toBe(false)
  })

  it('drops the properties the new type does not have, and says so', async () => {
    // They stayed, unseen in Studio and out of reach of update_relation,
    // which checks the bag against the new type.
    const { call, id, rel } = await entities()
    const res = await call('update_relation', { id, relationType: 'part-of' })
    expect(res.ok, res.resultText).toBe(true)
    expect(res.resultText).toMatch(/removed property "cardinality"/)
    expect(rel().relationType).toBe('part-of')
    expect('cardinality' in rel()).toBe(false)
    expect('description' in rel()).toBe(false)
  })

  it('clears a property given as null', async () => {
    const { call, id, rel } = await entities()
    const res = await call('update_relation', { id, properties: { cardinality: null } })
    expect(res.ok, res.resultText).toBe(true)
    expect('cardinality' in rel()).toBe(false)
    expect(rel().description).toBe('lines')
  })
})

describe('a type added by another writer', () => {
  // The schema an MCP client validates with lags behind; the handler checks
  // the type against the metamodel the call runs on.
  it('add_node refuses a type the metamodel does not have, naming the ones it has', async () => {
    const { call } = setup()
    const res = await call('add_node', { tempId: 'x', type: 'no-such-type', label: 'X' })
    expect(res.ok).toBe(false)
    expect(res.resultText).toMatch(/unknown type "no-such-type"/)
  })
})

// Item 192: create_view and update_view accepted chains they then read
// otherwise: a via with no direction was dropped (the step took nothing), a
// relation filter without direction was read as in, a property filter on an
// unknown key or with an unknown op ("like" acted as is-not) was kept.
describe('a filter chain given to create_view or update_view', () => {
  const needs = { ways: [{ types: ['need'] }] }
  const refused = async (pipeline: unknown) => {
    const { call } = setup()
    const made = await call('create_view', { tempId: 'v', name: 'Trace', pipeline })
    expect(made.ok, JSON.stringify(pipeline)).toBe(false)
    return made.resultText
  }

  it('is refused where it would be read otherwise than written', async () => {
    expect(await refused({ levels: [needs, { ways: [{ via: { relationType: 'derives' }, types: ['requirement'] }] }] })).toMatch(/level 2: a via is \{relationType, direction/)
    expect(await refused({ levels: [needs, { ways: [{ types: ['requirement'] }] }] })).toMatch(/level 2: a way needs a via/)
    expect(await refused({ levels: [{ ways: [{ types: ['need'], via: { contains: true } }] }] })).toMatch(/level 1: the first level takes no via/)
    expect(await refused({ levels: [{ ...needs, filters: [{ kind: 'relation', relationType: 'derives', has: true }] }] })).toMatch(/needs direction "in" or "out"/)
    expect(await refused({ levels: [{ ...needs, filters: [{ kind: 'property', key: 'nope', op: 'set' }] }] })).toMatch(/no node type has a property "nope"/)
    expect(await refused({ levels: [{ ...needs, filters: [{ kind: 'property', key: 'source', op: 'like', values: ['x'] }] }] })).toMatch(/op is "is", "is-not", "set" or "unset", not "like"/)
    expect(await refused({ levels: [{ ...needs, filters: [{ kind: 'colour', value: 'red' }] }] })).toMatch(/unknown filter kind "colour"/)
  })

  it('is taken when it reads as written', async () => {
    const { call } = setup()
    const made = await call('create_view', { tempId: 'v', name: 'Trace', pipeline: { levels: [
      { ...needs, filters: [{ kind: 'property', key: 'source', op: 'is', values: ['brief'] }, { kind: 'property', key: 'label', op: 'set' }] },
      { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }], filters: [{ kind: 'relation', relationType: 'satisfies', direction: 'in', has: false }] },
    ] } })
    expect(made.ok, made.resultText).toBe(true)
  })
})

describe('a within filter on an element that is deleted', () => {
  it('goes from the view, so a viewpoint made from it is not refused', async () => {
    const { facade, call } = setup()
    await call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await call('add_node', { tempId: 'api', type: 'container', label: 'API', parentId: 'shop' })
    expect((await call('create_view', { tempId: 'v', name: 'Inside', pipeline: { levels: [{ ways: [{ types: ['container'] }], filters: [{ kind: 'within', nodeId: 'shop' }] }] } })).ok).toBe(true)
    expect((await call('delete_node', { id: 'shop' })).ok).toBe(true)
    const view = Object.values(facade.toDiagramData().views ?? []).find((v) => v.name === 'Inside')!
    expect(JSON.stringify(view.pipeline)).not.toContain('within')
    const made = await call('upsert_viewpoint', { label: 'Inside', fromViewId: view.id })
    expect(made.ok, made.resultText).toBe(true)
  })
})
