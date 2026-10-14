/**
 * The drill level of a hierarchy view is like a camera: it is the view's
 * own, kept per view, and no undo step takes it back.
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
      { id: 'bank', type: 'system', label: 'Bank', collapsed: false, x: 900, y: 0, ...NODE_SIZES.system } as C4Node,
    ],
    relations: [],
    views: [{ id: 'tree', name: 'Hierarchy', kind: 'treemap', nodeIds: [], positions: {} }],
  }
}
beforeEach(() => { s().setAppMode('designer'); s().loadDiagram(model()) })
afterEach(() => s().stopLiveLayout())

describe('the drill level of a hierarchy view', () => {
  it('is not taken back by undoing another step', () => {
    s().updateNode('bank', { description: 'edited' })
    s().setTreemapFocus('tree', 'shop')
    s().undo()
    expect(s().c4Nodes.bank.description).toBeUndefined()
    expect(s().views.tree.treemapFocusId).toBe('shop')
  })
})

describe('a slide added on a hierarchy view drilled into an element', () => {
  // The slide kept no drill level: it played at the top.
  it('keeps the drill level and shows it when played', () => {
    const presId = s().addPresentation('Deck')
    s().setActivePresentation(presId)
    s().setActiveView('tree')
    s().setTreemapFocus('tree', 'shop')
    s().addPresentationSlide('Inside the shop')
    s().setTreemapFocus('tree', null)
    const slide = s().presentationSlides[s().presentationSlides.length - 1] as unknown as Record<string, unknown>
    expect(slide.treemapFocusId).toBe('shop')
    s().startPresentation()
    s().goToSlide(s().presentationSlides.length - 1)
    expect(s().slideTreemapFocus).toEqual({ viewId: 'tree', focusId: 'shop' })
    s().stopPresentation()
    expect(s().slideTreemapFocus).toBeNull()
    expect(s().views.tree.treemapFocusId ?? null).toBeNull()
  })
})
