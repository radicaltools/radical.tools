/**
 * An edit a perspective offers (the Inspector's Add scenario, a concern pack
 * added from the Hub) is Designer's (F-0132, F-0136): made in the model the
 * perspective showed, it was counted and drawn there, and gone in Designer,
 * never saved and with no undo step.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'
import { editAsDesigner } from '../src/store/designerEdit'

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
  it('made in the Inspector is in Designer\'s model, as one undo step, and the Inspector stays', () => {
    s().setAppMode('inspector')
    const id = editAsDesigner(() => {
      const made = s().addNode(draft('Paying with a wallet'))
      s().addNodeToView('spec', made)
      return made
    })
    expect(s().appMode).toBe('inspector')
    expect(s().c4Nodes[id!]?.label).toBe('Paying with a wallet')
    s().setAppMode('designer')
    expect(labels()).toContain('Paying with a wallet')
    expect(s().views.spec.nodeIds).toContain(id)
    s().undo()
    expect(labels()).toEqual(['Pay online', 'Take wallet payments'])
    expect(s().canUndo).toBe(false)
  })

  it('made in Viewer or Presenter takes Studio to Designer, where it is', () => {
    for (const mode of ['viewer', 'presenter'] as const) {
      s().setAppMode(mode)
      editAsDesigner(() => s().addNode(draft(`From ${mode}`)))
      expect(s().appMode).toBe('designer')
      expect(labels()).toContain(`From ${mode}`)
    }
  })

  it('from the Inspector is the live model\'s: Designer leaves a milestone it shows, and one with edits not kept refuses', () => {
    const v1 = s().createSnapshot('v1')
    s().selectMilestone(v1)
    s().setAppMode('inspector')
    editAsDesigner(() => s().addNode(draft('Paying with a wallet')))
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    expect(labels()).toContain('Paying with a wallet')
    expect(s().snapshots[0].nodes).not.toHaveProperty(Object.values(s().c4Nodes).find((n) => n.label === 'Paying with a wallet')!.id)

    s().selectMilestone(v1)
    s().updateNode('req', { label: 'Take wallet payments now' })
    expect(s().milestoneDirty).toBe(true)
    s().setAppMode('inspector')
    expect(editAsDesigner(() => s().addNode(draft('Refused')))).toBeUndefined()
    expect(s().appMode).toBe('inspector')
    expect(s().notifications[s().notifications.length - 1]?.message).toMatch(/not kept or dropped/)
    s().setAppMode('designer')
    expect(labels()).not.toContain('Refused')
  })
})
