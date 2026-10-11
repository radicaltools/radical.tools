/**
 * Alignments: elements the user keeps in a row or a column on one canvas.
 *
 * Covers:
 *   - addAlignment lines the elements up at once, on All elements or in the
 *     active view only, as one undo step; refusals are notified
 *   - deleting an element drops it from every alignment
 *   - saveDiagram / loadDiagram keep All elements' alignments
 *   - the live physics holds an alignment of leaves and one of groups,
 *     also while a member is dragged
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { activeLayoutConstraints, childrenInView, useDiagramStore } from '../src/store/diagramStore'
import { LiveColaLayout } from '../src/layout/liveColaLayout'
import { LiveColaEngine } from '../src/layout/liveColaEngine'
import { NODE_SIZES, type AlignConstraint, type C4Node, type C4Relation, type DiagramView } from '@radical/common/c4'
import type { Alignment } from '@radical/layout/constraints'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...extra }) as C4Node

const byId = <T extends { id: string }>(...items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]))

beforeEach(() => {
  useDiagramStore.setState({
    c4Nodes: byId(
      node('user', 'person', { x: 0, y: 0 }),
      node('shop', 'system', { x: 400, y: 300, width: 600, height: 400 }),
      node('api', 'container', { parentId: 'shop', x: 30, y: 120 }),
      node('bank', 'system', { x: 1200, y: 700 }),
      node('mail', 'system', { x: 1600, y: 100 }),
    ),
    c4Relations: byId(
      { id: 'r1', sourceId: 'user', targetId: 'api' } as C4Relation,
      { id: 'r2', sourceId: 'api', targetId: 'bank' } as C4Relation,
    ),
    views: {} as Record<string, DiagramView>,
    activeViewId: null,
    defaultLayoutConstraints: [],
    notifications: [],
    appMode: 'designer',
  } as any)
  useDiagramStore.getState()._sync()
})

/** Three root elements, drawn on the canvas. */
const threeRoots = (): string[] => ['user', 'bank', 'mail']

const centreY = (n: C4Node): number => n.y + n.height / 2

describe('addAlignment', () => {
  it('lines the elements up in a row on All elements, as one undo step', () => {
    const ids = threeRoots()
    const id = useDiagramStore.getState().addAlignment('horizontal', ids)
    expect(id).toBeTruthy()
    const s = useDiagramStore.getState()
    expect(s.defaultLayoutConstraints).toEqual([{ id, type: 'align', axis: 'horizontal', nodeIds: ids }])
    const rf = new Map(s.rfNodes.map((n) => [n.id, n]))
    const centres = ids.map((nid) => rf.get(nid)!.position.y + (rf.get(nid)!.data.height as number) / 2)
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(0.5)

    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().defaultLayoutConstraints).toEqual([])
    useDiagramStore.getState().redo()
    expect(useDiagramStore.getState().defaultLayoutConstraints).toHaveLength(1)
  })

  it('keeps a view\'s alignment to that view', () => {
    const ids = threeRoots()
    const vid = useDiagramStore.getState().addView('Context')
    useDiagramStore.getState().setActiveView(vid)
    useDiagramStore.getState().addAlignment('vertical', ids.slice(0, 2))
    const s = useDiagramStore.getState()
    expect(s.views[vid].layoutConstraints).toHaveLength(1)
    expect(s.defaultLayoutConstraints).toEqual([])
    expect(activeLayoutConstraints(s)).toBe(s.views[vid].layoutConstraints)
    useDiagramStore.getState().setActiveView(null)
    expect(activeLayoutConstraints(useDiagramStore.getState())).toEqual([])
  })

  it('refuses one element, a container with its child, and a duplicate', () => {
    const [a, b] = threeRoots()
    const store = useDiagramStore.getState()
    expect(store.addAlignment('horizontal', [a])).toBeNull()
    const child = Object.values(store.c4Nodes).find((n) => n.parentId)!
    expect(store.addAlignment('horizontal', [child.parentId!, child.id])).toBeNull()
    expect(store.addAlignment('horizontal', [a, b])).toBeTruthy()
    expect(useDiagramStore.getState().addAlignment('horizontal', [b, a])).toBeNull()
    expect(useDiagramStore.getState().addAlignment('vertical', [a, b])).toBeNull()
    const messages = useDiagramStore.getState().notifications.map((n: { message: string }) => n.message)
    expect(messages.some((m: string) => m.includes('already in one row'))).toBe(true)
    expect(useDiagramStore.getState().defaultLayoutConstraints).toHaveLength(1)
  })

  it('remembers the order elements were selected in', () => {
    const select = (id: string) => useDiagramStore.getState().onNodesChange([{ type: 'select', id, selected: true }])
    select('mail')
    select('user')
    select('bank')
    expect(useDiagramStore.getState().selectedNodeIds).toEqual(['mail', 'user', 'bank'])
    useDiagramStore.getState().onNodesChange([{ type: 'select', id: 'user', selected: false }])
    expect(useDiagramStore.getState().selectedNodeIds).toEqual(['mail', 'bank'])
  })

  it('keeps an ordered row in selection order, swapping what the canvas shows', () => {
    // user is drawn left of mail; selected the other way round.
    const id = useDiagramStore.getState().addAlignment('horizontal', ['mail', 'user'], { ordered: true })!
    const s = useDiagramStore.getState()
    expect(s.defaultLayoutConstraints[0]).toMatchObject({ nodeIds: ['mail', 'user'], ordered: true })
    const rf = new Map(s.rfNodes.map((n) => [n.id, n]))
    const cx = (nid: string): number => rf.get(nid)!.position.x + (rf.get(nid)!.data.width as number) / 2
    expect(cx('mail')).toBeLessThan(cx('user'))

    useDiagramStore.getState().setAlignmentOrdered(id, false)
    expect((useDiagramStore.getState().defaultLayoutConstraints[0] as AlignConstraint).ordered).toBeUndefined()
    useDiagramStore.getState().setAlignmentOrdered(id, true)
    expect(useDiagramStore.getState().defaultLayoutConstraints[0]).toMatchObject({ nodeIds: ['mail', 'user'], ordered: true })
    useDiagramStore.getState().undo()
    expect((useDiagramStore.getState().defaultLayoutConstraints[0] as AlignConstraint).ordered).toBeUndefined()
  })

  it('refuses an order that contradicts another one', () => {
    const store = useDiagramStore.getState()
    expect(store.addAlignment('horizontal', ['mail', 'user'], { ordered: true })).toBeTruthy()
    expect(useDiagramStore.getState().addAlignment('horizontal', ['user', 'bank', 'mail'], { ordered: true })).toBeNull()
    expect(useDiagramStore.getState().addAlignment('horizontal', ['bank', 'mail', 'user'], { ordered: true })).toBeTruthy()
  })

  it('lays a grid out in selection order, re-lays it with other columns, and undoes it', () => {
    const store = useDiagramStore.getState()
    const ids = ['mail', 'user', 'bank', 'shop']
    const id = store.addGrid(ids)!
    expect(useDiagramStore.getState().defaultLayoutConstraints).toEqual([{ id, type: 'grid', columns: 2, nodeIds: ids }])
    const centre = (nid: string) => {
      const n = useDiagramStore.getState().rfNodes.find((r) => r.id === nid)!
      return { x: n.position.x + (n.data.width as number) / 2, y: n.position.y + (n.data.height as number) / 2 }
    }
    // mail user / bank shop
    expect(Math.abs(centre('mail').y - centre('user').y)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(centre('mail').x - centre('bank').x)).toBeLessThanOrEqual(0.5)
    expect(centre('mail').x).toBeLessThan(centre('user').x)
    expect(centre('mail').y).toBeLessThan(centre('bank').y)

    useDiagramStore.getState().setGridColumns(id, 4)
    const ys = ids.map((nid) => centre(nid).y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.5)
    expect(centre('bank').x).toBeLessThan(centre('shop').x)

    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().defaultLayoutConstraints[0]).toMatchObject({ columns: 2 })
    useDiagramStore.getState().undo()
    expect(useDiagramStore.getState().defaultLayoutConstraints).toEqual([])
  })

  it('refuses a grid that puts two elements of one row into one column', () => {
    useDiagramStore.getState().addAlignment('horizontal', ['user', 'bank'])
    // user above bank in one column of a 1-column grid: they are already in one row.
    expect(useDiagramStore.getState().addGrid(['user', 'bank', 'mail'], 1)).toBeNull()
    expect(useDiagramStore.getState().addGrid(['user', 'bank', 'mail'], 2)).toBeTruthy()
  })

  it('reflows a grid when one of its elements is deleted', () => {
    useDiagramStore.getState().addGrid(['mail', 'user', 'bank', 'shop'], 2)
    useDiagramStore.getState().removeNode('user')
    expect(useDiagramStore.getState().defaultLayoutConstraints[0]).toMatchObject({ nodeIds: ['mail', 'bank', 'shop'], columns: 2 })
  })

  it('lists a container\'s children in the view, drawn or behind a collapse', () => {
    expect(childrenInView(useDiagramStore.getState(), 'shop')).toMatchObject({ drawn: true, boxes: [{ id: 'api' }] })
    useDiagramStore.getState().toggleCollapse('shop')
    expect(childrenInView(useDiagramStore.getState(), 'shop')).toMatchObject({ drawn: false, boxes: [{ id: 'api' }] })
  })

  it('lays out a grid of a collapsed container\'s children, ready for the expand', () => {
    const store = useDiagramStore.getState()
    store.addNode({ type: 'container', label: 'web', parentId: 'shop', collapsed: false, x: 400, y: 300, width: 240, height: 120 })
    store.addNode({ type: 'container', label: 'db', parentId: 'shop', collapsed: false, x: 30, y: 500, width: 240, height: 120 })
    useDiagramStore.getState().toggleCollapse('shop')
    const ids = Object.values(useDiagramStore.getState().c4Nodes).filter((n) => n.parentId === 'shop').map((n) => n.id)
    expect(ids).toHaveLength(3)
    const gridId = useDiagramStore.getState().addGrid(ids, 3)
    expect(gridId).toBeTruthy()
    const ys = ids.map((nid) => useDiagramStore.getState().c4Nodes[nid].y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.5)
  })

  it('drops a deleted element from its alignments, and an alignment left with one', () => {
    const [a, b, c] = threeRoots()
    useDiagramStore.getState().addAlignment('horizontal', [a, b, c])
    useDiagramStore.getState().removeNode(c)
    expect(useDiagramStore.getState().defaultLayoutConstraints[0].nodeIds).toEqual([a, b])
    useDiagramStore.getState().removeNode(b)
    expect(useDiagramStore.getState().defaultLayoutConstraints).toEqual([])
  })

  it('saves and loads All elements\' alignments', () => {
    const ids = threeRoots()
    useDiagramStore.getState().addAlignment('horizontal', ids)
    const data = useDiagramStore.getState().saveDiagram()
    expect(data.defaultLayoutConstraints).toHaveLength(1)
    useDiagramStore.setState({ defaultLayoutConstraints: [] } as any)
    useDiagramStore.getState().loadDiagram(data)
    expect(useDiagramStore.getState().defaultLayoutConstraints).toEqual(data.defaultLayoutConstraints)
    useDiagramStore.getState().stopLiveLayout()
  })
})

describe('Live layout physics with alignments', () => {
  function run(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, alignments: Alignment[]): LiveColaLayout {
    return new LiveColaLayout({
      getModel: () => ({ nodes, relations, alignments }),
      applyPositions: (positions) => {
        for (const [id, pos] of Object.entries(positions)) {
          const n = nodes[id]
          if (!n) continue
          n.x = pos.x
          n.y = pos.y
          if (pos.width != null) n.width = pos.width
          if (pos.height != null) n.height = pos.height
        }
      },
    })
  }

  it('holds a row of leaves, and the row follows a dragged member', async () => {
    const nodes: Record<string, C4Node> = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 300 }),
      c: node('c', 'system', { x: 1000, y: 600 }),
      d: node('d', 'system', { x: 500, y: 900 }),
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'a', targetId: 'd' } as C4Relation,
      r2: { id: 'r2', sourceId: 'c', targetId: 'd' } as C4Relation,
    }
    const layout = run(nodes, relations, [{ axis: 'y', ids: ['a', 'b', 'c'], orders: [] }])
    layout.start(true)
    await wait(300)
    const spread = (): number => {
      const cs = ['a', 'b', 'c'].map((id) => centreY(nodes[id]))
      return Math.max(...cs) - Math.min(...cs)
    }
    expect(spread()).toBeLessThanOrEqual(1)

    // As on the canvas: React Flow moves the dragged node, the physics the rest.
    const y0 = nodes.b.y
    layout.grab('b', nodes.b.x, nodes.b.y)
    for (let i = 1; i <= 10; i++) {
      nodes.b.y = y0 + 40 * i
      layout.drag('b', nodes.b.x, nodes.b.y)
      await wait(20)
    }
    layout.release('b')
    await wait(300)
    layout.stop()
    expect(centreY(nodes.b)).toBeCloseTo(y0 + 400 + nodes.b.height / 2)
    expect(spread()).toBeLessThanOrEqual(1)
  })

  it('keeps an ordered row in order when a member is dragged past the next one', async () => {
    const nodes: Record<string, C4Node> = {
      a: node('a', 'system', { x: 0, y: 0 }),
      b: node('b', 'system', { x: 500, y: 0 }),
      c: node('c', 'system', { x: 1000, y: 0 }),
    }
    const layout = run(nodes, {}, [{ axis: 'y', ids: ['a', 'b', 'c'], orders: [['a', 'b', 'c']] }])
    layout.start(true)
    await wait(200)
    // Drag a far to the right, past b and c.
    const x0 = nodes.a.x
    layout.grab('a', nodes.a.x, nodes.a.y)
    for (let i = 1; i <= 15; i++) {
      nodes.a.x = x0 + 100 * i
      layout.drag('a', nodes.a.x, nodes.a.y)
      await wait(20)
    }
    layout.release('a')
    await wait(300)
    layout.stop()
    const cx = (id: string): number => nodes[id].x + nodes[id].width / 2
    expect(cx('a')).toBeLessThan(cx('b'))
    expect(cx('b')).toBeLessThan(cx('c'))
  })

  it('does not drift a column after one of its containers is expanded', async () => {
    // From a 490-node model: a column of groups, one expanded. Each WebCoLa
    // step pushed the members across the line and the alignment pulled them
    // back to their mean, so the whole column crept away and never stopped.
    // A large model (local physics) makes it show within a second.
    const nodes: Record<string, C4Node> = {}
    const relations: Record<string, C4Relation> = {}
    const add = (n: C4Node): void => { nodes[n.id] = n }
    const rel = (id: string, sourceId: string, targetId: string): void => { relations[id] = { id, sourceId, targetId } as C4Relation }
    for (let i = 0; i < 160; i++) add(node(`f${i}`, 'container', { x: 4000 + (i % 16) * 320, y: Math.floor(i / 16) * 220 }))
    for (let i = 1; i < 160; i++) rel(`fr${i}`, `f${i - 1}`, `f${i}`)
    add(node('dec', 'group', { x: 300, y: -500, collapsed: true, width: 360, height: 220 }))
    for (let i = 0; i < 4; i++) add(node(`dc${i}`, 'container', { parentId: 'dec', x: 30 + i * 260, y: 120 }))
    add(node('log', 'group', { x: 0, y: 0, width: 1200, height: 900 }))
    for (let i = 0; i < 10; i++) add(node(`l${i}`, 'container', { parentId: 'log', x: 30 + (i % 4) * 280, y: 120 + Math.floor(i / 4) * 220 }))
    add(node('con', 'group', { x: 300, y: 1100, collapsed: true, width: 360, height: 220 }))
    for (let i = 0; i < 8; i++) add(node(`c${i}`, 'container', { parentId: 'con', x: 30 + (i % 4) * 280, y: 120 + Math.floor(i / 4) * 220 }))
    for (let i = 0; i < 8; i++) rel(`cr${i}`, `c${i}`, `l${i}`)
    for (let i = 0; i < 4; i++) rel(`dr${i}`, `dc${i}`, `l${i + 3}`)
    rel('x1', 'l9', 'f0')
    const shown = (): Record<string, C4Node> =>
      Object.fromEntries(Object.entries(nodes).filter(([, n]) => !n.parentId || !nodes[n.parentId].collapsed))
    const layout = new LiveColaLayout({
      getModel: () => ({ nodes: shown(), relations, alignments: [{ axis: 'x', ids: ['dec', 'log', 'con'], orders: [['dec', 'log', 'con']] }] }),
      applyPositions: (positions) => {
        for (const [id, pos] of Object.entries(positions)) {
          const n = nodes[id]
          n.x = pos.x
          n.y = pos.y
          if (pos.width != null) n.width = pos.width
          if (pos.height != null) n.height = pos.height
        }
      },
    })
    const cx = (id: string): number => nodes[id].x + nodes[id].width / 2
    layout.start(true)
    await wait(300)
    nodes.con.collapsed = false
    layout.invalidate()
    await wait(500)
    const line = cx('con')
    await wait(1500)
    layout.stop()
    expect(Math.abs(cx('con') - line)).toBeLessThanOrEqual(1)
    expect(Math.abs(cx('dec') - cx('log'))).toBeLessThanOrEqual(1)
    expect(Math.abs(cx('con') - cx('log'))).toBeLessThanOrEqual(1)
  })

  // From the repo's own architecture model: a column of groups, the first
  // holding a grid of groups. Expanding one of those on a large model left
  // the canvas shaking for good, the groups flipping between two places
  // thousands of pixels apart. Both mechanisms are checked on the engine.
  describe('alignments nested in an aligned container', () => {
    const nested = (g1Children = 3): Record<string, C4Node> => {
      // Children first: a local neighbourhood then fills up with g1's
      // children before it reaches top, as it does on the real model.
      const nodes: Record<string, C4Node> = {}
      for (const [g, count] of [['g1', g1Children], ['g2', 3]] as const) {
        for (let i = 0; i < count; i++) nodes[`${g}c${i}`] = node(`${g}c${i}`, 'container', { parentId: g, x: 30 + (i % 3) * 280, y: 120 + Math.floor(i / 3) * 200 })
      }
      return {
        ...nodes,
        g1: node('g1', 'group', { parentId: 'top', x: 60, y: 120, width: 900, height: 400 }),
        g2: node('g2', 'group', { parentId: 'top', x: 1100, y: 120, width: 900, height: 400 }),
        top: node('top', 'group', { x: 0, y: 0, width: 2400, height: 1000 }),
        side: node('side', 'system', { x: 2500, y: 1600 }),
      }
    }
    const alignments: Alignment[] = [
      { axis: 'x', ids: ['top', 'side'], orders: [['top', 'side']] },
      { axis: 'y', ids: ['g1', 'g2'], orders: [['g1', 'g2']] },
    ]
    /** The engine's internals these tests look at. */
    interface Internals {
      start(skipBulk: boolean): void
      stop(): void
      groupAlignments: Array<{ axis: 'x' | 'y'; members: Array<{ id: string }>; line?: number }>
      colaNodes: Array<{ c4id: string; fixed?: number }>
      shiftMember(m: { id: string }, axis: 'x' | 'y', d: number): void
      projectGroupAlignments(): void
      freezeAllBut(...ids: string[]): void
    }
    const engine = (nodes: Record<string, C4Node>): Internals =>
      new LiveColaEngine({ getModel: () => ({ nodes, relations: {}, alignments }), applyPositions: () => {} }) as unknown as Internals

    it('moves the lines inside a container with it', () => {
      const e = engine(nested())
      e.start(true)
      e.stop()
      e.projectGroupAlignments()
      const row = e.groupAlignments.find((a) => a.axis === 'y')!
      const column = e.groupAlignments.find((a) => a.axis === 'x')!
      const before = row.line!
      // The outer column moves the container down: the row inside follows.
      e.shiftMember(column.members.find((m) => m.id === 'top')!, 'y', 500)
      expect(row.line).toBeCloseTo(before + 500)
      // Outer lines project first, so the row is not pulled back first.
      expect(e.groupAlignments.indexOf(column)).toBeLessThan(e.groupAlignments.indexOf(row))
    })

    it('frees the partners of a container a moving element is inside', () => {
      // More children than a local neighbourhood holds: top is not in g1c0's.
      const e = engine(nested(45))
      e.start(true)
      e.stop()
      // g1c0 moves (shown by an expand, dragged): g1 and top move with it,
      // so top's column partner side follows, as do g1's row partner g2 and
      // its leaves.
      e.freezeAllBut('g1c0')
      const frozen = new Set(e.colaNodes.filter((n) => ((n.fixed ?? 0) & 8) !== 0).map((n) => n.c4id))
      for (const id of ['g2c0', 'g2c1', 'g2c2', 'side']) expect(frozen.has(id)).toBe(false)
    })
  })

  it('holds a column of expanded containers', async () => {
    const nodes: Record<string, C4Node> = {
      s1: node('s1', 'system', { x: 0, y: 0, width: 600, height: 400 }),
      a: node('a', 'container', { parentId: 's1', x: 30, y: 120 }),
      s2: node('s2', 'system', { x: 900, y: 600, width: 600, height: 400 }),
      b: node('b', 'container', { parentId: 's2', x: 30, y: 120 }),
    }
    const relations: Record<string, C4Relation> = { r1: { id: 'r1', sourceId: 'a', targetId: 'b' } as C4Relation }
    const layout = run(nodes, relations, [{ axis: 'x', ids: ['s1', 's2'], orders: [] }])
    layout.start(true)
    await wait(400)
    layout.stop()
    const cx = (id: string): number => nodes[id].x + nodes[id].width / 2
    expect(Math.abs(cx('s1') - cx('s2'))).toBeLessThanOrEqual(1)
  })
})
