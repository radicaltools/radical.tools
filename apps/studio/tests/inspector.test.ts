/**
 * The Inspector panel and the way it goes to an element: the panel is kept
 * open or closed, at its height, across perspectives and reloads, and a link
 * in it shows the element in the perspective open, on the view a Quick
 * Search pick would open, selected with its properties card.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useCardOpen } from '@radical/ui/store/showInView'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { showElement, toggleInspector, useInspectorNav, viewNodeSets } from '../src/renderer/src/navigation'

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
  useCardOpen.setState({ open: false, requested: false })
})
afterEach(() => { vi.useRealTimers() })

describe('the Inspector', () => {
  it('is kept open or folded for the next start, and folding leaves its path', () => {
    const saved = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v) }, removeItem: (k: string) => { saved.delete(k) } }
    toggleInspector(false)
    toggleInspector()
    expect(useInspectorNav.getState().open).toBe(true)
    expect(JSON.parse(localStorage.getItem('radical-inspector-panel')!)).toEqual({ open: true })
    useInspectorNav.setState({ trace: 'req' })
    toggleInspector()
    expect(useInspectorNav.getState()).toMatchObject({ open: false, trace: null })
    expect(JSON.parse(localStorage.getItem('radical-inspector-panel')!)).toEqual({ open: false })
  })
})

describe('going to an element', () => {
  it('lists what each view shows — not the containers it holds them in — and all for an unfiltered view', () => {
    const { views, c4Nodes, c4Relations, metamodel } = useDiagramStore.getState()
    const sets = viewNodeSets(views, c4Nodes, c4Relations, metamodel)
    expect([...sets['v-api']].sort()).toEqual(['api'])
    expect(sets['v-wiki'].size).toBe(4)
  })

  it('stays in the perspective open, on the view that shows it, with it selected and its card open', () => {
    vi.useFakeTimers()
    for (const mode of ['designer', 'viewer'] as const) {
      useDiagramStore.getState().setAppMode(mode)
      useDiagramStore.getState().setActiveView('v-table')
      expect(showElement('api')).toBe(true)
      vi.advanceTimersByTime(200)
      const s = useDiagramStore.getState()
      expect(s.appMode).toBe(mode)
      // The smallest canvas that shows it, as a Quick Search pick opens.
      expect(s.activeViewId).toBe('v-api')
      expect(s.selectedNodeId).toBe('api')
      expect(useCardOpen.getState().requested).toBe(true)
    }
  })

  it('stays on the active view when it shows the element, a table too', () => {
    vi.useFakeTimers()
    useDiagramStore.getState().setActiveView('v-table')
    showElement('req')
    vi.advanceTimersByTime(200)
    expect(useDiagramStore.getState()).toMatchObject({ appMode: 'designer', activeViewId: 'v-table', selectedNodeId: 'req' })
  })

  it('goes from Presenter to Viewer, which has the card and changes nothing either', () => {
    vi.useFakeTimers()
    useDiagramStore.getState().setAppMode('presenter')
    showElement('req')
    vi.advanceTimersByTime(200)
    expect(useDiagramStore.getState()).toMatchObject({ appMode: 'viewer', selectedNodeId: 'req' })
  })

  it('says so when the milestone shown lacks the element', () => {
    const v1 = useDiagramStore.getState().createSnapshot('v1')
    useDiagramStore.getState().addNode({ type: 'requirement', label: 'Refund later', description: '', technology: '', collapsed: false, external: false, x: 0, y: 0, width: 200, height: 100 } as Omit<C4Node, 'id'>)
    const added = Object.values(useDiagramStore.getState().c4Nodes).find((n) => n.label === 'Refund later')!.id
    useDiagramStore.getState().selectMilestone(v1)
    expect(showElement(added)).toBe(false)
    const notes = useDiagramStore.getState().notifications
    expect(notes[notes.length - 1]?.message).toMatch(/milestone shown has no such element/)
  })
})
