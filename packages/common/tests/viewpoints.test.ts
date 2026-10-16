import { describe, it, expect } from 'vitest'
import { buildMetamodelMessage } from '../src/ai/metamodelContext'
import { createModelFacade } from '../src/ai/modelFacade'
import { runTool } from '../src/ai/tools/index'
import type { ToolRunContext } from '../src/ai/tools/types'
import type { DiagramView, ViewPipeline } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel, type Metamodel } from '../src/metamodel/index'
import * as model from '../src/model'
import { pipelineOf } from '../src/viewPipeline'
import { radicalViewpoints } from '../src/metamodel/presets/viewpoints'
import {
  UNGROUPED_VIEWPOINTS, viewpointGroups, chainOfViewpoint, chainSummary, newViewName, newViewpointId, sameChain, saveAsViewpoint, viewpointsOf, withViewpoint, withoutViewpoint,
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

describe('viewpoints', () => {
  it('come with both presets, grouped by concern: all of them with Radical, the C4 ones with C4', () => {
    const radical = viewpointsOf(builtInGovernanceMetamodel())
    expect(viewpointGroups(radical).map((g) => [g.group, g.viewpoints.length])).toEqual([['C4', 4], ['Domain', 3], ['Requirements', 5], ['Decisions', 3], ['UX', 2], ['States', 2]])
    expect(radical.find((v) => v.id === 'traceability')).toMatchObject({ kind: 'table', group: 'Requirements' })
    expect(viewpointsOf(builtInC4Metamodel()).map((v) => v.id)).toEqual(['system-context', 'containers', 'components', 'container-dependencies'])
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
        // What a view of it holds is the chain as the view reads it.
        expect(sameChain(chainOfViewpoint(v), v.pipeline), where).toBe(true)
      }
    }
  })
})

describe('viewpoint tools', () => {
  function setup() {
    const facade = createModelFacade({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() })
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
})
