/**
 * Where a Quick Search pick shows an element (exploratory run 60, decided
 * 2026-10-21): a diagram before a table or wiki, before a matrix or flow;
 * on a wiki its page, on a hierarchy a level that draws it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { canvasViewFor, canvasViewsFor, pickViewFor, showOnPage, viewNodeSets } from '../src/renderer/src/navigation'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

function model(): DiagramData {
  return {
    nodes: [
      node('sys', 'system', 'Shop'),
      node('api', 'container', 'API', { parentId: 'sys' }),
      node('cmp', 'component', 'Orders', { parentId: 'api' }),
      node('leaf', 'component', 'Ledger', { parentId: 'cmp' }),
      node('bank', 'system', 'Bank'),
    ],
    relations: [],
    views: [
      { id: 'v-bank', name: 'Bank', nodeIds: ['bank'], positions: {} },
      { id: 'v-matrix', name: 'Matrix', kind: 'matrix', nodeIds: ['api'], positions: {} },
      { id: 'v-table', name: 'Table', kind: 'table', nodeIds: ['sys', 'api'], positions: {} },
      { id: 'v-big', name: 'Containers', nodeIds: ['sys', 'api', 'cmp', 'bank'], positions: {} },
      { id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} },
      { id: 'v-tree', name: 'Tree', kind: 'treemap', nodeIds: [], positions: {} },
    ],
  }
}

const s = useDiagramStore.getState
beforeEach(() => {
  s().loadDiagram(model())
  useDiagramStore.setState({ appMode: 'designer', presentationActive: false } as never)
})

describe('the view a pick opens', () => {
  it('is a diagram before a table and a matrix, though they are smaller', () => {
    const sets = viewNodeSets(s().views, s().c4Nodes, s().c4Relations, s().metamodel)
    expect(pickViewFor('api', 'v-bank', s().views, sets)).toBe('v-big')
    // The view shown, when it shows it.
    expect(pickViewFor('api', 'v-matrix', s().views, sets)).toBe('v-matrix')
    // All elements stays.
    expect(pickViewFor('api', null, s().views, sets)).toBeNull()
  })

  it('is a table or wiki before a matrix or flow when no diagram has it', () => {
    const views = { ...s().views }
    delete views['v-big']
    const sets = viewNodeSets(views, s().c4Nodes, s().c4Relations, s().metamodel)
    expect(pickViewFor('api', 'v-bank', views, sets)).toBe('v-table')
  })
})

// Item 245: a relation's pick opened the smallest view with its source,
// which did not draw it.
describe('the view a relation\'s pick opens', () => {
  it('shows both its ends', () => {
    s().loadDiagram({
      ...model(),
      nodes: [...model().nodes, node('cust', 'person', 'Customer')],
      views: [
        ...model().views.filter((v) => v.id !== 'v-big'),
        { id: 'v-ctx', name: 'Context', nodeIds: ['cust', 'sys'], positions: {} },
        { id: 'v-big', name: 'Containers', nodeIds: ['cust', 'sys', 'api', 'cmp', 'bank'], positions: {} },
      ],
    })
    const sets = viewNodeSets(s().views, s().c4Nodes, s().c4Relations, s().metamodel)
    expect(pickViewFor('cust', 'v-bank', s().views, sets)).toBe('v-ctx')
    expect(pickViewFor(['cust', 'api'], 'v-bank', s().views, sets)).toBe('v-big')
    // The view shown, when it shows both; else one that shows everything.
    expect(pickViewFor(['cust', 'api'], 'v-big', s().views, sets)).toBe('v-big')
    expect(pickViewFor(['cust', 'leaf'], 'v-bank', s().views, sets)).toBe('v-wiki')
  })
})

describe('a pick on a wiki or hierarchy view', () => {
  it('opens the element\'s wiki page', () => {
    s().setActiveView('v-wiki')
    showOnPage('v-wiki', 'cmp')
    expect(s().views['v-wiki'].wikiFocusId).toBe('cmp')
  })

  it('drills a hierarchy to a level that draws the element', () => {
    s().setActiveView('v-tree')
    // Two levels from the top: Shop, API. Ledger is four down.
    showOnPage('v-tree', 'leaf')
    expect(s().views['v-tree'].treemapFocusId).toBe('cmp')
    // Drawn already: nothing moves.
    showOnPage('v-tree', 'leaf')
    expect(s().views['v-tree'].treemapFocusId).toBe('cmp')
    // Above the level shown.
    showOnPage('v-tree', 'bank')
    expect(s().views['v-tree'].treemapFocusId ?? null).toBeNull()
  })
})

// F-0021: a group of views per element is never a canvas of its own. Quick
// Search opened one as a canvas (and saved positions into it), and the view
// a pick or Show on canvas chose could be one.
describe('a group of views per element', () => {
  beforeEach(() => {
    s().loadDiagram({
      nodes: [
        node('shop', 'system', 'Shop'),
        node('api', 'container', 'API', { parentId: 'shop' }),
        node('bank', 'system', 'Bank'),
        node('ledger', 'container', 'Ledger', { parentId: 'bank' }),
      ],
      relations: [],
      views: [{ id: 'v-bank', name: 'Bank', nodeIds: ['bank'], positions: {} }],
    })
    useDiagramStore.setState({ appMode: 'designer' } as never)
    const g = s().addView('Containers of a system')
    useDiagramStore.setState((st: any) => { st.views.g = { ...st.views[g], id: 'g' }; delete st.views[g] })
    expect(s().applyViewpoint('g', 'system-containers', null)).toBe(true)
    s()._sync()
  })
  const member = (subject: string): string => Object.values(s().views).find((v) => v.partOf === 'g' && v.subject === subject)!.id

  it('opens on its first view, as a click on it in the list does', () => {
    s().setActiveView(null)
    s().setActiveView('g')
    expect(s().activeViewId).toBe(member('bank'))
    expect(s().views.g.positions).toEqual({})
  })

  it('is never the view a pick, Show on canvas or the choice of views opens', () => {
    const sets = viewNodeSets(s().views, s().c4Nodes, s().c4Relations, s().metamodel)
    expect(sets.g).toBeUndefined()
    // Even with the group shown (a link of before), the element's own view.
    useDiagramStore.setState({ activeViewId: 'g' } as never)
    expect(pickViewFor('api', 'g', s().views, sets)).toBe(member('shop'))
    expect(canvasViewFor('api')).toBe(member('shop'))
    expect(canvasViewsFor('api').map((v) => v.id)).not.toContain('g')
  })
})
