/**
 * An element dropped from the palette into a container stays where the
 * pointer let go of it when there is room for it there; where there is not
 * (over another element, over the frame's header or edge) it goes to the
 * next cell of the grid of what the container holds.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nodeTypeSize, type C4Node, type DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState

const model = (): DiagramData => ({
  nodes: [
    { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 1060, height: 640, collapsed: false },
    { id: 'web', type: 'container', label: 'Web', parentId: 'sys', x: 30, y: 120, width: 240, height: 160, collapsed: false },
  ],
  relations: [],
})

/** A palette drop of `type` with its middle at (relX, relY) in `parentId`'s frame. */
function drop(type: string, parentId: string, relX: number, relY: number): C4Node {
  const size = nodeTypeSize(type, s().metamodel)
  const id = s().requestCreateNode({ type, label: type, description: '', technology: '', collapsed: false, external: false, parentId, x: relX - size.width / 2, y: relY - size.height / 2, ...size } as Omit<C4Node, 'id'>, { skipWizard: true, dropped: true })
  return s().c4Nodes[id]
}
const middle = (n: C4Node) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 })

describe('a palette drop into a container', () => {
  beforeEach(() => {
    s().setAppMode('designer')
    s().loadDiagram(model())
  })
  afterEach(() => s().stopLiveLayout())

  it('stays under the pointer where there is room for it', () => {
    const added = drop('container', 'sys', 760, 420)
    expect(middle(added)).toEqual({ x: 760, y: 420 })
    expect({ x: s().c4Nodes.web.x, y: s().c4Nodes.web.y }).toEqual({ x: 30, y: 120 })
  })

  it('goes to the next cell of the grid over another element, the header or the edge', () => {
    for (const [x, y] of [[150, 200], [500, 40], [1050, 400]]) {
      s().loadDiagram(model())
      const added = drop('container', 'sys', x, y)
      expect(middle(added), `dropped at ${x}, ${y}`).not.toEqual({ x, y })
      // Beside Web, in its row: the grid's next cell.
      expect(added.y, `dropped at ${x}, ${y}`).toBe(120)
      expect(added.x, `dropped at ${x}, ${y}`).toBeGreaterThanOrEqual(30 + 240)
    }
  })
})
