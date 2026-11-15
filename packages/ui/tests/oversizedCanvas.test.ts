import { beforeEach, describe, expect, it } from 'vitest'
import { oversizedCanvas, useDiagramStore } from '../src/store/diagramStore'
import { CANVAS_MAX_ELEMENTS, type C4Node, type C4Relation, type DiagramView } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'

const nodesOf = (n: number): Record<string, C4Node> =>
  Object.freeze(Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, { id: `r${i}`, type: 'requirement', label: `R${i}`, x: 0, y: 0, width: 240, height: 140, collapsed: false } as C4Node])))

const chain = (kind?: DiagramView['kind']): DiagramView =>
  ({ id: 'v', name: 'Every requirement', kind, nodeIds: Object.freeze([]) as unknown as string[], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } }) as DiagramView

const state = (view: DiagramView | null, n: number) =>
  ({ activeViewId: view?.id ?? null, views: view ? { [view.id]: view } : {}, exploration: null, c4Nodes: nodesOf(n), c4Relations: Object.freeze({}) })

/** A view of type Explore listing `n` elements, grown from the first. */
const explored = (n: number): DiagramView => ({
  id: 'v', name: 'Explored', kind: 'explore', positions: {},
  nodeIds: Array.from({ length: n }, (_, i) => `r${i}`),
  explore: { start: 'r0', levels: Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${i}`, i ? 1 : 0])), addedBy: {}, expansions: {} },
}) as DiagramView

describe('a canvas with more elements than a canvas draws', () => {
  it('draws up to CANVAS_MAX_ELEMENTS, and says how many past them', () => {
    expect(oversizedCanvas(state(chain(), CANVAS_MAX_ELEMENTS))).toBeNull()
    expect(oversizedCanvas(state(chain(), CANVAS_MAX_ELEMENTS + 1))?.count).toBe(CANVAS_MAX_ELEMENTS + 1)
  })

  it('leaves tables, wikis and All elements to show any number', () => {
    for (const kind of ['table', 'wiki', 'matrix'] as const) expect(oversizedCanvas(state(chain(kind), 5000))).toBeNull()
    expect(oversizedCanvas(state(null, 5000))).toBeNull()
  })

  it('counts a view of type Explore by the elements it lists', () => {
    expect(oversizedCanvas(state(explored(CANVAS_MAX_ELEMENTS), CANVAS_MAX_ELEMENTS + 5))).toBeNull()
    expect(oversizedCanvas(state(explored(CANVAS_MAX_ELEMENTS + 1), CANVAS_MAX_ELEMENTS + 5))?.count).toBe(CANVAS_MAX_ELEMENTS + 1)
  })
})

describe('an exploration never draws more than a canvas draws', () => {
  const s = useDiagramStore.getState
  const requirement = (id: string): C4Node => ({ id, type: 'requirement', label: id, x: 0, y: 0, width: 240, height: 140, collapsed: false } as C4Node)

  /** `n` requirements derived from one need, and the view of every requirement. */
  function load(n: number): void {
    const nodes = [{ id: 'need', type: 'need', label: 'The brief', x: 0, y: 0, width: 240, height: 140, collapsed: false } as C4Node, ...Array.from({ length: n }, (_, i) => requirement(`r${i}`))]
    const relations: C4Relation[] = Array.from({ length: n }, (_, i) => ({ id: `d${i}`, sourceId: `r${i}`, targetId: 'need', relationType: 'derives', label: '' }))
    s().loadDiagram({ metamodel: builtInGovernanceMetamodel(), nodes, relations, views: [chain()] })
  }

  beforeEach(() => {
    useDiagramStore.setState({ appMode: 'designer', presentationActive: false } as never)
  })

  it('keeps a view too large for a canvas as it is when switched to Explore: the notice stays', () => {
    load(CANVAS_MAX_ELEMENTS + 1)
    s().setActiveView('v')
    expect(oversizedCanvas(s())?.count).toBe(CANVAS_MAX_ELEMENTS + 1)
    s().setViewKind('v', 'explore')
    expect(s().views.v.kind ?? 'static').toBe('static')
    expect(s().views.v.explore).toBeUndefined()
    expect(oversizedCanvas(s())?.count).toBe(CANVAS_MAX_ELEMENTS + 1)
    // Within the limit it turns.
    load(CANVAS_MAX_ELEMENTS - 1)
    s().setViewKind('v', 'explore')
    expect(s().views.v.kind).toBe('explore')
    expect(s().views.v.nodeIds).toHaveLength(CANVAS_MAX_ELEMENTS - 1)
  })

  it("adds no + past the limit: All of a need with more requirements than a canvas draws adds nothing", () => {
    load(CANVAS_MAX_ELEMENTS)
    s().exploreFrom('need')
    s().exploreNeighbours('need')
    expect(s().exploration!.nodeIds).toEqual(['need'])
    expect(oversizedCanvas(s())).toBeNull()
    // One fewer fits: the need and its 999 requirements.
    load(CANVAS_MAX_ELEMENTS - 1)
    s().exploreFrom('need')
    s().exploreNeighbours('need')
    expect(s().exploration!.nodeIds).toHaveLength(CANVAS_MAX_ELEMENTS)
  })
})
