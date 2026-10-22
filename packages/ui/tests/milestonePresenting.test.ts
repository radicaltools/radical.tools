/**
 * Propagate, Save as new and Discard act on the milestone shown and its
 * edits, never on what a playing slide draws (F-0022). A slide puts its
 * own model on the canvas while it plays (a milestone it is linked to, its
 * copy, or the live model): Propagate pressed then diffed that model
 * against the milestone and wrote it into every later milestone and the
 * live model. And F5 does not start a presentation behind the question how
 * to save the milestone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore, milestoneOnCanvas } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const sys = (id: string, x: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y: 0, ...NODE_SIZES.system } as C4Node)
const add = (label: string): string =>
  s().addNode({ type: 'system', label, x: 2000, y: 600, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)

function model(): DiagramData {
  return { nodes: [sys('a', 0), sys('b', 400)], relations: [], views: [] }
}

const labels = (nodes: Record<string, C4Node>): string[] => Object.values(nodes).map((n) => n.label).sort()
const milestone = (id: string): string[] => labels(s().snapshots.find((m) => m.id === id)!.nodes as Record<string, C4Node>)
const liveNow = (): string[] => labels((s().liveBackup?.nodes ?? s().c4Nodes) as Record<string, C4Node>)

// v1 has a b; v2 has a b c; the live model a b c d.
let v1 = ''
let v2 = ''
beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).__rfCurrentViewport = { x: 0, y: 0, zoom: 1 }
  ;(window as unknown as Record<string, unknown>).__prePresState = undefined
  s().setAppMode('designer')
  s().loadDiagram(model())
  v1 = s().createSnapshot('v1')
  add('c')
  v2 = s().createSnapshot('v2')
  add('d')
  s().setPresentations([{ id: 'p', name: 'P', slides: [
    { id: 'live', name: 'Live', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
    { id: 'old', name: 'On v1', snapshotId: v1, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
  ] }])
  s().setActivePresentation('p')
  // v1 opened and edited: e added, the question answered "decide later".
  s().selectMilestone(v1)
  add('e')
  s().dismissMilestonePrompt()
  expect(s().milestoneDirty).toBe(true)
})
afterEach(() => {
  if (s().presentationActive) s().stopPresentation()
  s().stopLiveLayout()
})

describe('Propagate pressed while a slide plays (F-0022)', () => {
  for (const [slide, index] of [['a slide that shows the live model', 0], ['a slide linked to an earlier milestone', 1]] as const) {
    it(`on ${slide} carries the milestone's edits, not the slide's model`, () => {
      s().startPresentation()
      s().goToSlide(index)
      s().commitMilestoneChanges('propagate')
      expect(milestone(v1)).toEqual(['a', 'b', 'e'])
      expect(milestone(v2)).toEqual(['a', 'b', 'c', 'e'])
      expect(liveNow()).toEqual(['a', 'b', 'c', 'd', 'e'])
      expect(s().presentationActive).toBe(false)
      expect(s().activeSnapshotId).toBe(v1)
      expect(labels(s().c4Nodes)).toEqual(['a', 'b', 'e'])
    })
  }

  it('Save as new keeps the milestone\'s edits, and Discard goes back to the live model', () => {
    s().startPresentation()
    s().goToSlide(0)
    s().commitMilestoneChanges('new', 'v1 edited')
    const made = s().snapshots.find((m) => m.name === 'v1 edited')!
    expect(milestone(made.id)).toEqual(['a', 'b', 'e'])
    expect(milestone(v2)).toEqual(['a', 'b', 'c'])
    expect(s().presentationActive).toBe(false)

    add('f')
    s().dismissMilestonePrompt()
    s().startPresentation()
    s().goToSlide(1)
    s().discardMilestoneChanges()
    expect(s().presentationActive).toBe(false)
    expect(s().activeSnapshotId).toBeNull()
    expect(labels(s().c4Nodes)).toEqual(['a', 'b', 'c', 'd'])
    expect(milestone(v1)).toEqual(['a', 'b'])
  })
})

describe('F5 while the milestone question is open (F-0022)', () => {
  it('does not start the presentation', () => {
    add('f')
    expect(s().milestonePromptOpen).toBe(false)
    // An edit after "decide later" does not ask again; a milestone switch does.
    s().selectMilestone(v2)
    expect(s().milestonePromptOpen).toBe(true)
    s().startPresentation()
    expect(s().presentationActive).toBe(false)
    expect(labels(s().c4Nodes)).toEqual(['a', 'b', 'e', 'f'])
  })
})

describe('The milestone chip over a playing slide (F-0027)', () => {
  // A slide with neither a milestone nor a copy draws the live model,
  // whatever milestone is open: the chip over it named the milestone open,
  // with its diff and Propagate.
  it('names the milestone the slide draws, and none over the live model', () => {
    expect(milestoneOnCanvas(s())).toBe(v1)
    s().setPresentations([{ id: 'q', name: 'Q', slides: [
      { id: 'live', name: 'Live', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
      { id: 'later', name: 'On v2', snapshotId: v2, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
      { id: 'gone', name: 'Gone', snapshotId: 'deleted', viewId: null, viewport: { x: 0, y: 0, zoom: 0 } },
    ] }])
    s().setActivePresentation('q')
    s().discardMilestoneChanges()
    s().selectMilestone(v1)
    s().startPresentation()
    s().goToSlide(0)
    expect(milestoneOnCanvas(s())).toBeNull()
    s().goToSlide(1)
    expect(milestoneOnCanvas(s())).toBe(v2)
    s().goToSlide(2)
    expect(milestoneOnCanvas(s())).toBeNull()
    s().stopPresentation()
    expect(milestoneOnCanvas(s())).toBe(v1)
  })
})
