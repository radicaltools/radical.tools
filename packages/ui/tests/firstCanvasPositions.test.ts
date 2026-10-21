/**
 * A canvas view opened for the first time draws its elements where All
 * elements has them.
 *
 * A view with no positions of its own (a new view of a viewpoint, a table
 * turned into a structure view) kept the canvas shown before it: Bookstore
 * at its 360×260 System Context box, its containers wherever another canvas
 * had left them, outside it and over Payment Provider.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

// A first layout whose winner is the layout the view opened with (CI's
// fonts gave it there): keepCurrent makes Smart Layout say so.
const keepCurrent = vi.hoisted(() => ({ on: false }))
vi.mock('../src/layout/smartLayoutRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/layout/smartLayoutRunner')>()
  return {
    ...actual,
    runSmartLayout: async (...args: Parameters<typeof actual.runSmartLayout>) => {
      const result = await actual.runSmartLayout(...args)
      return keepCurrent.on ? { ...result, keptCurrent: true } : result
    },
  }
})

const s = useDiagramStore.getState
const pos = (x: number, y: number, width: number, height: number): NodePosition => ({ x, y, width, height })
const node = (id: string, type: string, parentId: string | undefined, p: NodePosition): C4Node =>
  ({ id, type, label: id, collapsed: false, ...(parentId ? { parentId } : {}), ...p }) as C4Node

/** All elements: Bookstore wraps API and DB, Payments beside it. The view
 *  "ctx" draws Bookstore small, with Payments right next to it; "containers"
 *  and "list" have no positions of their own. */
function model(): DiagramData {
  const all = {
    shop: pos(0, 0, 640, 320),
    api: pos(30, 120, 260, 160),
    db: pos(340, 120, 260, 160),
    pay: pos(760, 0, 360, 260),
  }
  return {
    nodes: [
      node('shop', 'system', undefined, all.shop),
      node('api', 'container', 'shop', all.api),
      node('db', 'database', 'shop', all.db),
      node('pay', 'system', undefined, all.pay),
    ],
    relations: [],
    views: [
      { id: 'ctx', name: 'Context', nodeIds: ['shop', 'pay'], positions: { shop: pos(0, 0, 360, 260), pay: pos(420, 0, 360, 260) } },
      { id: 'containers', name: 'Containers', nodeIds: ['shop', 'api', 'db', 'pay'], positions: {} },
      { id: 'list', name: 'List', kind: 'table', nodeIds: ['shop', 'api', 'db', 'pay'], positions: {} },
    ],
    defaultPositions: all,
  }
}

interface Box { x: number; y: number; width: number; height: number }
const abs = (id: string): Box => {
  const n = s().c4Nodes[id]
  const b = { x: n.x, y: n.y, width: n.width, height: n.height }
  for (let p = n.parentId; p; p = s().c4Nodes[p].parentId) { b.x += s().c4Nodes[p].x; b.y += s().c4Nodes[p].y }
  return b
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const inside = (child: string): boolean => {
  const c = abs(child)
  const p = abs(s().c4Nodes[child].parentId!)
  return c.x >= p.x && c.y >= p.y && c.x + c.width <= p.x + p.width && c.y + c.height <= p.y + p.height
}
const tidy = (): void => {
  expect(inside('api')).toBe(true)
  expect(inside('db')).toBe(true)
  expect(overlap(abs('shop'), abs('pay'))).toBe(false)
  expect(overlap(abs('api'), abs('db'))).toBe(false)
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('a view with no positions of its own', () => {
  it('opens on All elements\' places, not the view shown before it', () => {
    s().setActiveView('ctx')
    s().setActiveView('containers')
    tidy()
    expect(abs('shop')).toEqual(pos(0, 0, 640, 320))
  })

  it('keeps them once it was left', () => {
    s().setActiveView('ctx')
    s().setActiveView('containers')
    s().setActiveView('ctx')
    expect(abs('shop')).toEqual(pos(0, 0, 360, 260))
    s().setActiveView('containers')
    tidy()
  })

  it('the same in Viewer', () => {
    s().setActiveView('ctx')
    s().setAppMode('viewer')
    s().setActiveView('containers')
    tidy()
  })

  it('turned from a table into a structure view', () => {
    s().setActiveView('ctx')
    s().setActiveView('list')
    s().setViewKind('list', 'static')
    tidy()
  })
})

describe('a slide of a view with no positions of its own', () => {
  // Slides with no captured canvas, as create_presentation makes them.
  const slides = [
    { id: 's-ctx', name: 'Context', viewId: 'ctx', snapshotId: null, viewport: { x: 0, y: 0, zoom: 0 } },
    { id: 's-new', name: 'Containers', viewId: 'containers', snapshotId: null, viewport: { x: 0, y: 0, zoom: 0 } },
  ]
  beforeEach(() => {
    useDiagramStore.setState({ presentations: [{ id: 'p', name: 'P', slides }], activePresentationId: 'p', presentationSlides: slides } as never)
    s().setAppMode('presenter')
  })

  it('opens on All elements\' places when played', () => {
    s().goToSlide(0)
    expect(abs('shop')).toEqual(pos(0, 0, 360, 260))
    s().goToSlide(1)
    tidy()
    expect(abs('shop')).toEqual(pos(0, 0, 640, 320))
  })

  it('and when its card is shown', () => {
    s().previewSlide(0)
    s().previewSlide(1)
    tidy()
  })
})

describe('a view of a viewpoint opened first in Viewer or Presenter', () => {
  // Designer lays it out on first opening (Smart Layout); opened in another
  // mode, Designer then showed it at All elements' places.
  for (const mode of ['viewer', 'presenter'] as const) {
    it(`is laid out once Designer shows it (${mode})`, () => {
      const original = s().runSmartLayout
      const runSmartLayout = vi.fn(async () => {})
      useDiagramStore.setState({ runSmartLayout } as never)
      try {
        useDiagramStore.setState((st: any) => { st.views.containers.viewpoint = 'containers' })
        s().setActiveView('ctx')
        s().setAppMode(mode)
        s().setActiveView('containers')
        expect(runSmartLayout).not.toHaveBeenCalled()
        s().setAppMode('designer')
        expect(s().activeViewId).toBe('containers')
        expect(runSmartLayout).toHaveBeenCalledTimes(1)
      } finally {
        useDiagramStore.setState({ runSmartLayout: original } as never)
      }
    })
  }
})

describe('the first layout of a view (decided 2026-10-21)', () => {
  // It was an undo step of its own: New view of a viewpoint took two Undos,
  // and opening two views of a group three to remove the group. A reload or
  // a view switch before it landed saved All elements' places as the view's
  // own, and it was never laid out.
  const laidOut = async (): Promise<void> => {
    await vi.waitFor(() => expect(s().isLayoutRunning).toBe(false), { timeout: 30_000 })
  }
  const asAgentMade = (): void => {
    useDiagramStore.setState((st: any) => { st.views.containers.viewpoint = 'containers' })
  }

  it('belongs to the step that made the view: New view is one Undo', async () => {
    s().updateNode('pay', { description: 'before' })
    const id = s().addViewOfViewpoint('containers')!
    expect(id).toBeTruthy()
    s().setActiveView(id)
    await laidOut()
    expect(Object.keys(s().views[id].positions).length).toBeGreaterThan(0)
    s().undo()
    expect(s().views[id]).toBeUndefined()
    expect(s().c4Nodes.pay.description).toBe('before')
    s().redo()
    expect(Object.keys(s().views[id].positions).length).toBeGreaterThan(0)
  }, 60_000)

  it('of a view opened for the first time is no step, and an Undo keeps it', async () => {
    asAgentMade()
    s().updateNode('pay', { description: 'before' })
    s().setActiveView('containers')
    await laidOut()
    const positions = s().views.containers.positions
    expect(Object.keys(positions).length).toBeGreaterThan(0)
    s().undo()
    expect(s().c4Nodes.pay.description).toBeUndefined()
    expect(s().views.containers.positions).toEqual(positions)
    expect(s().canUndo).toBe(false)
  }, 60_000)

  it('that keeps the places the view opened with makes them its own, with no notice', async () => {
    asAgentMade()
    keepCurrent.on = true
    try {
      s().setActiveView('containers')
      await laidOut()
    } finally {
      keepCurrent.on = false
    }
    expect(Object.keys(s().views.containers.positions).length).toBeGreaterThan(0)
    expect(s().notifications.map((n: { message: string }) => n.message).join(' ')).not.toMatch(/already scores best/)
  }, 60_000)

  it('is not replaced by All elements\' places saved before it lands', async () => {
    asAgentMade()
    s().setActiveView('containers')
    expect(s().isLayoutRunning).toBe(true)
    const saved = s().saveDiagram().views!.find((v) => v.id === 'containers')!
    expect(saved.positions).toEqual({})
    // Left at once: it is laid out on the next opening.
    s().setActiveView('ctx')
    expect(s().views.containers.positions).toEqual({})
    await laidOut()
    s().setActiveView('containers')
    await laidOut()
    expect(Object.keys(s().views.containers.positions).length).toBeGreaterThan(0)
  }, 60_000)
})
