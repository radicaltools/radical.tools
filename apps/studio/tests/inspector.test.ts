/**
 * The Inspector perspective and the way it goes to an element: it shows no
 * canvas and takes no undo step, the model Designer had comes back on
 * return, and "Show on canvas" / "Open wiki page" pick the view that shows
 * the element.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { canvasViewFor, openWikiPage, revealOnCanvas, viewNodeSets, wikiViewFor } from '../src/renderer/src/navigation'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

function model(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'Shop'),
      node('api', 'container', 'API', { parentId: 'sys' }),
      node('req', 'requirement', 'Pay', { action: 'take the payment' }),
      node('other', 'requirement', 'Refund', { action: 'refund' }),
    ],
    relations: [{ id: 'r1', relationType: 'satisfies', sourceId: 'api', targetId: 'req' }],
    views: [
      { id: 'v-all', name: 'Everything', nodeIds: ['sys', 'api', 'req', 'other'], positions: {} },
      { id: 'v-req', name: 'Requirements', nodeIds: ['req', 'other'], positions: {} },
      { id: 'v-table', name: 'Table', kind: 'table', nodeIds: ['req'], positions: {} },
      { id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} },
      { id: 'v-api', name: 'API', nodeIds: ['api'], positions: {} },
    ],
  }
}

beforeEach(() => {
  useDiagramStore.getState().loadDiagram(model())
  useDiagramStore.setState({ appMode: 'designer', presentationActive: false } as never)
  ;(window as unknown as { __preModeLayout?: unknown }).__preModeLayout = undefined
  useDiagramStore.getState().setActiveView(null)
})
afterEach(() => { vi.useRealTimers() })

describe('the Inspector perspective', () => {
  it('parks the model Designer had and gives it back on return, taking no undo step', () => {
    const store = useDiagramStore.getState()
    store.setActiveView('v-req')
    const undoDepth = useDiagramStore.getState().canUndo
    store.setAppMode('inspector')
    expect(useDiagramStore.getState().appMode).toBe('inspector')
    expect((window as unknown as { __preModeLayout?: unknown }).__preModeLayout).toBeDefined()
    useDiagramStore.getState().toggleCollapse('sys')
    expect(useDiagramStore.getState().canUndo).toBe(undoDepth)
    useDiagramStore.getState().setAppMode('designer')
    expect(useDiagramStore.getState().activeViewId).toBe('v-req')
    expect(useDiagramStore.getState().c4Nodes.sys.collapsed).toBe(false)
  })
})

describe('going to an element', () => {
  it('lists what each view shows, its ancestors included, and all for an unfiltered view', () => {
    const { views, c4Nodes } = useDiagramStore.getState()
    const sets = viewNodeSets(views, c4Nodes)
    expect([...sets['v-api']].sort()).toEqual(['api', 'sys'])
    expect(sets['v-wiki'].size).toBe(4)
  })

  it('shows an element on the active canvas when it is there, else on the smallest canvas that shows it', () => {
    expect(canvasViewFor('req')).toBe('v-req')
    useDiagramStore.getState().setActiveView('v-all')
    expect(canvasViewFor('req')).toBe('v-all')
    // A table is no canvas, even when it is the smallest view with the element.
    useDiagramStore.getState().setActiveView('v-table')
    expect(canvasViewFor('req')).toBe('v-req')
    expect(canvasViewFor('api')).toBe('v-api')
  })

  it('goes from the Inspector to Designer, on that canvas, with the element selected', () => {
    vi.useFakeTimers()
    useDiagramStore.getState().setAppMode('inspector')
    revealOnCanvas('api')
    vi.advanceTimersByTime(200)
    const s = useDiagramStore.getState()
    expect(s.appMode).toBe('designer')
    expect(s.activeViewId).toBe('v-api')
    expect(s.selectedNodeId).toBe('api')
  })

  it('opens the wiki page of an element, or says there is none', () => {
    expect(wikiViewFor('req')).toBe('v-wiki')
    useDiagramStore.getState().setAppMode('inspector')
    expect(openWikiPage('req')).toBe(true)
    const s = useDiagramStore.getState()
    expect(s.appMode).toBe('designer')
    expect(s.activeViewId).toBe('v-wiki')
    expect(s.views['v-wiki'].wikiFocusId).toBe('req')
    useDiagramStore.getState().setAppMode('designer')
    useDiagramStore.getState().removeView('v-wiki')
    expect(wikiViewFor('req')).toBeNull()
    expect(openWikiPage('req')).toBe(false)
  })
})
