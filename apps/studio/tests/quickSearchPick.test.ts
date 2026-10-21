/**
 * Where a Quick Search pick shows an element (exploratory run 60, decided
 * 2026-10-21): a diagram before a table or wiki, before a matrix or flow;
 * on a wiki its page, on a hierarchy a level that draws it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { pickViewFor, showOnPage, viewNodeSets } from '../src/renderer/src/navigation'

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
    const sets = viewNodeSets(s().views, s().c4Nodes, s().c4Relations)
    expect(pickViewFor('api', 'v-bank', s().views, sets)).toBe('v-big')
    // The view shown, when it shows it.
    expect(pickViewFor('api', 'v-matrix', s().views, sets)).toBe('v-matrix')
    // All elements stays.
    expect(pickViewFor('api', null, s().views, sets)).toBeNull()
  })

  it('is a table or wiki before a matrix or flow when no diagram has it', () => {
    const views = { ...s().views }
    delete views['v-big']
    const sets = viewNodeSets(views, s().c4Nodes, s().c4Relations)
    expect(pickViewFor('api', 'v-bank', views, sets)).toBe('v-table')
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
