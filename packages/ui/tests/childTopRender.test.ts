/**
 * The canvas draws a container's children where the model has them. It used
 * to draw every child nearer than 110 px to its parent's top at 110, "without
 * mutating the model": children the live physics had settled at about 60
 * jumped down on every reload, view switch and redo, and the canvas showed
 * what the file did not. Only a child saved on top of the parent's header is
 * still drawn below it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { LIVE_CHILD_TOP_MIN } from '@radical/layout/liveColaEngine'
import { useDiagramStore } from '../src/store/diagramStore'

function load(childY: number): void {
  const nodes: C4Node[] = [
    { id: 'sys', type: 'system', label: 'Sys', collapsed: false, x: 0, y: 0, width: 700, height: 420 } as C4Node,
    { id: 'api', type: 'container', label: 'API', collapsed: false, parentId: 'sys', x: 40, y: childY, ...NODE_SIZES.container } as C4Node,
  ]
  useDiagramStore.getState().loadDiagram({ nodes, relations: [] })
}

const drawnY = (): number => useDiagramStore.getState().rfNodes.find((n) => n.id === 'api')!.position.y

describe('Where the canvas draws a child of an open container', () => {
  afterEach(() => useDiagramStore.getState().stopLiveLayout())

  it('is where the live physics left it', () => {
    load(60)
    expect(drawnY()).toBe(60)
    expect(useDiagramStore.getState().c4Nodes.api.y).toBe(60)
  })

  it('is where a layout put it', () => {
    load(120)
    expect(drawnY()).toBe(120)
  })

  it('is below the header when the file has it on top of the header', () => {
    load(10)
    expect(drawnY()).toBe(LIVE_CHILD_TOP_MIN)
  })
})
