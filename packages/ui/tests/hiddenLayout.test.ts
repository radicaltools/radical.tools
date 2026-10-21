/**
 * No layout runs where nobody sees it.
 *
 * On a table, wiki, Warnier, matrix or treemap view the live layout went on
 * laying out the canvas behind it: after an add it moved nodes[].x/y for
 * ~21 s (in a Warnier process of 150 steps without end), and each move held
 * the save back.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

afterEach(() => s().stopLiveLayout())

/** Twelve linked systems on top of each other: the physics pulls them apart. */
function heap(kind: 'table' | 'static'): DiagramData {
  const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, type: 'system', label: `N${i}`, x: i * 3, y: i * 2, width: 300, height: 180, collapsed: false })) as C4Node[]
  const relations = nodes.slice(1).map((n, i) => ({ id: `r${i}`, sourceId: `n${i}`, targetId: n.id }))
  return { nodes, relations, views: [{ id: 'v', name: 'V', kind, nodeIds: [], positions: {} }] } as DiagramData
}

const places = (): string => JSON.stringify(Object.values(s().c4Nodes).map((n) => [Math.round(n.x), Math.round(n.y)]))

describe('the live layout behind a view that is no canvas', () => {
  it('moves nothing on a table view', async () => {
    s().setAppMode('designer')
    s().loadDiagram(heap('table'))
    s().setActiveView('v')
    s().startLiveLayout()
    const before = places()
    s().addNode({ type: 'system', label: 'New', x: 0, y: 0, width: 300, height: 180, collapsed: false } as any)
    const after = places()
    await wait(800)
    expect(places()).toBe(after)
    expect(before.length).toBeGreaterThan(0)
  })
})
