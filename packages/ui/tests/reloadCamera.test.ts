/**
 * A reload with a view shown keeps All elements' camera.
 *
 * A reload (an outside change merged in) loads the model with All elements
 * active and shows the view again: the camera in use, the view's, was saved
 * as All elements' (`defaultViewport` in _layout.json).
 */
import { it, expect, afterEach } from 'vitest'
import type { DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
afterEach(() => { delete (window as any).__rfCurrentViewport })

it('does not save the view\'s camera as All elements\' on a reload', () => {
  const doc: DiagramData = {
    nodes: [{ id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 300, height: 180 }],
    relations: [],
    views: [{ id: 'v', name: 'V', nodeIds: ['a'], positions: { a: { x: 0, y: 0, width: 300, height: 180 } }, viewport: { x: 5, y: 6, zoom: 1.2 } }],
    defaultViewport: { x: 1, y: 2, zoom: 0.5 },
  } as DiagramData
  s().setAppMode('designer')
  s().loadDiagram(structuredClone(doc))
  s().setActiveView('v')
  // The user's camera on the view.
  ;(window as any).__rfCurrentViewport = { x: 400, y: -300, zoom: 0.9 }
  // A reload of the same document, the view shown again (autosave keepUi).
  s().loadDiagram(structuredClone(doc), { outsideChange: true })
  s().setActiveView('v')
  expect(s().defaultViewport).toEqual({ x: 1, y: 2, zoom: 0.5 })
})

// F-0095: a model opened on one of its views (the sample from Models, a
// Structurizr import) switches to it while it loads; the load then placed
// All elements' camera on the view, and the canvas kept it as the view's.
it('a view opened while the model loads opens at its own camera', () => {
  const doc: DiagramData = {
    nodes: [{ id: 'a', type: 'system', label: 'A', collapsed: false, x: 0, y: 0, width: 300, height: 180 }],
    relations: [],
    views: [{ id: 'v', name: 'V', nodeIds: ['a'], positions: { a: { x: 0, y: 0, width: 300, height: 180 } }, viewport: { x: 5, y: 6, zoom: 1.2 } }],
    defaultViewport: { x: 1, y: 2, zoom: 0.5 },
  } as DiagramData
  s().setAppMode('designer')
  s().loadDiagram({ nodes: [], relations: [] } as DiagramData)
  const placed: unknown[] = []
  ;(window as any).__rfPlaceCamera = (vp: unknown) => { placed.push(vp && { ...(vp as object) }) }
  // As ModelSteps' openOnView: the view opens once the store has it.
  const unsub = useDiagramStore.subscribe((st) => {
    if (!st.views.v || st.activeViewId === 'v') return
    unsub()
    st.setActiveView('v')
  })
  try {
    s().loadDiagram(structuredClone(doc))
  } finally {
    unsub()
    delete (window as any).__rfPlaceCamera
  }
  expect(s().activeViewId).toBe('v')
  expect(placed[placed.length - 1]).toEqual({ x: 5, y: 6, zoom: 1.2 })
})
