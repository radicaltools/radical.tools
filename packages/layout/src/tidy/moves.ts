/**
 * The moves a person makes when tidying a diagram, each a candidate the
 * tidier tries: pulling an element out beside what it belongs to, putting
 * an actor above what it uses and an outside system at the edge, swapping
 * two neighbours, sliding an element until a line runs straight, centring
 * it over what it relates to. Each returns the elements it moved; the
 * tidier keeps it when the reader's cost fell and takes it back otherwise.
 * What an element is (an actor, a store, a start) and which way a line
 * reads come from the metamodel (layoutHints.ts), through the Layout.
 */
import type { C4Node, C4Relation } from '@radical/common/c4'
import { COMFORT, type Line, STRAIGHT_TOLERANCE, againstFlow, anchorOf, kinApartOf, nearMissesOf, segmentHitsRect } from './cost'
import type { Layout } from './layout'

export interface Move {
  kind: 'rough' | 'untangle' | 'gather' | 'pull-out' | 'actor-up' | 'end-down' | 'external-out' | 'between' | 'swap' | 'align' | 'balance' | 'closer' | 'row' | 'flow' | 'follow' | 'even' | 'order' | 'snap' | 'kin' | 'clear'
  ids: string[]
  description: string
  /** Tells apart moves of one kind on the same elements with the same description (the two axes of a slide). */
  variant?: string
  /** Does it; false when it cannot be done (no room). */
  apply(l: Layout): boolean
}

/** The lines `id` is an end of, as the elements at the other end (indexed once per set of lines). */
const neighbourIndex = new WeakMap<Line[], Map<string, string[]>>()
function neighbours(id: string, lines: Line[]): string[] {
  let index = neighbourIndex.get(lines)
  if (!index) {
    index = new Map()
    for (const x of lines) {
      index.set(x.a, [...(index.get(x.a) ?? []), x.b])
      index.set(x.b, [...(index.get(x.b) ?? []), x.a])
    }
    neighbourIndex.set(lines, index)
  }
  return index.get(id) ?? []
}

/** A free place for `id` nearest `(cx, cy)`, searched outward in rings
 *  (tested against the siblings' boxes, nothing moved until one fits);
 *  false when none within reach. */
function placeNear(l: Layout, id: string, cx: number, cy: number): boolean {
  const b = l.box(id)!
  const parent = l.parentOf(id)
  const gap = l.gapOf(parent)
  const others = l.childrenOf(parent).filter((o) => o !== id).map((o) => l.box(o)!)
  const fits = (x: number, y: number): boolean => others.every((r) => x + b.w + gap <= r.x || r.x + r.w + gap <= x || y + b.h + gap <= r.y || r.y + r.h + gap <= y)
  const step = Math.max(40, Math.round(gap + b.h / 2))
  for (let ring = 0; ring <= 10; ring++) {
    const spots: { x: number; y: number }[] = []
    if (ring === 0) spots.push({ x: cx - b.w / 2, y: cy - b.h / 2 })
    else {
      for (let i = -ring; i <= ring; i++) {
        spots.push({ x: cx - b.w / 2 + i * step, y: cy - b.h / 2 - ring * step }, { x: cx - b.w / 2 + i * step, y: cy - b.h / 2 + ring * step })
        if (Math.abs(i) < ring) spots.push({ x: cx - b.w / 2 - ring * step, y: cy - b.h / 2 + i * step }, { x: cx - b.w / 2 + ring * step, y: cy - b.h / 2 + i * step })
      }
    }
    for (const sp of spots) {
      if (!fits(sp.x, sp.y)) continue
      l.moveTo(id, sp.x, sp.y)
      if (l.allClear([id])) return true
    }
  }
  return false
}

function ancestorsOf(l: Layout, id: string): string[] {
  const out: string[] = []
  for (let p = l.parentOf(id); p; p = l.parentOf(p)) out.push(p)
  return out
}

/** The satellites of `id`: siblings with one line, to `id`, standing right
 *  beside it (a database at its container, an ADR at its system). They go
 *  where it goes. */
function satellitesOf(l: Layout, id: string, lines: Line[]): string[] {
  const b = l.box(id)!
  const gap = l.gapOf(l.parentOf(id))
  return l.childrenOf(l.parentOf(id)).filter((o) => {
    if (o === id) return false
    const ns = neighbours(o, lines)
    if (ns.length !== 1 || !(ns[0] === id || l.holds(id, ns[0]))) return false
    const r = l.box(o)!
    const dx = Math.max(0, r.x - (b.x + b.w), b.x - (r.x + r.w)), dy = Math.max(0, r.y - (b.y + b.h), b.y - (r.y + r.h))
    return Math.hypot(dx, dy) <= gap + 1
  })
}

/** `id` with its satellites (those not pinned) moved by (dx, dy). */
function slide(l: Layout, id: string, dx: number, dy: number, lines: Line[]): string[] {
  const group = [id, ...satellitesOf(l, id, lines).filter((s) => !l.fixed(s))]
  for (const g of group) l.moveBy(g, dx, dy)
  return group
}

/** `id` with its satellites slid by `delta` along `axis` into line with
 *  something; when the spot is taken, on along the other axis to the
 *  nearest place clear of what stands there, as a person moves an element
 *  into line and then just past the one in the way: never past `partner`,
 *  what it is put in line with, which would turn the line round. */
function slideInto(l: Layout, id: string, axis: 'x' | 'y', delta: number, lines: Line[], partner: string): boolean {
  const group = axis === 'x' ? slide(l, id, delta, 0, lines) : slide(l, id, 0, delta, lines)
  if (l.allClear(group)) return true
  const parent = l.parentOf(id)
  const gap = l.gapOf(parent)
  const along = axis === 'x' ? 'y' : 'x'
  const by = (d: number) => { for (const g of group) along === 'x' ? l.moveBy(g, d, 0) : l.moveBy(g, 0, d) }
  const span = (): [number, number] => {
    const bs = group.map((g) => l.box(g)!)
    return along === 'x' ? [Math.min(...bs.map((b) => b.x)), Math.max(...bs.map((b) => b.x + b.w))] : [Math.min(...bs.map((b) => b.y)), Math.max(...bs.map((b) => b.y + b.h))]
  }
  // Just before or just past each sibling in the way, and a few steps either side.
  const offsets = new Set<number>()
  const [s0, s1] = span()
  for (const o of l.childrenOf(parent)) {
    if (group.includes(o)) continue
    const r = l.box(o)!
    const hit = group.some((g) => { const b = l.box(g)!; return b.x < r.x + r.w + gap && r.x < b.x + b.w + gap && b.y < r.y + r.h + gap && r.y < b.y + b.h + gap })
    if (!hit) continue
    const [r0, r1] = along === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.h]
    offsets.add(r0 - gap - 1 - s1)
    offsets.add(r1 + gap + 1 - s0)
  }
  const step = gap + COMFORT * l.meanSize
  for (let k = 1; k <= 3; k++) { offsets.add(k * step); offsets.add(-k * step) }
  const centre = (x: string) => along === 'x' ? l.box(x)!.cx : l.box(x)!.cy
  const side = Math.sign(centre(id) - centre(partner))
  let at = 0
  for (const d of [...offsets].sort((p, q) => Math.abs(p) - Math.abs(q)).slice(0, 12)) {
    if (Math.abs(d) > 3 * l.meanSize) continue
    if (side && Math.sign(centre(id) + d - at - centre(partner)) !== side) continue
    by(d - at)
    at = d
    if (l.allClear(group)) return true
  }
  by(-at)
  return false
}

/** How far `id` slides along `axis` to stand in line with `o`: middle to
 *  middle, or for a frame edge to edge when that is the nearer. */
function lineUpDelta(l: Layout, id: string, o: string, axis: 'x' | 'y'): number {
  const p = l.box(id)!, q = l.box(o)!
  const mid = axis === 'x' ? q.cx - p.cx : q.cy - p.cy
  if (!l.isFrame(id) && !l.isFrame(o)) return mid
  const edge = axis === 'x' ? q.x - p.x : q.y - p.y
  return Math.abs(edge) < Math.abs(mid) ? edge : mid
}

/** Whether `id` with its satellites, slid by `delta` along `axis`, would stand clear of its siblings. */
function spotFree(l: Layout, id: string, axis: 'x' | 'y', delta: number, lines: Line[]): boolean {
  const group = [id, ...satellitesOf(l, id, lines).filter((s) => !l.fixed(s))]
  const gap = l.gapOf(l.parentOf(id))
  const dx = axis === 'x' ? delta : 0, dy = axis === 'y' ? delta : 0
  return l.childrenOf(l.parentOf(id)).every((o) => {
    if (group.includes(o)) return true
    const r = l.box(o)!
    return group.every((g) => {
      const b = l.box(g)!
      return !(b.x + dx < r.x + r.w + gap && r.x < b.x + dx + b.w + gap && b.y + dy < r.y + r.h + gap && r.y < b.y + dy + b.h + gap)
    })
  })
}

/** Whether `id` already stands beside `anchor` on `side`, touching by the gap. */
function besideOn(l: Layout, id: string, anchor: string, side: 'left' | 'right'): boolean {
  const a = l.box(anchor)!, b = l.box(id)!
  const gap = l.gapOf(l.parentOf(id))
  const rowed = Math.abs(a.cy - b.cy) < STRAIGHT_TOLERANCE
  const near = side === 'right' ? Math.abs(b.x - (a.x + a.w + gap)) < 1 : Math.abs(a.x - (b.x + b.w + gap)) < 1
  return rowed && near
}

/**
 * Elements on top of each other pulled apart first: each one that lies on
 * a sibling goes to the nearest free place. Nothing else can be judged
 * while boxes overlap (no move may leave two siblings on each other).
 */
export function untangleMoves(l: Layout, nodes: Record<string, C4Node>): Move[] {
  const moves: Move[] = []
  for (const id of l.ids()) {
    if (l.fixed(id) || l.clear(id)) continue
    moves.push({
      kind: 'untangle', ids: [id],
      description: `${nodes[id].label || id} off what it lay on`,
      apply: (lay) => {
        if (lay.clear(id)) return false
        const b = lay.box(id)!
        return placeNear(lay, id, b.cx, b.cy)
      },
    })
  }
  return moves
}

/**
 * Loose elements (no relation at all, nor any inside them) swept into a
 * column at the left margin of their container, top to bottom: what a
 * person does first, to see the diagram for what is related.
 */
export function gatherMoves(l: Layout, nodes: Record<string, C4Node>, lines: Line[]): Move[] {
  const linked = new Set<string>()
  for (const x of lines) for (const end of [x.a, x.b]) { linked.add(end); for (let p = l.parentOf(end); p; p = l.parentOf(p)) linked.add(p) }
  const moves: Move[] = []
  const byParent = new Map<string | undefined, string[]>()
  for (const id of l.ids()) byParent.set(l.parentOf(id), [...(byParent.get(l.parentOf(id)) ?? []), id])
  const byName = (a: string, b: string): number => (nodes[a].label || a).localeCompare(nodes[b].label || b) || a.localeCompare(b)
  for (const [parent, siblings] of byParent) {
    const loose = siblings.filter((id) => !linked.has(id) && !l.fixed(id))
    const rest = siblings.filter((id) => linked.has(id) || l.fixed(id))
    if (!loose.length || !rest.length) continue
    const gap = l.gapOf(parent)
    // A column per type, by name, in the order the types first appear; more
    // than eight of a type wrap into further columns.
    const types = [...new Set(loose.map((id) => nodes[id].type))].sort()
    const columns: string[][] = []
    for (const t of types) {
      const ofType = loose.filter((id) => nodes[id].type === t).sort(byName)
      const n = Math.ceil(ofType.length / 8), per = Math.ceil(ofType.length / n)
      for (let i = 0; i < ofType.length; i += per) columns.push(ofType.slice(i, i + per))
    }
    moves.push({
      kind: 'gather', ids: loose,
      description: `${loose.map((id) => nodes[id].label || id).join(', ')} without relations, into the margin`,
      apply: (lay) => {
        const left = Math.min(...rest.map((id) => lay.box(id)!.x))
        const top = Math.min(...rest.map((id) => lay.box(id)!.y))
        const widths = columns.map((col) => Math.max(...col.map((id) => lay.box(id)!.w)))
        let x = left - gap - widths.reduce((s, w) => s + w, 0) - gap * (columns.length - 1)
        columns.forEach((col, i) => {
          let y = top
          for (const id of col) {
            const b = lay.box(id)!
            lay.moveTo(id, x + (widths[i] - b.w) / 2, y)
            y += b.h + gap
          }
          x += widths[i] + gap
        })
        return lay.allClear(loose)
      },
    })
  }
  return moves
}

/**
 * The last pass: every container's children drawn in towards its middle,
 * the farthest first, as far as the comfortable distance from the others
 * allows. A person does this at the end, to close the room the moves left.
 */
export function compactMoves(l: Layout, nodes: Record<string, C4Node>, lines: Line[]): Move[] {
  const moves: Move[] = []
  const linked = new Set<string>()
  for (const x of lines) for (const end of [x.a, x.b]) { linked.add(end); for (let p = l.parentOf(end); p; p = l.parentOf(p)) linked.add(p) }
  const byParent = new Map<string | undefined, string[]>()
  for (const id of l.ids()) byParent.set(l.parentOf(id), [...(byParent.get(l.parentOf(id)) ?? []), id])
  for (const siblings of byParent.values()) {
    // Satellites go with their anchors.
    const satellites = new Set(siblings.flatMap((o) => satellitesOf(l, o, lines)))
    const movers = siblings.filter((id) => linked.has(id) && !l.fixed(id) && !satellites.has(id))
    if (movers.length < 2) continue
    const cx = movers.reduce((s, id) => s + l.box(id)!.cx, 0) / movers.length
    const cy = movers.reduce((s, id) => s + l.box(id)!.cy, 0) / movers.length
    const far = [...movers].sort((a, b) => Math.hypot(l.box(b)!.cx - cx, l.box(b)!.cy - cy) - Math.hypot(l.box(a)!.cx - cx, l.box(a)!.cy - cy))
    for (const id of far) {
      for (const axis of ['x', 'y'] as const) {
        moves.push({
          kind: 'closer', ids: [id], variant: axis,
          description: `${nodes[id].label || id} drawn in`,
          apply: (lay) => slideTowards(lay, id, axis, axis === 'x' ? cx : cy, lines),
        })
      }
    }
  }
  return moves
}

/** `id` slid along `axis` towards coordinate `to`, up to the comfortable
 *  distance from whatever stands in the way; false when it cannot move. */
function slideTowards(lay: Layout, id: string, axis: 'x' | 'y', to: number, lines: Line[]): boolean {
  const me = lay.box(id)!
  const goal = axis === 'x' ? to - me.cx : to - me.cy
  const sats = satellitesOf(lay, id, lines)
  const group = [id, ...sats]
  const comfort = lay.gapOf(lay.parentOf(id)) + COMFORT * lay.meanSize
  const sign = Math.sign(goal)
  let free = Math.abs(goal)
  for (const g of group) {
    const gb = lay.box(g)!
    for (const o of lay.childrenOf(lay.parentOf(id))) {
      if (group.includes(o)) continue
      const r = lay.box(o)!
      if (axis === 'x') {
        if (r.y >= gb.y + gb.h + comfort || gb.y >= r.y + r.h + comfort) continue
        const d = sign > 0 ? r.x - (gb.x + gb.w) : gb.x - (r.x + r.w)
        if (d >= 0) free = Math.min(free, d - comfort)
      } else {
        if (r.x >= gb.x + gb.w + comfort || gb.x >= r.x + r.w + comfort) continue
        const d = sign > 0 ? r.y - (gb.y + gb.h) : gb.y - (r.y + r.h)
        if (d >= 0) free = Math.min(free, d - comfort)
      }
    }
  }
  if (free < 4) return false
  const moved = axis === 'x' ? slide(lay, id, sign * free, 0, lines) : slide(lay, id, 0, sign * free, lines)
  return lay.allClear(moved)
}

/** `only`: candidates for these elements alone (the ones the last move touched); none: for all. */
export function candidateMoves(l: Layout, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, lines: Line[], only?: ReadonlySet<string>): Move[] {
  const moves: Move[] = []
  const label = (id: string) => nodes[id].label || id
  const concerns = (ids: readonly string[]): boolean => !only || ids.some((id) => only.has(id))

  for (const id of l.ids()) {
    if (l.fixed(id) || !concerns([id])) continue
    const role = l.role(id)
    const ns = neighbours(id, lines)
    const own = lines.filter((x) => x.a === id || x.b === id)

    // Midway between its two neighbours in its row (or column): even spacing.
    {
      const b = l.box(id)!
      for (const axis of ['x', 'y'] as const) {
        let before: string | undefined, after: string | undefined
        for (const o of l.childrenOf(l.parentOf(id))) {
          if (o === id) continue
          const r = l.box(o)!
          if (axis === 'x') {
            if (Math.abs(r.cy - b.cy) >= STRAIGHT_TOLERANCE) continue
            if (r.x + r.w <= b.x && (!before || r.x + r.w > l.box(before)!.x + l.box(before)!.w)) before = o
            else if (r.x >= b.x + b.w && (!after || r.x < l.box(after)!.x)) after = o
          } else {
            if (Math.abs(r.cx - b.cx) >= STRAIGHT_TOLERANCE) continue
            if (r.y + r.h <= b.y && (!before || r.y + r.h > l.box(before)!.y + l.box(before)!.h)) before = o
            else if (r.y >= b.y + b.h && (!after || r.y < l.box(after)!.y)) after = o
          }
        }
        if (!before || !after) continue
        const p = l.box(before)!, q = l.box(after)!
        const g1 = axis === 'x' ? b.x - (p.x + p.w) : b.y - (p.y + p.h), g2 = axis === 'x' ? q.x - (b.x + b.w) : q.y - (b.y + b.h)
        if (Math.abs(g1 - g2) < 2) continue
        const d = (g2 - g1) / 2
        moves.push({
          kind: 'even', ids: [id], variant: axis,
          description: `${label(id)} midway between ${label(before)} and ${label(after)}`,
          apply: (lay) => lay.allClear(axis === 'x' ? slide(lay, id, d, 0, lines) : slide(lay, id, 0, d, lines)),
        })
      }
    }

    // A store with one user, or a note with one relation, beside it.
    const anchor = anchorOf(l, id, own)
    if (anchor) {
      const side: 'left' | 'right' = role === 'store' ? 'right' : 'left'
      if (!besideOn(l, id, anchor, side)) {
        moves.push({
          kind: 'pull-out', ids: [id],
          description: `${label(id)} beside ${label(anchor)}, on its ${side}`,
          apply: (lay) => {
            const a = lay.box(anchor)!, b = lay.box(id)!, gap = lay.gapOf(lay.parentOf(id))
            const x = side === 'right' ? a.x + a.w + gap : a.x - gap - b.w
            lay.moveTo(id, x, a.cy - b.h / 2)
            // Something in the way: the nearest free place to it.
            return lay.allClear([id]) || placeNear(lay, id, x + b.w / 2, a.cy)
          },
        })
      }
    }

    // An actor above what it uses, a start above what it leads to, centred over it.
    if ((role === 'actor' || role === 'start') && ns.length) {
      const above = ns.every((n) => l.box(n)!.y >= l.box(id)!.y + l.box(id)!.h)
      const mx = ns.reduce((s, n) => s + l.box(n)!.cx, 0) / ns.length
      if (!above || Math.abs(mx - l.box(id)!.cx) > STRAIGHT_TOLERANCE) {
        moves.push({
          kind: 'actor-up', ids: [id],
          description: `${label(id)} above ${ns.map(label).join(', ')}`,
          apply: (lay) => {
            const b = lay.box(id)!
            const top = Math.min(...ns.map((n) => lay.box(n)!.y))
            const gap = lay.gapOf(lay.parentOf(id))
            lay.moveTo(id, mx - b.w / 2, top - gap - b.h)
            return lay.allClear([id]) || placeNear(lay, id, mx, top - gap - b.h / 2)
          },
        })
      }
    }

    // An end below what leads to it, centred under it.
    if (role === 'end' && ns.length) {
      const below = ns.every((n) => l.box(n)!.y + l.box(n)!.h <= l.box(id)!.y)
      const mx = ns.reduce((s, n) => s + l.box(n)!.cx, 0) / ns.length
      if (!below || Math.abs(mx - l.box(id)!.cx) > STRAIGHT_TOLERANCE) {
        moves.push({
          kind: 'end-down', ids: [id],
          description: `${label(id)} below ${ns.map(label).join(', ')}`,
          apply: (lay) => {
            const b = lay.box(id)!
            const bottom = Math.max(...ns.map((n) => lay.box(n)!.y + lay.box(n)!.h))
            const gap = lay.gapOf(lay.parentOf(id))
            lay.moveTo(id, mx - b.w / 2, bottom + gap)
            return lay.allClear([id]) || placeNear(lay, id, mx, bottom + gap + b.h / 2)
          },
        })
      }
    }

    // A broker between the two sides it joins, on the line between them.
    if (role === 'broker' && ns.length === 2) {
      const p = l.box(ns[0])!, q = l.box(ns[1])!, b = l.box(id)!
      const mx = (p.cx + q.cx) / 2, my = (p.cy + q.cy) / 2
      if (Math.hypot(b.cx - mx, b.cy - my) > STRAIGHT_TOLERANCE) {
        moves.push({
          kind: 'between', ids: [id],
          description: `${label(id)} between ${label(ns[0])} and ${label(ns[1])}`,
          apply: (lay) => {
            const me = lay.box(id)!
            lay.moveTo(id, mx - me.w / 2, my - me.h / 2)
            return lay.allClear([id]) || placeNear(lay, id, mx, my)
          },
        })
      }
    }

    // An outside system below what calls it, or right of it.
    if (role === 'element' && nodes[id].external && ns.length && !l.parentOf(id)) {
      const callers = ns
      const below = callers.every((n) => l.box(n)!.y + l.box(n)!.h <= l.box(id)!.y)
      const right = callers.every((n) => l.box(n)!.x + l.box(n)!.w <= l.box(id)!.x)
      if (!below && !right) {
        const mx = callers.reduce((s, n) => s + l.box(n)!.cx, 0) / callers.length
        const my = callers.reduce((s, n) => s + l.box(n)!.cy, 0) / callers.length
        moves.push({
          kind: 'external-out', ids: [id],
          description: `${label(id)} out of the way, below ${callers.map(label).join(', ')}`,
          apply: (lay) => {
            const b = lay.box(id)!, gap = lay.gapOf(undefined)
            const bottom = Math.max(...callers.map((n) => lay.box(n)!.y + lay.box(n)!.h))
            lay.moveTo(id, mx - b.w / 2, bottom + gap)
            if (lay.allClear([id])) return true
            const rightEdge = Math.max(...callers.map((n) => lay.box(n)!.x + lay.box(n)!.w))
            lay.moveTo(id, rightEdge + gap, my - b.h / 2)
            return lay.allClear([id]) || placeNear(lay, id, mx, bottom + gap + b.h / 2)
          },
        })
      }
    }

    // Slid along its row or column until a line runs straight: the way
    // the line reads (under for a vertical flow, level for a horizontal one
    // or a side relation), and the shorter way when that differs.
    for (const x of own) {
      const n = x.a === id ? x.b : x.a
      const a = l.box(id)!, b = l.box(n)!
      const dx = Math.abs(a.cx - b.cx), dy = Math.abs(a.cy - b.cy)
      if (dx < STRAIGHT_TOLERANCE || dy < STRAIGHT_TOLERANCE) continue
      const short: 'x' | 'y' = dx <= dy ? 'x' : 'y'
      const read: 'x' | 'y' = x.flow === 'side' || x.axis === 'free' ? short : x.axis === 'vertical' ? 'x' : 'y'
      // A free line the other way too when the shorter slide finds its spot taken.
      const shortTaken = x.axis === 'free' && !spotFree(l, id, short, short === 'x' ? b.cx - a.cx : b.cy - a.cy, lines)
      const axes: ('x' | 'y')[] = shortTaken ? [short, short === 'x' ? 'y' : 'x'] : read === short ? [read] : [read, short]
      for (const axis of axes) {
        moves.push({
          kind: 'align', ids: [id], variant: axis,
          description: `${label(id)} ${axis === 'x' ? 'under' : 'level with'} ${label(n)}: a straight line`,
          apply: (lay) => {
            const me = lay.box(id)!, other = lay.box(n)!
            return slideInto(lay, id, axis, axis === 'x' ? other.cx - me.cx : other.cy - me.cy, lines, n)
          },
        })
      }
    }

    // Into a row or a column with a near sibling it has no line to, when
    // it is in none: the rows and columns a reader expects (HOLA R4).
    {
      const b = l.box(id)!
      const siblings = l.childrenOf(l.parentOf(id)).filter((o) => o !== id)
      const aligned = siblings.some((o) => Math.abs(l.box(o)!.cx - b.cx) < STRAIGHT_TOLERANCE || Math.abs(l.box(o)!.cy - b.cy) < STRAIGHT_TOLERANCE)
      if (!aligned && ns.length) {
        for (const o of siblings) {
          if (ns.includes(o)) continue
          const r = l.box(o)!
          if (Math.hypot(r.cx - b.cx, r.cy - b.cy) > 3 * l.meanSize + (r.w + b.w) / 2) continue
          const dx = Math.abs(b.cx - r.cx), dy = Math.abs(b.cy - r.cy)
          const axis: 'x' | 'y' = dx <= dy ? 'x' : 'y'
          moves.push({
            kind: 'row', ids: [id],
            description: `${label(id)} in a ${axis === 'x' ? 'column' : 'row'} with ${label(o)}`,
            apply: (lay) => {
              const me = lay.box(id)!, other = lay.box(o)!
              return slideInto(lay, id, axis, axis === 'x' ? other.cx - me.cx : other.cy - me.cy, lines, o)
            },
          })
        }
      }
    }

    // Snapped into the row or column it almost stands in with a near
    // sibling: a line nearly kept reads as a mistake.
    for (const { o, axis } of nearMissesOf(l, id)) {
      moves.push({
        kind: 'snap', ids: [id], variant: `${axis}:${o}`,
        description: `${label(id)} in line with ${label(o)}`,
        apply: (lay) => slideInto(lay, id, axis, lineUpDelta(lay, id, o, axis), lines, o),
      })
    }

    // In a row or a column with others of its kind, when it stands in
    // line with none of them: the people together, the stores together,
    // frames of one kind side by side; the nearest two tried each way.
    {
      const b = l.box(id)!
      const kin = kinApartOf(l, id, (o) => neighbours(o, lines).length > 0)
        .map((o) => ({ o, d: Math.hypot(l.box(o)!.cx - b.cx, l.box(o)!.cy - b.cy) }))
        .sort((p, q) => p.d - q.d).slice(0, 2)
      for (const { o } of kin) {
        for (const axis of ['x', 'y'] as const) {
          moves.push({
            kind: 'kin', ids: [id], variant: `${axis}:${o}`,
            description: `${label(id)} in a ${axis === 'x' ? 'column' : 'row'} with ${label(o)}, of its kind`,
            apply: (lay) => slideInto(lay, id, axis, lineUpDelta(lay, id, o, axis), lines, o),
          })
        }
      }
    }

    // Centred over what it relates to.
    if (ns.length >= 2) {
      const mx = ns.reduce((s, n) => s + l.box(n)!.cx, 0) / ns.length
      const my = ns.reduce((s, n) => s + l.box(n)!.cy, 0) / ns.length
      const b = l.box(id)!
      const spreadX = Math.max(...ns.map((n) => l.box(n)!.cx)) - Math.min(...ns.map((n) => l.box(n)!.cx))
      const spreadY = Math.max(...ns.map((n) => l.box(n)!.cy)) - Math.min(...ns.map((n) => l.box(n)!.cy))
      const axis: 'x' | 'y' = spreadX >= spreadY ? 'x' : 'y'
      if (Math.abs((axis === 'x' ? b.cx - mx : b.cy - my)) > STRAIGHT_TOLERANCE) {
        moves.push({
          kind: 'balance', ids: [id],
          description: `${label(id)} centred ${axis === 'x' ? 'over' : 'beside'} ${ns.map(label).join(', ')}`,
          apply: (lay) => {
            const me = lay.box(id)!
            const group = axis === 'x' ? slide(lay, id, mx - me.cx, 0, lines) : slide(lay, id, 0, my - me.cy, lines)
            return lay.allClear(group)
          },
        })
      }
    }
  }

  // Off a line drawn over it: the element (or the group a view draws
  // round it, which has no frame of its own) slid aside, square to the
  // line, just clear of it on either side.
  for (const x of lines) {
    const a = l.box(x.a)!, b = l.box(x.b)!
    const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy)
    if (len < 1) continue
    const nx = -dy / len, ny = dx / len
    const x0 = Math.min(a.cx, b.cx), x1 = Math.max(a.cx, b.cx), y0 = Math.min(a.cy, b.cy), y1 = Math.max(a.cy, b.cy)
    for (const e of l.ids()) {
      if (e === x.a || e === x.b || l.isFrame(e) || l.holds(e, x.a) || l.holds(e, x.b)) continue
      const r = l.box(e)!
      if (r.x > x1 || r.x + r.w < x0 || r.y > y1 || r.y + r.h < y0) continue
      if (!segmentHitsRect(a.cx, a.cy, b.cx, b.cy, r.x, r.y, r.x + r.w, r.y + r.h)) continue
      // The group that goes: the element, or the tight frame holding it when the line's ends are outside it.
      let mover = e
      for (let p = l.parentOf(e); p && l.isTight(p) && !l.holds(p, x.a) && !l.holds(p, x.b); p = l.parentOf(p)) mover = p
      if (l.fixed(mover) || !concerns([mover, x.a, x.b])) continue
      const m = l.box(mover)!
      const corners = [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]].map(([px, py]) => (px - a.cx) * nx + (py - a.cy) * ny)
      const gap = l.gapOf(l.parentOf(mover))
      for (const shift of [-Math.min(...corners) + gap, -(Math.max(...corners) + gap)]) {
        moves.push({
          kind: 'clear', ids: [mover], variant: `${x.id}:${shift > 0 ? '+' : '-'}`,
          description: `${label(mover)} off the line from ${label(x.a)} to ${label(x.b)}`,
          apply: (lay) => lay.allClear(slide(lay, mover, nx * shift, ny * shift, lines)),
        })
      }
    }
  }

  // Drawn closer: slid along one axis towards what it relates to (or
  // towards its siblings) as far as it stays clear of them.
  for (const id of l.ids()) {
    if (l.fixed(id) || !concerns([id])) continue
    const ns = neighbours(id, lines)
    const b = l.box(id)!
    // Loose elements are gathered, not drawn closer; a satellite goes with its anchor.
    if (!ns.length) continue
    if (ns.length === 1 && satellitesOf(l, ns[0], lines).includes(id)) continue
    // Towards what it relates to in its own container; with all its lines
    // leaving the container, towards its siblings.
    const siblings = l.childrenOf(l.parentOf(id)).filter((o) => o !== id)
    const inside = ns.filter((n) => l.parentOf(n) === l.parentOf(id))
    const towards = inside.length ? inside : siblings.length ? siblings : ns
    const tx = towards.reduce((s, n) => s + l.box(n)!.cx, 0) / towards.length
    const ty = towards.reduce((s, n) => s + l.box(n)!.cy, 0) / towards.length
    for (const axis of ['x', 'y'] as const) {
      const want = axis === 'x' ? tx - b.cx : ty - b.cy
      if (Math.abs(want) < l.gapOf(l.parentOf(id))) continue
      moves.push({
        kind: 'closer', ids: [id], variant: axis,
        description: `${label(id)} closer to ${towards.length === 1 ? label(towards[0]) : 'the rest'}`,
        apply: (lay) => slideTowards(lay, id, axis, axis === 'x' ? tx : ty, lines),
      })
    }
  }

  // A line that reads along an axis: what follows put right after what
  // comes first, under it or right of it (a transition's next state, the
  // screen navigated to), where a slide along one axis cannot reach.
  for (const x of lines) {
    if (x.flow === 'side' || x.axis === 'free' || l.parentOf(x.a) !== l.parentOf(x.b)) continue
    const [first, then] = x.flow === 'forward' ? [x.a, x.b] : [x.b, x.a]
    const f = l.box(first)!, t = l.box(then)!
    const after = x.axis === 'vertical'
      ? Math.abs(f.cx - t.cx) < STRAIGHT_TOLERANCE && t.y >= f.y + f.h
      : Math.abs(f.cy - t.cy) < STRAIGHT_TOLERANCE && t.x >= f.x + f.w
    if (after) continue
    // What follows `then` along the same axis goes with it, as a person
    // drags the rest of the chain (one step cannot see the next).
    const chain = [then]
    for (let i = 0; i < chain.length; i++) {
      for (const q of lines) {
        if (q.flow === 'side' || q.axis !== x.axis) continue
        const [from, to] = q.flow === 'forward' ? [q.a, q.b] : [q.b, q.a]
        if (from === chain[i] && to !== first && !chain.includes(to) && l.parentOf(to) === l.parentOf(then)) chain.push(to)
      }
    }
    if (chain.some((c) => l.fixed(c)) || !concerns([first, ...chain])) continue
    moves.push({
      kind: 'follow', ids: chain,
      description: x.axis === 'vertical' ? `${label(then)} under ${label(first)}: the line reads down` : `${label(then)} right of ${label(first)}: the line reads on`,
      apply: (lay) => {
        const a = lay.box(first)!, b = lay.box(then)!, gap = lay.gapOf(lay.parentOf(then))
        const cx = x.axis === 'vertical' ? a.cx : a.x + a.w + gap + b.w / 2
        const cy = x.axis === 'vertical' ? a.y + a.h + gap + b.h / 2 : a.cy
        const tryAt = (tx: number, ty: number): boolean => {
          const dx = tx - b.cx, dy = ty - b.cy
          for (const c of chain) lay.moveBy(c, dx, dy)
          if (lay.allClear(chain)) return true
          for (const c of chain) lay.moveBy(c, -dx, -dy)
          return false
        }
        if (tryAt(cx, cy)) return true
        // The place after `first` taken by another that follows it: beside that one, in its row (a fan of parts under their root).
        const row = lay.childrenOf(lay.parentOf(then)).filter((o) => {
          if (chain.includes(o) || o === first) return false
          const r = lay.box(o)!
          return x.axis === 'vertical'
            ? r.y >= a.y + a.h && r.y < a.y + a.h + gap + lay.meanSize && r.x < a.x + a.w + lay.meanSize && a.x < r.x + r.w + lay.meanSize
            : r.x >= a.x + a.w && r.x < a.x + a.w + gap + lay.meanSize && r.y < a.y + a.h + lay.meanSize && a.y < r.y + r.h + lay.meanSize
        })
        if (row.length) {
          const boxes = row.map((o) => lay.box(o)!)
          if (x.axis === 'vertical') {
            const right = Math.max(...boxes.map((r) => r.x + r.w)), left = Math.min(...boxes.map((r) => r.x))
            if (tryAt(right + gap + b.w / 2, boxes[0].cy) || tryAt(left - gap - b.w / 2, boxes[0].cy)) return true
          } else {
            const bottom = Math.max(...boxes.map((r) => r.y + r.h)), top = Math.min(...boxes.map((r) => r.y))
            if (tryAt(boxes[0].cx, bottom + gap + b.h / 2) || tryAt(boxes[0].cx, top - gap - b.h / 2)) return true
          }
        }
        return chain.length === 1 && placeNear(lay, then, cx, cy)
      },
    })
  }

  // A line that runs against its flow: its ends change places.
  for (const x of lines) {
    if (l.parentOf(x.a) !== l.parentOf(x.b) || !againstFlow(l, x) || l.fixed(x.a) || l.fixed(x.b) || !concerns([x.a, x.b])) continue
    const [first, then] = x.flow === 'forward' ? [x.a, x.b] : [x.b, x.a]
    moves.push({
      kind: 'flow', ids: [x.a, x.b],
      description: x.axis === 'horizontal' ? `${label(first)} left of ${label(then)}: the line reads on` : `${label(first)} above ${label(then)}: the line reads down`,
      apply: (lay) => {
        const ba = lay.box(x.a)!, bb = lay.box(x.b)!
        const ax = ba.x, ay = ba.y
        lay.moveTo(x.a, bb.cx - ba.w / 2, bb.cy - ba.h / 2)
        lay.moveTo(x.b, ax + (ba.w - bb.w) / 2, ay + (ba.h - bb.h) / 2)
        return lay.allClear([x.a, x.b])
      },
    })
  }

  const byParent = new Map<string | undefined, string[]>()
  for (const id of l.ids()) byParent.set(l.parentOf(id), [...(byParent.get(l.parentOf(id)) ?? []), id])

  // A row (or column) of three or more put in the order of what its
  // elements relate to outside it, as one move: swapping neighbours one
  // pair at a time cannot untangle a row of six.
  for (const siblings of byParent.values()) {
    for (const axis of ['x', 'y'] as const) {
      const seen = new Set<string>()
      for (const id of siblings) {
        if (seen.has(id)) continue
        const b = l.box(id)!
        const row = siblings.filter((o) => Math.abs(axis === 'x' ? l.box(o)!.cy - b.cy : l.box(o)!.cx - b.cx) < STRAIGHT_TOLERANCE)
        for (const o of row) seen.add(o)
        if (row.length < 3 || row.some((o) => l.fixed(o)) || !concerns(row)) continue
        const inRow = new Set(row)
        const at = (o: string): number => (axis === 'x' ? l.box(o)!.cx : l.box(o)!.cy)
        const bary = (o: string): number => {
          const outside = neighbours(o, lines).filter((n) => !inRow.has(n))
          return outside.length ? outside.reduce((s, n) => s + at(n), 0) / outside.length : at(o)
        }
        if (!row.some((o) => neighbours(o, lines).some((n) => !inRow.has(n)))) continue
        const current = [...row].sort((p, q) => at(p) - at(q))
        const wanted = [...row].sort((p, q) => bary(p) - bary(q) || at(p) - at(q))
        if (current.every((o, i) => o === wanted[i])) continue
        const slots = current.map(at)
        moves.push({
          kind: 'order', ids: row,
          description: `${wanted.map(label).join(', ')}: the ${axis === 'x' ? 'row' : 'column'} in the order of what it relates to`,
          apply: (lay) => {
            wanted.forEach((o, i) => {
              const r = lay.box(o)!
              if (axis === 'x') lay.moveTo(o, slots[i] - r.w / 2, r.y); else lay.moveTo(o, r.x, slots[i] - r.h / 2)
            })
            return lay.allClear(row)
          },
        })
      }
    }
  }

  // Two siblings that change places.
  for (const siblings of byParent.values()) {
    for (let i = 0; i < siblings.length; i++) for (let j = i + 1; j < siblings.length; j++) {
      const a = siblings[i], b = siblings[j]
      if (l.fixed(a) || l.fixed(b) || !concerns([a, b])) continue
      if (!neighbours(a, lines).length && !neighbours(b, lines).length) continue
      // Neighbours only: within three mean sizes of each other.
      const ba = l.box(a)!, bb = l.box(b)!
      if (Math.hypot(ba.cx - bb.cx, ba.cy - bb.cy) > 3 * l.meanSize + (ba.w + bb.w) / 2) continue
      moves.push({
        kind: 'swap', ids: [a, b],
        description: `${label(a)} and ${label(b)} change places`,
        apply: (lay) => {
          const ba = lay.box(a)!, bb = lay.box(b)!
          // Centres exchanged, so boxes of different sizes stay put in their cells.
          const ax = ba.cx, ay = ba.cy, bx = bb.cx, by = bb.cy
          lay.moveTo(a, bx - ba.w / 2, by - ba.h / 2)
          lay.moveTo(b, ax - bb.w / 2, ay - bb.h / 2)
          return lay.allClear([a, b])
        },
      })
    }
  }
  return moves
}
