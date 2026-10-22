/**
 * Explore from here: a temporary structure view grown from one element.
 * It is drawn like a view while it is shown, yet it is none of the
 * document's: it never reaches the saved model, the undo history or the
 * list of views the document keeps. Each element's + adds the elements
 * joined to it (relations either way, its parent, its children) that the
 * view does not show yet, all or those chosen, on the level below it, each
 * on its own (flat, no frame), and lays the exploration out again top-down
 * by level, a long level in rows of 8, drawing only the lines between an
 * element and the next level; its − takes them back. In Designer each +,
 * − and drag is an undo step of the exploration's, gone with it. Save as
 * view keeps it as an ordinary structure view (one undo step); closing it,
 * another exploration or another model drops it without a question.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { labelGaps, pairKey } from '@radical/layout/labelRoom'
import { historyMark, useDiagramStore, viewById } from '../src/store/diagramStore'
import { explorationLinks, menuRows } from '../src/store/exploration'
// A copy of the e2e suite's fixture (apps/e2e/fixtures), the model the
// scenarios name: a workspace imports no file of another.
import bookstoreFile from './fixtures/bookstore.radical?raw'

const s = useDiagramStore.getState

const bookstore = (): DiagramData => JSON.parse(bookstoreFile) as DiagramData

/** Where `id` is drawn on the canvas shown: its top-left, summed up the
 *  containers the canvas draws it in (none on the flat exploration). */
function abs(id: string): { x: number; y: number } {
  const rf = new Map(s().rfNodes.map((n) => [n.id, n]))
  if (!rf.has(id)) {
    const nodes = s().c4Nodes
    let x = 0
    let y = 0
    for (let n: C4Node | undefined = nodes[id]; n; n = n.parentId ? nodes[n.parentId] : undefined) { x += n.x; y += n.y }
    return { x, y }
  }
  let x = 0
  let y = 0
  for (let n = rf.get(id); n; n = n.parentNode ? rf.get(n.parentNode) : undefined) { x += n.position.x; y += n.position.y }
  return { x, y }
}

/** Every element drawn on the canvas shown, with where it is drawn. */
function drawnPlaces(): Record<string, { x: number; y: number }> {
  return Object.fromEntries(s().rfNodes.filter((n) => !n.hidden).map((n) => [n.id, abs(n.id)]))
}

/** The elements the exploration lists. */
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

/** `a` lies in a layer below `b`'s: its top under `b`'s bottom. */
function below(a: string, b: string): boolean {
  const height = s().rfNodes.find((r) => r.id === b)!.data.height
  return abs(a).y >= abs(b).y + height
}

/** The clear space between `a` and `b` falls short of what the layout
 *  keeps between elements (40) or what the label of a relation drawn
 *  between them needs: what is missing, or null. */
function tooClose(a: string, b: string): string | null {
  const size = (n: string) => s().rfNodes.find((r) => r.id === n)!.data
  const pa = abs(a)
  const pb = abs(b)
  const dx = Math.max(pb.x - (pa.x + size(a).width), pa.x - (pb.x + size(b).width))
  const dy = Math.max(pb.y - (pa.y + size(a).height), pa.y - (pb.y + size(b).height))
  const base = 40
  const drawnRelations = Object.fromEntries(Object.entries(s().c4Relations).filter(([id]) => edges().includes(id)))
  const need = labelGaps(Object.fromEntries(Object.entries(s().c4Nodes).map(([id, n]) => [id, { ...n, parentId: undefined }])), drawnRelations).get(pairKey(a, b))
  const nx = Math.max(base, need?.x ?? 0)
  const ny = Math.max(base, need?.y ?? 0)
  return dx >= nx || dy >= ny ? null : `${a}–${b}: ${Math.round(dx)} px across (needs ${nx}), ${Math.round(dy)} px down (needs ${ny})`
}

/** The relations the canvas draws. */
const edges = (): string[] => s().rfEdges.filter((e) => !e.data?.isVirtual).map((e) => e.id).sort()

/** The containment lines the exploration draws. */
const containment = (): string[] => s().rfEdges.filter((e) => e.id.startsWith('contains:')).map((e) => e.id).sort()

/** Relations only: no parent, no children. */
const RELATIONS = { parent: false, children: false }

/** What a drag does to the store (see dragUndo.test.ts). */
function drag(id: string, by: { x: number; y: number }): void {
  const n = s().c4Nodes[id]
  s().liveGrab(id, n.x, n.y, 'calm', abs(id))
  useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, [id]: { ...st.c4Nodes[id], x: n.x + by.x, y: n.y + by.y } } }))
  s().liveRelease(id, [], true)
}

/** Every pair of elements drawn too close (tooClose). */
function crowded(): string[] {
  const shown = s().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
  const out: string[] = []
  for (const a of shown) for (const b of shown) {
    if (a >= b) continue
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
  it('opens on the element alone, with no frame, as a view the document does not hold', () => {
    const views = s().views
    s().exploreFrom('api')
    const exploration = s().exploration!
    expect(exploration.name).toBe('Explore: API')
    expect(s().activeViewId).toBe(exploration.id)
    expect(s().views).toBe(views)
    expect(listed()).toEqual(['api'])
    expect(Object.keys(drawnPlaces())).toEqual(['api'])
    expect(drawn('bookstore')).toBe(false)
    // Its + menu is open, to choose the next level; closed, API stays alone.
    expect(s().exploreMenuFor).toBe('api')
    s().openExploreMenu(null)
    expect(listed()).toEqual(['api'])
  })

  it('opens no + menu on an element with nothing to add', () => {
    s().loadDiagram({ nodes: [{ id: 'lone', type: 'system', label: 'Lone', x: 0, y: 0, width: 200, height: 120, collapsed: false } as C4Node], relations: [] })
    s().exploreFrom('lone')
    expect(s().exploration).not.toBeNull()
    expect(s().exploreMenuFor).toBeNull()
  })

  it("API's + adds what it is joined to a level below API, each with its line to API, no frame drawn", () => {
    s().exploreFrom('api')
    // Web App, Orders DB, Payment Provider, and its parent Bookstore.
    expect(s().exploreMore?.api).toBe(4)
    s().exploreNeighbours('api')
    expect(listed()).toEqual(['api', 'bookstore', 'db', 'payments', 'web'])
    for (const id of ['web', 'db', 'payments', 'bookstore']) expect(below(id, 'api')).toBe(true)
    // Flat: Bookstore drawn on its own, joined to API by a containment line.
    for (const id of ['api', 'web', 'db']) expect(s().rfNodes.find((n) => n.id === id)!.parentNode).toBeUndefined()
    expect(edges()).toEqual(['r2', 'r3', 'r4'])
    expect(containment()).toEqual(['contains:bookstore:api'])
    expect(crowded()).toEqual([])
    expect(s().exploreMore?.api ?? 0).toBe(0)
    expect(s().exploreMore?.web).toBe(1)
  })

  it("Web App's + adds Customer on the next level, and the levels hold", () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', RELATIONS)
    s().exploreNeighbours('web')
    expect(listed()).toEqual(['api', 'bookstore', 'customer', 'db', 'payments', 'web'])
    expect(s().exploration!.levels).toEqual({ api: 0, web: 1, db: 1, payments: 1, customer: 2, bookstore: 2 })
    for (const id of ['web', 'db', 'payments']) {
      expect(below(id, 'api')).toBe(true)
      expect(below('customer', id)).toBe(true)
    }
    // Lines between consecutive levels only: Web App holds no Bookstore.
    expect(edges()).toEqual(['r1', 'r2', 'r3', 'r4'])
    // Bookstore, which Web App's + added, holds Web App and Orders DB.
    expect(containment()).toEqual(['contains:bookstore:db', 'contains:bookstore:web'])
    expect(crowded()).toEqual([])
  })

  it('a level of more than 8 wraps into rows of at most 8, closer together than the levels, in the order added', () => {
    // A person using six containers of one system and six other systems.
    const box = (id: string, type: string, parentId?: string): C4Node =>
      ({ id, type, label: id, x: 0, y: 0, width: 200, height: 120, collapsed: false, ...(parentId ? { parentId } : {}) } as C4Node)
    const inner = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
    const outer = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
    s().loadDiagram({
      nodes: [box('user', 'person'), box('sys', 'system'), ...inner.map((id) => box(id, 'container', 'sys')), ...outer.map((id) => box(id, 'system'))],
      relations: [
        ...[...inner, ...outer].map((id) => ({ id: `uses-${id}`, sourceId: 'user', targetId: id, label: 'uses' })),
        // Within the level below the user: not drawn.
        { id: 'r1-r2', sourceId: 'r1', targetId: 'r2', label: 'calls' },
      ],
    })
    s().exploreFrom('user')
    s().exploreNeighbours('user')
    const added = [...inner, ...outer]
    for (const id of added) expect(below(id, 'user')).toBe(true)
    const rows = new Map<number, string[]>()
    for (const id of added) rows.set(Math.round(abs(id).y), [...(rows.get(Math.round(abs(id).y)) ?? []), id])
    expect(rows.size).toBeGreaterThan(1)
    for (const row of rows.values()) {
      expect(row.length).toBeLessThanOrEqual(8)
      const xs = row.map((id) => abs(id).x)
      expect(xs).toEqual([...xs].sort((a, b) => a - b))
    }
    const tops = [...rows.keys()].sort((a, b) => a - b)
    const height = s().rfNodes.find((n) => n.id === 'r6')!.data.height
    const levelGap = tops[0] - (abs('user').y + s().rfNodes.find((n) => n.id === 'user')!.data.height)
    expect(tops[1] - (tops[0] + height)).toBeLessThan(levelGap)
    expect(drawn('sys')).toBe(false)
    expect(edges()).toEqual(added.map((id) => `uses-${id}`).sort())
    expect(s().exploration!.hiddenRelationIds).toEqual(['r1-r2'])
    expect(crowded()).toEqual([])
    // Saved as a view, it draws what the exploration drew.
    const view = s().saveExploration('Uses', null)!
    expect(s().views[view].hiddenRelationIds).toEqual(['r1-r2'])
  })

  it('an element keeps the level it is added on: one related to the start, added by a later +, goes on that later level', () => {
    const box = (id: string): C4Node => ({ id, type: 'system', label: id, x: 0, y: 0, width: 200, height: 120, collapsed: false } as C4Node)
    s().loadDiagram({
      nodes: ['start', 'a', 'b', 'p'].map(box),
      relations: [
        { id: 'start-a', sourceId: 'start', targetId: 'a', label: 'uses' },
        { id: 'a-b', sourceId: 'a', targetId: 'b', label: 'uses' },
        { id: 'b-p', sourceId: 'b', targetId: 'p', label: 'uses' },
      ],
    })
    s().exploreFrom('start')
    s().exploreNeighbours('start')
    s().exploreNeighbours('a')
    // Related to the start since the start's + was used.
    s().addRelation({ sourceId: 'start', targetId: 'p', label: 'pays' })
    s().exploreNeighbours('b')
    expect(s().exploration!.levels).toEqual({ start: 0, a: 1, b: 2, p: 3 })
    expect(below('a', 'start')).toBe(true)
    expect(below('b', 'a')).toBe(true)
    expect(below('p', 'b')).toBe(true)
    expect(edges()).toEqual(['a-b', 'b-p', 'start-a'])
  })

  it('is not saved: the document is as it was, its views among it', () => {
    const was = saved()
    const views = s().views
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().exploreNeighbours('web')
    drag('web', { x: 40, y: 0 })
    expect(saved()).toBe(was)
    expect(s().views).toBe(views)
    expect(s().saveDiagram().views!.map((v) => v.name)).not.toContain('Explore: API')
  })

  it("its + is an undo step of its own: Undo takes back what it added, levels too, and Redo gives it back", () => {
    s().exploreFrom('api')
    const mark = historyMark()
    expect(s().canUndo).toBe(false)
    s().exploreNeighbours('api', RELATIONS)
    const places = drawnPlaces()
    s().exploreNeighbours('web')
    s().undo()
    expect(listed()).toEqual(['api', 'db', 'payments', 'web'])
    expect(s().exploration!.levels).toEqual({ api: 0, web: 1, db: 1, payments: 1 })
    expect(drawnPlaces()).toEqual(places)
    s().redo()
    expect(listed()).toContain('customer')
    expect(s().exploration!.levels.customer).toBe(2)
    s().undo()
    s().undo()
    expect(listed()).toEqual(['api'])
    expect(s().canUndo).toBe(false)
    // Nothing to save.
    expect(historyMark()).toBe(mark)
  })

  it('a drag on it is an undo step of its own', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    // On the flat exploration the nodes hold where they are drawn.
    const at = () => ({ x: s().c4Nodes.web.x, y: s().c4Nodes.web.y })
    const was = at()
    drag('web', { x: 120, y: 30 })
    expect(at()).toEqual({ x: was.x + 120, y: was.y + 30 })
    s().undo()
    expect(at()).toEqual(was)
    expect(listed()).toContain('web')
  })

  it('Undo takes back its + first and stays on it, then the rename made before on Containers', () => {
    s().setActiveView('v-containers')
    s().updateNode('customer', { label: 'Reader' })
    s().exploreFrom('api')
    const id = s().exploration!.id
    s().exploreNeighbours('api')
    s().undo()
    expect(listed()).toEqual(['api'])
    expect(s().activeViewId).toBe(id)
    expect(s().c4Nodes.customer.label).toBe('Reader')
    s().undo()
    expect(s().c4Nodes.customer.label).toBe('Customer')
  })

  it('closing it takes its steps out of the history: Undo goes to the rename, and nothing is saved', () => {
    s().setActiveView('v-containers')
    s().updateNode('customer', { label: 'Reader' })
    const was = saved()
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    drag('web', { x: 50, y: 0 })
    expect(saved()).toBe(was)
    s().closeExploration()
    expect(saved()).toBe(was)
    expect(s().canRedo).toBe(false)
    s().undo()
    expect(s().c4Nodes.customer.label).toBe('Customer')
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
    // The first one's steps went with it.
    expect(s().canUndo).toBe(false)
  })

  it('another model drops it', () => {
    s().exploreFrom('api')
    s().loadDiagram({ nodes: [], relations: [] })
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBeNull()
  })

  it('an outside change keeps it on screen, without what an agent deleted, and never writes it', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', RELATIONS)
    const id = s().exploration!.id
    const places = drawnPlaces()
    outsideChange((data) => {
      data.nodes = data.nodes.filter((n) => n.id !== 'payments')
      data.relations = data.relations.filter((r) => r.sourceId !== 'payments' && r.targetId !== 'payments')
    })
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['api', 'db', 'web'])
    // Each keeps its level.
    expect(s().exploration!.levels).toEqual({ api: 0, web: 1, db: 1 })
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

  it('lays out 500 elements quickly', () => {
    // A hub related to 499 others: one + adds them all.
    const box = (id: string): C4Node => ({ id, type: 'system', label: id, x: 0, y: 0, width: 200, height: 120, collapsed: false } as C4Node)
    const ids = Array.from({ length: 499 }, (_, i) => `n${i}`)
    s().loadDiagram({
      nodes: [box('hub'), ...ids.map(box)],
      relations: ids.map((id, i) => ({ id: `r-${id}`, sourceId: i % 2 ? 'hub' : id, targetId: i % 2 ? id : 'hub', label: 'uses' })),
    })
    s().exploreFrom('hub')
    const started = performance.now()
    s().exploreNeighbours('hub')
    const took = performance.now() - started
    expect(listed().length).toBe(500)
    expect(took).toBeLessThan(1000)
  })
})

describe('choosing the relations of a +', () => {
  /** The rows of element `id`'s + menu, as key → count, by column. */
  const menu = (id: string): { out: Record<string, number>; in: Record<string, number> } => {
    const rows = menuRows(explorationLinks(s().exploration!, s().c4Nodes, s().c4Relations).get(id) ?? [])
    const byKey = (list: typeof rows.out) => Object.fromEntries(list.map((r) => [r.key, r.n]))
    return { out: byKey(rows.out), in: byKey(rows.in) }
  }

  it("API's menu: what goes out from it, and what comes in, its parent last", () => {
    s().exploreFrom('api')
    expect(menu('api')).toEqual({
      out: { 'l:charges card': 1, 'l:reads/writes': 1 },
      in: { 'l:calls': 1, parent: 1 },
    })
  })

  it('a row adds the neighbours joined that way, its relations drawn; Show all adds the rest', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', { rows: [{ key: 'l:reads/writes', direction: 'out' }, { key: 'l:calls', direction: 'in' }], parent: false, children: false })
    expect(listed()).toEqual(['api', 'db', 'web'])
    expect(edges()).toEqual(['r2', 'r3'])
    // Its + stays, with what is left: Payment Provider and Bookstore.
    expect(s().exploreMore?.api).toBe(2)
    expect(menu('api')).toEqual({ out: { 'l:charges card': 1 }, in: { parent: 1 } })
    s().exploreNeighbours('api')
    expect(listed()).toEqual(['api', 'bookstore', 'db', 'payments', 'web'])
    expect(s().exploreMore?.api ?? 0).toBe(0)
  })

  it('contained in adds the parent a level below, with a dashed contains arrow from it to the element', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', { rows: [], parent: true })
    expect(listed()).toEqual(['api', 'bookstore'])
    expect(s().exploration!.levels.bookstore).toBe(1)
    expect(below('bookstore', 'api')).toBe(true)
    const line = s().rfEdges.find((e) => e.id === 'contains:bookstore:api')!
    expect([line.source, line.target, line.data?.label, line.data?.isVirtual]).toEqual(['bookstore', 'api', 'Contains', true])
    expect(line.markerEnd).toBeTruthy()
    // Flat: API is not drawn inside it.
    expect(s().rfNodes.find((n) => n.id === 'api')!.parentNode).toBeUndefined()
    // A line, not a relation of the model; never saved.
    expect(Object.keys(s().c4Relations)).not.toContain('contains:bookstore:api')
  })

  it("the parent's contains lists its children not shown yet; they go out from it", () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', { rows: [], parent: true })
    // Web App and Orders DB: API is shown.
    expect(menu('bookstore')).toEqual({ out: { children: 2 }, in: {} })
    s().exploreNeighbours('bookstore', { rows: [], children: true })
    expect(listed()).toEqual(['api', 'bookstore', 'db', 'web'])
    expect(s().exploration!.levels).toMatchObject({ web: 2, db: 2 })
    expect(containment()).toEqual(['contains:bookstore:api', 'contains:bookstore:db', 'contains:bookstore:web'])
    for (const child of ['db', 'web']) {
      const line = s().rfEdges.find((e) => e.id === `contains:bookstore:${child}`)!
      expect([line.source, line.target]).toEqual(['bookstore', child])
    }
  })

  it("an element's − takes back what its + added and all added from those since; Undo gives them back", () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api')
    s().exploreNeighbours('web')
    expect(listed()).toContain('customer')
    expect(s().exploreFoldable?.api).toBe(true)
    s().foldExploration('api')
    expect(listed()).toEqual(['api'])
    expect(s().exploration!.levels).toEqual({ api: 0 })
    expect(s().exploreMore?.api).toBe(4)
    expect(s().exploreFoldable?.api).toBeUndefined()
    s().undo()
    expect(listed()).toEqual(['api', 'bookstore', 'customer', 'db', 'payments', 'web'])
    s().redo()
    expect(listed()).toEqual(['api'])
  })
})

describe('saving and closing an explore view', () => {
  it('Save as view keeps it as a structure view in its folder, with its places, as one undo step', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', RELATIONS)
    const places = drawnPlaces()
    const mark = historyMark()
    const id = s().saveExploration('API context', 'Explorations')!
    expect(historyMark()).toBe(mark + 1)
    const view = s().views[id]
    expect(view.name).toBe('API context')
    expect(view.folder).toBe('Explorations')
    expect((view.kind ?? 'static')).toBe('static')
    expect([...view.nodeIds].sort()).toEqual(['api', 'db', 'payments', 'web'])
    expect(s().exploration).toBeNull()
    expect(s().activeViewId).toBe(id)
    expect(drawnPlaces()).toMatchObject(places)
    const doc = s().saveDiagram().views!.find((v) => v.id === id)!
    expect(doc.positions.api).toBeDefined()
    expect(doc.positions.payments).toBeDefined()

    s().undo()
    expect(s().views[id]).toBeUndefined()
    expect(s().exploration).toBeNull()
    s().redo()
    expect(s().views[id].name).toBe('API context')
    expect(s().activeViewId).toBe(id)
    expect(drawnPlaces()).toMatchObject(places)
  })

  it('a child saved with its parent is drawn in it, as a structure view nests', () => {
    s().exploreFrom('api')
    s().exploreNeighbours('api', { rows: [], parent: true })
    const id = s().saveExploration('API in Bookstore', null)!
    expect(s().rfNodes.find((n) => n.id === 'api')!.parentNode).toBe('bookstore')
    expect([...s().views[id].nodeIds].sort()).toEqual(['api', 'bookstore'])
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
    expect(s().canUndo).toBe(false)
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
    s().exploreNeighbours('ctn2', RELATIONS)
    expect(listed()).toEqual(['ctn1', 'ctn2'])
    const places = drawnPlaces()
    // Current (live): the same elements, their neighbours counted there.
    s().discardMilestoneChanges()
    expect(s().activeSnapshotId).toBeNull()
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['ctn1', 'ctn2'])
    expect(drawnPlaces().ctn2).toEqual(places.ctn2)
    s().exploreNeighbours('ctn2', RELATIONS)
    expect(listed().length).toBeGreaterThan(2)
    // Its − works in Viewer too.
    s().foldExploration('ctn2')
    expect(listed()).toEqual(['ctn2'])
    // No undo steps, no Save as view; Designer finds its model as it was.
    expect(s().canUndo).toBe(false)
    expect(s().saveExploration('Kept', null)).toBeNull()
    expect(Object.values(s().views).map((v) => v.name)).not.toContain('Kept')
    expect(historyMark()).toBe(mark)
    // Back in Designer it stays, on the live model; nothing was saved.
    s().setAppMode('designer')
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(['ctn2'])
    expect(saved()).toBe(was)
    expect(historyMark()).toBe(mark)
  })

  it('stays open between Designer and Viewer; Undo in Designer takes back its own + only', () => {
    s().setAppMode('designer')
    s().exploreFrom('ctn2')
    const id = s().exploration!.id
    s().exploreNeighbours('ctn2', RELATIONS)
    const designerAdded = listed().filter((n) => n !== 'ctn2')
    expect(designerAdded.length).toBeGreaterThan(0)
    const levels = { ...s().exploration!.levels }
    s().setAppMode('viewer')
    expect(s().activeViewId).toBe(id)
    expect(s().exploration!.levels).toEqual(levels)
    // In Viewer: the frontend's + (from what Designer's + added), and the
    // start's parent (from the start). No undo steps there.
    s().exploreNeighbours('ctn1', RELATIONS)
    s().exploreNeighbours('ctn2', { rows: [], parent: true })
    const parent = s().c4Nodes.ctn2.parentId!
    expect(listed()).toContain(parent)
    const viewerShown = listed()
    s().setAppMode('designer')
    expect(s().activeViewId).toBe(id)
    expect(listed()).toEqual(viewerShown)
    // Undo: Designer's + goes, with what was added from it in Viewer; the
    // parent, added from the start, stays.
    s().undo()
    expect(listed()).toEqual(['ctn2', parent].sort())
    expect(s().exploration!.levels).toEqual({ ctn2: 0, [parent]: 1 })
  })

  it('a milestone shown in Viewer, back in Designer the exploration follows the live model', () => {
    s().setAppMode('designer')
    s().exploreFrom('ctn2')
    s().exploreNeighbours('ctn2', RELATIONS)
    const live = listed()
    s().setAppMode('viewer')
    s().selectMilestone('snap-1')
    // v1 lacks the cache and the database.
    expect(listed().length).toBeLessThan(live.length)
    s().setAppMode('designer')
    expect(s().activeSnapshotId).toBeNull()
    expect(listed()).toEqual(live)
  })

  it('a milestone shown keeps it, with what that milestone lacks left out', () => {
    s().exploreFrom('ctn2')
    s().exploreNeighbours('ctn2', RELATIONS)
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
