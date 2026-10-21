/**
 * What a slide keeps and shows: its collapse state, its drill level, the
 * view it is linked to, and which slide is the current one once the list
 * changes. Exploratory runs 47 and 56 (items 171, 197, 198, 200, 201).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
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
