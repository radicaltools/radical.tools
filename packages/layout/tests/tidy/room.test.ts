/**
 * Moves that make room, and a frame turned over: where a spot is taken,
 * the siblings in the way give way along the row or the column (a slot
 * opened, as a person opens one), and a frame's contents are mirrored so
 * the elements with lines out of it stand on the side those lines leave by.
 */
import { describe, it, expect } from 'vitest'
import { runTidyLayout } from '../../src/tidy'
import { Layout } from '../../src/tidy/layout'
import { linesOf } from '../../src/tidy/cost'
import { candidateMoves } from '../../src/tidy/moves'
import { NODE_SIZES, type C4Node, type C4Relation } from '@radical/common/c4'

function node(id: string, type: string, x: number, y: number, parentId?: string): C4Node {
  return { id, type: type as C4Node['type'], label: id, collapsed: false, x, y, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...(parentId ? { parentId } : {}) } as C4Node
}
const rel = (sourceId: string, targetId: string): C4Relation => ({ id: `${sourceId}-${targetId}`, sourceId, targetId, relationType: 'interacts' })
const byId = <T extends { id: string }>(xs: T[]): Record<string, T> => Object.fromEntries(xs.map((x) => [x.id, x]))

function setup(nodes: C4Node[], relations: C4Relation[], pinned: string[] = []) {
  const l = new Layout(byId(nodes), null, pinned)
  const lines = linesOf(l, byId(relations))
  const moves = candidateMoves(l, byId(nodes), byId(relations), lines)
  const clearOfAll = (): boolean => l.ids().every((id) => l.clear(id))
  return { l, moves, clearOfAll }
}

// `top` far over a row of three (so the short way to a straight line is sideways): `left`, `mid`, `right`, a system's width and the gap apart. `far` has
// a line to `top` and stands at the row's end: the spot under `top` is `mid`'s.
const W = NODE_SIZES.system.width, H = NODE_SIZES.system.height
const row = (): C4Node[] => [
  node('top', 'system', W + 40, -1500),
  node('left', 'system', 0, H + 100), node('mid', 'system', W + 40, H + 100), node('right', 'system', 2 * (W + 40), H + 100),
  node('far', 'system', 3 * (W + 40), H + 100),
]
const rowLines = (): C4Relation[] => [rel('top', 'far'), rel('left', 'mid'), rel('mid', 'right')]

describe('Tidy makes room', () => {
  it('an element slid into a taken spot shifts the siblings in its way along the row', () => {
    const { l, moves, clearOfAll } = setup(row(), rowLines())
    const room = moves.find((m) => m.kind === 'align' && m.ids[0] === 'far' && m.variant === 'x:room-x')!
    expect(room, 'a make-room variant of the align move, the spot under top being taken').toBeDefined()
    expect(room.wide).toBe(true)
    const was = { mid: l.box('mid')!.x, right: l.box('right')!.x, left: l.box('left')!.x }
    expect(room.apply(l)).toBe(true)
    // far stands under top, in the row; mid and what it then stood too close to gave way, left stayed.
    expect(Math.abs(l.box('far')!.cx - l.box('top')!.cx)).toBeLessThan(1)
    expect(l.box('far')!.cy).toBe(l.box('mid')!.cy)
    expect(l.box('mid')!.x).not.toBe(was.mid)
    expect(l.box('left')!.x === was.left || l.box('right')!.x === was.right).toBe(true)
    expect(clearOfAll()).toBe(true)
  })

  it('or along the column', () => {
    const { l, moves, clearOfAll } = setup(row(), rowLines())
    const room = moves.find((m) => m.kind === 'align' && m.ids[0] === 'far' && m.variant === 'x:room-y')!
    const was = l.box('mid')!
    expect(room.apply(l)).toBe(true)
    expect(Math.abs(l.box('far')!.cx - l.box('top')!.cx)).toBeLessThan(1)
    expect(l.box('mid')!.x).toBe(was.x)
    expect(l.box('mid')!.y).not.toBe(was.y)
    expect(clearOfAll()).toBe(true)
  })

  it('a pinned element does not give way', () => {
    const { l, moves } = setup(row(), rowLines(), ['mid'])
    const was = l.positions()
    for (const m of moves.filter((m) => m.kind === 'align' && m.ids[0] === 'far' && m.wide)) {
      expect(m.apply(l)).toBe(false)
      l.setPositions(was)
    }
  })

  it('no room is made where the spot is free', () => {
    const nodes = row().filter((n) => n.id !== 'mid')
    const { moves } = setup(nodes, [rel('top', 'far'), rel('left', 'right')])
    expect(moves.some((m) => m.kind === 'align' && m.ids[0] === 'far' && m.wide)).toBe(false)
  })

  it('at most six siblings give way to one move', () => {
    // A row of nine, tight: sliding one in at its start would shift eight.
    const nodes = [node('top', 'system', 0, -5000), ...Array.from({ length: 9 }, (_, i) => node(`r${i}`, 'system', i * (W + 40), H + 100)), node('far', 'system', 9 * (W + 40), H + 100)]
    const relations = [rel('top', 'far'), ...Array.from({ length: 8 }, (_, i) => rel(`r${i}`, `r${i + 1}`))]
    const { l, moves } = setup(nodes, relations)
    const room = moves.find((m) => m.kind === 'align' && m.ids[0] === 'far' && m.variant === 'x:room-x')!
    expect(room.apply(l)).toBe(false)
  })
})

describe('Tidy turns a frame over', () => {
  // A system holding `a` (left) and `b` (right); `out` stands left of it with a line to `b`.
  const nodes = (): C4Node[] => [
    node('out', 'system', 0, 150),
    node('sys', 'system', 500, 0),
    node('a', 'container', 40, 120, 'sys'), node('b', 'container', 40 + NODE_SIZES.container.width + 20, 120, 'sys'),
  ]
  const relations = (): C4Relation[] => [rel('out', 'b'), rel('a', 'b')]

  it('left to right: its children mirrored, the frame where and as large as it was', () => {
    const { l, moves, clearOfAll } = setup(nodes(), relations())
    const flip = moves.find((m) => m.kind === 'flip' && m.ids[0] === 'sys' && m.variant === 'x')!
    expect(flip).toBeDefined()
    const frame = { ...l.box('sys')! }, a = { ...l.box('a')! }, b = { ...l.box('b')! }
    expect(flip.apply(l)).toBe(true)
    expect(l.box('sys')).toEqual(frame)
    expect(l.box('b')!.x).toBe(a.x)
    expect(l.box('a')!.x + l.box('a')!.w).toBe(b.x + b.w)
    expect(clearOfAll()).toBe(true)
  })

  it('tidying turns the frame so the line out of it leaves by the near side', () => {
    const { winner, tidy } = runTidyLayout(byId(nodes()), byId(relations()), { metamodel: null })
    expect(tidy.steps.some((s) => s.kind === 'flip')).toBe(true)
    expect(winner.positions.b.x).toBeLessThan(winner.positions.a.x)
  })

  it('a frame with no line out of it, or holding a pinned element, is not turned', () => {
    expect(setup(nodes(), [rel('a', 'b')]).moves.some((m) => m.kind === 'flip')).toBe(false)
    expect(setup(nodes(), relations(), ['a']).moves.some((m) => m.kind === 'flip')).toBe(false)
  })
})
