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

  it('clearDiagram keeps only the metamodel', () => {
    const f = facade({ sequences: [{ id: 'seq', name: 'Flow', steps: [] } as never] })
    f.addNode(node('system', 'A'))
    f.addView!('V')
    f.clearDiagram!()
    expect(f.toDiagramData()).toEqual({ nodes: [], relations: [], views: [], metamodel: MM })
  })

  it('applies the C4 metamodel when the document has none', () => {
    const f = createModelFacade({ nodes: [], relations: [] })
    expect(f.getMetamodel!()?.id).toBe('c4-builtin')
  })
})
