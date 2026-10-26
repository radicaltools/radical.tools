import { describe, it, expect } from 'vitest'
import { createModelFacade } from '../src/ai/modelFacade'
import type { C4Node, DiagramData } from '../src/c4'
import type { Metamodel, NodeTypeDef } from '../src/metamodel/index'

const type = (id: string, extra: Partial<NodeTypeDef> = {}): NodeTypeDef => ({
  id, label: id[0].toUpperCase() + id.slice(1), color: '', fg: '', iconPath: '', width: 200, height: 100, ...extra,
})

/** Systems at the root (at most two), containers only inside systems, and
 *  "uses" relations between systems only. */
const MM: Metamodel = {
  id: 'test',
  name: 'Test',
  nodeTypes: {
    system: type('system', { allowedAtRoot: true, cardinality: { max: 2 } }),
    container: type('container', { allowedParents: ['system'] }),
    requirement: type('requirement', {
      allowedAtRoot: true,
      properties: [{ key: 'priority', label: 'Priority', type: 'text', default: 'must' }],
    }),
  },
  relationTypes: {
    uses: { id: 'uses', label: 'Uses', allowedPairs: [{ from: 'system', to: 'system' }] },
  },
}

const node = (t: string, label: string, extra: Partial<C4Node> = {}): Omit<C4Node, 'id'> =>
  ({ type: t, label, collapsed: false, x: 0, y: 0, width: 200, height: 100, ...extra }) as Omit<C4Node, 'id'>

function facade(data: Partial<DiagramData> = {}) {
  let seq = 0
  return createModelFacade({ nodes: [], relations: [], metamodel: MM, ...data }, { newId: () => `id${++seq}` })
}

describe('createModelFacade', () => {
  it('adds nodes with their metamodel defaults', () => {
    const f = facade()
    const id = f.addNode(node('requirement', 'Login'))
    expect(id).toBe('id1')
    expect(f.getNodes()[id]).toMatchObject({ id, label: 'Login', priority: 'must' })
  })

  it('refuses placements the metamodel forbids, with the reason', () => {
    const f = facade()
    expect(f.addNode(node('container', 'API'))).toBe('')
    expect(f.lastError).toBe('Cannot place Container inside the canvas root. Allowed parents: System.')
    f.addNode(node('system', 'A'))
    f.addNode(node('system', 'B'))
    expect(f.addNode(node('system', 'C'))).toBe('')
    expect(f.lastError).toBe('Cannot add another System: maximum (2) reached in the metamodel.')
    expect(Object.keys(f.getNodes())).toHaveLength(2)
  })

  it('refuses a reparent that breaks containment and leaves the node unchanged', () => {
    const f = facade()
    const sys = f.addNode(node('system', 'A'))
    const api = f.addNode(node('container', 'API', { parentId: sys }))
    f.updateNode(api, { parentId: undefined })
    expect(f.lastError).toBe('Cannot move Container "API" into the canvas root. Allowed parents: System.')
    expect(f.getNodes()[api].parentId).toBe(sys)
  })

  it('moves nodes into another parent, keeping their canvas position', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A', { x: 100, y: 50 }))
    const b = f.addNode(node('system', 'B', { x: 600, y: 0 }))
    const api = f.addNode(node('container', 'API', { parentId: a, x: 20, y: 130 }))
    f.moveNodes!([api], b)
    expect(f.lastError).toBeNull()
    // Absolute (120, 180) stays put, now relative to B at (600, 0).
    expect(f.getNodes()[api]).toMatchObject({ parentId: b, x: -480, y: 180 })
  })

  it('moves a node in every view that keeps a place for it: inside the new parent there, or placed afresh', () => {
    const at = (x: number, y: number, width = 200, height = 100) => ({ x, y, width, height })
    const f = facade({
      nodes: [
        { id: 'a', ...node('system', 'A', { x: 0, y: 0, width: 600, height: 400 }) },
        { id: 'b', ...node('system', 'B', { x: 700, y: 0, width: 600, height: 400 }) },
        { id: 'api', ...node('container', 'API', { parentId: 'a', x: 30, y: 130 }) },
        { id: 'db', ...node('container', 'DB', { parentId: 'b', x: 30, y: 130 }) },
      ] as C4Node[],
      views: [
        // B lies round API here: moved into B, API keeps its place on it.
        { id: 'over', name: 'Over', nodeIds: [], positions: { a: at(0, 0, 600, 400), b: at(-100, 100, 600, 400), api: at(30, 130), db: at(300, 200) } },
        // B is far away: API's place here is dropped, for the canvas to give it one inside B.
        { id: 'apart', name: 'Apart', nodeIds: [], positions: { a: at(0, 0, 600, 400), b: at(0, 900, 600, 400), api: at(30, 130) } },
        // Inside B, but on DB: dropped too.
        { id: 'onDb', name: 'On DB', nodeIds: [], positions: { a: at(0, 0, 600, 400), b: at(-100, 100, 600, 400), api: at(30, 130), db: at(100, 0) } },
      ],
    })
    f.moveNodes!(['api'], 'b')
    expect(f.lastError).toBeNull()
    const views = f.getViews!()
    expect(views.over.positions.api).toEqual(at(130, 30))
    expect(views.apart.positions.api).toBeUndefined()
    expect(views.onDb.positions.api).toBeUndefined()
    expect(views.apart.positions.b).toEqual(at(0, 900, 600, 400))
  })

  it('refuses moves into a descendant or a forbidden parent, leaving the node unchanged', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const api = f.addNode(node('container', 'API', { parentId: a }))
    f.moveNodes!([a], api)
    expect(f.lastError).toBe('Cannot move a node into itself or one of its descendants.')
    f.moveNodes!([api], null)
    expect(f.lastError).toBe('Cannot place Container "API" inside the canvas root. Allowed parents: System.')
    expect(f.getNodes()[api].parentId).toBe(a)
    expect(f.getNodes()[a].parentId).toBeUndefined()
  })

  it('infers the relation type and refuses pairs the metamodel does not allow', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const b = f.addNode(node('system', 'B'))
    const api = f.addNode(node('container', 'API', { parentId: a }))
    f.addRelation({ sourceId: a, targetId: b })
    expect(Object.values(f.getRelations())).toEqual([{ id: 'id4', sourceId: a, targetId: b, relationType: 'uses' }])
    f.addRelation({ sourceId: api, targetId: b })
    expect(f.lastError).toBe('Relation not allowed: Container → System. The metamodel does not permit this connection.')
    expect(Object.keys(f.getRelations())).toHaveLength(1)
  })

  it('removing a node removes its descendants, their relations and view references', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const b = f.addNode(node('system', 'B'))
    const api = f.addNode(node('container', 'API', { parentId: a }))
    f.addRelation({ sourceId: a, targetId: b })
    const view = f.addView!('Context')
    f.setViewNodes!(view, [a, api, b])
    f.removeNode(a)
    expect(Object.keys(f.getNodes())).toEqual([b])
    expect(f.getRelations()).toEqual({})
    expect(f.getViews!()[view].nodeIds).toEqual([b])
  })

  it('removing a node a milestone holds leaves it on that milestone\'s view (delete_node, F-0053)', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const b = f.addNode(node('system', 'B'))
    const view = f.addView!('Context')
    f.setViewNodes!(view, [a, b])
    f.getViews!()[view].positions = { [a]: { x: 0, y: 0, width: 200, height: 100 } }
    f.createMilestone!('As-is')
    f.removeNode(a)
    expect(f.getViews!()[view].nodeIds).toEqual([b])
    const [milestone] = f.toDiagramData().snapshots!
    expect(milestone.views?.[view]?.nodeIds).toEqual([a, b])
    // Its list only: the places and the rest of the layout stay the view's,
    // for every milestone.
    expect(Object.keys(milestone.views![view]).sort()).toEqual(['empty', 'id', 'nodeIds'])
    // An element added since a milestone: it has nothing to keep.
    f.createMilestone!('To-be')
    const c = f.addNode(node('requirement', 'C'))
    f.setViewNodes!(view, [b, c])
    f.removeNode(c)
    expect(f.toDiagramData().snapshots![1].views).toBeUndefined()
  })

  it('removing the element of a view of one element keeps that view, with its places, in a milestone that holds it (delete_node, F-0064)', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const view = f.addView!('A')
    f.getViews!()[view].subject = a
    f.getViews!()[view].positions = { [a]: { x: 0, y: 0, width: 200, height: 100 } }
    f.createMilestone!('As-is')
    f.removeNode(a)
    expect(f.getViews!()[view]).toBeUndefined()
    const [milestone] = f.toDiagramData().snapshots!
    expect(milestone.views?.[view]?.subject).toBe(a)
    expect(milestone.views?.[view]?.positions).toEqual({ [a]: { x: 0, y: 0, width: 200, height: 100 } })
  })

  it('removing a sequence a milestone holds keeps its flow view linked there (delete_sequence, F-0065)', () => {
    const f = facade()
    const q = f.addSequence!('Pay')
    const view = f.addView!('Flow')
    f.setViewSequence!(view, q)
    f.createMilestone!('As-is')
    f.removeSequence!(q)
    expect(f.getViews!()[view].sequenceId).toBeUndefined()
    expect(f.toDiagramData().snapshots![0].views?.[view]?.sequenceId).toBe(q)
  })

  it('keeps view node lists to known ids, deduplicated, and adds new nodes to the active view', () => {
    const f = facade()
    const a = f.addNode(node('system', 'A'))
    const view = f.addView!('Context')
    f.setViewNodes!(view, [a, 'ghost', a])
    expect(f.getViews!()[view].nodeIds).toEqual([a])
    f.setActiveView!(view)
    const b = f.addNode(node('system', 'B'))
    expect(f.getViews!()[view].nodeIds).toEqual([a, b])
    expect(f.getActiveView!()).toEqual({ id: view, name: 'Context', nodeIds: [a, b] })
    f.removeView!(view)
    expect(f.getActiveView!()).toBeNull()
  })

  it('round-trips a document and carries the fields it does not edit', () => {
    const input: DiagramData = {
      nodes: [{ id: 's', type: 'system', label: 'S', collapsed: false, x: 1, y: 2, width: 3, height: 4 }],
      relations: [],
      sequences: [{ id: 'seq', name: 'Flow', steps: [] } as never],
      metamodel: MM,
    }
    const f = createModelFacade(input)
    f.updateNode('s', { label: 'S2' })
    const out = f.toDiagramData()
    expect(out.nodes[0].label).toBe('S2')
    expect(out.sequences).toEqual(input.sequences)
    expect(out.metamodel).toEqual(MM)
    expect(input.nodes[0].label).toBe('S') // the input is not mutated
  })

  it('clearDiagram keeps the metamodel, milestones and presentations', () => {
    const snapshots = [{ id: 'm1', name: 'v1', nodes: {}, relations: {} } as never]
    const presentations = [{ id: 'p1', name: 'Deck', slides: [] } as never]
    const f = facade({ sequences: [{ id: 'seq', name: 'Flow', steps: [] } as never], snapshots, presentations, defaultPositions: {} })
    f.addNode(node('system', 'A'))
    f.addView!('V')
    f.clearDiagram!()
    expect(f.toDiagramData()).toEqual({ nodes: [], relations: [], views: [], metamodel: MM, snapshots, presentations })
  })

  it('applies the C4 metamodel when the document has none', () => {
    const f = createModelFacade({ nodes: [], relations: [] })
    expect(f.getMetamodel!()?.id).toBe('c4-builtin')
  })
})

describe('a move into another member of a row, column or grid', () => {
  const BOXES: Metamodel = { id: 'boxes', name: 'Boxes', nodeTypes: { system: type('system', { allowedAtRoot: true, allowedParents: ['system'] }) }, relationTypes: {} }
  const box = (id: string, x: number, y: number): C4Node => ({ id, type: 'system', label: id.toUpperCase(), collapsed: false, x, y, width: 300, height: 180 }) as C4Node
  const grid = { id: 'g', type: 'grid' as const, columns: 2, nodeIds: ['s1', 's2', 's3', 's4'] }
  const row = { id: 'r', type: 'align' as const, axis: 'horizontal' as const, nodeIds: ['s4', 's2'] }
  const pin = { id: 'p', type: 'pin' as const, nodeIds: ['s4'] }

  it('takes the element out of the alignments it would share with its new parent, on every canvas (item 166)', () => {
    const nodes = [box('s1', 0, 0), box('s2', 400, 0), box('s3', 0, 300), box('s4', 400, 300)]
    const at = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]))
    const f = createModelFacade({
      nodes, relations: [], metamodel: BOXES,
      views: [
        { id: 'v1', name: 'One', nodeIds: [], positions: at, layoutConstraints: [grid, pin] },
        { id: 'v2', name: 'Two', nodeIds: [], positions: at, layoutConstraints: [row] },
      ],
      defaultPositions: at,
      defaultLayoutConstraints: [grid],
    })
    f.moveNodes!(['s4'], 's2')
    expect(f.lastError ?? '').toBe('')
    expect(f.getNodes().s4.parentId).toBe('s2')
    expect(f.getLayoutConstraints!('v1')).toEqual([{ ...grid, nodeIds: ['s1', 's2', 's3'] }, pin])
    // A row left with one member goes.
    expect(f.getLayoutConstraints!('v2')).toEqual([])
    expect(f.getLayoutConstraints!(null)).toEqual([{ ...grid, nodeIds: ['s1', 's2', 's3'] }])
  })

  it('keeps it in an alignment with its new siblings', () => {
    const nodes = [box('s1', 0, 0), box('s2', 400, 0), { ...box('c', 30, 120), parentId: 's1' } as C4Node]
    const line = { id: 'l', type: 'align' as const, axis: 'vertical' as const, nodeIds: ['c', 's2'] }
    const f = createModelFacade({ nodes, relations: [], metamodel: BOXES, views: [{ id: 'v', name: 'V', nodeIds: [], positions: {}, layoutConstraints: [line] }] })
    f.moveNodes!(['c'], null)
    expect(f.getLayoutConstraints!('v')).toEqual([line])
  })
})
