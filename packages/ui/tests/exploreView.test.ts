/**
 * Explore from here: a temporary structure view grown from one element.
 * It is drawn like a view while it is shown, yet it is none of the
 * document's: it never reaches the saved model, the undo history or the
 * list of views the document keeps. Each element's + adds the elements
 * related to it that the view does not show yet, beside it, inside the
 * frames of their containers (drawn round what was added), clear of what
 * is shown by the gap the add rule keeps and the room a relation's label
 * needs, and moves nothing shown; + 1 level does that
 * for every element at once. Save as view keeps it as an ordinary
 * structure view (one undo step); closing it, another exploration or
 * another model drops it without a question.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { labelGaps, pairKey } from '@radical/layout/labelRoom'
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

/** The elements the exploration lists, the containers drawn round them among them. */
const listed = (): string[] => [...(viewShownNodes(s().exploration ?? undefined, s().c4Nodes, s().c4Relations) ?? [])].sort()

/** Whether `a` and `b` lie on each other as the canvas draws them. */
const overlap = (a: string, b: string): boolean => {
  const size = (id: string) => s().rfNodes.find((n) => n.id === id)!.data
  const pa = abs(a)
  const pb = abs(b)
  return pa.x < pb.x + size(b).width && pb.x < pa.x + size(a).width && pa.y < pb.y + size(b).height && pb.y < pa.y + size(a).height
}

/** Drawn: on the canvas and visible (a frame held only to place what is
 *  in it is not). */
const drawn = (id: string): boolean => s().rfNodes.some((n) => n.id === id && !n.hidden)

/** `id` lies inside `frame`'s drawn box. */
function inside(id: string, frame: string): boolean {
  const size = (n: string) => s().rfNodes.find((r) => r.id === n)!.data
  const a = abs(id)
  const f = abs(frame)
  return a.x >= f.x && a.y >= f.y && a.x + size(id).width <= f.x + size(frame).width && a.y + size(id).height <= f.y + size(frame).height
}

/** `a` lies in a layer below `b`'s: its top under `b`'s bottom. */
function below(a: string, b: string): boolean {
  const height = s().rfNodes.find((r) => r.id === b)!.data.height
  return abs(a).y >= abs(b).y + height
}

/** The clear space between `a` and `b` falls short of what the add rule
 *  keeps between siblings (20 inside a container, 60 at the top) or what
 *  the label of a relation between them needs: what is missing, or null. */
function tooClose(a: string, b: string): string | null {
  const size = (n: string) => s().rfNodes.find((r) => r.id === n)!.data
  const pa = abs(a)
  const pb = abs(b)
  const dx = Math.max(pb.x - (pa.x + size(a).width), pa.x - (pb.x + size(b).width))
  const dy = Math.max(pb.y - (pa.y + size(a).height), pa.y - (pb.y + size(b).height))
  const base = s().c4Nodes[a].parentId ? 20 : 60
  const need = labelGaps(s().c4Nodes, s().c4Relations).get(pairKey(a, b))
  const nx = Math.max(base, need?.x ?? 0)
  const ny = Math.max(base, need?.y ?? 0)
  return dx >= nx || dy >= ny ? null : `${a}–${b}: ${Math.round(dx)} px across (needs ${nx}), ${Math.round(dy)} px down (needs ${ny})`
}

/** Every pair of siblings drawn too close (tooClose). */
function crowded(): string[] {
  const shown = s().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
  const out: string[] = []
  for (const a of shown) for (const b of shown) {
    if (a >= b || (s().c4Nodes[a].parentId ?? '') !== (s().c4Nodes[b].parentId ?? '')) continue
    const close = tooClose(a, b)
    if (close) out.push(close)
  }
  return out
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
  it('opens on the element alone, in the frame of its container, as a view the document does not hold', async () => {
    const views = s().views
    await s().exploreFrom('api')
    const exploration = s().exploration!
    expect(exploration.name).toBe('Explore: API')
    expect(s().activeViewId).toBe(exploration.id)
    expect(s().views).toBe(views)
    expect(listed()).toEqual(['api', 'bookstore'])
    // API alone, inside the Bookstore frame, drawn round it alone.
    expect(Object.keys(drawnPlaces()).sort()).toEqual(['api', 'bookstore'])
    expect(s().rfNodes.find((n) => n.id === 'api')!.parentNode).toBe('bookstore')
    expect(inside('api', 'bookstore')).toBe(true)
    const frame = s().rfNodes.find((n) => n.id === 'bookstore')!.data
    expect(frame.collapsed).toBe(false)
    expect(frame.width).toBeLessThan(s().rfNodes.find((n) => n.id === 'api')!.data.width + 200)
  })

  it("API's + adds Web App, Orders DB and Payment Provider a layer below API, inside their frames", async () => {
    await s().exploreFrom('api')
    expect(s().exploreMore?.api).toBe(3)
    await s().exploreNeighbours('api')
    expect(listed()).toEqual(['api', 'bookstore', 'db', 'payments', 'web'])
    // The Bookstore frame drawn round API, Web App and Orders DB, Payment
    // Provider outside it.
    expect(drawn('bookstore')).toBe(true)
    for (const id of ['api', 'web', 'db']) expect(inside(id, 'bookstore')).toBe(true)
    expect(overlap('payments', 'bookstore')).toBe(false)
    // The start on top, its neighbours a layer below.
    for (const id of ['web', 'db', 'payments']) expect(below(id, 'api')).toBe(true)
    // Clear of each other by the gap siblings keep and the room their
    // relation's label needs.
    expect(crowded()).toEqual([])
    // API has no neighbour left to show.
    expect(s().exploreMore?.api ?? 0).toBe(0)
    expect(s().exploreMore?.web).toBe(1)
  })

  it('+ 1 level adds the next layer, and the layering holds through a second +', async () => {
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    await s().exploreLevel()
    expect(listed()).toEqual(['api', 'bookstore', 'customer', 'db', 'payments', 'web'])
    for (const id of ['web', 'db', 'payments']) {
      expect(below(id, 'api')).toBe(true)
      expect(below('customer', id)).toBe(true)
    }
    for (const id of ['api', 'web', 'db']) expect(inside(id, 'bookstore')).toBe(true)
    for (const id of ['payments', 'customer']) expect(overlap(id, 'bookstore')).toBe(false)
    expect(overlap('customer', 'payments')).toBe(false)
    expect(crowded()).toEqual([])
    expect(Object.values(s().exploreMore ?? {}).filter(Boolean)).toEqual([])
  })

  it('a layer of more than 8 wraps into rows of at most 8, closer together than the layers, in the order added', async () => {
    // A person using six containers of one system and six other systems.
    const box = (id: string, type: string, parentId?: string): C4Node =>
      ({ id, type, label: id, x: 0, y: 0, width: 200, height: 120, collapsed: false, ...(parentId ? { parentId } : {}) } as C4Node)
    const inner = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
    const outer = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
    s().loadDiagram({
      nodes: [box('user', 'person'), box('sys', 'system'), ...inner.map((id) => box(id, 'container', 'sys')), ...outer.map((id) => box(id, 'system'))],
      relations: [...inner, ...outer].map((id) => ({ id: `uses-${id}`, sourceId: 'user', targetId: id, label: 'uses' })),
    })
    await s().exploreFrom('user')
    await s().exploreNeighbours('user')
    const added = [...inner, ...outer]
    for (const id of added) expect(below(id, 'user')).toBe(true)
    // Rows by their top, each of at most 8, the added order kept in each.
    const rows = new Map<number, string[]>()
    for (const id of added) rows.set(Math.round(abs(id).y), [...(rows.get(Math.round(abs(id).y)) ?? []), id])
    expect(rows.size).toBeGreaterThan(1)
    for (const row of rows.values()) {
      expect(row.length).toBeLessThanOrEqual(8)
      const xs = row.map((id) => abs(id).x)
      expect(xs).toEqual([...xs].sort((a, b) => a - b))
    }
    // The second row closer under the first than the first under the start.
    const tops = [...rows.keys()].sort((a, b) => a - b)
    const height = s().rfNodes.find((n) => n.id === 'r6')!.data.height
    const layerGap = tops[0] - (abs('user').y + s().rfNodes.find((n) => n.id === 'user')!.data.height)
    expect(tops[1] - (tops[0] + height)).toBeLessThan(layerGap)
    // The system's frame holds its containers, the other systems lie outside it.
    expect(drawn('sys')).toBe(true)
    for (const id of inner) expect(inside(id, 'sys')).toBe(true)
    for (const id of outer) expect(overlap(id, 'sys')).toBe(false)
    expect(crowded()).toEqual([])
  })

  it('is not saved: the document is as it was, its views among it', async () => {
    const was = saved()
    const views = s().views
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    await s().exploreLevel()
    expect(saved()).toBe(was)
    expect(s().views).toBe(views)
    expect(s().saveDiagram().views!.map((v) => v.name)).not.toContain('Explore: API')
  })

  it('is no undo step: opening it, its +, + 1 level, a drag and a fold leave the history as it was', async () => {
    s().updateNode('customer', { label: 'Reader' })
    const mark = historyMark()
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    await s().exploreLevel()
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

  it('an edit made on it is an undo step that comes back to it', async () => {
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
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

  it('another exploration replaces it, without a question', async () => {
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    const first = s().exploration!.id
    const was = saved()
    await s().exploreFrom('db')
    expect(s().exploration!.id).not.toBe(first)
    expect(s().exploration!.name).toBe('Explore: Orders DB')
    expect(listed()).toEqual(['bookstore', 'db'])
    expect(viewById(s(), first)).toBeUndefined()
    expect(s().pendingDelete).toBeNull()
    expect(saved()).toBe(was)
  })

  it('another model drops it', async () => {
    await s().exploreFrom('api')
    s().loadDiagram({ nodes: [], relations: [] })
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBeNull()
  })

  it('an outside change keeps it on screen, without what an agent deleted, and never writes it', async () => {
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    const id = s().exploration!.id
    const places = drawnPlaces()
    outsideChange((data) => {
      data.nodes = data.nodes.filter((n) => n.id !== 'payments')
      data.relations = data.relations.filter((r) => r.sourceId !== 'payments' && r.targetId !== 'payments')
    })
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['api', 'bookstore', 'db', 'web'])
    const now = drawnPlaces()
    for (const n of ['api', 'web', 'db']) expect(now[n]).toEqual(places[n])
    expect(now.payments).toBeUndefined()
    expect(s().saveDiagram().views!.some((v) => v.id === id)).toBe(false)
  })

  it('in Designer a milestone shown closes it, and none opens while one is shown', async () => {
    await s().exploreFrom('api')
    s().createSnapshot('As-is')
    s().selectMilestone(s().snapshots[s().snapshots.length - 1].id)
    expect(s().exploration).toBeNull()
    await s().exploreFrom('db')
    expect(s().exploration).toBeNull()
    s().discardMilestoneChanges()
  })
})

describe('saving and closing an explore view', () => {
  it('Save as view keeps it as a structure view in its folder, with its places and folds, as one undo step', async () => {
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
    s().toggleCollapse('api')
    const places = drawnPlaces()
    const mark = historyMark()
    const id = s().saveExploration('API context', 'Explorations')!
    expect(historyMark()).toBe(mark + 1)
    const view = s().views[id]
    expect(view.name).toBe('API context')
    expect(view.folder).toBe('Explorations')
    expect((view.kind ?? 'static')).toBe('static')
    expect([...view.nodeIds].sort()).toEqual(['api', 'bookstore', 'db', 'payments', 'web'])
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

  it('closing it drops it without a question, back on the canvas it was opened from', async () => {
    s().setActiveView('v-containers')
    const was = saved()
    const mark = historyMark()
    await s().exploreFrom('api')
    await s().exploreNeighbours('api')
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

  it('explores the milestone shown, follows Current (live), and keeps nothing', async () => {
    s().setAppMode('designer')
    const was = saved()
    const mark = historyMark()
    s().setAppMode('viewer')
    s().selectMilestone('snap-1')
    await s().exploreFrom('ctn2')
    const id = s().exploration!.id
    expect(s().activeViewId).toBe(id)
    // In v1 the backend is the API, related to the frontend only.
    expect(s().exploration!.name).toBe('Explore: API')
    expect(s().exploreMore?.ctn2).toBe(1)
    await s().exploreNeighbours('ctn2')
    expect(listed().filter((n) => n.startsWith('ctn'))).toEqual(['ctn1', 'ctn2'])
    const places = drawnPlaces()
    // Current (live): the same elements, their neighbours counted there.
    s().discardMilestoneChanges()
    expect(s().activeSnapshotId).toBeNull()
    expect(s().activeViewId).toBe(id)
    expect(listed().filter((n) => n.startsWith('ctn'))).toEqual(['ctn1', 'ctn2'])
    expect(drawnPlaces().ctn2).toEqual(places.ctn2)
    expect(s().exploreMore?.ctn2).toBe(2)
    // The frontend's: the end user and the auth service.
    expect(s().exploreMore?.ctn1).toBe(2)
    await s().exploreLevel()
    expect(listed().filter((n) => n.startsWith('ctn')).length).toBeGreaterThan(2)
    // No Save as view, no undo step; Designer finds its model as it was.
    expect(s().saveExploration('Kept', null)).toBeNull()
    expect(Object.values(s().views).map((v) => v.name)).not.toContain('Kept')
    expect(historyMark()).toBe(mark)
    s().setAppMode('designer')
    expect(s().exploration).toBeNull()
    expect(saved()).toBe(was)
    expect(historyMark()).toBe(mark)
  })

  it('a milestone shown keeps it, with what that milestone lacks left out', async () => {
    await s().exploreFrom('ctn2')
    await s().exploreNeighbours('ctn2')
    const before = listed()
    expect(before.filter((n) => n.startsWith('ctn')).length).toBe(4)
    s().selectMilestone('snap-1')
    expect(s().exploration).not.toBeNull()
    expect(listed()).toEqual(before.filter((x) => !!s().c4Nodes[x]))
    expect(listed()).toContain('ctn2')
  })

  it('closes when the perspective changes, and is not offered in Presenter', async () => {
    await s().exploreFrom('ctn1')
    expect(s().exploration).not.toBeNull()
    s().setAppMode('presenter')
    expect(s().exploration).toBeNull()
    await s().exploreFrom('ctn1')
    expect(s().exploration).toBeNull()
    s().setAppMode('designer')
  })
})
