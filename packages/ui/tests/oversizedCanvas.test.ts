import { beforeEach, describe, expect, it } from 'vitest'
import { oversizedCanvas, tooLargeToExplore, useDiagramStore } from '../src/store/diagramStore'
import { CANVAS_MAX_ELEMENTS, type C4Node, type C4Relation, type DiagramView } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { noCanvasLayout } from '@radical/common/ai/tools'

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

describe('the canvas limit counts what the canvas draws', () => {
  // Shop holds API, which holds one component more than a canvas draws.
  const N = CANVAS_MAX_ELEMENTS + 1
  const box = (id: string, type: string, parentId?: string, collapsed = false): C4Node =>
    ({ id, type, label: id, x: 0, y: 0, width: 240, height: 140, collapsed, ...(parentId ? { parentId } : {}) }) as C4Node
  const model = (apiFolded = false): Record<string, C4Node> => Object.freeze(Object.fromEntries([
    box('shop', 'system'), box('api', 'container', 'shop', apiFolded),
    ...Array.from({ length: N }, (_, i) => box(`c${i}`, 'component', 'api')),
  ].map((n) => [n.id, n])))
  const every = ['shop', 'api', ...Array.from({ length: N }, (_, i) => `c${i}`)]
  const view = (fields: Partial<DiagramView>): DiagramView => ({ id: 'v', name: 'API', nodeIds: every, positions: {}, ...fields }) as DiagramView
  const chain = { levels: [{ ways: [{ types: ['system', 'container', 'component'] }] }] }

  // [what, the view, API folded on the model, how many the canvas draws (null: within the limit)]
  const cases: Array<[string, DiagramView, boolean, number | null]> = [
    ['API folded in the view', view({ collapsedNodeIds: ['api'] }), false, null],
    ['API folded on the model', view({}), true, null],
    ['API folded on the model, opened in the view', view({ expandedNodeIds: ['api'] }), true, N + 2],
    ['API folded in the view and opened in it', view({ collapsedNodeIds: ['api'], expandedNodeIds: ['api'] }), false, N + 2],
    ['API open', view({}), false, N + 2],
    ['a view of every element, API folded in it', view({ nodeIds: [] }), true, null],
    ['a filter chain, API open', view({ nodeIds: [], pipeline: chain }), false, N + 2],
    ['a filter chain, API folded in the view', view({ nodeIds: [], pipeline: chain, collapsedNodeIds: ['api'] }), false, null],
    // API is only a frame round the components: a frame is never folded.
    ['the components alone, API folded in the view', view({ nodeIds: every.slice(2), collapsedNodeIds: ['api'] }), false, N],
  ]

  it("leaves out what lies in a container folded in the view, or on the model and not opened there; a frame is never folded", () => {
    for (const [what, v, apiFolded, drawn] of cases) {
      const nodes = model(apiFolded)
      const s = { activeViewId: 'v', views: { v }, exploration: null, c4Nodes: nodes, c4Relations: Object.freeze({}) }
      // Studio's notice and the MCP server's layout tools alike.
      expect(oversizedCanvas(s)?.count ?? null, what).toBe(drawn)
      expect(noCanvasLayout('smart_layout', v, nodes, {}) !== null, what).toBe(drawn !== null)
    }
  })

  it('still counts the folded elements for an exploration, which lists them all', () => {
    const v = view({ collapsedNodeIds: ['api'] })
    expect(tooLargeToExplore({ views: { v }, c4Nodes: model(), c4Relations: Object.freeze({}) }, 'v')).toBe(true)
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
