/**
 * What a slide keeps and shows: its collapse state, its drill level, the
 * view it is linked to, and which slide is the current one once the list
 * changes. Exploratory runs 47 and 56 (items 171, 197, 198, 200, 201).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'
// A copy of the e2e suite's fixture (apps/e2e/fixtures).
import bookstoreFile from './fixtures/bookstore.radical?raw'

const s = useDiagramStore.getState
const bookstore = (): DiagramData => JSON.parse(bookstoreFile) as DiagramData
function model(): DiagramData {
  return {
    nodes: [
      { id: 'shop', type: 'system', label: 'Shop', collapsed: false, x: 0, y: 0, width: 600, height: 400 } as C4Node,
      { id: 'api', type: 'container', label: 'API', parentId: 'shop', collapsed: false, x: 40, y: 120, ...NODE_SIZES.container } as C4Node,
      { id: 'db', type: 'container', label: 'DB', parentId: 'shop', collapsed: false, x: 320, y: 120, ...NODE_SIZES.container } as C4Node,
      { id: 'bank', type: 'system', label: 'Bank', collapsed: false, x: 900, y: 0, ...NODE_SIZES.system } as C4Node,
    ],
    relations: [],
    views: [
      { id: 'ctx', name: 'Context', nodeIds: ['shop', 'bank'], positions: { shop: { x: 0, y: 0, width: 240, height: 140 }, bank: { x: 500, y: 0, width: 240, height: 140 } } },
      { id: 'core', name: 'Core', nodeIds: ['shop', 'api', 'db'], positions: { shop: { x: 0, y: 0, width: 600, height: 400 }, api: { x: 40, y: 120, width: 240, height: 140 }, db: { x: 320, y: 120, width: 240, height: 140 } } },
      { id: 'tree', name: 'Hierarchy', kind: 'treemap', nodeIds: [], positions: {} },
    ],
  }
}

/** The view whose slide is played or shown: what it folds, as _sync draws it. */
const drawnCollapsed = (id: string): boolean => {
  const rf = s().rfNodes.find((n) => n.id === id)
  return Boolean((rf?.data as { collapsed?: boolean } | undefined)?.collapsed)
}

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).__rfCurrentViewport = { x: 10, y: 20, zoom: 1 }
  ;(window as unknown as Record<string, unknown>).__prePresState = undefined
  s().setAppMode('designer')
  s().loadDiagram(model())
  const presId = s().addPresentation('Deck')
  s().setActivePresentation(presId)
})
afterEach(() => {
  if (s().presentationActive) s().stopPresentation()
  s().stopLiveLayout()
})

describe('a slide captured with a container folded or open in its view (item 171)', () => {
  it('shows it as it was captured, whatever the view does since', () => {
    s().setActiveView('core')
    s().toggleCollapse('shop')
    s().addPresentationSlide('Folded')
    s().toggleCollapse('shop')
    s().addPresentationSlide('Open')
    expect(s().views.core.collapsedNodeIds ?? []).toEqual([])
    // Folded again in Designer: the "Open" slide still shows it open.
    s().toggleCollapse('shop')
    s().startPresentation()
    s().goToSlide(1)
    expect(drawnCollapsed('shop')).toBe(false)
    s().goToSlide(0)
    expect(drawnCollapsed('shop')).toBe(true)
    s().stopPresentation()
    // Designer's view keeps its own fold.
    expect(s().views.core.collapsedNodeIds).toEqual(['shop'])
    expect(drawnCollapsed('shop')).toBe(true)
  })
})

describe('Capture again on a hierarchy slide (item 197)', () => {
  it('takes the drill level shown now', () => {
    s().setActiveView('tree')
    s().setTreemapFocus('tree', 'shop')
    s().addPresentationSlide('Inside')
    const id = s().presentationSlides[0].id
    s().setTreemapFocus('tree', null)
    s().captureSlideViewport(id)
    expect(s().presentationSlides[0].treemapFocusId).toBeNull()
    s().setTreemapFocus('tree', 'shop')
    s().captureSlideViewport(id)
    expect(s().presentationSlides[0].treemapFocusId).toBe('shop')
    // Captured on a canvas, it keeps no drill level.
    s().setActiveView('core')
    s().captureSlideViewport(id)
    expect(s().presentationSlides[0]).not.toHaveProperty('treemapFocusId')
  })
})

describe('a hierarchy slide with no drill level of its own', () => {
  it('shows the top, not the level the view was left at', () => {
    s().setPresentations([{ id: 'p', name: 'P', slides: [{ id: 'h', name: 'Tree', snapshotId: null, viewId: 'tree', viewport: { x: 0, y: 0, zoom: 0 } }] }])
    s().setActivePresentation('p')
    s().setTreemapFocus('tree', 'shop')
    s().startPresentation()
    s().goToSlide(0)
    expect(s().slideTreemapFocus).toEqual({ viewId: 'tree', focusId: null })
  })
})

describe('Link view (item 198)', () => {
  it('draws the linked view with its own places, not the old view\'s', () => {
    s().setActiveView('ctx')
    s().addPresentationSlide('Context')
    const id = s().presentationSlides[0].id
    s().linkViewToSlide(id, 'core')
    const slide = s().presentationSlides[0]
    expect(slide.viewId).toBe('core')
    expect(slide.canvasState).toBeUndefined()
    expect(slide.viewport).toEqual({ x: 0, y: 0, zoom: 0 })
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes.shop).toMatchObject({ width: 600, height: 400 })
  })
})

describe('the slide list replaced from outside (item 200)', () => {
  it('keeps the slide shown current, not its place in the list', () => {
    const slide = (id: string) => ({ id, name: id, snapshotId: null, viewId: 'ctx', viewport: { x: 0, y: 0, zoom: 0 } })
    s().setPresentations([{ id: 'p', name: 'P', slides: [slide('a'), slide('b'), slide('c')] }])
    s().setActivePresentation('p')
    s().previewSlide(1)
    s().setPresentations([{ id: 'p', name: 'P', slides: [slide('c'), slide('a'), slide('b')] }])
    expect(s().presentationSlides[s().presentationSlideIndex].id).toBe('b')
    // Gone: the place it had, within the list.
    s().setPresentations([{ id: 'p', name: 'P', slides: [slide('c')] }])
    expect(s().presentationSlideIndex).toBe(0)
  })
})

describe('F5 from Designer (item 201)', () => {
  it('leaves Designer\'s views as they were when it stops', () => {
    s().setActiveView('tree')
    s().addPresentationSlide('Top')
    s().startPresentation()
    s().goToSlide(0)
    // What playing did to a view (a drill, a fold) is the slide's.
    s().setTreemapFocus('tree', 'shop')
    s().stopPresentation()
    expect(s().views.tree.treemapFocusId ?? null).toBeNull()
  })
})

describe('a slide of a deleted view', () => {
  it('shows All elements, not the whole model under the deleted view\'s id', () => {
    s().setActiveView('core')
    s().addPresentationSlide('Core')
    s().setActiveView('ctx')
    s().removeView('core')
    s().startPresentation()
    s().goToSlide(0)
    expect(s().activeViewId).toBeNull()
  })
})

describe('Presenter, then Viewer', () => {
  it('Viewer shows the view as Designer has it, not as the last slide left it', () => {
    s().setActiveView('core')
    s().addPresentationSlide('Core')
    // Rearranged in Designer after the slide.
    s().updateNode('api', { x: 60 })
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes.api.x).toBe(40)
    s().setAppMode('viewer')
    expect(s().c4Nodes.api.x).toBe(60)
  })
})

describe('back in Designer from Presenter', () => {
  // Its camera moved 40 px: a camera moved in Presenter stayed, and Smart fit
  // took what Designer shows again for new.
  it('puts Designer\'s camera back, with the nodes Designer shows', () => {
    const W = window as unknown as Record<string, unknown>
    const placed: unknown[][] = []
    W.__rfPlaceCamera = (...args: unknown[]) => { placed.push(args) }
    s().setActiveView('core')
    W.__rfCurrentViewport = { x: 1, y: 2, zoom: 0.5 }
    s().setAppMode('presenter')
    W.__rfCurrentViewport = { x: 50, y: 60, zoom: 2 }
    s().toggleCollapse('shop')
    s().setAppMode('designer')
    expect(placed[placed.length - 1]).toEqual([{ x: 1, y: 2, zoom: 0.5 }, expect.arrayContaining(['shop', 'api', 'db']), { keep: true }])
    delete W.__rfPlaceCamera
  })
})

describe('a presentation started from Designer (F5)', () => {
  // F-0097: Esc put back the view shown before, not its camera: the view was
  // drawn at the last slide's camera, and a reload moved it.
  it('ends at Designer\'s camera from before it started', () => {
    const W = window as unknown as Record<string, unknown>
    const placed: unknown[][] = []
    W.__rfPlaceCamera = (...args: unknown[]) => { placed.push(args) }
    try {
      s().setActiveView('core')
      s().addPresentationSlide('Core')
      s().setActiveView('ctx')
      W.__rfCurrentViewport = { x: 1, y: 2, zoom: 0.5 }
      s().startPresentation()
      // The slide's camera.
      W.__rfCurrentViewport = { x: 50, y: 60, zoom: 2 }
      s().stopPresentation()
      expect(s().activeViewId).toBe('ctx')
      expect(placed[placed.length - 1]?.[0]).toEqual({ x: 1, y: 2, zoom: 0.5 })
    } finally {
      delete W.__rfPlaceCamera
    }
  })
})

describe('the model a slide shows once its milestone is gone (item 232)', () => {
  // Milestone v1 has the four elements; the live model has a fifth since.
  const live = (): string => s().addNode({ type: 'system', label: 'Pay', x: 900, y: 600, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)

  it('a slide added on a milestone shows the live model after Delete milestone', () => {
    const v1 = s().createSnapshot('v1')
    const pay = live()
    s().setActiveView('ctx')
    s().selectMilestone(v1)
    s().addPresentationSlide('On v1')
    s().discardMilestoneChanges()
    s().removeSnapshot(v1)
    expect(s().notifications[s().notifications.length - 1]?.message).toMatch(/shows the live model now/)
    const slide = s().presentationSlides[0]
    expect(slide.snapshotId).toBeNull()
    // Nothing captured from v1 is left to replay over the live model.
    expect(slide.modelSnapshot).toBeUndefined()
    expect(slide.canvasState).toBeUndefined()
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
    s().startPresentation()
    s().goToSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
  })

  it('Undo of Delete milestone gives the slide back what it captured on it', () => {
    const v1 = s().createSnapshot('v1')
    live()
    s().setActiveView('ctx')
    s().selectMilestone(v1)
    s().addPresentationSlide('On v1')
    s().discardMilestoneChanges()
    const before = s().presentationSlides[0]
    expect(before.canvasState).toBeDefined()
    s().removeSnapshot(v1)
    s().undo()
    expect(s().presentationSlides[0]).toEqual(before)
    expect(s().presentations.find((p) => p.id === s().activePresentationId)?.slides[0]).toEqual(before)
    s().redo()
    expect(s().presentationSlides[0]).toMatchObject({ snapshotId: null, viewport: { x: 0, y: 0, zoom: 0 } })
    expect(s().presentationSlides[0].canvasState).toBeUndefined()
  })

  it('a slide added on a milestone and unlinked by hand shows the live model', () => {
    const v1 = s().createSnapshot('v1')
    const pay = live()
    s().selectMilestone(v1)
    s().addPresentationSlide('On v1')
    s().discardMilestoneChanges()
    const id = s().presentationSlides[0].id
    expect(s().presentationSlides[0].snapshotId).toBe(v1)
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeUndefined()
    s().linkSnapshotToSlide(id, null)
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
  })

  it('Capture on a slide linked to a milestone keeps no copy of it either', () => {
    const v1 = s().createSnapshot('v1')
    const pay = live()
    s().addPresentationSlide('Live')
    const id = s().presentationSlides[0].id
    s().linkSnapshotToSlide(id, v1)
    s().setAppMode('presenter')
    s().previewSlide(0)
    s().captureSlideViewport(id)
    expect(s().presentationSlides[0].modelSnapshot).toBeUndefined()
    s().linkSnapshotToSlide(id, null)
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
  })

  // Decided 2026-10-21: a slide with neither a milestone nor a copy of its
  // own (the sample's, an agent's) showed the milestone open in Designer or
  // Presenter.
  it('a slide with neither a milestone nor a copy shows the live model whatever milestone is open', () => {
    const v1 = s().createSnapshot('v1')
    const pay = live()
    s().setPresentations([{ id: 'p', name: 'P', slides: [{ id: 'a', name: 'A', snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } }] }])
    s().setActivePresentation('p')
    s().selectMilestone(v1)
    expect(s().c4Nodes[pay]).toBeUndefined()
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
    s().startPresentation()
    s().goToSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
    s().stopPresentation()
    // Picked in Presenter too.
    s().setAppMode('designer')
    s().discardMilestoneChanges()
    s().setAppMode('presenter')
    s().selectMilestone(v1)
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
    // Back in Designer: the live model it was left on.
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    expect(s().c4Nodes[pay]).toBeDefined()
  })
})

describe('Capture on a slide while a milestone is shown (F-0016)', () => {
  // Milestone v1 has the four elements; the live model has a fifth since.
  const live = (): string => s().addNode({ type: 'system', label: 'Pay', x: 900, y: 600, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)

  it('links a slide that showed no milestone to the one shown, as Add slide does, and keeps no copy of it', () => {
    const v1 = s().createSnapshot('v1')
    const pay = live()
    s().addPresentationSlide('Live')
    const id = s().presentationSlides[0].id
    expect(s().presentationSlides[0].modelSnapshot).toBeDefined()
    s().setAppMode('presenter')
    s().previewSlide(0)
    s().selectMilestone(v1)
    s().captureSlideViewport(id)
    expect(s().presentationSlides[0].snapshotId).toBe(v1)
    expect(s().presentationSlides[0].modelSnapshot).toBeUndefined()
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeUndefined()
    // Delete milestone: the slide shows the live model, nothing of v1.
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    s().removeSnapshot(v1)
    expect(s().presentationSlides[0].snapshotId).toBeNull()
    expect(s().presentationSlides[0].modelSnapshot).toBeUndefined()
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().c4Nodes[pay]).toBeDefined()
  })
})

describe('Undo in Designer after a slide was unlinked in Presenter (F-0023)', () => {
  it('takes back Designer\'s step only: the slide stays on the live model', () => {
    const v1 = s().createSnapshot('v1')
    s().addPresentationSlide('v1 MVP')
    const id = s().presentationSlides[0].id
    s().linkSnapshotToSlide(id, v1)
    s().addNode({ type: 'system', label: 'Live1', x: 900, y: 600, collapsed: false, ...NODE_SIZES.system } as Omit<C4Node, 'id'>)
    s().setAppMode('presenter')
    s().linkSnapshotToSlide(id, null)
    s().setAppMode('designer')
    s().undo()
    expect(Object.values(s().c4Nodes).some((n) => n.label === 'Live1')).toBe(false)
    expect(s().presentationSlides[0].snapshotId).toBeNull()
    expect(s().saveDiagram().presentations?.find((p) => p.id === s().activePresentationId)?.slides[0].snapshotId).toBeNull()
    s().redo()
    expect(s().presentationSlides[0].snapshotId).toBeNull()
  })
})

describe('a slide of a view that gained elements since (F-0015)', () => {
  /** Where each element is drawn, its box summed up the frames it is in. */
  function drawnBoxes(): Record<string, { x: number; y: number; w: number; h: number; parent?: string }> {
    const rf = new Map(s().rfNodes.map((n) => [n.id, n]))
    const out: Record<string, { x: number; y: number; w: number; h: number; parent?: string }> = {}
    for (const n of s().rfNodes) {
      if (n.hidden) continue
      let x = 0
      let y = 0
      for (let p: typeof n | undefined = n; p; p = p.parentNode ? rf.get(p.parentNode) : undefined) { x += p.position.x; y += p.position.y }
      const data = n.data as { width: number; height: number }
      out[n.id] = { x, y, w: data.width, h: data.height, parent: n.parentNode }
    }
    return out
  }
  /** Pairs of drawn elements on each other (a frame and what is in it aside). */
  function overlaps(): string[] {
    const boxes = drawnBoxes()
    const inside = (a: string, b: string): boolean => {
      for (let p = boxes[a]?.parent; p; p = boxes[p]?.parent) if (p === b) return true
      return false
    }
    const out: string[] = []
    const ids = Object.keys(boxes).sort()
    for (const a of ids) for (const b of ids) {
      if (a >= b || inside(a, b) || inside(b, a)) continue
      const p = boxes[a]
      const q = boxes[b]
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) out.push(`${a}–${b}`)
    }
    return out
  }

  it('draws what an explore view gained since where the view draws it, on none of the elements captured', () => {
    s().loadDiagram(bookstore())
    s().setActivePresentation(s().addPresentation('Deck'))
    s().exploreFrom('api')
    s().exploreNeighbours('api', { parent: false, children: false })
    const view = s().saveExploration('API context', null)!
    s().addPresentationSlide('API')
    const captured = drawnBoxes()
    expect(Object.keys(captured).sort()).toEqual(['api', 'db', 'payments', 'web'])
    // Grown in Designer since: Customer, a level below Web App.
    s().exploreNeighbours('web', { parent: false, children: false })
    const designer = drawnBoxes()
    s().setAppMode('presenter')
    s().previewSlide(0)
    expect(s().activeViewId).toBe(view)
    const slide = drawnBoxes()
    expect(Object.keys(slide).sort()).toEqual(['api', 'customer', 'db', 'payments', 'web'])
    for (const id of Object.keys(captured)) expect(slide[id]).toMatchObject({ x: captured[id].x, y: captured[id].y })
    expect(overlaps()).toEqual([])
    expect(slide.customer).toMatchObject({ x: designer.customer.x, y: designer.customer.y })
  })

  it('draws what an explore view gained since beside the elements captured when the view has it where one of them was', () => {
    s().loadDiagram(bookstore())
    s().setActivePresentation(s().addPresentation('Deck'))
    s().exploreFrom('api')
    s().exploreNeighbours('api', { parent: false, children: false })
    const view = s().saveExploration('API context', null)!
    // Customer, not drawn, where another canvas left it: on API.
    const api = s().c4Nodes.api
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, customer: { ...st.c4Nodes.customer, x: api.x, y: api.y } } }))
    s().addPresentationSlide('API')
    const captured = drawnBoxes()
    s().exploreNeighbours('web', { parent: false, children: false })
    // And moved in Designer since to where the slide has API.
    useDiagramStore.setState((st) => ({ views: { ...st.views, [view]: { ...st.views[view], positions: { ...st.views[view].positions, customer: { ...st.views[view].positions.customer, x: captured.api.x, y: captured.api.y } } } } }))
    s().setAppMode('presenter')
    s().previewSlide(0)
    const slide = drawnBoxes()
    expect(Object.keys(slide).sort()).toEqual(['api', 'customer', 'db', 'payments', 'web'])
    for (const id of Object.keys(captured)) expect(slide[id]).toMatchObject({ x: captured[id].x, y: captured[id].y })
    expect(overlaps()).toEqual([])
  })

  it('places an element a structure view gained since as the view does, on none of the elements captured', () => {
    s().loadDiagram(bookstore())
    s().setActivePresentation(s().addPresentation('Deck'))
    // Customer and Payment Provider where All elements has the Bookstore.
    const view = s().addView('Two')
    s().setViewNodes(view, ['customer', 'payments'])
    s().setActiveView(view)
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, customer: { ...st.c4Nodes.customer, x: 0, y: 300 }, payments: { ...st.c4Nodes.payments, x: 400, y: 300 } } }))
    s()._sync()
    s().addPresentationSlide('Two')
    const captured = drawnBoxes()
    expect(Object.keys(captured).sort()).toEqual(['customer', 'payments'])
    s().addNodeToView(view, 'bookstore')
    s().setAppMode('presenter')
    s().previewSlide(0)
    const slide = drawnBoxes()
    expect(Object.keys(slide).sort()).toEqual(['bookstore', 'customer', 'payments'])
    for (const id of Object.keys(captured)) expect(slide[id]).toMatchObject({ x: captured[id].x, y: captured[id].y })
    expect(overlaps()).toEqual([])
  })
})
