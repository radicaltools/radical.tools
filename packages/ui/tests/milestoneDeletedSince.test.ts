/**
 * A milestone shows the model as it was (F-0053): a view shown in it draws
 * the elements the milestone holds that the view listed, though they were
 * deleted from the live model since. Views are shared by the milestones
 * (one layout per view), and a delete on the live model took the element
 * out of the view's list for every milestone: the milestone's view and the
 * slide linked to it drew without it, and its frame was sized for it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, DiagramView } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, x: number, y: number, parentId?: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...(NODE_SIZES as Record<string, { width: number; height: number }>)[type] ?? { width: 200, height: 100 }, ...(parentId ? { parentId } : {}) } as C4Node)
const box = (x: number, y: number, width = 200, height = 120) => ({ x, y, width, height })

function model(): DiagramData {
  return {
    nodes: [
      { ...node('shop', 'system', 0, 0), width: 700, height: 400 },
      node('api', 'container', 40, 120, 'shop'),
      node('fx', 'component', 20, 40, 'api'),
      node('web', 'container', 360, 120, 'shop'),
      { ...node('bank', 'system', 900, 0), width: 500, height: 400 },
    ],
    relations: [{ id: 'r1', sourceId: 'api', targetId: 'bank' }],
    views: [
      { id: 'core', name: 'Core', nodeIds: ['shop', 'api', 'fx', 'web', 'bank'], positions: { shop: box(0, 0, 700, 400), api: box(40, 120), fx: box(60, 160, 100, 60), web: box(360, 120), bank: box(900, 0, 500, 400) } },
      { id: 'all', name: 'All', nodeIds: [], positions: {} },
    ] as DiagramView[],
  }
}

const drawn = () => s().rfNodes.map((n) => n.id).sort()

let early = ''
beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  early = s().createSnapshot('early')
  s().setActiveView('core')
})
afterEach(() => s().stopLiveLayout())

describe('An element deleted from the live model since a milestone', () => {
  it('is still drawn on a view that listed it when the milestone is shown, and not on the live view', () => {
    s().removeNode('api')
    expect(s().views.core.nodeIds).toEqual(['shop', 'web', 'bank'])
    expect(drawn()).not.toContain('api')
    s().selectMilestone(early)
    expect(s().views.core.nodeIds).toContain('api')
    expect(drawn()).toContain('api')
    s().discardMilestoneChanges()
    expect(s().views.core.nodeIds).toEqual(['shop', 'web', 'bank'])
    expect(drawn()).not.toContain('api')
  })

  it('is drawn in the milestone after a reload, and the live views stay without it', () => {
    s().removeNode('api')
    s().loadDiagram(s().saveDiagram())
    expect(s().saveDiagram().views!.find((v) => v.id === 'core')!.nodeIds).toEqual(['shop', 'web', 'bank'])
    s().setActiveView('core')
    s().selectMilestone(early)
    expect(drawn()).toContain('api')
    // The milestone keeps the view's list, and nothing else of it: its
    // places and the rest of its layout are the live view's.
    expect(Object.keys(s().saveDiagram().snapshots![0].views!.core).sort()).toEqual(['empty', 'id', 'nodeIds'])
  })

  it('Undo of the delete leaves the milestone as it was', () => {
    const before = s().snapshots
    s().removeNode('api')
    s().undo()
    expect(s().snapshots).toEqual(before)
  })

  it('a delete made in a later milestone and propagated leaves it on the earlier one\'s view', () => {
    s().createSnapshot('later')
    const later = s().snapshots[1].id
    s().selectMilestone(later)
    s().removeNode('api')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().views.core.nodeIds).toEqual(['shop', 'web', 'bank'])
    s().selectMilestone(early)
    expect(drawn()).toContain('api')
  })

  it('Unwrap on the live model leaves it on the milestone\'s view too', () => {
    s().unwrapNode('fx')
    expect(s().c4Nodes.fx).toBeUndefined()
    expect(s().views.core.nodeIds).not.toContain('fx')
    s().selectMilestone(early)
    expect(s().views.core.nodeIds).toContain('fx')
  })

  it('deleted in a milestone that shows the view its own way and propagated, leaves the live view too', () => {
    s().selectMilestone(early)
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('new', 'own')
    expect(s().snapshots[1].views?.core).toBeDefined()
    s().removeNode('web')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.web).toBeUndefined()
    expect(s().views.core.nodeIds).not.toContain('web')
  })

  it('Restore to live of the milestone puts it back on the views that listed it (F-0090)', () => {
    s().removeNode('api')
    // And takes off them what it does not hold.
    const added = s().addNode({ type: 'system', label: 'New', x: 1600, y: 600, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    expect(s().views.core.nodeIds).toContain(added)
    // A view the milestone shows as the live model has it, with a fold.
    s().setActiveView('all')
    s().toggleCollapse('shop')
    expect(s().views.all.collapsedNodeIds).toContain('shop')
    s().setActiveView('core')
    s().selectMilestone(early)
    expect(drawn()).toContain('api')
    s().restoreSnapshot(early)
    expect(s().activeSnapshotId).toBeNull()
    expect(s().c4Nodes.api).toBeDefined()
    expect(s().views.core.nodeIds).toContain('api')
    expect(drawn()).toContain('api')
    expect(s().saveDiagram().views!.find((v) => v.id === 'core')!.nodeIds).toContain('api')
    expect(s().views.core.nodeIds).not.toContain(added)
    // The milestone and the live model have one list again: a live edit of
    // it reaches the milestone.
    s().removeNodeFromView('core', 'web')
    s().selectMilestone(early)
    expect(drawn()).not.toContain('web')
  })
})

describe('The view a milestone keeps its own list of has the live view\'s layout (F-0089, F-0091)', () => {
  // A milestone that holds an element the live model deleted keeps the
  // view's list of elements, and only that: the view's folds, line style,
  // alignments and filter are the live view's for every milestone. Its copy
  // of the whole view froze them at the delete, and Propagate wrote the
  // copy's whole list and folds over the live view.
  const addInto = (label: string, parentId?: string): string =>
    s().addNode({ type: parentId ? 'container' : 'system', label, x: parentId ? 920 : 1600, y: parentId ? 120 : 600, collapsed: false, ...(parentId ? { parentId } : {}), ...(NODE_SIZES as Record<string, { width: number; height: number }>)[parentId ? 'container' : 'system'] } as Omit<C4Node, 'id'>)
  let later = ''
  beforeEach(() => {
    later = s().createSnapshot('later')
    s().removeNode('api')
  })

  it('a fold and the line style set on the live view after the delete show in every milestone that holds it', () => {
    s().toggleCollapse('shop')
    s().setViewEdgeStyle('core', 'orthogonal')
    for (const m of [early, later]) {
      s().selectMilestone(m)
      expect(drawn()).toContain('api')
      expect(s().views.core.collapsedNodeIds).toContain('shop')
      expect(s().views.core.edgeStyle).toBe('orthogonal')
      s().discardMilestoneChanges()
    }
  })

  it('Propagate of a fold from the earlier milestone reaches the later one and the live view', () => {
    s().selectMilestone(early)
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().views.core.collapsedNodeIds).toContain('shop')
    s().selectMilestone(later)
    expect(s().views.core.collapsedNodeIds).toContain('shop')
    expect(s().views.core.nodeIds).toContain('api')
  })

  it('Propagate carries only the edit: the live view keeps what was added and folded on it, and does not list what it deleted', () => {
    const added = addInto('New system')
    addInto('Ledger', 'bank')
    s().toggleCollapse('bank')
    expect(s().views.core.nodeIds).toContain(added)
    s().selectMilestone(early)
    s().removeNodeFromView('core', 'web')
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().views.core.nodeIds).toContain(added)
    expect(s().views.core.nodeIds).not.toContain('api')
    expect(s().views.core.nodeIds).not.toContain('web')
    expect(s().views.core.collapsedNodeIds).toEqual(expect.arrayContaining(['bank', 'shop']))
    // The milestone draws its own list with the edit.
    s().selectMilestone(early)
    expect(drawn()).toContain('api')
    expect(drawn()).not.toContain('web')
  })
})

describe('A view of one element deleted from the live model since a milestone (F-0064)', () => {
  // The view of an element (a view per element of a group) went with the
  // element, and the milestone that still holds the element kept no copy of
  // it: its group listed one view fewer, and a link to the view drew nothing.
  const el = (id: string, type: string, label: string, parentId?: string, x = 0): C4Node =>
    ({ id, type, label, x, y: 0, width: 200, height: 120, ...(parentId ? { parentId } : {}) }) as C4Node
  const viewOf = (subject: string): DiagramView | undefined => Object.values(s().views).find((v) => v.partOf === 'g' && v.subject === subject)
  const realSmartLayout = s().runSmartLayout
  let m = ''
  beforeEach(() => {
    s().loadDiagram({
      nodes: [el('shop', 'system', 'Shop'), el('api', 'container', 'Payments Service', 'shop'), el('web', 'webapp', 'Web', 'shop', 300), el('c1', 'component', 'Ledger', 'api')],
      relations: [],
      views: [],
    })
    useDiagramStore.setState({ appMode: 'designer', runSmartLayout: async () => {} } as any)
    const g = s().addView('Components')
    useDiagramStore.setState((st: any) => { st.views.g = { ...st.views[g], id: 'g', folder: 'C4' }; delete st.views[g] })
    s().applyViewpoint('g', 'container-components', null)
    s()._sync()
    const api = viewOf('api')!
    useDiagramStore.setState((st: any) => { st.views[api.id].positions = { api: box(10, 20, 400, 300), c1: box(30, 60) } })
    m = s().createSnapshot('M')
  })
  afterEach(() => useDiagramStore.setState({ runSmartLayout: realSmartLayout } as any))

  it('is in the group in the milestone and draws what the element holds; not on the live model, nor saved with its views', () => {
    const view = viewOf('api')!
    s().setActiveView(view.id)
    const drawnLive = drawn()
    expect(drawnLive).toEqual(expect.arrayContaining(['api', 'c1']))
    s().setActiveView(null)
    s().removeNode('api')
    expect(viewOf('api')).toBeUndefined()
    s().selectMilestone(m)
    expect(viewOf('api')?.id).toBe(view.id)
    expect(s().views[view.id].name).toBe('Payments Service')
    expect(s().views[view.id].folder).toBe('C4')
    expect(s().saveDiagram().views!.map((v) => v.id)).not.toContain(view.id)
    s().setActiveView(view.id)
    expect(s().activeViewId).toBe(view.id)
    expect(drawn()).toEqual(drawnLive)
    s().discardMilestoneChanges()
    expect(s().views[view.id]).toBeUndefined()
    expect(s().activeViewId).toBeNull()
    expect(s().saveDiagram().views!.map((v) => v.id)).not.toContain(view.id)
  })

  it('stays the milestone\'s alone after Undo of an edit in the milestone', () => {
    const view = viewOf('api')!
    s().removeNode('api')
    s().selectMilestone(m)
    s().updateNode('web', { label: 'Web shop' })
    s().undo()
    expect(s().views[view.id].subject).toBe('api')
    expect(s().saveDiagram().views!.map((v) => v.id)).not.toContain(view.id)
  })

  it('a slide of it added in the milestone plays it from the live model too (F-0103)', () => {
    const view = viewOf('api')!
    s().setActiveView(view.id)
    const drawnLive = drawn()
    s().setActiveView(null)
    s().removeNode('api')
    s().selectMilestone(m)
    s().setActiveView(view.id)
    s().addPresentationSlide('Payments')
    s().discardMilestoneChanges()
    const slides = s().presentationSlides
    expect(slides[slides.length - 1]).toMatchObject({ viewId: view.id, snapshotId: m })
    s().startPresentation()
    s().goToSlide(slides.length - 1)
    expect(s().activeViewId).toBe(view.id)
    expect(drawn()).toEqual(drawnLive)
    s().stopPresentation()
    expect(s().views[view.id]).toBeUndefined()
    expect(s().saveDiagram().views!.map((v) => v.id)).not.toContain(view.id)
  })

  it('comes back with its element and its places on Restore to live (F-0090)', () => {
    const view = viewOf('api')!
    s().removeNode('api')
    s().restoreSnapshot(m)
    expect(viewOf('api')?.id).toBe(view.id)
    expect(Object.keys(s().views[view.id].positions).sort()).toEqual(['api', 'c1'])
    expect(s().saveDiagram().views!.map((v) => v.id)).toContain(view.id)
  })

  it('is in the milestone after a reload, with its places', () => {
    const view = viewOf('api')!
    s().removeNode('api')
    s().loadDiagram(s().saveDiagram())
    s().selectMilestone(m)
    expect(viewOf('api')?.id).toBe(view.id)
    // The places it had: no live view has them any more.
    expect(Object.keys(s().views[view.id].positions).sort()).toEqual(['api', 'c1'])
  })
})

describe('A sequence deleted from the live model since a milestone (F-0065)', () => {
  // Its flow views were unlinked for every milestone: one that still holds
  // the sequence said "No sequence linked" on them.
  beforeEach(() => {
    const data = model()
    data.sequences = [{ id: 'pay', name: 'Pay', relationIds: ['r1'] }]
    data.views!.push({ id: 'flow', name: 'Flow', kind: 'dynamic', sequenceId: 'pay', nodeIds: [], positions: {} } as DiagramView)
    s().loadDiagram(data)
    early = s().createSnapshot('early')
  })

  it('still plays on its flow view in the milestone; the live view is unlinked, also saved', () => {
    s().removeSequence('pay')
    expect(s().views.flow.sequenceId).toBeUndefined()
    s().selectMilestone(early)
    expect(s().views.flow.sequenceId).toBe('pay')
    expect(s().saveDiagram().views!.find((v) => v.id === 'flow')!.sequenceId).toBeUndefined()
    s().discardMilestoneChanges()
    expect(s().views.flow.sequenceId).toBeUndefined()
    s().loadDiagram(s().saveDiagram())
    s().selectMilestone(early)
    expect(s().views.flow.sequenceId).toBe('pay')
  })

  it('deleted in a later milestone and propagated, it still plays on the earlier one', () => {
    const later = s().createSnapshot('later')
    s().selectMilestone(later)
    s().removeSequence('pay')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().views.flow.sequenceId).toBeUndefined()
    s().selectMilestone(early)
    expect(s().views.flow.sequenceId).toBe('pay')
  })

  it('Undo of the delete leaves the milestone as it was', () => {
    const before = s().snapshots
    s().removeSequence('pay')
    s().undo()
    expect(s().snapshots).toEqual(before)
    expect(s().views.flow.sequenceId).toBe('pay')
  })
})

describe('A view renamed while a milestone that shows it its own way is shown (F-0066)', () => {
  // The milestone's copy of the view was renamed, and the live view parked
  // under it was saved, and put back on leaving the milestone, as before:
  // the folder split in two and the view's name came back.
  beforeEach(() => {
    s().setViewFolder('core', 'Logical')
    s().setViewFolder('all', 'Logical')
    early = s().createSnapshot('early again')
    s().removeNode('api')
    s().selectMilestone(early)
    expect(s().liveBackup?.views?.core).toBeDefined()
  })
  const saved = () => s().saveDiagram().views!.map((v) => `${v.id}:${v.name}:${v.folder ?? ''}`).sort()

  it('a folder renamed holds every view of it, saved and back on the live model', () => {
    s().renameViewFolder('Logical', 'Architecture')
    expect(saved()).toEqual(['all:All:Architecture', 'core:Core:Architecture'])
    s().discardMilestoneChanges()
    expect(saved()).toEqual(['all:All:Architecture', 'core:Core:Architecture'])
    expect(s().views.core.folder).toBe('Architecture')
  })

  it('a view renamed or moved to a folder keeps it, saved and back on the live model', () => {
    s().renameView('core', 'Core X')
    s().setViewFolder('core', 'Other')
    expect(saved()).toEqual(['all:All:Logical', 'core:Core X:Other'])
    s().discardMilestoneChanges()
    expect(saved()).toEqual(['all:All:Logical', 'core:Core X:Other'])
    expect(s().views.core.name).toBe('Core X')
  })

  it('a view renamed, and the milestone\'s edits propagated: the live view keeps the name', () => {
    s().renameView('core', 'Core X')
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().views.core.name).toBe('Core X')
  })
})
