/**
 * Views per element (a group) and milestones. The views are the live
 * model's and every milestone's: an element renamed or deleted in a
 * milestone leaves them as they are until the edit reaches the live model
 * (Propagate), and Discard finds them as they were. A view of the group
 * opened for the first time in a milestone is laid out on live, not as an
 * edit of the milestone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import type { C4Node, DiagramView } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const el = (id: string, type: string, label: string, parentId?: string, x = 0): C4Node =>
  ({ id, type, label, x, y: 0, width: 200, height: 120, ...(parentId ? { parentId } : {}) }) as C4Node
const realSmartLayout = s().runSmartLayout
const smartLayout = vi.fn(async () => {})

/** The view of `subject` in the group. */
const viewOf = (subject: string): DiagramView | undefined => Object.values(s().views).find((v) => v.partOf === 'g' && v.subject === subject)

beforeEach(() => {
  s().loadDiagram({
    nodes: [el('shop', 'system', 'Shop'), el('api', 'container', 'Payments Service', 'shop', 0), el('web', 'webapp', 'Web', 'shop', 300), el('c1', 'component', 'Ledger', 'api')],
    relations: [],
    views: [],
  })
  useDiagramStore.setState({ appMode: 'designer', runSmartLayout: smartLayout } as any)
  const g = s().addView('Components')
  // The group under a fixed id, for viewOf.
  useDiagramStore.setState((st: any) => { st.views.g = { ...st.views[g], id: 'g' }; delete st.views[g] })
  expect(s().applyViewpoint('g', 'container-components', null)).toBe(true)
  s()._sync()
  // Laid out once on live: the view keeps its positions.
  const api = viewOf('api')!
  useDiagramStore.setState((st: any) => { st.views[api.id].positions = { api: { x: 10, y: 20, width: 400, height: 300 }, c1: { x: 30, y: 60, width: 200, height: 120 } } })
  s().createSnapshot('v1')
  smartLayout.mockClear()
})

afterEach(() => {
  useDiagramStore.setState({ runSmartLayout: realSmartLayout } as any)
})

describe('an element of a view per element, edited in a milestone', () => {
  it('renamed and discarded: its view keeps its name, and follows a later rename on live', () => {
    const viewId = viewOf('api')!.id
    s().selectMilestone(s().snapshots[0].id)
    s().updateNode('api', { label: 'Payments Service v4' })
    expect(s().c4Nodes.api.label).toBe('Payments Service v4')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.api.label).toBe('Payments Service')
    expect(s().views[viewId].name).toBe('Payments Service')
    s().updateNode('api', { label: 'Payments' })
    expect(s().views[viewId].name).toBe('Payments')
  })

  it('deleted and discarded: its view is the same view, with its positions', () => {
    const view = viewOf('api')!
    s().selectMilestone(s().snapshots[0].id)
    s().removeNode('api')
    expect(s().c4Nodes.api).toBeUndefined()
    s().discardMilestoneChanges()
    expect(s().c4Nodes.api).toBeDefined()
    expect(viewOf('api')?.id).toBe(view.id)
    expect(Object.keys(s().views[view.id].positions).sort()).toEqual(['api', 'c1'])
  })

  it('deleted and saved as a new milestone: the live model keeps its view', () => {
    const view = viewOf('api')!
    s().selectMilestone(s().snapshots[0].id)
    s().removeNode('api')
    s().commitMilestoneChanges('new', 'v2')
    expect(s().snapshots.find((m) => m.name === 'v2')!.nodes.api).toBeUndefined()
    s().discardMilestoneChanges()
    expect(viewOf('api')?.id).toBe(view.id)
    expect(Object.keys(s().views[view.id].positions).sort()).toEqual(['api', 'c1'])
  })

  it('renamed and propagated: the live model\'s view takes the name', () => {
    const viewId = viewOf('api')!.id
    s().selectMilestone(s().snapshots[0].id)
    s().updateNode('api', { label: 'Payments Service v4' })
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.api.label).toBe('Payments Service v4')
    expect(s().views[viewId].name).toBe('Payments Service v4')
  })

  it('deleted and propagated: the live model loses its view, and no view lists it', () => {
    const viewId = viewOf('api')!.id
    const listing = s().addView('Lists it')
    useDiagramStore.setState((st: any) => { st.views[listing].nodeIds = ['api', 'web'] })
    s().selectMilestone(s().snapshots[0].id)
    s().removeNode('api')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.api).toBeUndefined()
    expect(s().views[viewId]).toBeUndefined()
    expect(s().views[listing].nodeIds).toEqual(['web'])
  })
})

describe('a view per element opened for the first time in a milestone', () => {
  it('is not laid out as an edit of the milestone, and is laid out back on live', () => {
    const viewId = viewOf('web')!.id
    expect(Object.keys(s().views[viewId].positions)).toEqual([])
    s().selectMilestone(s().snapshots[0].id)
    s().setActiveView(viewId)
    expect(smartLayout).not.toHaveBeenCalled()
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
    s().discardMilestoneChanges()
    expect(s().activeViewId).toBe(viewId)
    expect(smartLayout).toHaveBeenCalledTimes(1)
  })

  it('opened on live, it is laid out at once', () => {
    s().setActiveView(viewOf('web')!.id)
    expect(smartLayout).toHaveBeenCalledTimes(1)
  })
})
