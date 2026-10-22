import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel/index'
import * as model from '../src/model'

const el = (id: string, type: string, label: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 160, height: 80, collapsed: false, ...extra }) as C4Node

const view = (id: string, name: string, nodeIds: string[], extra: Partial<DiagramView> = {}): DiagramView =>
  ({ id, name, nodeIds, ...extra }) as DiagramView

describe('the views that show an element', () => {
  function state(): model.ModelState {
    const nodes = [
      el('order', 'state-machine', 'Order'), el('placed', 'state', 'Placed', { parentId: 'order' }), el('paid', 'state', 'Paid', { parentId: 'order' }),
      el('payment', 'state-machine', 'Payment'), el('pending', 'state', 'Pending', { parentId: 'payment' }),
      el('loose', 'need', 'Loose'),
    ]
    const relations: C4Relation[] = [{ id: 't1', sourceId: 'placed', targetId: 'paid', relationType: 'transition' } as C4Relation]
    const views = [
      view('listed', 'Listed', ['order', 'placed']),
      view('whole', 'Whole', []),
      view('emptied', 'Emptied', [], { empty: true }),
      view('needs', 'Needs', [], { pipeline: { levels: [{ ways: [{ types: ['need'] }] }] } }),
    ]
    return {
      c4Nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      c4Relations: Object.fromEntries(relations.map((r) => [r.id, r])),
      views: Object.fromEntries(views.map((v) => [v.id, v])),
      activeViewId: null,
      metamodel: builtInGovernanceMetamodel(),
    }
  }
  const names = (s: model.ModelState, id: string) => model.viewsShowingNode(id, s).map((v) => v.name)

  it('are those whose list or chain has it, and those of the whole model, in model order', () => {
    const s = state()
    expect(names(s, 'placed')).toEqual(['Listed', 'Whole'])
    expect(names(s, 'pending')).toEqual(['Whole'])
    // A chain view shows what its chain gives, not its (empty) list.
    expect(names(s, 'loose')).toEqual(['Whole', 'Needs'])
    // An element on no view, and one that is not there.
    delete s.views.whole
    expect(names(s, 'pending')).toEqual([])
    expect(names(s, 'nowhere')).toEqual([])
  })

  it('leave out a group of views per element, whose views stand for it', () => {
    const s = state()
    delete s.views.whole
    let next = 0
    model.insertView(s, 'g', 'Machines')
    expect(model.applyViewpoint(s, 'g', 'state-machine', null)).toBe(true)
    model.syncViewGroups(s, () => `m${++next}`)
    expect(names(s, 'pending')).toEqual(['Payment'])
    expect(names(s, 'placed')).toEqual(['Listed', 'Order'])
  })
})
