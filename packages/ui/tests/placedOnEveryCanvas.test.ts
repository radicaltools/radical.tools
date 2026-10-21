/**
 * An element added on one canvas has a place on the others.
 *
 * Each canvas (All elements, every view) keeps its own positions. A new
 * element got one on the canvas it was added on only: on the others it kept
 * that parent-relative place, which there lay outside the parent's frame or
 * on a sibling ("Search Service" written on Bookstore's wiki page sat at
 * x 1000 on All elements, outside Bookstore and over Payment Provider), and
 * a save kept it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const size = NODE_SIZES.container
const pos = (x: number, y: number, width: number, height: number): NodePosition => ({ x, y, width, height })

/** All elements: the shop is narrow, its two containers stacked. The view
 *  "wide" lays the same containers out in a row, in a much wider shop. */
function model(): DiagramData {
  return {
    nodes: [
      { id: 'shop', type: 'system', label: 'Shop', collapsed: false, ...pos(0, 0, 400, 520) } as C4Node,
      { id: 'web', type: 'container', label: 'Web', collapsed: false, parentId: 'shop', x: 60, y: 120, ...size } as C4Node,
      { id: 'api', type: 'container', label: 'API', collapsed: false, parentId: 'shop', x: 60, y: 320, ...size } as C4Node,
      { id: 'bank', type: 'system', label: 'Bank', collapsed: false, ...pos(480, 0, 300, 200) } as C4Node,
    ],
    relations: [],
    views: [{
      id: 'wide', name: 'Wide', nodeIds: ['shop', 'web', 'api'],
      positions: {
        shop: pos(0, 0, 1400, 320),
        web: pos(60, 120, size.width, size.height),
        api: pos(700, 120, size.width, size.height),
      },
    }],
    defaultPositions: {
      shop: pos(0, 0, 400, 520),
      web: pos(60, 120, size.width, size.height),
      api: pos(60, 320, size.width, size.height),
      bank: pos(480, 0, 300, 200),
    },
  }
}

interface Box { x: number; y: number; width: number; height: number }
const box = (id: string): Box => {
  const n = s().c4Nodes[id]
  return { x: n.x, y: n.y, width: n.width, height: n.height }
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** `child` lies inside the frame of its parent. */
const inside = (child: string): boolean => {
  const c = box(child)
  const p = box(s().c4Nodes[child].parentId!)
  return c.x >= 0 && c.y >= 0 && c.x + c.width <= p.width && c.y + c.height <= p.height
}
const addOnView = (): string => {
  s().setActiveView('wide')
  // Where a drop on the wide view puts it: right of the row.
  return s().addNode({ type: 'container', label: 'Search', collapsed: false, parentId: 'shop', x: 1040, y: 120, ...size } as Omit<C4Node, 'id'>)
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('an element added on a view', () => {
  it('lies inside its parent on All elements, clear of its siblings', () => {
    const id = addOnView()
    expect(inside(id)).toBe(true)

    s().setActiveView(null)
    expect(box('shop').x).toBe(0)
    expect(inside(id)).toBe(true)
    expect(overlap(box(id), box('web'))).toBe(false)
    expect(overlap(box(id), box('api'))).toBe(false)
    // The parent grew for it; the row of the wide view was not brought along.
    expect(box('shop').width).toBeLessThan(1400)
    expect(box('web')).toMatchObject({ x: 60, y: 120 })
    expect(box('api')).toMatchObject({ x: 60, y: 320 })
  })

  it('keeps its place on the view', () => {
    const id = addOnView()
    const onView = { added: box(id), shop: box('shop'), api: box('api') }
    s().setActiveView(null)
    s().setActiveView('wide')
    expect(box(id)).toEqual(onView.added)
    expect(box('shop')).toEqual(onView.shop)
    expect(box('api')).toEqual(onView.api)
  })

  it('the same after a save made on the view and a reload', () => {
    const id = addOnView()
    const saved = JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData
    s().loadDiagram(saved)
    expect(s().activeViewId).toBeNull()
    expect(inside(id)).toBe(true)
    expect(overlap(box(id), box('web'))).toBe(false)
    expect(overlap(box(id), box('api'))).toBe(false)
    expect(box('web')).toMatchObject({ x: 60, y: 120 })
  })

  it('a container added with its children keeps them where they were in it', () => {
    s().setActiveView('wide')
    const outer = s().addNode({ type: 'container', label: 'Outer', collapsed: false, parentId: 'shop', x: 1040, y: 120, width: 320, height: 300 } as Omit<C4Node, 'id'>)
    const inner = s().addNode({ type: 'component', label: 'Inner', collapsed: false, parentId: outer, x: 40, y: 130, ...NODE_SIZES.component } as Omit<C4Node, 'id'>)
    const within = { x: s().c4Nodes[inner].x, y: s().c4Nodes[inner].y }
    s().setActiveView(null)
    expect(inside(outer)).toBe(true)
    expect({ x: s().c4Nodes[inner].x, y: s().c4Nodes[inner].y }).toEqual(within)
  })
})

describe('an element added on All elements', () => {
  it('is not placed on a view that does not show it', () => {
    const id = s().addNode({ type: 'system', label: 'Mail', collapsed: false, ...pos(900, 0, 300, 200) } as Omit<C4Node, 'id'>)
    s().setActiveView('wide')
    // Not in the view's list: it is not drawn, and has no place to be given.
    expect(s().rfNodes.find((n) => n.id === id)?.hidden ?? true).toBe(true)
    s().setActiveView(null)
    expect(box(id)).toMatchObject({ x: 900, y: 0 })
  })
})

describe('an element dropped on a collapsed container', () => {
  // The drop point is a point of the container's small box: taken as the
  // place inside it, the element lay on the header once the container was
  // opened, over its label and a sibling. The live layout moved it off,
  // unless the container had been dragged: a pinned container holds what is
  // in it where it is.
  const dropOnCollapsed = (): string => {
    s().toggleCollapse('shop')
    expect(s().c4Nodes.shop.collapsed).toBe(true)
    return s().addNode({ type: 'container', label: 'Dropped', collapsed: false, parentId: 'shop', x: 70, y: 18, ...size } as Omit<C4Node, 'id'>)
  }

  it('gets a place below the header, clear of the others in it', () => {
    const id = dropOnCollapsed()
    expect(box(id).y).toBeGreaterThanOrEqual(100)
    expect(overlap(box(id), box('web'))).toBe(false)
    expect(overlap(box(id), box('api'))).toBe(false)
  })

  it('lies inside the container when it is opened', () => {
    const id = dropOnCollapsed()
    s().toggleCollapse('shop')
    expect(s().c4Nodes.shop.collapsed).toBe(false)
    expect(box(id).y).toBeGreaterThanOrEqual(100)
    expect(inside(id)).toBe(true)
    expect(inside('web')).toBe(true)
    expect(inside('api')).toBe(true)
  })
})

describe('a view that is not a canvas', () => {
  it('places nothing: only a canvas draws positions', () => {
    useDiagramStore.setState((st) => ({
      views: { ...st.views, list: { id: 'list', name: 'List', kind: 'table', nodeIds: [], positions: { shop: pos(0, 0, 400, 520) } } },
    }))
    s().setActiveView('list')
    expect(box('bank')).toMatchObject({ x: 480, y: 0 })
    expect(box('web')).toMatchObject({ x: 60, y: 120 })
  })
})

describe('an element whose file was moved into another container by hand', () => {
  // Orders DB moved from Shop's folder into Bank's: its places are still
  // the ones it had in Shop, far right of Bank's frame here (x 700 in a
  // frame 300 wide), on every canvas, after a reload too.
  const moved = (): DiagramData => {
    const data = model()
    data.nodes.push({ id: 'db', type: 'container', label: 'Orders DB', collapsed: false, parentId: 'bank', x: 700, y: 120, ...size } as C4Node)
    data.defaultPositions!.db = pos(700, 120, size.width, size.height)
    data.views!.push({ id: 'banks', name: 'Banks', nodeIds: ['bank', 'db'], positions: { bank: pos(0, 0, 300, 200), db: pos(700, 120, size.width, size.height) } })
    return data
  }

  it('is placed inside its new parent when the model opens, and on a view', () => {
    s().loadDiagram(moved())
    expect(inside('db')).toBe(true)
    expect(overlap(box('bank'), box('shop'))).toBe(false)
    s().setActiveView('banks')
    expect(inside('db')).toBe(true)
  })
})

describe('elements imported on a view', () => {
  // A blueprint imported from the Hub on a view had places on that view
  // only: All elements had 1 of its 39, and a view of it opened on All
  // elements' places drew it over the model's root elements.
  it('get places on All elements at once', () => {
    s().loadDiagram(model())
    s().setActiveView('wide')
    useDiagramStore.setState((st: any) => {
      st.c4Nodes.ledger = { id: 'ledger', type: 'system', label: 'Ledger', collapsed: false, ...pos(0, 0, 600, 400) }
      st.c4Nodes.journal = { id: 'journal', type: 'container', label: 'Journal', collapsed: false, parentId: 'ledger', x: 30, y: 120, ...size }
    })
    s()._placeOnAllElements()
    const all = s().defaultPositions
    expect(all.ledger).toBeDefined()
    expect(all.journal).toMatchObject({ x: 30, y: 120 })
    for (const other of ['shop', 'bank']) expect(overlap(all.ledger, all[other]), other).toBe(false)
    // The view shown keeps its own.
    expect(s().c4Nodes.ledger).toMatchObject({ x: 0, y: 0 })
  })
})
