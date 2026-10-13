/**
 * A relation that ends on an open group gives the live physics no link (it
 * links leaves, and an open group is drawn around its children). An element
 * related only to open groups therefore had nothing holding it: when the
 * rest of the diagram moved, it stayed behind, far from everything, and was
 * saved there. A run of the physics now brings it back by the group.
 */
import { describe, it, expect } from 'vitest'
import { relaxLayout } from '../src/liveColaEngine'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'

type Nodes = Record<string, C4Node>

/** A web app open around two related components, at (0, 0). */
function webApp(): Nodes {
  return {
    web: { id: 'web', type: 'webapp', label: 'Web', collapsed: false, x: 0, y: 0, width: 700, height: 340 } as any,
    a: { id: 'a', type: 'component', label: 'A', collapsed: false, parentId: 'web', x: 60, y: 100, ...NODE_SIZES.component } as any,
    b: { id: 'b', type: 'component', label: 'B', collapsed: false, parentId: 'web', x: 400, y: 100, ...NODE_SIZES.component } as any,
  }
}

const RELATIONS: Record<string, C4Relation> = {
  inside: { id: 'inside', sourceId: 'a', targetId: 'b', label: '' } as any,
  uses: { id: 'uses', sourceId: 'legacy', targetId: 'web', label: 'uses' } as any,
}

/** Runs the physics over the whole diagram until it rests. */
function settle(nodes: Nodes, pinned: string[] = []): void {
  for (const [id, pos] of Object.entries(relaxLayout({ nodes, relations: RELATIONS, pinned })!)) {
    const n = nodes[id]
    n.x = pos.x
    n.y = pos.y
    if (pos.width != null) n.width = pos.width
    if (pos.height != null) n.height = pos.height
  }
}

/** Distance between the drawn boxes of two elements on the canvas. */
function gap(a: C4Node, b: C4Node): number {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width))
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height))
  return Math.hypot(dx, dy)
}

const system = (id: string, x: number, y: number): C4Node =>
  ({ id, type: 'system', label: id, collapsed: false, x, y, ...NODE_SIZES.system } as any)

describe('Live layout physics: an element related only to an open group', () => {
  it('is brought back by the group, which stays as it was', () => {
    const alone = webApp()
    settle(alone)

    const nodes: Nodes = { ...webApp(), legacy: system('legacy', -1400, -1200) }
    expect(gap(nodes.legacy, nodes.web)).toBeGreaterThan(1000)
    settle(nodes)

    expect(gap(nodes.legacy, nodes.web)).toBeLessThan(260)
    for (const id of ['web', 'a', 'b']) {
      expect(Math.abs(nodes[id].x - alone[id].x)).toBeLessThan(1)
      expect(Math.abs(nodes[id].y - alone[id].y)).toBeLessThan(1)
    }
  })

  it('stays where it is when it already stands by the group', () => {
    const nodes: Nodes = { ...webApp(), legacy: system('legacy', 100, -360) }
    settle(nodes)
    expect(Math.abs(nodes.legacy.x - 100)).toBeLessThan(1)
    expect(Math.abs(nodes.legacy.y + 360)).toBeLessThan(1)
  })

  it('stays where the user pinned it', () => {
    const nodes: Nodes = { ...webApp(), legacy: system('legacy', -1400, -1200) }
    settle(nodes, ['legacy'])
    expect(nodes.legacy.x).toBeCloseTo(-1400, 0)
    expect(nodes.legacy.y).toBeCloseTo(-1200, 0)
  })

  it('stops at what stands in its way, without pushing it', () => {
    // `wall` stands between `legacy` and the web app, straight above it.
    const nodes: Nodes = { ...webApp(), wall: system('wall', 200, -700), legacy: system('legacy', 200, -1900) }
    const wall = { x: nodes.wall.x, y: nodes.wall.y }
    settle(nodes)

    expect(Math.abs(nodes.wall.x - wall.x)).toBeLessThan(1)
    expect(Math.abs(nodes.wall.y - wall.y)).toBeLessThan(1)
    // It came down to the wall, and no further.
    expect(nodes.legacy.y).toBeGreaterThan(-1900 + 500)
    expect(nodes.legacy.y + nodes.legacy.height).toBeLessThan(nodes.wall.y)
  })
})
