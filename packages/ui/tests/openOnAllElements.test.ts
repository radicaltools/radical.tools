/**
 * A document is saved with its nodes where the canvas shown at that moment
 * had them, and All elements' own places in `defaultPositions`. It opens on
 * All elements. Opened with a view's positions still in its nodes, the first
 * switch to a view took them for All elements' and saved them as such: every
 * reload with a view in the address replaced All elements' layout with that
 * view's.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState

/** Saved while the view "ctx" was shown: the nodes hold its positions. */
function savedOnAView(): DiagramData {
  const at = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
  const all = { shop: at(0, 270, 860, 350), api: at(290, 120, 300, 200), bank: at(960, 355, 300, 180) }
  const ctx = { shop: at(250, 270, 360, 260), api: at(290, 120, 300, 200), bank: at(710, 310, 300, 180) }
  const node = (id: string, type: string, parentId?: string): C4Node =>
    ({ id, type, label: id, collapsed: false, parentId, ...ctx[id as keyof typeof ctx] } as C4Node)
  return {
    nodes: [node('shop', 'system'), node('api', 'container', 'shop'), node('bank', 'system')],
    relations: [{ id: 'r', sourceId: 'api', targetId: 'bank' }],
    views: [{ id: 'ctx', name: 'Context', nodeIds: ['shop', 'bank'], positions: ctx }],
    defaultPositions: all,
  }
}

const box = (id: string) => (({ x, y, width, height }) => ({ x, y, width, height }))(s().c4Nodes[id])

describe('A document saved while a view was shown', () => {
  afterEach(() => s().stopLiveLayout())

  it('opens on All elements with All elements\' layout', () => {
    const data = savedOnAView()
    s().loadDiagram(data)
    expect(s().activeViewId).toBeNull()
    expect(box('shop')).toEqual(data.defaultPositions!.shop)
    expect(box('bank')).toEqual(data.defaultPositions!.bank)
  })

  it('keeps All elements\' layout when the view is opened again, as a reload does', () => {
    const data = savedOnAView()
    s().loadDiagram(data)
    s().setActiveView('ctx')
    expect(box('shop')).toEqual(data.views![0].positions.shop)
    expect(s().defaultPositions.shop).toEqual(data.defaultPositions!.shop)
    expect(s().saveDiagram().defaultPositions!.shop).toEqual(data.defaultPositions!.shop)

    s().setActiveView(null)
    expect(box('shop')).toEqual(data.defaultPositions!.shop)
    expect(box('bank')).toEqual(data.defaultPositions!.bank)
  })

  it('does not change the document it was given', () => {
    const data = savedOnAView()
    const before = JSON.stringify(data)
    s().loadDiagram(data)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('gives an element All elements has no place for a place beside the others', () => {
    // Added while the view was shown, at a place of the view's: on All
    // elements that is on top of the shop (see placedOnEveryCanvas.test.ts).
    const data = savedOnAView()
    data.nodes.push({ id: 'new', type: 'system', label: 'new', collapsed: false, x: 5, y: 276, width: 300, height: 180 } as C4Node)
    s().loadDiagram(data)
    const placed = box('new')
    expect({ width: placed.width, height: placed.height }).toEqual({ width: 300, height: 180 })
    for (const other of ['shop', 'bank']) {
      const o = box(other)
      const apart = placed.x >= o.x + o.width || o.x >= placed.x + placed.width || placed.y >= o.y + o.height || o.y >= placed.y + placed.height
      expect(apart, `clear of ${other}`).toBe(true)
    }
    expect(box('shop')).toEqual(data.defaultPositions!.shop)
    expect(box('bank')).toEqual(data.defaultPositions!.bank)
  })
})
