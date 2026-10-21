/**
 * Sequence tests.
 *
 * Covers:
 *   - addSequence creates a new empty sequence and returns its id
 *   - renameSequence updates the name
 *   - removeSequence deletes the sequence; unlinks views that reference it;
 *     clears activeSequenceId if it was the active one
 *   - setActiveSequence / toggle (set to null)
 *   - toggleRelationInSequence always appends a relation (same relation can
 *     appear multiple times in one sequence); removal is done via removeFromSequence
 *   - removeFromSequence removes a step by index
 *   - reorderSequence swaps two steps
 *   - clearSequence removes all steps
 *   - addViewFromSequence unlinks the sequence from the view when the
 *     sequence is subsequently deleted
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { computeStepDiff, useDiagramStore } from '../src/store/diagramStore'
import type { C4Node, C4Relation } from '@radical/common/c4'

const initial = (() => {
  const s = useDiagramStore.getState()
  return {
    c4Nodes: JSON.parse(JSON.stringify(s.c4Nodes)) as Record<string, C4Node>,
    c4Relations: JSON.parse(JSON.stringify(s.c4Relations)) as Record<string, C4Relation>,
    sequences: JSON.parse(JSON.stringify(s.sequences)),
    views: JSON.parse(JSON.stringify(s.views)),
    activeSequenceId: s.activeSequenceId,
    activeViewId: s.activeViewId,
  }
})()

beforeEach(() => {
  useDiagramStore.setState({
    c4Nodes: JSON.parse(JSON.stringify(initial.c4Nodes)),
    c4Relations: JSON.parse(JSON.stringify(initial.c4Relations)),
    sequences: JSON.parse(JSON.stringify(initial.sequences)),
    views: JSON.parse(JSON.stringify(initial.views)),
    activeSequenceId: null,
    activeViewId: null,
    appMode: 'designer',
  } as any)
  useDiagramStore.getState()._sync()
})

describe('addSequence', () => {
  it('creates a new empty sequence and returns its id', () => {
    const id = useDiagramStore.getState().addSequence('My Seq')
    const seq = useDiagramStore.getState().sequences[id]
    expect(seq).toBeDefined()
    expect(seq.name).toBe('My Seq')
    expect(seq.relationIds).toEqual([])
  })
})

describe('renameSequence', () => {
  it('updates the sequence name', () => {
    const id = useDiagramStore.getState().addSequence('Old')
    useDiagramStore.getState().renameSequence(id, 'New')
    expect(useDiagramStore.getState().sequences[id].name).toBe('New')
  })

  it('is a no-op for unknown ids', () => {
    expect(() => useDiagramStore.getState().renameSequence('nonexistent', 'X')).not.toThrow()
  })
})

describe('removeSequence', () => {
  it('deletes the sequence', () => {
    const id = useDiagramStore.getState().addSequence('Temp')
    useDiagramStore.getState().removeSequence(id)
    expect(useDiagramStore.getState().sequences[id]).toBeUndefined()
  })

  it('clears activeSequenceId when the active sequence is removed', () => {
    const id = useDiagramStore.getState().addSequence('Active')
    useDiagramStore.getState().setActiveSequence(id)
    expect(useDiagramStore.getState().activeSequenceId).toBe(id)
    useDiagramStore.getState().removeSequence(id)
    expect(useDiagramStore.getState().activeSequenceId).toBeNull()
  })

  it('does not clear activeSequenceId when a different sequence is removed', () => {
    const id1 = useDiagramStore.getState().addSequence('Keep')
    const id2 = useDiagramStore.getState().addSequence('Remove')
    useDiagramStore.getState().setActiveSequence(id1)
    useDiagramStore.getState().removeSequence(id2)
    expect(useDiagramStore.getState().activeSequenceId).toBe(id1)
  })

  it('unlinks views that referenced the deleted sequence', () => {
    const seqId = useDiagramStore.getState().addSequence('Linked')
    const viewId = useDiagramStore.getState().addView('Linked View')
    useDiagramStore.getState().setViewSequence(viewId, seqId)
    expect(useDiagramStore.getState().views[viewId].sequenceId).toBe(seqId)

    useDiagramStore.getState().removeSequence(seqId)
    expect(useDiagramStore.getState().views[viewId].sequenceId).toBeUndefined()
  })
})

describe('setActiveSequence', () => {
  it('sets the active sequence id', () => {
    const id = useDiagramStore.getState().addSequence('S')
    useDiagramStore.getState().setActiveSequence(id)
    expect(useDiagramStore.getState().activeSequenceId).toBe(id)
  })

  it('clears with null', () => {
    const id = useDiagramStore.getState().addSequence('S')
    useDiagramStore.getState().setActiveSequence(id)
    useDiagramStore.getState().setActiveSequence(null)
    expect(useDiagramStore.getState().activeSequenceId).toBeNull()
  })
})

describe('toggleRelationInSequence', () => {
  it('adds a relation on first toggle', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relId = Object.keys(useDiagramStore.getState().c4Relations)[0]
    useDiagramStore.getState().toggleRelationInSequence(seqId, relId)
    expect(useDiagramStore.getState().sequences[seqId].relationIds).toContain(relId)
  })

  it('appends the same relation again on second click (no toggle-off)', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relId = Object.keys(useDiagramStore.getState().c4Relations)[0]
    useDiagramStore.getState().toggleRelationInSequence(seqId, relId)
    useDiagramStore.getState().toggleRelationInSequence(seqId, relId)
    expect(useDiagramStore.getState().sequences[seqId].relationIds).toEqual([relId, relId])
  })
})

describe('removeFromSequence', () => {
  it('removes the step at the given index', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    // Remove step at index 1 (middle)
    useDiagramStore.getState().removeFromSequence(seqId, 1)
    const remaining = useDiagramStore.getState().sequences[seqId].relationIds
    expect(remaining.length).toBe(2)
    expect(remaining).not.toContain(relIds[1])
    expect(remaining[0]).toBe(relIds[0])
    expect(remaining[1]).toBe(relIds[2])
  })
})

describe('reorderSequence', () => {
  it('moves a step forward', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    // Move index 0 to index 2
    useDiagramStore.getState().reorderSequence(seqId, 0, 2)
    const ids = useDiagramStore.getState().sequences[seqId].relationIds
    expect(ids[0]).toBe(relIds[1])
    expect(ids[1]).toBe(relIds[2])
    expect(ids[2]).toBe(relIds[0])
  })

  it('moves a step backward', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    // Move index 2 to index 0
    useDiagramStore.getState().reorderSequence(seqId, 2, 0)
    const ids = useDiagramStore.getState().sequences[seqId].relationIds
    expect(ids[0]).toBe(relIds[2])
    expect(ids[1]).toBe(relIds[0])
    expect(ids[2]).toBe(relIds[1])
  })
})

describe('clearSequence', () => {
  it('removes all steps', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 2)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    expect(useDiagramStore.getState().sequences[seqId].relationIds.length).toBe(2)
    useDiagramStore.getState().clearSequence(seqId)
    expect(useDiagramStore.getState().sequences[seqId].relationIds).toEqual([])
  })
})

describe('updateStepDescription', () => {
  it('sets a description for a specific step', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 2)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    useDiagramStore.getState().updateStepDescription(seqId, 0, 'First step note')
    const seq = useDiagramStore.getState().sequences[seqId]
    expect(seq.stepDescriptions?.[0]).toBe('First step note')
    expect(seq.stepDescriptions?.[1]).toBeUndefined()
  })

  it('clears a description when empty string is provided', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 1)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    useDiagramStore.getState().updateStepDescription(seqId, 0, 'some note')
    useDiagramStore.getState().updateStepDescription(seqId, 0, '')
    const seq = useDiagramStore.getState().sequences[seqId]
    expect(seq.stepDescriptions?.[0]).toBeUndefined()
  })

  it('is no edit when the note stays as it was', () => {
    // A click into a note and out wrote it back unchanged: an undo step, and
    // in a milestone the question how to save changes nobody had made.
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 2)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    useDiagramStore.getState().updateStepDescription(seqId, 0, 'note')
    const before = useDiagramStore.getState().sequences[seqId]
    for (const [idx, text] of [[0, 'note'], [1, ''], [5, '']] as const) {
      useDiagramStore.getState().updateStepDescription(seqId, idx, text)
    }
    expect(useDiagramStore.getState().sequences[seqId]).toBe(before)
    // One Undo takes the note back, not a write that changed nothing.
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().sequences[seqId].stepDescriptions?.[0]).toBeUndefined()
  })

  it('preserves descriptions when removing a step', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    useDiagramStore.getState().updateStepDescription(seqId, 0, 'step A')
    useDiagramStore.getState().updateStepDescription(seqId, 2, 'step C')
    // Remove step 1 (middle, no description)
    useDiagramStore.getState().removeFromSequence(seqId, 1)
    const seq = useDiagramStore.getState().sequences[seqId]
    expect(seq.stepDescriptions?.[0]).toBe('step A')
    expect(seq.stepDescriptions?.[1]).toBe('step C')
  })

  it('preserves descriptions when reordering steps', () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    useDiagramStore.getState().updateStepDescription(seqId, 0, 'first')
    useDiagramStore.getState().updateStepDescription(seqId, 2, 'third')
    // Move index 0 to index 2
    useDiagramStore.getState().reorderSequence(seqId, 0, 2)
    const seq = useDiagramStore.getState().sequences[seqId]
    // After move: [relIds[1], relIds[2], relIds[0]]
    // descriptions follow: [undefined, 'third', 'first']
    expect(seq.stepDescriptions?.[0]).toBeUndefined()
    expect(seq.stepDescriptions?.[1]).toBe('third')
    expect(seq.stepDescriptions?.[2]).toBe('first')
  })
})

describe('computeStepDiff (a flow view against the milestone before)', () => {
  // The diff took a sequence as a set of relation ids: a relation that is
  // two steps lost one with no ghost, gained one with no NEW, and a note
  // changed on one step coloured the other too.
  const seq = (relationIds: string[], stepDescriptions?: string[]) => ({ relationIds, stepDescriptions })
  it('finds a second step of a relation removed', () => {
    const d = computeStepDiff(seq(['r1', 'r2', 'r3', 'r4', 'r2']), seq(['r1', 'r2', 'r3', 'r4']))
    expect(d.steps).toEqual([undefined, undefined, undefined, undefined])
    expect(d.removed).toEqual([4])
  })
  it('finds a second step of a relation added', () => {
    const d = computeStepDiff(seq(['r1', 'r2', 'r3', 'r4']), seq(['r1', 'r2', 'r3', 'r4', 'r2']))
    expect(d.steps).toEqual([undefined, undefined, undefined, undefined, 'new'])
    expect(d.removed).toEqual([])
  })
  it('colours only the step whose note changed', () => {
    const d = computeStepDiff(seq(['r1', 'r2', 'r3', 'r4', 'r2'], ['', 'a', '', '', 'b']), seq(['r1', 'r2', 'r3', 'r4', 'r2'], ['', 'a', '', '', 'B']))
    expect(d.steps).toEqual([undefined, undefined, undefined, undefined, 'changed'])
  })
  it('takes every step as new when the sequence was not there', () => {
    expect(computeStepDiff(undefined, seq(['r1', 'r2'])).steps).toEqual(['new', 'new'])
  })
})

describe('deleting what a sequence steps along (D4)', () => {
  // A deleted relation's steps stayed: a flow numbered the steps left with
  // gaps (3, 4) under "2 steps", and nothing flagged them.
  const withSteps = () => {
    const s = useDiagramStore.getState()
    const seqId = s.addSequence('S')
    const relIds = Object.keys(s.c4Relations).slice(0, 3)
    for (const r of [...relIds, relIds[1]]) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    relIds.forEach((_, i) => useDiagramStore.getState().updateStepDescription(seqId, i, `step ${i}`))
    useDiagramStore.getState().updateStepDescription(seqId, 3, 'again')
    return { seqId, relIds }
  }

  it('removes a deleted relation\'s steps with their notes, in the same undo step', () => {
    const { seqId, relIds } = withSteps()
    useDiagramStore.getState().removeRelation(relIds[1])
    const seq = useDiagramStore.getState().sequences[seqId]
    expect(seq.relationIds).toEqual([relIds[0], relIds[2]])
    expect(seq.stepDescriptions).toEqual(['step 0', 'step 2'])
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().c4Relations[relIds[1]]).toBeDefined()
    expect(useDiagramStore.getState().sequences[seqId].relationIds).toEqual([...relIds, relIds[1]])
    expect(useDiagramStore.getState().sequences[seqId].stepDescriptions).toEqual(['step 0', 'step 1', 'step 2', 'again'])
  })

  it('removes the steps of the relations a deleted element takes with it', () => {
    const { seqId, relIds } = withSteps()
    const s = useDiagramStore.getState()
    const end = s.c4Relations[relIds[0]].sourceId
    const gone = new Set(Object.values(s.c4Relations).filter((r) => r.sourceId === end || r.targetId === end).map((r) => r.id))
    useDiagramStore.getState().removeNode(end)
    const seq = useDiagramStore.getState().sequences[seqId]
    expect(seq.relationIds).toEqual([...relIds, relIds[1]].filter((r) => !gone.has(r)))
    expect(seq.relationIds.every((r) => useDiagramStore.getState().c4Relations[r])).toBe(true)
  })
})

describe('backward steps (a response along the relation)', () => {
  const withSteps = () => {
    const seqId = useDiagramStore.getState().addSequence('S')
    const relIds = Object.keys(useDiagramStore.getState().c4Relations).slice(0, 3)
    for (const r of relIds) useDiagramStore.getState().toggleRelationInSequence(seqId, r)
    return { seqId, relIds, seq: () => useDiagramStore.getState().sequences[seqId] }
  }

  it('setStepBackward turns one step, as one undo step; turned forward again it leaves no flags', () => {
    const { seqId, seq } = withSteps()
    useDiagramStore.getState().setStepBackward(seqId, 1, true)
    expect(seq().stepBackward).toEqual([false, true])
    useDiagramStore.getState().setStepBackward(seqId, 1, false)
    expect(seq().stepBackward).toBeUndefined()
    useDiagramStore.getState().undo()
    expect(seq().stepBackward).toEqual([false, true])
    useDiagramStore.getState().undo()
    expect(seq().stepBackward).toBeUndefined()
    expect(seq().relationIds).toHaveLength(3)
  })

  it('is no edit when the step already runs that way, or is not there', () => {
    const { seqId, seq } = withSteps()
    const before = seq()
    useDiagramStore.getState().setStepBackward(seqId, 0, false)
    useDiagramStore.getState().setStepBackward(seqId, 7, true)
    expect(seq()).toBe(before)
  })

  it('keeps the flag on its step when steps are removed, moved, cleared or their relation deleted', () => {
    const { seqId, relIds, seq } = withSteps()
    useDiagramStore.getState().setStepBackward(seqId, 2, true)
    useDiagramStore.getState().removeFromSequence(seqId, 0)
    expect(seq().stepBackward).toEqual([false, true])
    useDiagramStore.getState().reorderSequence(seqId, 1, 0)
    expect(seq().relationIds).toEqual([relIds[2], relIds[1]])
    expect(seq().stepBackward).toEqual([true])
    useDiagramStore.getState().reorderSequence(seqId, 0, 1)
    expect(seq().stepBackward).toEqual([false, true])
    useDiagramStore.getState().removeRelation(relIds[1])
    expect(seq().relationIds).toEqual([relIds[2]])
    expect(seq().stepBackward).toEqual([true])
    useDiagramStore.getState().clearSequence(seqId)
    expect(seq().stepBackward).toBeUndefined()
  })

  it('numbers a backward step on the canvas apart from the forward ones of its relation', () => {
    const { seqId, relIds } = withSteps()
    useDiagramStore.getState().toggleRelationInSequence(seqId, relIds[0])
    useDiagramStore.getState().setStepBackward(seqId, 3, true)
    useDiagramStore.getState().setActiveSequence(seqId)
    const edge = (id: string) => useDiagramStore.getState().rfEdges.find((e) => e.id === id)?.data as { sequenceStep?: number[]; sequenceStepBack?: number[] } | undefined
    expect(edge(relIds[0])).toMatchObject({ sequenceStep: [1], sequenceStepBack: [4] })
    expect(edge(relIds[1])?.sequenceStepBack).toBeUndefined()
  })

  it('computeStepDiff marks a step turned the other way as changed', () => {
    const d = computeStepDiff({ relationIds: ['r1', 'r2'] }, { relationIds: ['r1', 'r2'], stepBackward: [false, true] })
    expect(d.steps).toEqual([undefined, 'changed'])
  })
})
