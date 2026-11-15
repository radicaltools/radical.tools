/**
 * The Inspector is about the live model (F-0134): its lists read the live
 * model, also while Designer shows a milestone, and so must the card it
 * opens. The store went on holding the milestone in the Inspector: Open on
 * a requirement added since showed an empty card. Leaving the Inspector,
 * each perspective shows what it showed before.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, label: string, x: number): C4Node =>
  ({ id, type, label, collapsed: false, x, y: 0, width: 200, height: 100 } as C4Node)

function model(): DiagramData {
  return {
    nodes: [node('need', 'need', 'Pay online', 0), node('cards', 'requirement', 'Take card payments', 300), node('wallet', 'requirement', 'Take wallet payments', 600)],
    relations: [],
    views: [{ id: 'spec', name: 'Specification', nodeIds: ['need', 'cards', 'wallet'], positions: {} }],
  }
}

let v1 = ''
beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  s().setActiveView('spec')
  v1 = s().createSnapshot('v1 Cards')
  // Since the milestone: one requirement added, one deleted.
  s().addNode({ type: 'requirement', label: 'Pay in instalments', description: '', technology: '', collapsed: false, external: false, x: 900, y: 0, width: 200, height: 100 } as Omit<C4Node, 'id'>)
  s().removeNode('wallet')
})
afterEach(() => s().stopLiveLayout())

const labels = () => Object.values(s().c4Nodes).map((n) => n.label).sort()

describe('the Inspector with a milestone shown', () => {
  it('holds the live model, and Designer gets its milestone back', () => {
    s().selectMilestone(v1)
    expect(labels()).toEqual(['Pay online', 'Take card payments', 'Take wallet payments'])
    s().setAppMode('inspector')
    expect(s().activeSnapshotId).toBeNull()
    expect(labels()).toEqual(['Pay in instalments', 'Pay online', 'Take card payments'])
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBe(v1)
    expect(labels()).toEqual(['Pay online', 'Take card payments', 'Take wallet payments'])
  })

  it('gives Viewer back the milestone it showed', () => {
    s().setAppMode('viewer')
    s().selectMilestone(v1)
    s().setAppMode('inspector')
    expect(labels()).toEqual(['Pay in instalments', 'Pay online', 'Take card payments'])
    s().setAppMode('viewer')
    expect(s().activeSnapshotId).toBe(v1)
    expect(labels()).toEqual(['Pay online', 'Take card payments', 'Take wallet payments'])
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    expect(labels()).toEqual(['Pay in instalments', 'Pay online', 'Take card payments'])
  })
})
