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
import { showNodeInView } from '../src/store/showInView'

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

  // F-0105: an agent's write read while the edit was not saved yet showed
  // the view as saved again: the element came back, the chip still said
  // unsaved, and Propagate left it on the live view.
  it('stays done when a change made outside Studio is read, and Propagate makes it the live view\'s', () => {
    s().removeNodeFromView('v', 'bank')
    s().dismissMilestonePrompt()
    const data = structuredClone(s().saveDiagram())
    data.nodes.find((n) => n.id === 'web')!.label = 'Web X'
    s().loadDiagram(data, { outsideChange: true })
    expect(s().activeSnapshotId).toBe(early)
    expect(s().milestoneDirty).toBe(true)
    expect(s().rfNodes.map((n) => n.id)).not.toContain('bank')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.web.label).toBe('Web X')
    expect(savedView('v').nodeIds).not.toContain('bank')
    expect(savedView('v').nodeIds).toContain('web')
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

describe('Revealing an element in a milestone (F-0011)', () => {
  // The card's Views, Quick Search and the Inspector open the containers
  // around the element they show (expandAncestors): navigation, not an
  // edit. It asked how to save the milestone, and the chip said unsaved.
  beforeEach(() => {
    s().discardMilestoneChanges()
    s().setActiveView('v')
    s().toggleCollapse('shop')
    s().selectMilestone(early)
  })

  it('opens its containers on the view without asking, and the live view keeps its folds', () => {
    const live = json(savedView('v'))
    expect(savedView('v').collapsedNodeIds).toEqual(['shop'])
    showNodeInView('api', 'v')
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
    expect(s().selectedNodeIds).toEqual(['api'])
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
    expect(json(savedView('v'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.v.collapsedNodeIds).toContain('shop')
  })

  it('on All elements, and from another view, asks nothing either', () => {
    s().setActiveView(null)
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, shop: { ...st.c4Nodes.shop, collapsed: true } } }))
    s().expandAncestors('api')
    expect(s().c4Nodes.shop.collapsed).toBe(false)
    expect(s().milestoneDirty).toBe(false)
    showNodeInView('web', 'v')
    expect(s().activeViewId).toBe('v')
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
  })

  it('a fold made by hand after it still asks', () => {
    showNodeInView('api', 'v')
    s().toggleCollapse('shop')
    expect(s().milestoneDirty).toBe(true)
    expect(s().milestonePromptOpen).toBe(true)
  })
})

describe('An element added on a view that lists its elements, in a milestone', () => {
  // The add listed the new id in the live view at once: saved so, it named
  // an element no model had, and stayed after Discard (sibling of item 230).
  beforeEach(() => {
    s().discardMilestoneChanges()
    const data = model()
    data.views!.push({ id: 'listed', name: 'listed', nodeIds: ['shop', 'bank'], positions: {} } as DiagramView)
    s().loadDiagram(data)
    early = s().createSnapshot('early')
    s().setActiveView('listed')
    s().selectMilestone(early)
  })

  it('is listed in the view shown only, and Discard takes it out', () => {
    const live = json(savedView('listed'))
    const { id: _x, ...added } = node('x', 'system', 1500, 0)
    const id = s().addNode(added)
    expect(s().milestoneDirty).toBe(true)
    expect(s().views.listed.nodeIds).toContain(id)
    expect(json(savedView('listed'))).toBe(live)
    s().discardMilestoneChanges()
    expect(s().views.listed.nodeIds).toEqual(['shop', 'bank'])
  })

  it('is listed in the live view by Propagate', () => {
    const { id: _x, ...added } = node('x', 'system', 1500, 0)
    const id = s().addNode(added)
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(savedView('listed').nodeIds).toEqual(['shop', 'bank', id])
    expect(s().c4Nodes[id]).toBeDefined()
  })
})

describe('A sequence of the milestone and the live flow views', () => {
  // Views are the live model's: a sequence deleted in a milestone unlinked
  // the live flow view for good (also after Discard), and a flow view made
  // from a sequence added there was saved naming a sequence, and elements,
  // the live model did not have.
  beforeEach(() => {
    s().discardMilestoneChanges()
    const data = model()
    data.sequences = [{ id: 'pay', name: 'Pay', relationIds: ['r1'] }]
    data.views!.push({ id: 'flow', name: 'flow', kind: 'dynamic', sequenceId: 'pay', nodeIds: [], positions: {} } as DiagramView)
    s().loadDiagram(data)
    early = s().createSnapshot('early')
    s().selectMilestone(early)
  })

  it('a sequence deleted: the live flow view keeps it, also after Discard; Propagate unlinks it', () => {
    s().removeSequence('pay')
    expect(s().views.flow.sequenceId).toBeUndefined()
    expect(savedView('flow').sequenceId).toBe('pay')
    s().discardMilestoneChanges()
    expect(s().views.flow.sequenceId).toBe('pay')
    s().selectMilestone(early)
    s().removeSequence('pay')
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(savedView('flow').sequenceId).toBeUndefined()
    expect(s().sequences.pay).toBeUndefined()
  })

  it('a flow view made from a sequence added there names nothing the live model lacks; Propagate links it', () => {
    const { id: _x, ...added } = node('x', 'system', 1500, 0)
    const x = s().addNode(added)
    s().addRelation({ sourceId: 'bank', targetId: x })
    const rel = Object.values(s().c4Relations).find((r) => r.targetId === x)!.id
    const q = s().addSequence('Refund')
    s().toggleRelationInSequence(q, rel)
    const viewId = s().addViewFromSequence(q)
    expect(s().views[viewId].sequenceId).toBe(q)
    expect(savedView(viewId).sequenceId).toBeUndefined()
    expect(savedView(viewId).nodeIds).toEqual(['bank'])
    s().commitMilestoneChanges('propagate')
    s().discardMilestoneChanges()
    expect(savedView(viewId).sequenceId).toBe(q)
    expect(savedView(viewId).nodeIds).toEqual(['bank', x])
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
  // The question took the focus from the field typed into, and gave it back
  // once answered: what was typed before and after it were two steps
  // (decided 2026-10-21: one).
  it('what is typed into one field before and after the question is one step', () => {
    s().beginTyping()
    s().updateNode('api', { label: 'api ' })
    expect(s().milestonePromptOpen).toBe(true)
    s().updateNode('api', { label: 'api X' })
    s().endTyping()
    s().dismissMilestonePrompt()
    s().beginTyping()
    s().updateNode('api', { label: 'api XQ' })
    s().endTyping()
    s().undo()
    expect(s().c4Nodes.api.label).toBe('api')
    expect(s().milestoneDirty).toBe(false)
  })

  it('another field typed into after the question is a step of its own', () => {
    s().beginTyping()
    s().updateNode('api', { label: 'API' })
    s().endTyping()
    s().dismissMilestonePrompt()
    s().beginTyping()
    s().updateNode('api', { description: 'Takes orders' })
    s().endTyping()
    s().undo()
    expect(s().c4Nodes.api).toMatchObject({ label: 'API' })
    expect(s().c4Nodes.api.description).toBeUndefined()
  })

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
    ['the hierarchy\'s Size', () => s().setTreemapSizeBy('v', 'uniform'), (v) => v?.treemapSizeBy],
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

// Views are the live model's and every milestone's. What was done on them in
// a milestone kept by Save as new was shown on the canvas but kept nowhere:
// reopening the new milestone showed the live views (decided 2026-10-21:
// the new milestone keeps them).
describe('Save as new and the view edits made in the milestone', () => {
  /** What the view shows, apart from where it is looked at. */
  const look = (id: string) => {
    const { positions: _p, viewport: _v, ...rest } = s().views[id]
    return json(rest)
  }

  function savedAsNew(): string {
    s().removeNodeFromView('v', 'bank')
    s().toggleCollapse('shop')
    s().commitMilestoneChanges('new', 'early (edited)')
    return s().activeSnapshotId!
  }

  it('keeps them in the new milestone: reopening it shows them, and the live views stay as they were', () => {
    const live = json(savedView('v'))
    const liveLook = look('v')
    const made = savedAsNew()
    const edited = look('v')
    expect(edited).not.toBe(liveLook)
    s().discardMilestoneChanges()
    expect(look('v')).toBe(liveLook)
    expect(json(savedView('v'))).toBe(live)
    s().selectMilestone(made)
    expect(look('v')).toBe(edited)
    expect(s().milestoneDirty).toBe(false)
    expect(json(savedView('v'))).toBe(live)
    // Another milestone shows the live views.
    s().selectMilestone(early)
    expect(look('v')).toBe(liveLook)
    s().selectMilestone(made)
    expect(look('v')).toBe(edited)
    s().discardMilestoneChanges()
    expect(look('v')).toBe(liveLook)
    expect(json(savedView('v'))).toBe(live)
  })

  it('are saved with the milestone, and shown after a reload', () => {
    const made = savedAsNew()
    const edited = look('v')
    s().discardMilestoneChanges()
    s().loadDiagram(s().saveDiagram())
    s().setActiveView('v')
    s().selectMilestone(made)
    expect(look('v')).toBe(edited)
  })

  it('are shown still after a change made outside Studio is read', () => {
    const made = savedAsNew()
    const edited = look('v')
    s().discardMilestoneChanges()
    s().selectMilestone(made)
    s().loadDiagram(structuredClone(s().saveDiagram()), { outsideChange: true })
    expect(s().activeSnapshotId).toBe(made)
    expect(look('v')).toBe(edited)
    s().discardMilestoneChanges()
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
  })

  it('keep the view\'s name, folder and layout as the live model has them now', () => {
    const made = savedAsNew()
    s().discardMilestoneChanges()
    s().renameView('v', 'Shop view')
    s().setViewFolder('v', 'Shop')
    s().selectMilestone(made)
    expect(s().views.v).toMatchObject({ name: 'Shop view', folder: 'Shop' })
    expect(s().views.v.collapsedNodeIds).toContain('shop')
    expect(json(s().views.v.positions)).toBe(json(savedView('v').positions))
  })

  // The milestone keeps of the view only what was done on it there: what the
  // live view changes since, and the milestone did not, reaches it.
  it('show what is done on the live view since, where the milestone did not change it', () => {
    const made = savedAsNew()
    s().discardMilestoneChanges()
    s().setViewEdgeStyle('v', 'orthogonal')
    s().addAlignment('horizontal', ['api', 'web'])
    s().selectMilestone(made)
    expect(s().views.v.edgeStyle).toBe('orthogonal')
    expect(s().views.v.layoutConstraints?.length).toBe(1)
    expect(s().views.v.collapsedNodeIds).toContain('shop')
    expect(s().views.v.nodeIds).not.toContain('bank')
  })

  it('Propagate from that milestone carries only what was edited in it now', () => {
    const made = savedAsNew()
    s().discardMilestoneChanges()
    s().selectMilestone(made)
    s().updateNode('api', { label: 'API' })
    s().setViewEdgeStyle('v', 'orthogonal')
    s().commitMilestoneChanges('propagate')
    // The milestone shows its own views with the edit.
    expect(s().views.v.collapsedNodeIds).toContain('shop')
    expect(s().views.v.edgeStyle).toBe('orthogonal')
    s().discardMilestoneChanges()
    expect(s().c4Nodes.api.label).toBe('API')
    expect(s().views.v.edgeStyle).toBe('orthogonal')
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('shop')
    expect(savedView('v').nodeIds).toEqual([])
    s().selectMilestone(made)
    expect(s().views.v.collapsedNodeIds).toContain('shop')
    expect(s().views.v.edgeStyle).toBe('orthogonal')
  })
})
