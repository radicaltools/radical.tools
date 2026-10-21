/**
 * A milestone in the URL (`…/s/<id>`) only *views* that milestone. It used to
 * be applied with restoreSnapshot, which swaps the milestone in without a
 * live backup, so reloading while viewing a milestone made the next autosave
 * write the milestone over the live model.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { applyRoute } from '../src/renderer/src/route'

beforeEach(() => {
  useDiagramStore.setState({
    snapshots: [],
    activeSnapshotId: null,
    liveBackup: null,
    milestoneDirty: false,
    milestonePromptOpen: false,
    appMode: 'designer',
  } as any)
})

describe('milestone in the route', () => {
  it('shows the milestone and keeps the live model for saving', () => {
    const store = useDiagramStore.getState()
    const id = Object.keys(store.c4Nodes)[0]
    const atMilestone = store.c4Nodes[id].label
    const snap = store.createSnapshot('v1')
    store.updateNode(id, { label: 'Renamed after v1' })

    applyRoute({ mode: 'designer', view: 'canvas', snap })

    const after = useDiagramStore.getState()
    expect(after.activeSnapshotId).toBe(snap)
    expect(after.c4Nodes[id].label).toBe(atMilestone)
    const saved = after.saveDiagram()
    expect(saved.nodes.find((n) => n.id === id)?.label).toBe('Renamed after v1')
  })

  // Back from a milestone kept it shown, and the URL written then put it
  // into the entry Back had gone to.
  it('a route without one leaves the milestone shown, and asks first when it has unsaved edits', () => {
    const store = useDiagramStore.getState()
    const id = Object.keys(store.c4Nodes)[0]
    const snap = store.createSnapshot('v1')
    applyRoute({ mode: 'designer', view: 'canvas', snap })
    expect(useDiagramStore.getState().activeSnapshotId).toBe(snap)
    applyRoute({ mode: 'designer', view: 'canvas' })
    expect(useDiagramStore.getState().activeSnapshotId).toBeNull()

    applyRoute({ mode: 'designer', view: 'canvas', snap })
    useDiagramStore.getState().updateNode(id, { label: 'Edited in v1' })
    useDiagramStore.getState().dismissMilestonePrompt()
    applyRoute({ mode: 'designer', view: 'canvas' })
    expect(useDiagramStore.getState().activeSnapshotId).toBe(snap)
    expect(useDiagramStore.getState().milestonePromptOpen).toBe(true)
  })
})
