/**
 * Explore from here: a temporary structure view grown from one element.
 * It is drawn like a view while it is shown, yet it is none of the
 * document's: it never reaches the saved model, the undo history or the
 * list of views the document keeps. Each element's + adds the elements
 * related to it that the view does not show yet, beside it, inside the
 * frames of their containers, and moves nothing shown; + 1 level does that
 * for every element at once. Save as view keeps it as an ordinary
 * structure view (one undo step); closing it, another exploration or
 * another model drops it without a question.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { historyMark, useDiagramStore, viewById } from '../src/store/diagramStore'
// The e2e suite's fixture, the model the scenarios name.
import bookstoreFile from '../../../apps/e2e/fixtures/bookstore.radical?raw'

const s = useDiagramStore.getState

const bookstore = (): DiagramData => JSON.parse(bookstoreFile) as DiagramData

/** Where `id` is drawn on the canvas shown: its top-left, summed up its containers. */
function abs(id: string): { x: number; y: number } {
  const nodes = s().c4Nodes
  let x = 0
  let y = 0
  for (let n: C4Node | undefined = nodes[id]; n; n = n.parentId ? nodes[n.parentId] : undefined) { x += n.x; y += n.y }
  return { x, y }
}

/** Every element drawn on the canvas shown, with where it is drawn. */
function drawnPlaces(): Record<string, { x: number; y: number }> {
  return Object.fromEntries(s().rfNodes.filter((n) => !n.hidden).map((n) => [n.id, abs(n.id)]))
}

/** The elements the exploration lists (not its frames). */
const listed = (): string[] => [...(viewShownNodes(s().exploration ?? undefined, s().c4Nodes, s().c4Relations) ?? [])].sort()

/** Whether `a` and `b` lie on each other as the canvas draws them. */
const overlap = (a: string, b: string): boolean => {
  const size = (id: string) => s().rfNodes.find((n) => n.id === id)!.data
  const pa = abs(a)
  const pb = abs(b)
  return pa.x < pb.x + size(b).width && pb.x < pa.x + size(a).width && pa.y < pb.y + size(b).height && pb.y < pa.y + size(a).height
}

/** What the document would hold if it were saved now. */
const saved = (): string => JSON.stringify(s().saveDiagram())

/** The folder changed outside Studio, as autosave reloads it: back on the
 *  canvas that was shown, the exploration's included. */
function outsideChange(change: (data: DiagramData) => void): void {
  const data = structuredClone(s().saveDiagram())
  change(data)
  const viewId = s().activeViewId
  s().loadDiagram(data, { outsideChange: true })
  if (viewId && viewById(s(), viewId)) s().setActiveView(viewId)
}

beforeEach(() => {
  useDiagramStore.setState({ appMode: 'designer', presentationActive: false } as never)
  s().loadDiagram(bookstore())
})

describe('an explore view', () => {
  it('opens on the element alone, in the frame of its container, as a view the document does not hold', () => {
    const views = s().views
    s().exploreFrom('api')
    const exploration = s().exploration!
    expect(exploration.name).toBe('Explore: API')
    expect(s().activeViewId).toBe(exploration.id)
    expect(s().views).toBe(views)
    expect(listed()).toEqual(['api'])
    // API alone, inside the Bookstore frame (which a structure view draws
    // only to hold what it shows).
    expect(Object.keys(drawnPlaces())).toEqual(['api'])
    expect(s().rfNodes.find((n) => n.id === 'api')!.parentNode).toBe('bookstore')
  })

  it("API's + adds Web App, Orders DB and Payment Provider inside their frames beside API, and moves nothing", () => {
    s().exploreFrom('api')
    expect(s().exploreMore?.api).toBe(3)
    const before = { api: abs('api'), bookstore: abs('bookstore') }
    s().exploreNeighbours('api')
    expect(listed()).toEqual(['api', 'db', 'payments', 'web'])
    // What was drawn stays where it was.
    expect(abs('api')).toEqual(before.api)
    expect(abs('bookstore')).toEqual(before.bookstore)
    // Web App and Orders DB in the Bookstore frame, clear of API and each other.
    const frame = s().c4Nodes.bookstore
    for (const id of ['web', 'db']) {
      const n = s().c4Nodes[id]
      expect(n.parentId).toBe('bookstore')
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
      const drawn = s().rfNodes.find((r) => r.id === id)!.data
      expect(n.x + drawn.width).toBeLessThanOrEqual(frame.width)
      expect(n.y + drawn.height).toBeLessThanOrEqual(frame.height)
      expect(overlap(id, 'api')).toBe(false)
    }
    expect(overlap('web', 'db')).toBe(false)
    // Payment Provider outside the frame, near it.
    expect(overlap('payments', 'bookstore')).toBe(false)
    const api = abs('api')
    const pay = abs('payments')
    expect(Math.hypot(pay.x - api.x, pay.y - api.y)).toBeLessThan(1500)
    // API has no neighbour left to show.
    expect(s().exploreMore?.api ?? 0).toBe(0)
    expect(s().exploreMore?.web).toBe(1)
  })

  it('+ 1 level adds the neighbours of every element at once, and moves nothing shown', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    const before = drawnPlaces()
    s().exploreLevel()
    expect(listed()).toEqual(['api', 'customer', 'db', 'payments', 'web'])
    for (const [id, at] of Object.entries(before)) expect(abs(id)).toEqual(at)
    expect(overlap('customer', 'bookstore')).toBe(false)
    expect(overlap('customer', 'payments')).toBe(false)
    expect(Object.values(s().exploreMore ?? {}).filter(Boolean)).toEqual([])
  })

  it('is not saved: the document is as it was, its views among it', () => {
    const was = saved()
    const views = s().views
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().exploreLevel()
    expect(saved()).toBe(was)
    expect(s().views).toBe(views)
    expect(s().saveDiagram().views!.map((v) => v.name)).not.toContain('Explore: API')
  })

  it('is no undo step: opening it, its +, + 1 level, a drag and a fold leave the history as it was', () => {
    s().updateNode('customer', { label: 'Reader' })
    const mark = historyMark()
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().exploreLevel()
    const web = s().c4Nodes.web
    s().liveGrab('web', web.x, web.y, 'calm', abs('web'))
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, web: { ...st.c4Nodes.web, x: web.x + 40 } } }))
    s().liveRelease('web', [], true)
    s().toggleCollapse('api')
    expect(s().exploration!.collapsedNodeIds).toEqual(['api'])
    expect(historyMark()).toBe(mark)
    // Undo takes back the step before it, and the exploration stays.
    s().undo()
    expect(s().c4Nodes.customer.label).toBe('Customer')
    expect(s().exploration).not.toBeNull()
    expect(s().canUndo).toBe(false)
  })

  it('an edit made on it is an undo step that comes back to it', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    const id = s().exploration!.id
    const places = drawnPlaces()
    s().updateNode('db', { label: 'Orders' })
    s().undo()
    expect(s().c4Nodes.db.label).toBe('Orders DB')
    expect(s().activeViewId).toBe(id)
    expect(drawnPlaces()).toEqual(places)
    s().redo()
    expect(s().c4Nodes.db.label).toBe('Orders')
    expect(s().activeViewId).toBe(id)
  })

  it('another exploration replaces it, without a question', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    const first = s().exploration!.id
    const was = saved()
    s().exploreFrom('db')
    expect(s().exploration!.id).not.toBe(first)
    expect(s().exploration!.name).toBe('Explore: Orders DB')
    expect(listed()).toEqual(['db'])
    expect(viewById(s(), first)).toBeUndefined()
    expect(s().pendingDelete).toBeNull()
    expect(saved()).toBe(was)
  })

  it('another model drops it', () => {
    s().exploreFrom('api')
    s().loadDiagram({ nodes: [], relations: [] })
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBeNull()
  })

  it('an outside change keeps it on screen, without what an agent deleted, and never writes it', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    const id = s().exploration!.id
    const places = drawnPlaces()
    outsideChange((data) => {
      data.nodes = data.nodes.filter((n) => n.id !== 'payments')
      data.relations = data.relations.filter((r) => r.sourceId !== 'payments' && r.targetId !== 'payments')
    })
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['api', 'db', 'web'])
    const now = drawnPlaces()
    for (const n of ['api', 'web', 'db']) expect(now[n]).toEqual(places[n])
    expect(now.payments).toBeUndefined()
    expect(s().saveDiagram().views!.some((v) => v.id === id)).toBe(false)
  })

  it('in Designer a milestone shown closes it, and none opens while one is shown', () => {
    s().exploreFrom('api')
    s().createSnapshot('As-is')
    s().selectMilestone(s().snapshots[s().snapshots.length - 1].id)
    expect(s().exploration).toBeNull()
    s().exploreFrom('db')
    expect(s().exploration).toBeNull()
    s().discardMilestoneChanges()
  })
})

describe('saving and closing an explore view', () => {
  it('Save as view keeps it as a structure view in its folder, with its places and folds, as one undo step', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().toggleCollapse('api')
    const places = drawnPlaces()
    const mark = historyMark()
    const id = s().saveExploration('API context', 'Explorations')!
    expect(historyMark()).toBe(mark + 1)
    const view = s().views[id]
    expect(view.name).toBe('API context')
    expect(view.folder).toBe('Explorations')
    expect((view.kind ?? 'static')).toBe('static')
    expect([...view.nodeIds].sort()).toEqual(['api', 'db', 'payments', 'web'])
    expect(view.collapsedNodeIds).toEqual(['api'])
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBe(id)
    expect(drawnPlaces()).toEqual(places)
    // Saved in the document with its places.
    const doc = s().saveDiagram().views!.find((v) => v.id === id)!
    expect(doc.positions.api).toBeDefined()
    expect(doc.positions.payments).toBeDefined()

    s().undo()
    expect(s().views[id]).toBeUndefined()
    expect(s().exploration).toBeNull()
    s().redo()
    expect(s().views[id].name).toBe('API context')
    expect(s().activeViewId).toBe(id)
    expect(drawnPlaces()).toEqual(places)
  })

  it('closing it drops it without a question, back on the canvas it was opened from', () => {
    s().setActiveView('v-containers')
    const was = saved()
    const mark = historyMark()
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().closeExploration()
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBe('v-containers')
    expect(s().pendingDelete).toBeNull()
    expect(historyMark()).toBe(mark)
    expect(saved()).toBe(was)
  })
})

describe('an explore view in Viewer', () => {
  beforeEach(() => {
    s().resetDiagram()
    s().setAppMode('viewer')
  })

  it('explores the milestone shown, follows Current (live), and keeps nothing', () => {
    s().setAppMode('designer')
    const was = saved()
    const mark = historyMark()
    s().setAppMode('viewer')
    s().selectMilestone('snap-1')
    s().exploreFrom('ctn2')
    const id = s().exploration!.id
    expect(s().activeViewId).toBe(id)
    // In v1 the backend is the API, related to the frontend only.
    expect(s().exploration!.name).toBe('Explore: API')
    expect(s().exploreMore?.ctn2).toBe(1)
    s().exploreNeighbours('ctn2')
    expect(listed()).toEqual(['ctn1', 'ctn2'])
    const places = drawnPlaces()
    // Current (live): the same elements, their neighbours counted there.
    s().discardMilestoneChanges()
    expect(s().activeSnapshotId).toBeNull()
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['ctn1', 'ctn2'])
    expect(drawnPlaces().ctn2).toEqual(places.ctn2)
    expect(s().exploreMore?.ctn2).toBe(2)
    // The frontend's: the end user and the auth service.
    expect(s().exploreMore?.ctn1).toBe(2)
    s().exploreLevel()
    expect(listed().length).toBeGreaterThan(2)
    // No Save as view, no undo step; Designer finds its model as it was.
    expect(s().saveExploration('Kept', null)).toBeNull()
    expect(Object.values(s().views).map((v) => v.name)).not.toContain('Kept')
    expect(historyMark()).toBe(mark)
    s().setAppMode('designer')
    expect(s().exploration).toBeNull()
    expect(saved()).toBe(was)
    expect(historyMark()).toBe(mark)
  })

  it('a milestone shown keeps it, with what that milestone lacks left out', () => {
    s().exploreFrom('ctn2')
    s().exploreNeighbours('ctn2')
    const before = listed()
    expect(before.length).toBe(4)
    s().selectMilestone('snap-1')
    expect(s().exploration).not.toBeNull()
    expect(listed()).toEqual(before.filter((x) => !!s().c4Nodes[x]))
    expect(listed()).toContain('ctn2')
  })

  it('closes when the perspective changes, and is not offered in Presenter', () => {
    s().exploreFrom('ctn1')
    expect(s().exploration).not.toBeNull()
    s().setAppMode('presenter')
    expect(s().exploration).toBeNull()
    s().exploreFrom('ctn1')
    expect(s().exploration).toBeNull()
    s().setAppMode('designer')
  })
})
