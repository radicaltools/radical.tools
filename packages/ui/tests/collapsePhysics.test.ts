/**
 * Verify that the live cola physics keeps running after a node is collapsed.
 *
 * Reproduces the workflow:
 *   1. start live layout against a small model (parent + 2 children)
 *   2. wait for the d3.timer to tick at least once → applyPositions called
 *   3. flip parent.collapsed = true and call invalidate(): nothing moves
 *   4. add an element next to it and call invalidate() → applyPositions
 *      must be called again
 *
 * If physics dies on collapse, step 4 never produces fresh emissions.
 */
import { describe, it, expect } from 'vitest'
import { LiveColaLayout } from '../src/layout/liveColaLayout'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('Live layout physics survives a collapse', () => {
  it('continues to emit positions after invalidate triggered by collapse', async () => {
    const nodes: Record<string, C4Node> = {
      sys: {
        id: 'sys', type: 'system', label: 'Sys', collapsed: false,
        x: 100, y: 100, width: 600, height: 400,
      } as any,
      a: {
        id: 'a', type: 'container', label: 'A', collapsed: false, parentId: 'sys',
        x: 40, y: 60, ...NODE_SIZES.container,
      } as any,
      b: {
        id: 'b', type: 'container', label: 'B', collapsed: false, parentId: 'sys',
        x: 320, y: 60, ...NODE_SIZES.container,
      } as any,
      ext: {
        id: 'ext', type: 'system', label: 'Ext', collapsed: false, external: true,
        x: 800, y: 100, ...NODE_SIZES.system,
      } as any,
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'a', targetId: 'b', label: '' } as any,
      r2: { id: 'r2', sourceId: 'b', targetId: 'ext', label: '' } as any,
    }

    let emissionCount = 0
    let lastEmission: Record<string, { x: number; y: number; width?: number; height?: number }> = {}

    const layout = new LiveColaLayout({
      getModel: () => ({ nodes, relations }),
      applyPositions: (positions) => {
        emissionCount++
        lastEmission = positions
        for (const [id, pos] of Object.entries(positions)) {
          const n = nodes[id]
          if (n) {
            n.x = pos.x
            n.y = pos.y
            if (pos.width != null) n.width = pos.width
            if (pos.height != null) n.height = pos.height
          }
        }
      },
    })

    layout.start()
    expect(layout.running).toBe(true)

    // Let physics tick a few frames
    await wait(120)
    const beforeCount = emissionCount
    expect(beforeCount).toBeGreaterThan(0)

    // Collapse the parent system + invalidate
    nodes.sys.collapsed = true
    layout.invalidate()

    // Layout must still be running after invalidate
    expect(layout.running).toBe(true)

    // A collapse moves nothing: the container shrinks where it stands (it
    // used to count as a new element, which freed its surroundings; see
    // "collapsing a container" in packages/layout/tests/liveColaRest.test.ts).
    await wait(200)
    expect(emissionCount).toBe(beforeCount)

    // The physics is alive: an element added next to it is placed, with
    // the collapsed parent as a leaf and its children out of the picture.
    nodes.fresh = {
      id: 'fresh', type: 'system', label: 'Fresh', collapsed: false,
      x: 820, y: 120, ...NODE_SIZES.system,
    } as any
    layout.invalidate()
    await wait(300)
    expect(emissionCount).toBeGreaterThan(beforeCount)
    expect(lastEmission.fresh).toBeTruthy()
    expect(lastEmission.a).toBeUndefined()
    expect(lastEmission.b).toBeUndefined()

    layout.stop()
    expect(layout.running).toBe(false)
  })

  it('expanding a collapsed node also keeps physics alive', async () => {
    const nodes: Record<string, C4Node> = {
      sys: {
        id: 'sys', type: 'system', label: 'Sys', collapsed: true,
        x: 100, y: 100, ...NODE_SIZES.system,
      } as any,
      a: {
        id: 'a', type: 'container', label: 'A', collapsed: false, parentId: 'sys',
        x: 40, y: 60, ...NODE_SIZES.container,
      } as any,
      ext: {
        id: 'ext', type: 'person', label: 'User', collapsed: false,
        x: 600, y: 100, ...NODE_SIZES.person,
      } as any,
    }
    const relations: Record<string, C4Relation> = {
      r1: { id: 'r1', sourceId: 'sys', targetId: 'ext', label: '' } as any,
    }

    let emissionCount = 0
    const layout = new LiveColaLayout({
      getModel: () => ({ nodes, relations }),
      applyPositions: (positions) => {
        emissionCount++
        for (const [id, pos] of Object.entries(positions)) {
          const n = nodes[id]
          if (n) {
            n.x = pos.x
            n.y = pos.y
            if (pos.width != null) n.width = pos.width
            if (pos.height != null) n.height = pos.height
          }
        }
      },
    })

    layout.start()
    await wait(120)
    const before = emissionCount
    expect(before).toBeGreaterThan(0)

    // Expand
    nodes.sys.collapsed = false
    layout.invalidate()
    expect(layout.running).toBe(true)

    await wait(200)
    expect(emissionCount).toBeGreaterThan(before)

    layout.stop()
  })
})
