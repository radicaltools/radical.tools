/**
 * A web app holds components the way a container does, so the live physics
 * must treat it as a group: it keeps its components inside and is resized
 * around them. It used to drop a web app with children from the simulation,
 * which let its components be dragged out of it.
 */
import { describe, it, expect } from 'vitest'
import { LiveColaLayout } from '../src/layout/liveColaLayout'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('Live layout physics with a web app parent', () => {
  it('lays out the web app as a group around its components', async () => {
    const nodes: Record<string, C4Node> = {
      web: { id: 'web', type: 'webapp', label: 'Web', collapsed: false, x: 100, y: 100, width: 600, height: 400 } as any,
      a: { id: 'a', type: 'component', label: 'A', collapsed: false, parentId: 'web', x: 20, y: 120, ...NODE_SIZES.component } as any,
      b: { id: 'b', type: 'component', label: 'B', collapsed: false, parentId: 'web', x: 300, y: 120, ...NODE_SIZES.component } as any,
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'a', targetId: 'b', label: '' } as any,
    }
    const emitted = new Set<string>()
    const layout = new LiveColaLayout({
      getModel: () => ({ nodes, relations }),
      applyPositions: (positions) => {
        for (const [id, pos] of Object.entries(positions)) {
          emitted.add(id)
          const n = nodes[id]
          if (!n) continue
          n.x = pos.x
          n.y = pos.y
          if (pos.width != null) n.width = pos.width
          if (pos.height != null) n.height = pos.height
        }
      },
    })
    layout.start()
    await wait(200)
    layout.stop()

    expect(emitted.has('web')).toBe(true)
    // Children stay inside the web app's box (positions are parent-relative).
    for (const id of ['a', 'b']) {
      const c = nodes[id]
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.x + c.width).toBeLessThanOrEqual(nodes.web.width)
      expect(c.y + c.height).toBeLessThanOrEqual(nodes.web.height)
    }
  })
})
