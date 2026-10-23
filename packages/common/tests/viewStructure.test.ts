import { describe, expect, it } from 'vitest'
import { viewShowsEveryNode, type C4Node } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '../src/metamodel'
import { radicalViewpoints } from '../src/ai/forge'
import * as model from '../src/model'
import { metamodelViews } from '../src/viewStructure'

const chosen = (mm: ReturnType<typeof builtInGovernanceMetamodel>): string[] =>
  radicalViewpoints(mm).filter((c) => c.chosen).map((c) => c.id)

describe('metamodelViews', () => {
  it('makes a view of each chosen viewpoint in its folder, and a group for one that draws one element', () => {
    const mm = builtInGovernanceMetamodel()
    const views = metamodelViews(mm, chosen(mm))
    // All elements as a Structure view first, at the top of the list: it
    // lists none, so it shows every element.
    expect(views[0]).toMatchObject({ id: 'view-all-elements', name: 'All elements', nodeIds: [] })
    expect(views[0].kind ?? 'static').toBe('static')
    expect(views[0].folder).toBeUndefined()
    expect(viewShowsEveryNode(views[0])).toBe(true)
    // Then the list's order: Conceptual, then Logical, then Governance.
    const ofViewpoints = views.slice(1)
    expect([...new Set(ofViewpoints.map((v) => v.folder))]).toEqual(['Conceptual', 'Logical', 'Governance'])
    expect(ofViewpoints.map((v) => v.id).slice(0, 3)).toEqual(['view-domain-map', 'view-domain-entities', 'view-traceability'])
    // The whole-model ones a view per element stands in for are left out.
    expect(views.map((v) => v.viewpoint)).not.toContain('containers')
    for (const v of ofViewpoints) {
      expect(v.name).toBe(mm.viewpoints!.find((d) => d.id === v.viewpoint)!.label)
      expect(v.nodeIds).toEqual([])
    }
    const specification = views.find((v) => v.viewpoint === 'specification')!
    expect(specification).toMatchObject({ kind: 'wiki', wikiPageMode: 'multi' })

    // A group gets a view of each element as it is added.
    const state: model.ModelState = { c4Nodes: {}, c4Relations: {}, views: Object.fromEntries(views.map((v) => [v.id, v])), activeViewId: null, metamodel: mm }
    expect(model.isViewGroup(state.views['view-state-machine'], mm)).toBe(true)
    state.c4Nodes.order = { id: 'order', type: 'state-machine', label: 'Order', x: 0, y: 0, width: 200, height: 100, collapsed: false } as C4Node
    let next = 0
    model.syncViewGroups(state, () => `v${++next}`)
    expect(model.viewsOfGroup(state.views, 'view-state-machine')).toMatchObject([{ name: 'Order', subject: 'order', folder: 'Conceptual' }])
  })

  it('makes only All elements for no viewpoints, and leaves out those the metamodel lacks', () => {
    expect(metamodelViews(builtInGovernanceMetamodel(), []).map((v) => v.id)).toEqual(['view-all-elements'])
    const c4 = builtInC4Metamodel()
    const views = metamodelViews(c4, ['system-context', 'traceability'])
    expect(views).toMatchObject([{ id: 'view-all-elements' }, { id: 'view-system-context', viewpoint: 'system-context', folder: 'Logical' }])
  })
})
