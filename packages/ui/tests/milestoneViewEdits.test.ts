/**
 * What is done on a view while a milestone is shown (a collapse, Hide from
 * view, an alignment, a pin, Unpin all, a filter, Multi page, Move to…) is
 * an edit of the milestone: asked about as a drag is, kept out of the saved
 * live views, and taken back by Discard. Views are the live model's and
 * every milestone's, and each of these went into the live view at once.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, DiagramView } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, x: number, y: number, parentId?: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...(NODE_SIZES as Record<string, { width: number; height: number }>)[type] ?? { width: 200, height: 100 }, ...(parentId ? { parentId } : {}), ...extra } as C4Node)

const box = (x: number, y: number, width = 200, height = 120) => ({ x, y, width, height })

function model(): DiagramData {
  return {
    nodes: [
      { ...node('shop', 'system', 0, 0), width: 700, height: 400 },
      node('api', 'container', 40, 120, 'shop'),
      node('web', 'container', 360, 120, 'shop'),
      { ...node('bank', 'system', 900, 0), width: 500, height: 400 },
    ],
    relations: [{ id: 'r1', sourceId: 'api', targetId: 'bank' }],
    defaultPositions: { shop: box(0, 0, 700, 400), api: box(40, 120), web: box(360, 120), bank: box(900, 0, 500, 400) },
    views: [
      { id: 'v', name: 'v', nodeIds: [], positions: { shop: box(0, 0, 700, 400), api: box(40, 120), web: box(360, 120), bank: box(900, 0, 500, 400) } },
      { id: 'w', name: 'w', nodeIds: [], kind: 'wiki', positions: {} },
      { id: 'other', name: 'other', nodeIds: [], positions: { shop: box(0, 0, 700, 400), api: box(40, 120), web: box(360, 120), bank: box(900, 0, 500, 400) } },
    ] as DiagramView[],
  }
}

/** The live views as a reload would read them. */
const savedView = (id: string) => s().saveDiagram().views!.find((v) => v.id === id)!
const json = (x: unknown) => JSON.stringify(x)

let early = ''
beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  early = s().createSnapshot('early')
  s().setActiveView('v')
  s().selectMilestone(early)
})
afterEach(() => s().stopLiveLayout())

describe('A view edited while a milestone is shown', () => {
  it('a collapse asks about the milestone, is not saved into the live view, and Discard takes it back', () => {
    const live = json(savedView('v'))
    s().toggleCollapse('shop')
    expect(s().milestoneDirty).toBe(true)
    expect(s().milestonePromptOpen).toBe(true)
    expect(s().views.v.collapsedNodeIds).toContain('shop')
    expect(json(savedView('v'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
    expect(json(savedView('v'))).toBe(live)
  })

  it('Hide from view asks, is not saved, and Discard takes it back', () => {
    const live = json(savedView('v'))
    s().removeNodeFromView('v', 'bank')
    expect(s().milestoneDirty).toBe(true)
    expect(json(savedView('v'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.v.nodeIds).toEqual([])
  })

  it('an alignment and Unpin all are taken back by Discard', () => {
    s().addAlignment('horizontal', ['api', 'web'])
    expect(s().views.v.layoutConstraints?.length).toBe(1)
    expect(savedView('v').layoutConstraints ?? []).toEqual([])
    s().discardMilestoneChanges()
    expect(s().views.v.layoutConstraints ?? []).toEqual([])
  })

  it('Unpin all made in a milestone leaves the live pins', () => {
    s().discardMilestoneChanges()
    s().liveGrab('api', 40, 120)
    s().liveRelease('api')
    const pins = json(s().views.v.layoutConstraints)
    expect(s().views.v.layoutConstraints?.length).toBe(1)
    s().selectMilestone(early)
    s().removeLayoutConstraint(s().views.v.layoutConstraints![0].id, 'v')
    expect(s().milestoneDirty).toBe(true)
    expect(json(savedView('v').layoutConstraints)).toBe(pins)
    s().discardMilestoneChanges()
    expect(json(s().views.v.layoutConstraints)).toBe(pins)
  })

  it('a filter edited and Multi page switched are taken back by Discard, and Multi page\'s step stays with the live model', () => {
    s().setViewPipeline('v', { edges: 'all' })
    expect(s().milestoneDirty).toBe(true)
    expect(savedView('v').pipeline).toBeUndefined()
    s().setWikiPageMode('w', 'multi')
    expect(savedView('w').wikiPageMode ?? 'single').toBe('single')
    s().discardMilestoneChanges()
    expect(s().views.v.pipeline).toBeUndefined()
    expect(s().views.w.wikiPageMode ?? 'single').toBe('single')
  })

  it('Propagate makes what was done on the view the live view\'s', () => {
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('propagate')
    expect(savedView('v').collapsedNodeIds).toContain('shop')
    s().discardMilestoneChanges()
    expect(s().views.v.collapsedNodeIds).toContain('shop')
  })

  it('Save as new leaves the live views as they were', () => {
    const live = json(savedView('v'))
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('new', 'early (folded)')
    expect(json(savedView('v'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
  })
})

describe('Move to… in a milestone', () => {
  it('leaves the live views and All elements as they were after Discard and after Save as new', () => {
    const before = { v: json(s().views.v.positions), other: json(s().views.other.positions), all: json(s().defaultPositions) }
    s().reparentNodes(['web'], 'bank')
    expect(s().milestoneDirty).toBe(true)
    const saved = s().saveDiagram()
    expect(json(saved.views!.find((v) => v.id === 'other')!.positions)).toBe(before.other)
    expect(json(saved.defaultPositions)).toBe(before.all)
    s().discardMilestoneChanges()
    expect(json(s().views.v.positions)).toBe(before.v)
    expect(json(s().views.other.positions)).toBe(before.other)
    expect(json(s().defaultPositions)).toBe(before.all)
    expect(s().c4Nodes.web.parentId).toBe('shop')

    s().selectMilestone(early)
    s().reparentNodes(['web'], 'bank')
    s().commitMilestoneChanges('new', 'early (moved)')
    s().discardMilestoneChanges()
    expect(json(s().views.other.positions)).toBe(before.other)
    expect(json(s().defaultPositions)).toBe(before.all)
  })
})

describe('Undo in a milestone', () => {
  it('undoing every edit of the milestone leaves it with nothing unsaved; Redo makes it unsaved again', () => {
    s().toggleCollapse('shop')
    s().updateNode('api', { label: 'API' })
    expect(s().milestoneDirty).toBe(true)
    s().undo()
    expect(s().milestoneDirty).toBe(true)
    s().undo()
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
    s().redo()
    expect(s().milestoneDirty).toBe(true)
  })
})

// Every setting of a view's properties is an edit of the milestone shown,
// as the filter and the Lines are: the viewpoint, the Auto-layout and the
// flow's Sequence went into the live view at once (saved, kept after
// Discard), with no question and no step to undo on live.
describe('A view property set in a milestone', () => {
  const cases: [string, () => void, (v: DiagramView | undefined) => unknown][] = [
    ['the viewpoint', () => { expect(s().applyViewpoint('v', 'containers', null)).toBe(true) }, (v) => v?.viewpoint],
    ['the Auto-layout', () => s().setViewLayoutMode('v', 'tree'), (v) => v?.layoutMode],
    ['the flow\'s Sequence', () => s().setViewSequence('v', 'seq'), (v) => v?.sequenceId],
    ['the view type', () => s().setViewKind('v', 'table'), (v) => v?.kind],
    ['the hierarchy\'s Size', () => s().setTreemapSizeBy('v', 'children'), (v) => v?.treemapSizeBy],
    ['the hierarchy\'s Levels', () => s().setTreemapMaxDepth('v', 4), (v) => v?.treemapMaxDepth],
  ]
  for (const [what, edit, read] of cases) {
    it(`${what}: asks, is not saved into the live view, and Discard takes it back`, () => {
      const live = json(savedView('v'))
      const was = read(s().views.v)
      edit()
      expect(read(s().views.v)).not.toEqual(was)
      expect(s().milestoneDirty).toBe(true)
      expect(s().milestonePromptOpen).toBe(true)
      expect(json(savedView('v'))).toBe(live)
      s().discardMilestoneChanges()
      expect(read(s().views.v)).toEqual(was)
      expect(json(savedView('v'))).toBe(live)
    })
  }

  it('the viewpoint detached: asks, and Discard gives the live view its viewpoint back', () => {
    s().discardMilestoneChanges()
    s().applyViewpoint('v', 'containers', null)
    const live = json(savedView('v'))
    s().selectMilestone(early)
    s().detachViewpoint('v')
    expect(s().views.v.viewpoint).toBeUndefined()
    expect(s().milestoneDirty).toBe(true)
    expect(json(savedView('v'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.v.viewpoint).toBe('containers')
  })
})
