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
    // The milestone keeps the view's list, not its places.
    expect(s().saveDiagram().snapshots![0].views!.core.positions).toEqual({})
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
})
