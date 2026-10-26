import { describe, it, expect } from 'vitest'
import { BATCH_CELL, WRAP_HEADER, WRAP_PAD, createBatchPlacer, fitAncestors, fittedParentSize, freeSpotNear, modelCanvas, placeGhosts, placeNewNode, placeUnplaced, settleMovedNodes, gridSlotIn } from '../src/geometry'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, type C4Node } from '@radical/common/c4'

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...extra }) as C4Node

describe('fittedParentSize', () => {
  it('wraps the children plus padding, never below the collapsed size', () => {
    const sys = node('sys', 'system')
    expect(fittedParentSize(sys, [{ x: 30, y: 120, width: 900, height: 600 }])).toEqual({ width: 960, height: 750 })
    expect(fittedParentSize(sys, [{ x: 0, y: 0, width: 10, height: 10 }])).toEqual({ width: COLLAPSED_WIDTH.system, height: COLLAPSED_HEIGHT.system })
  })
})

describe('fitAncestors', () => {
  it('refits the parent and every ancestor above it, leaving collapsed ones alone', () => {
    const nodes: Record<string, C4Node> = {
      dom: node('dom', 'domain'),
      sys: node('sys', 'system', { parentId: 'dom', x: 30, y: 120 }),
      api: node('api', 'container', { parentId: 'sys', x: 30, y: 120, width: 1000, height: 400 }),
      shut: node('shut', 'system', { collapsed: true, width: 10, height: 10 }),
      kid: node('kid', 'container', { parentId: 'shut', x: 5000, y: 5000 }),
    }
    fitAncestors(nodes, 'sys')
    expect(nodes.sys).toMatchObject({ width: 1060, height: 550 })
    expect(nodes.dom).toMatchObject({ width: 1120, height: 700 })
    fitAncestors(nodes, 'shut')
    expect(nodes.shut).toMatchObject({ width: 10, height: 10 })
  })

  it('wraps the components of a web app, as it does a container\'s', () => {
    const nodes: Record<string, C4Node> = {
      web: node('web', 'webapp'),
      ui: node('ui', 'component', { parentId: 'web', x: 20, y: 120 }),
      api: node('api', 'component', { parentId: 'web', x: 240, y: 120 }),
    }
    fitAncestors(nodes, 'web')
    expect(nodes.web).toMatchObject({ width: 240 + NODE_SIZES.component.width + 20, height: 120 + NODE_SIZES.component.height + 20 })
  })
})

describe('placeNewNode', () => {
  it('places a first child below the header, later ones right of their siblings', () => {
    const nodes: Record<string, C4Node> = { sys: node('sys', 'system', { x: 500, y: 500 }) }
    expect(placeNewNode(nodes, 'sys')).toEqual({ x: 30, y: 120 })
    nodes.api = node('api', 'container', { parentId: 'sys', x: 30, y: 120 })
    expect(placeNewNode(nodes, 'sys')).toEqual({ x: 30 + NODE_SIZES.container.width + 20, y: 120 })
  })

  it('places a root node right of the root nodes only', () => {
    const nodes: Record<string, C4Node> = {
      sys: node('sys', 'system', { x: 100 }),
      api: node('api', 'container', { parentId: 'sys', x: 9000 }),
    }
    expect(placeNewNode({}, undefined)).toEqual({ x: 0, y: 0 })
    expect(placeNewNode(nodes, undefined)).toEqual({ x: 100 + NODE_SIZES.system.width + 80, y: 0 })
  })
})

describe('createBatchPlacer', () => {
  it('starts a batch right of what the canvas shows and grows it sideways', () => {
    const nodes: Record<string, C4Node> = {
      a: node('a', 'system', { x: 100, y: 50 }),
      b: node('b', 'system', { x: 400, y: -20 }),
      hidden: node('hidden', 'system', { x: 5000, y: 0 }),
    }
    const place = createBatchPlacer(() => nodes, () => new Set(['a', 'b']))
    const x0 = 400 + NODE_SIZES.system.width + 120
    const placed = Array.from({ length: 5 }, () => place(undefined))
    expect(placed).toEqual([
      { x: x0, y: -20 },
      { x: x0 + BATCH_CELL.width, y: -20 },
      { x: x0, y: -20 + BATCH_CELL.height },
      { x: x0 + BATCH_CELL.width, y: -20 + BATCH_CELL.height },
      { x: x0 + 2 * BATCH_CELL.width, y: -20 },
    ])
  })

  it('keeps one batch per parent, inside its padding when it has no children yet', () => {
    const nodes: Record<string, C4Node> = { sys: node('sys', 'system') }
    const place = createBatchPlacer(() => nodes)
    expect(place('sys')).toEqual({ x: 30, y: 120 })
    expect(place('sys')).toEqual({ x: 30 + BATCH_CELL.width, y: 120 })
    expect(place(undefined)).toEqual({ x: NODE_SIZES.system.width + 120, y: 0 })
    expect(createBatchPlacer(() => ({}))(undefined)).toEqual({ x: 0, y: 0 })
  })
})

describe('placeUnplaced', () => {
  const n = (id: string, type: string, x: number, y: number, width: number, height: number, parentId?: string): C4Node =>
    ({ id, type, label: id, collapsed: false, x, y, width, height, ...(parentId ? { parentId } : {}) } as C4Node)
  const canvas = (): Record<string, C4Node> => ({
    shop: n('shop', 'system', 0, 0, 400, 520),
    web: n('web', 'container', 60, 120, 240, 150, 'shop'),
    api: n('api', 'container', 60, 320, 240, 150, 'shop'),
    // Added on another canvas: still where that one had it.
    search: n('search', 'container', 1040, 120, 240, 150, 'shop'),
    part: n('part', 'component', 30, 110, 180, 60, 'search'),
    mail: n('mail', 'system', -900, 4000, 300, 200),
  })
  const known = { shop: 1, web: 1, api: 1 }

  it('puts a node the canvas has no place for beside its siblings, inside a parent refit for it', () => {
    const nodes = canvas()
    expect(placeUnplaced(nodes, known).sort()).toEqual(['mail', 'search'])
    expect(nodes.search).toMatchObject({ x: 60 + 240 + 20, y: 120 })
    expect(nodes.search.x + nodes.search.width).toBeLessThanOrEqual(nodes.shop.width)
    // At the root: right of the root nodes, top-aligned with them.
    expect(nodes.mail.y).toBe(0)
    expect(nodes.mail.x).toBeGreaterThanOrEqual(nodes.shop.x + nodes.shop.width)
    // What the canvas had placed stays.
    expect(nodes.web).toMatchObject({ x: 60, y: 120 })
    expect(nodes.api).toMatchObject({ x: 60, y: 320 })
  })

  it('leaves what is inside a node placed this way where it was in it', () => {
    const nodes = canvas()
    placeUnplaced(nodes, known)
    expect(nodes.part).toMatchObject({ x: 30, y: 110 })
  })

  it('places only what a view shows', () => {
    const nodes = canvas()
    expect(placeUnplaced(nodes, known, new Set(['shop', 'web', 'api', 'search', 'part']))).toEqual(['search'])
    expect(nodes.mail).toMatchObject({ x: -900, y: 4000 })
  })

  it('measures a container with nothing in it at the size the canvas draws it (F-0049)', () => {
    // A state dragged down inside its machine, which grew to hold it as
    // drawn (folded, nothing in it): at its stored 320 × 220 its middle lay
    // below the machine, and the next opening placed it afresh and freed
    // it for the physics, which rearranged the whole machine.
    const drawnH = COLLAPSED_HEIGHT.state
    const nodes: Record<string, C4Node> = {
      sm: n('sm', 'state-machine', 0, 0, 600, 500),
      idle: n('idle', 'state', 30, 120, 320, 220, 'sm'),
      refused: n('refused', 'state', 30, 500 - 30 - drawnH, 320, 220, 'sm'),
    }
    expect(500 - 30 - drawnH + 110).toBeGreaterThan(500)
    expect(placeUnplaced(nodes, { sm: 1, idle: 1, refused: 1 })).toEqual([])
    expect(nodes.refused).toMatchObject({ x: 30, y: 500 - 30 - drawnH })
  })

  it('takes no child for astray in a container the view does not draw (F-0049)', () => {
    // A machine that grew past the frame of its domain, which the view
    // draws only to hold it: nothing is drawn astray.
    const nodes: Record<string, C4Node> = {
      dom: n('dom', 'domain', 0, 0, 300, 200),
      sm: n('sm', 'state-machine', 0, 0, 900, 700, 'dom'),
      idle: n('idle', 'state', 30, 120, 170, 72, 'sm'),
    }
    const known = { dom: 1, sm: 1, idle: 1 }
    const shown = new Set(['dom', 'sm', 'idle'])
    expect(placeUnplaced(nodes, known, shown, undefined, { frames: new Set(['dom']) })).toEqual([])
    expect(nodes.sm).toMatchObject({ x: 0, y: 0 })
  })

  it('lets a container the view does not draw grow without pushing its neighbours (F-0048)', () => {
    // A view of entities: their domains are frames. One added on another
    // canvas goes beside its siblings, and its domain grows round it; as a
    // box of its own, that domain pushed the next one and what is in it.
    const nodes: Record<string, C4Node> = {
      a: n('a', 'domain', 0, 0, 520, 300),
      a1: n('a1', 'entity', 30, 120, 170, 56, 'a'),
      a2: n('a2', 'entity', 250, 120, 170, 56, 'a'),
      fresh: n('fresh', 'entity', 3000, 3000, 170, 56, 'a'),
      b: n('b', 'domain', 600, 0, 520, 300),
      b1: n('b1', 'entity', 30, 200, 170, 56, 'b'),
    }
    const known = { a: 1, a1: 1, a2: 1, b: 1, b1: 1 }
    const shown = new Set(Object.keys(nodes))
    expect(placeUnplaced(nodes, known, shown, undefined, { frames: new Set(['a', 'b']) })).toEqual(['fresh'])
    expect(nodes.a.width).toBeGreaterThan(600)
    expect(nodes.b).toMatchObject({ x: 600, y: 0 })
    expect(nodes.b1).toMatchObject({ x: 30, y: 200 })
  })

  describe('a new parent of what the canvas has places for ("Wrap into…" on another canvas, F-0047)', () => {
    // API wrapped into a group on another canvas: here API still has its
    // place in Bookstore, and the group none.
    const wrapped = (): Record<string, C4Node> => ({
      shop: n('shop', 'system', 0, 0, 860, 400),
      web: n('web', 'webapp', 30, 120, 210, 140, 'shop'),
      g: n('g', 'group', 500, 400, 360, 300, 'shop'),
      api: n('api', 'component', 290, 120, 300, 200, 'g'),
      db: n('db', 'database', 640, 155, 190, 130, 'shop'),
    })
    const known = { shop: 1, web: 1, api: 1, db: 1 }
    const abs = (nodes: Record<string, C4Node>, id: string): { x: number; y: number } => {
      let x = 0, y = 0
      for (let cur: C4Node | undefined = nodes[id]; cur; cur = cur.parentId ? nodes[cur.parentId] : undefined) { x += cur.x; y += cur.y }
      return { x, y }
    }

    it('draws the wrapped elements where they were, the new parent round them, and moves nothing else', () => {
      const nodes = wrapped()
      const out: string[] = []
      expect(placeUnplaced(nodes, known, undefined, undefined, { wrap: new Set(['g']), wrapped: out })).toEqual([])
      expect(out).toEqual(['g'])
      expect(abs(nodes, 'api')).toEqual({ x: 290, y: 120 })
      expect(nodes.g).toMatchObject({ x: 290 - WRAP_PAD, y: 120 - WRAP_PAD - WRAP_HEADER, width: 300 + 2 * WRAP_PAD, height: 200 + 2 * WRAP_PAD + WRAP_HEADER })
      expect(nodes.shop).toMatchObject({ x: 0, y: 0, width: 860, height: 400 })
      expect(nodes.web).toMatchObject({ x: 30, y: 120 })
      expect(nodes.db).toMatchObject({ x: 640, y: 155 })
    })

    it('fits a new parent the view does not draw tightly round them', () => {
      const nodes = wrapped()
      const shown = new Set(['shop', 'web', 'g', 'api', 'db'])
      expect(placeUnplaced(nodes, known, shown, undefined, { frames: new Set(['g']), wrap: new Set(['g']) })).toEqual([])
      expect(abs(nodes, 'api')).toEqual({ x: 290, y: 120 })
      expect(nodes.g).toMatchObject({ x: 290, y: 120, width: 300, height: 200 })
      expect(nodes.shop).toMatchObject({ x: 0, y: 0, width: 860, height: 400 })
      expect(nodes.web).toMatchObject({ x: 30, y: 120 })
      expect(nodes.db).toMatchObject({ x: 640, y: 155 })
    })
  })

  it('leaves a canvas with no positions at all alone', () => {
    const nodes = canvas()
    expect(placeUnplaced(nodes, {})).toEqual([])
    expect(placeUnplaced(nodes, undefined)).toEqual([])
    expect(nodes.search).toMatchObject({ x: 1040, y: 120 })
  })
})

describe('freeSpotNear', () => {
  const size = { width: 200, height: 80 }
  const clear = (spot: { x: number; y: number }, boxes: Array<{ x: number; y: number; width: number; height: number }>) =>
    boxes.every((b) => spot.x + size.width <= b.x || b.x + b.width <= spot.x || spot.y + size.height <= b.y || b.y + b.height <= spot.y)

  it('is the centre itself when nothing is there', () => {
    expect(freeSpotNear([], size, { x: 500, y: 300 })).toEqual({ x: 400, y: 260 })
  })

  it('moves off what is there, staying near the centre', () => {
    const boxes = [{ x: 300, y: 200, width: 400, height: 200 }]
    const spot = freeSpotNear(boxes, size, { x: 500, y: 300 })
    expect(clear(spot, boxes)).toBe(true)
    expect(Math.hypot(spot.x - 400, spot.y - 260)).toBeLessThan(400)
  })

  it('gives each of several boxes placed in turn a place of its own', () => {
    const boxes: Array<{ x: number; y: number; width: number; height: number }> = [{ x: 0, y: 0, width: 1000, height: 600 }]
    for (let i = 0; i < 3; i++) {
      const spot = freeSpotNear(boxes, size, { x: 500, y: 300 })
      expect(clear(spot, boxes)).toBe(true)
      boxes.push({ ...spot, ...size })
    }
  })
})

describe('placeGhosts', () => {
  const n = (id: string, type: string, x: number, y: number, width: number, height: number, parentId?: string): C4Node =>
    ({ id, type, label: id, collapsed: false, x, y, width, height, ...(parentId ? { parentId } : {}) } as C4Node)
  // A view where CLI is narrower than on All elements: the hole Hooks left is
  // right of Check, inside the frame.
  const canvas = (hooks: { x: number; y: number }): Record<string, C4Node> => ({
    cli: n('cli', 'container', 0, 0, 700, 300, undefined),
    diff: n('diff', 'component', 30, 120, 200, 120, 'cli'),
    check: n('check', 'component', 260, 120, 200, 120, 'cli'),
    hooks: n('hooks', 'component', hooks.x, hooks.y, 200, 120, 'cli'),
    part: n('part', 'component', 30, 120, 100, 60, 'hooks'),
    web: n('web', 'container', 900, 0, 240, 150),
  })
  const inside = (nodes: Record<string, C4Node>, id: string): boolean => {
    const g = nodes[id]
    const parent = nodes[g.parentId!]
    return g.x >= 0 && g.y >= 0 && g.x + g.width <= parent.width && g.y + g.height <= parent.height
  }
  const clear = (nodes: Record<string, C4Node>, id: string, of: string[]): boolean => of.every((o) => {
    const a = nodes[id], b = nodes[o]
    return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
  })

  it('moves a ghost outside its parent\'s frame, or on a sibling, to the nearest free place inside the frame', () => {
    // All elements had it at x 720: right of the frame here.
    let nodes = placeGhosts(canvas({ x: 720, y: 120 }), new Set(['hooks', 'part']))
    expect(inside(nodes, 'hooks')).toBe(true)
    expect(clear(nodes, 'hooks', ['diff', 'check'])).toBe(true)
    expect(nodes.hooks).toMatchObject({ x: 480, y: 120 })
    // What is inside it moves with it.
    expect(nodes.part).toMatchObject({ x: 30, y: 120 })
    // On Check.
    nodes = placeGhosts(canvas({ x: 280, y: 130 }), new Set(['hooks']))
    expect(inside(nodes, 'hooks')).toBe(true)
    expect(clear(nodes, 'hooks', ['diff', 'check'])).toBe(true)
  })

  it('leaves a ghost where it is when that is free, and the live elements alone', () => {
    const before = canvas({ x: 480, y: 130 })
    const nodes = placeGhosts(before, new Set(['hooks']))
    expect(nodes).toBe(before)
    expect(nodes.hooks).toMatchObject({ x: 480, y: 130 })
  })

  it('counts only the siblings the view shows, and keeps a root ghost clear of the other roots', () => {
    const nodes = placeGhosts({ ...canvas({ x: 480, y: 130 }), old: n('old', 'container', 950, 40, 240, 150) }, new Set(['old']))
    expect(clear(nodes, 'old', ['cli', 'web'])).toBe(true)
    // Check is not on this view: the ghost may take its place.
    const shown = new Set(['cli', 'diff', 'hooks'])
    expect(placeGhosts(canvas({ x: 280, y: 130 }), new Set(['hooks']), shown).hooks).toMatchObject({ x: 280, y: 130 })
  })

  it('goes below the siblings when the frame has no room', () => {
    const nodes = placeGhosts({ ...canvas({ x: 720, y: 120 }), fill: n('fill', 'component', 490, 120, 180, 120, 'cli') }, new Set(['hooks']))
    expect(clear(nodes, 'hooks', ['diff', 'check', 'fill'])).toBe(true)
    expect(nodes.hooks.x).toBe(30)
    expect(nodes.hooks.y).toBeGreaterThanOrEqual(240)
  })
})

describe('settleMovedNodes', () => {
  it('centres an element moved alone into an empty parent across it, below its header', () => {
    // System A moved into System B from beside it: its place, read in B, lies outside B.
    const nodes: Record<string, C4Node> = {
      b: node('b', 'system', { x: 600, y: 0 }),
      a: node('a', 'system', { parentId: 'b', x: -600, y: 0 }),
    }
    const canvas = modelCanvas(nodes)
    settleMovedNodes(nodes, ['a'], canvas)
    // As the canvas draws them.
    const frame = canvas.boxOf(nodes.b), box = canvas.boxOf(nodes.a)
    // Below the header (120), centred in what is left down to the bottom padding.
    expect(nodes.a.y).toBe(120 + Math.max(0, Math.round((frame.h - 120 - 30 - box.h) / 2)))
    expect(box.x - 0).toBe(frame.w - (box.x + box.w))
    expect(frame.h).toBeGreaterThanOrEqual(box.y + box.h)
  })

  it('puts one moved among the parent\'s children in the first free cell of their grid', () => {
    const nodes: Record<string, C4Node> = {
      b: node('b', 'system', { x: 600, y: 0, width: 400, height: 330 }),
      c: node('c', 'container', { parentId: 'b', x: 30, y: 120 }),
      a: node('a', 'container', { parentId: 'b', x: -600, y: 0 }),
    }
    settleMovedNodes(nodes, ['a'], modelCanvas(nodes))
    // Beside the first, in its row; the grid grows wider than tall, so a
    // third starts the next row.
    expect([nodes.a.x, nodes.a.y]).toEqual([nodes.c.x + nodes.c.width + 60, nodes.c.y])
    expect(gridSlotIn(nodes, 'b', { width: nodes.a.width, height: nodes.a.height })).toEqual({ x: nodes.c.x, y: nodes.c.y + nodes.c.height + 60 })
  })

  // Taken out to the top, it lay over the system it was in, now a sibling,
  // and went right of every root element, to the far top right (F-0072).
  it('puts one taken out to the top in the free place nearest where it stood', () => {
    const nodes: Record<string, C4Node> = {
      b: node('b', 'system', { x: 0, y: 0, width: 600, height: 330 }),
      c: node('c', 'container', { parentId: 'b', x: 30, y: 120 }),
      far: node('far', 'system', { x: 3000, y: -1000 }),
      a: node('a', 'container', { x: 330, y: 120 }),
    }
    const canvas = modelCanvas(nodes)
    settleMovedNodes(nodes, ['a'], canvas)
    const box = canvas.boxOf(nodes.a), frame = canvas.boxOf(nodes.b)
    const clear = box.x >= frame.x + frame.w || box.x + box.w <= frame.x || box.y >= frame.y + frame.h || box.y + box.h <= frame.y
    expect(clear).toBe(true)
    expect(Math.hypot(nodes.a.x - 330, nodes.a.y - 120)).toBeLessThan(400)
  })
})
