import { describe, expect, it } from 'vitest'
import { oversizedCanvas } from '../src/store/diagramStore'
import { CANVAS_MAX_ELEMENTS, type C4Node, type DiagramView } from '@radical/common/c4'

const nodesOf = (n: number): Record<string, C4Node> =>
  Object.freeze(Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, { id: `r${i}`, type: 'requirement', label: `R${i}`, x: 0, y: 0, width: 240, height: 140, collapsed: false } as C4Node])))

const chain = (kind?: DiagramView['kind']): DiagramView =>
  ({ id: 'v', name: 'Every requirement', kind, nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } }) as DiagramView

const state = (view: DiagramView | null, n: number) =>
  ({ activeViewId: view?.id ?? null, views: view ? { [view.id]: view } : {}, c4Nodes: nodesOf(n), c4Relations: Object.freeze({}) })

describe('a canvas with more elements than a canvas draws', () => {
  it('draws up to CANVAS_MAX_ELEMENTS, and says how many past them', () => {
    expect(oversizedCanvas(state(chain(), CANVAS_MAX_ELEMENTS))).toBeNull()
    expect(oversizedCanvas(state(chain(), CANVAS_MAX_ELEMENTS + 1))?.count).toBe(CANVAS_MAX_ELEMENTS + 1)
  })

  it('leaves tables, wikis and All elements to show any number', () => {
    for (const kind of ['table', 'wiki', 'matrix'] as const) expect(oversizedCanvas(state(chain(kind), 5000))).toBeNull()
    expect(oversizedCanvas(state(null, 5000))).toBeNull()
  })
})
