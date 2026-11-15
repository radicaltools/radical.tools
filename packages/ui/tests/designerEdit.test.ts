/**
 * An edit a perspective offers (the Inspector panel's Add scenario in Viewer,
 * a concern pack added from the Hub) is Designer's (F-0132, F-0136): made in the model the
 * perspective showed, it was counted and drawn there, and gone in Designer,
 * never saved and with no undo step.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'
import { editAsDesigner, liveModelEditRefused } from '../src/store/designerEdit'

const s = useDiagramStore.getState
const node = (id: string, type: string, label: string, x: number): C4Node =>
  ({ id, type, label, collapsed: false, x, y: 0, width: 200, height: 100 } as C4Node)
const draft = (label: string): Omit<C4Node, 'id'> =>
  ({ type: 'scenario', label, description: '', technology: '', collapsed: false, external: false, x: 600, y: 0, width: 200, height: 100 } as Omit<C4Node, 'id'>)

function model(): DiagramData {
  return {
    nodes: [node('need', 'need', 'Pay online', 0), node('req', 'requirement', 'Take wallet payments', 300)],
    relations: [],
    views: [{ id: 'spec', name: 'Specification', nodeIds: ['need', 'req'], positions: {} }],
  }
}

const labels = () => Object.values(s().c4Nodes).map((n) => n.label).sort()

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  s().setActiveView('spec')
})
afterEach(() => s().stopLiveLayout())

describe('an edit a perspective offers', () => {
  it('made in Viewer or Presenter takes Studio to Designer, where it is, as one undo step', () => {
    for (const mode of ['viewer', 'presenter'] as const) {
      s().setAppMode(mode)
      const id = editAsDesigner(() => {
        const made = s().addNode(draft(`From ${mode}`))
        s().addNodeToView('spec', made)
        return made
      })
      expect(s().appMode).toBe('designer')
      expect(labels()).toContain(`From ${mode}`)
      expect(s().views.spec.nodeIds).toContain(id)
    }
    s().undo()
    s().undo()
    expect(labels()).toEqual(['Pay online', 'Take wallet payments'])
    expect(s().canUndo).toBe(false)
  })

  it('of the live model is refused while a milestone is shown, in the perspective or parked in Designer', () => {
    expect(liveModelEditRefused()).toBeNull()
    const v1 = s().createSnapshot('v1')
    s().selectMilestone(v1)
    expect(liveModelEditRefused()).toMatch(/The milestone "v1" is shown: this edits the live model/)
    // Viewer showing the live model, Designer parked on the milestone.
    s().setAppMode('viewer')
    s().discardMilestoneChanges()
    expect(s().activeSnapshotId).toBeNull()
    expect(liveModelEditRefused()).toMatch(/is shown in Designer/)
    s().setAppMode('designer')
    s().discardMilestoneChanges()
    expect(liveModelEditRefused()).toBeNull()
  })
})
