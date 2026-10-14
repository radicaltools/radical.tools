/**
 * Milestones, the live model and the perspectives.
 *
 * Viewer and Presenter are for looking: what is picked there (a milestone,
 * "Current (live)", a slide) is put back on the way to Designer. Leaving
 * Designer parked the nodes and relations only, so a milestone picked in
 * Viewer stayed "the one shown" in Designer over the live model (a drag and
 * "Propagate" then copied the live model over every milestone), and "Current
 * (live)" picked in Viewer left the milestone's nodes as the live model.
 *
 * "Restore to live" makes a milestone the live model. It marked the milestone
 * as the one shown instead, so the next edit asked about "editing a
 * milestone", and with another milestone shown the live model did not change.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as C4Node)
/** The elements by label (addNode gives its own ids). */
const ids = (): string[] => Object.values(s().c4Nodes).map((n) => n.label).sort()
const savedIds = (): string[] => s().saveDiagram().nodes.map((n) => n.label).sort()

function model(): DiagramData {
  return {
    nodes: [sys('a', 0, 0), sys('b', 600, 0)],
    relations: [{ id: 'ab', sourceId: 'a', targetId: 'b' }],
    views: [],
  }
}

/** Milestone "one" has a and b, "two" has a, b and c; the live model has d too. */
let one = ''
let two = ''

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  one = s().createSnapshot('one')
  s().addNode(sys('c', 1200, 0))
  two = s().createSnapshot('two')
  s().addNode(sys('d', 1800, 0))
  expect(ids()).toEqual(['a', 'b', 'c', 'd'])
})
afterEach(() => {
  s().stopLiveLayout()
  s().setAppMode('designer')
})

describe('a milestone picked in Viewer', () => {
  it('is not the one Designer shows on return', () => {
    s().setAppMode('viewer')
    s().selectMilestone(one)
    expect(ids()).toEqual(['a', 'b'])

    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    expect(s().liveBackup).toBeNull()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    expect(savedIds()).toEqual(['a', 'b', 'c', 'd'])
  })

  it("leaves Designer's undo steps where they were", () => {
    s().setAppMode('viewer')
    s().selectMilestone(one)
    s().setAppMode('designer')
    expect(s().canUndo).toBe(true)
    s().undo()
    expect(ids()).toEqual(['a', 'b', 'c'])
  })

  it('does not keep the diff it showed', () => {
    s().setAppMode('viewer')
    s().selectMilestone(two)
    expect(Object.keys(s().diffHighlight).length).toBeGreaterThan(0)
    s().setAppMode('designer')
    expect(s().diffHighlight).toEqual({})
    expect(s().diffBaseSnapshotId).toBeNull()
  })
})

describe('"Current (live)" picked in Viewer while Designer shows a milestone', () => {
  it('leaves Designer on its milestone, and the live model as it was', () => {
    s().selectMilestone(one)
    s().setAppMode('viewer')
    s().discardMilestoneChanges()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])

    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBe(one)
    expect(ids()).toEqual(['a', 'b'])
    expect(Object.values(s().liveBackup!.nodes).map((n) => n.label).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(savedIds()).toEqual(['a', 'b', 'c', 'd'])
    // Back on the live model it is whole.
    s().discardMilestoneChanges()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps the edits Designer had not yet kept or dropped', () => {
    s().selectMilestone(one)
    s().updateNode('a', { description: 'edited' })
    expect(s().milestoneDirty).toBe(true)
    s().dismissMilestonePrompt()

    s().setAppMode('viewer')
    // Viewer browses freely: nothing asks it about Designer's edits.
    expect(s().milestoneDirty).toBe(false)
    s().selectMilestone(two)
    expect(s().milestonePromptOpen).toBe(false)
    expect(ids()).toEqual(['a', 'b', 'c'])

    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBe(one)
    expect(s().milestoneDirty).toBe(true)
    expect(s().c4Nodes.a.description).toBe('edited')
  })
})

describe('Restore to live', () => {
  it('makes the milestone the live model, with no milestone shown', () => {
    s().restoreSnapshot(one)
    expect(s().activeSnapshotId).toBeNull()
    expect(s().liveBackup).toBeNull()
    expect(ids()).toEqual(['a', 'b'])
    expect(savedIds()).toEqual(['a', 'b'])
    // The next edit is an edit of the live model.
    s().updateNode('a', { description: 'next' })
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
  })

  it('is one undo step', () => {
    s().restoreSnapshot(one)
    s().undo()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    expect(s().activeSnapshotId).toBeNull()
    s().redo()
    expect(ids()).toEqual(['a', 'b'])
  })

  it('replaces the live model also while another milestone is shown', () => {
    s().selectMilestone(two)
    s().restoreSnapshot(one)
    expect(s().activeSnapshotId).toBeNull()
    expect(s().liveBackup).toBeNull()
    expect(ids()).toEqual(['a', 'b'])
    expect(savedIds()).toEqual(['a', 'b'])
    // Undo gives the live model back, not the milestone that was shown.
    s().undo()
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('asks first when the milestone shown has edits not yet kept or dropped', () => {
    s().selectMilestone(two)
    s().updateNode('a', { description: 'edited' })
    s().dismissMilestonePrompt()
    s().restoreSnapshot(one)
    expect(s().milestonePromptOpen).toBe(true)
    expect(s().activeSnapshotId).toBe(two)
    expect(s().c4Nodes.a.description).toBe('edited')
  })
})

describe('slide cards in Presenter', () => {
  beforeEach(() => {
    const presId = s().addPresentation('Deck')
    s().setActivePresentation(presId)
    useDiagramStore.setState((st) => ({
      presentations: st.presentations.map((p) => p.id !== presId ? p : {
        ...p,
        slides: [
          { id: 's1', name: 'Then', snapshotId: one, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
          { id: 's2', name: 'Now', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
        ],
      }),
    }))
    s().setActivePresentation(presId)
    expect(s().presentationSlides.map((x) => x.id)).toEqual(['s1', 's2'])
  })

  it('a slide without its own model shows the live one after a milestone slide', () => {
    s().setAppMode('presenter')
    s().previewSlide(1)
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    s().previewSlide(0)
    expect(ids()).toEqual(['a', 'b'])
    s().previewSlide(1)
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('the presentation then plays that slide with the live model', async () => {
    s().setAppMode('presenter')
    s().previewSlide(0)
    s().previewSlide(1)
    s().startPresentation()
    s().goToSlide(1)
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    s().stopPresentation()
  })
})

describe('Undo belongs to Designer', () => {
  for (const mode of ['viewer', 'presenter'] as const) {
    it(`undo and redo do nothing in ${mode}`, () => {
      s().setAppMode(mode)
      s().undo()
      expect(ids()).toEqual(['a', 'b', 'c', 'd'])
      s().setAppMode('designer')
      expect(ids()).toEqual(['a', 'b', 'c', 'd'])
      expect(s().canUndo).toBe(true)
      s().undo()
      expect(ids()).toEqual(['a', 'b', 'c'])

      s().setAppMode(mode)
      s().redo()
      s().setAppMode('designer')
      expect(ids()).toEqual(['a', 'b', 'c'])
      expect(s().canRedo).toBe(true)
    })

    it(`what is done in ${mode} is no undo step of Designer's`, () => {
      s().setAppMode(mode)
      s().toggleCollapse('a')
      s().setAppMode('designer')
      // The newest step is still the one that added d.
      s().undo()
      expect(ids()).toEqual(['a', 'b', 'c'])
      expect(s().c4Nodes.a.collapsed).toBe(false)
    })
  }
})
