import { describe, it, expect } from 'vitest'
import { useDiagramStore } from '../src/renderer/src/store/diagramStore'

// These tests guard the memory-dedup refactor in diagramStore.ts: snapshots,
// undo history, and presentation slides now reference the live model instead
// of deep-cloning it, relying on immer's copy-on-write to keep old references
// correct. The risk of that change is a leak — some later edit corrupting
// data that's supposed to be frozen in an older snapshot. These tests exist
// to catch exactly that.

describe('Snapshot / history memory sharing (immer copy-on-write)', () => {
  it('createSnapshot shares node data with the live model until something diverges', () => {
    const before = useDiagramStore.getState()
    const nodeIds = Object.keys(before.c4Nodes)
    const untouchedId = nodeIds.find(id => id !== nodeIds[0]) ?? nodeIds[0]

    const snapId = before.createSnapshot('sharing-test-1')
    const afterCreate = useDiagramStore.getState()
    const snap = afterCreate.snapshots.find(s => s.id === snapId)!

    // Right after creation, no clone happened — same top-level object.
    expect(snap.nodes).toBe(afterCreate.c4Nodes)

    // Edit an unrelated field on a different node.
    afterCreate.updateNode(nodeIds[0], { description: 'sharing-test edit' })
    const afterEdit = useDiagramStore.getState()

    // The top-level map diverged (new object for c4Nodes)...
    expect(snap.nodes).not.toBe(afterEdit.c4Nodes)
    // ...but the untouched node is still the exact same shared object.
    expect(snap.nodes[untouchedId]).toBe(afterEdit.c4Nodes[untouchedId])
  })

  it('editing the live model after a milestone snapshot leaves the snapshot data correct', () => {
    const store = useDiagramStore.getState()
    const nodeId = Object.keys(store.c4Nodes)[0]
    const originalLabel = store.c4Nodes[nodeId].label

    const snapId = store.createSnapshot('sharing-test-2')
    store.updateNode(nodeId, { label: 'CHANGED-BY-TEST' })

    const after = useDiagramStore.getState()
    expect(after.c4Nodes[nodeId].label).toBe('CHANGED-BY-TEST')
    const snap = after.snapshots.find(s => s.id === snapId)!
    expect(snap.nodes[nodeId].label).toBe(originalLabel)
  })

  it('undo/redo restores exact prior state across multiple edits', () => {
    const store = useDiagramStore.getState()
    const nodeId = Object.keys(store.c4Nodes)[0]
    const originalLabel = store.c4Nodes[nodeId].label

    store.updateNode(nodeId, { label: 'undo-test-A' })
    store.updateNode(nodeId, { label: 'undo-test-B' })
    expect(useDiagramStore.getState().c4Nodes[nodeId].label).toBe('undo-test-B')

    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Nodes[nodeId].label).toBe('undo-test-A')

    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Nodes[nodeId].label).toBe(originalLabel)

    useDiagramStore.getState().redo()
    expect(useDiagramStore.getState().c4Nodes[nodeId].label).toBe('undo-test-A')
  })

  it('commitMilestoneChanges("propagate") updates the intended milestones only', () => {
    const store = useDiagramStore.getState()
    // Sample data seeds three milestones: snap-1, snap-2, snap-3 (see
    // buildSampleDiagram). 'usr1' exists, unchanged, in all three.
    const untouchedLabel = store.snapshots.find(s => s.id === 'snap-1')!.nodes['usr1'].label

    store.selectMilestone('snap-2')
    const midEdit = useDiagramStore.getState()
    midEdit.updateNode('ctn2', { label: 'propagate-test-label' })
    useDiagramStore.getState().commitMilestoneChanges('propagate')

    const after = useDiagramStore.getState()
    const s1 = after.snapshots.find(s => s.id === 'snap-1')!
    const s2 = after.snapshots.find(s => s.id === 'snap-2')!
    const s3 = after.snapshots.find(s => s.id === 'snap-3')!

    // Active milestone (snap-2) and the later one (snap-3) got the edit;
    // the earlier one (snap-1) did not.
    expect(s2.nodes['ctn2'].label).toBe('propagate-test-label')
    expect(s3.nodes['ctn2'].label).toBe('propagate-test-label')
    expect(s1.nodes['ctn2'].label).not.toBe('propagate-test-label')

    // An unrelated node is untouched everywhere.
    expect(s1.nodes['usr1'].label).toBe(untouchedLabel)
    expect(s2.nodes['usr1'].label).toBe(untouchedLabel)
    expect(s3.nodes['usr1'].label).toBe(untouchedLabel)
  })
})
