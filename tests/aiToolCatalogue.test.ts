import { describe, it, expect } from 'vitest'
import { buildToolDefs, buildToolHandlers } from '../src/renderer/src/ai/tools'
import type { ToolRunContext } from '../src/renderer/src/ai/tools/types'
import type { DiagramFacade } from '../src/renderer/src/ai/diagramFacade'
import type { C4Node, C4Relation, DiagramView } from '../src/renderer/src/types/c4'
import type { Metamodel } from '../src/renderer/src/types/metamodel'

function makeFacade(mm?: Metamodel): DiagramFacade & {
  _nodes: Record<string, C4Node>
  _rels: Record<string, C4Relation>
  _views: Record<string, DiagramView>
} {
  const nodes: Record<string, C4Node> = {}
  const rels: Record<string, C4Relation> = {}
  const views: Record<string, DiagramView> = {}
  let seq = 0
  return {
    _nodes: nodes,
    _rels: rels,
    _views: views,
    getNodes: () => nodes,
    getRelations: () => rels,
    getViews: () => views,
    getMetamodel: () => mm,
    addNode: (n) => { const id = `n${++seq}`; nodes[id] = { id, ...n }; return id },
    updateNode: (id, u) => { if (nodes[id]) Object.assign(nodes[id], u) },
    removeNode: (id) => { delete nodes[id] },
    addRelation: (r) => { const id = `r${++seq}`; rels[id] = { id, ...r } },
    updateRelation: (id, u) => { if (rels[id]) Object.assign(rels[id], u) },
    removeRelation: (id) => { delete rels[id] },
    addView: (name) => { const id = `v${++seq}`; views[id] = { id, name, nodeIds: [], positions: {} }; return id },
    setViewNodes: (id, nodeIds) => { if (views[id]) views[id].nodeIds = nodeIds },
    removeView: (id) => { delete views[id] },
    setActiveView: () => {},
    setViewKind: (id, kind) => { if (views[id]) views[id].kind = kind },
    clearDiagram: () => {
      for (const id of Object.keys(nodes)) delete nodes[id]
      for (const id of Object.keys(rels)) delete rels[id]
      for (const id of Object.keys(views)) delete views[id]
    },
  }
}

function makeCtx(diagram: DiagramFacade): ToolRunContext {
  const tempToReal = new Map<string, string>()
  let placed = 0
  return {
    diagram,
    resolveId: (id) => tempToReal.get(id) ?? id,
    registerTempId: (t, r) => { tempToReal.set(t, r) },
    resetTempIds: () => { tempToReal.clear() },
    placeNext: () => { placed++; return { x: placed * 10, y: 0 } },
  }
}

const REQUIREMENT_MM: Metamodel = {
  id: 'test',
  name: 'Test',
  nodeTypes: {
    system: { id: 'system', label: 'System', color: '', fg: '', iconPath: '', width: 0, height: 0, allowedAtRoot: true },
    requirement: {
      id: 'requirement', label: 'Requirement', color: '', fg: '', iconPath: '', width: 0, height: 0,
      allowedAtRoot: true,
      properties: [
        { key: 'ears_type', label: 'EARS type', type: 'enum', options: ['ubiquitous', 'event-driven'] },
        { key: 'action', label: 'Action', type: 'textarea' },
      ],
    },
  },
  relationTypes: {
    derives: { id: 'derives', label: 'Derives from', allowedPairs: [{ from: 'requirement', to: 'requirement' }], properties: [] },
  },
}

describe('buildToolDefs', () => {
  it('includes every tool, with a metamodel-driven node-type enum', () => {
    const defs = buildToolDefs(REQUIREMENT_MM)
    const names = defs.map((d) => d.name)
    expect(names).toEqual(expect.arrayContaining([
      'add_node', 'update_node', 'delete_node',
      'add_relation', 'update_relation', 'delete_relation',
      'create_view', 'set_view_nodes', 'delete_view', 'set_active_view',
      'search_model', 'focus_node', 'reset_diagram',
    ]))
    const addNode = defs.find((d) => d.name === 'add_node')!
    const schema = addNode.inputSchema as { properties: { type: { enum: string[] } } }
    expect(schema.properties.type.enum).toEqual(['system', 'requirement'])
  })
})

describe('node tools', () => {
  it('add_node applies a valid properties bag and drops unknown keys with a note', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    const result = handlers.get('add_node')!(
      { tempId: 't1', type: 'requirement', label: 'REQ', properties: { ears_type: 'event-driven', action: 'do X', bogus: 'nope' } },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect(result.added).toEqual({ nodes: 1 })
    expect(result.resultText).toMatch(/ignored property "bogus"/)
    const node = Object.values(facade._nodes)[0] as unknown as Record<string, unknown>
    expect(node.ears_type).toBe('event-driven')
    expect(node.action).toBe('do X')
    expect(node.bogus).toBeUndefined()
  })

  it('add_node drops an invalid enum value instead of failing the whole call', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    const result = handlers.get('add_node')!(
      { tempId: 't1', type: 'requirement', label: 'REQ', properties: { ears_type: 'not-a-real-option' } },
      ctx,
    )
    expect(result.ok).toBe(true)
    const node = Object.values(facade._nodes)[0] as unknown as Record<string, unknown>
    expect(node.ears_type).toBeUndefined()
    expect(result.resultText).toMatch(/must be one of/)
  })

  it('update_node validates properties against the node type', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 't1', type: 'requirement', label: 'REQ' }, ctx)
    const id = ctx.resolveId('t1')
    const result = handlers.get('update_node')!({ id, properties: { action: 'updated' } }, ctx)
    expect(result.ok).toBe(true)
    expect((facade._nodes[id] as unknown as Record<string, unknown>).action).toBe('updated')
  })

  it('delete_node resolves a tempId and removes the node', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 't1', type: 'system', label: 'Sys' }, ctx)
    const result = handlers.get('delete_node')!({ id: 't1' }, ctx)
    expect(result.ok).toBe(true)
    expect(Object.keys(facade._nodes)).toHaveLength(0)
  })

  it('add_node fails cleanly when the store rejects it (empty id)', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    facade.addNode = () => ''
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    const result = handlers.get('add_node')!({ tempId: 't1', type: 'system', label: 'X' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.resultText).toMatch(/rejected by the metamodel/)
  })
})

describe('relation tools', () => {
  it('add_relation with an explicit relationType validated against allowedPairs', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 'a', type: 'requirement', label: 'A' }, ctx)
    handlers.get('add_node')!({ tempId: 'b', type: 'requirement', label: 'B' }, ctx)
    const result = handlers.get('add_relation')!({ sourceId: 'a', targetId: 'b', relationType: 'derives' }, ctx)
    expect(result.ok).toBe(true)
    expect(Object.values(facade._rels)[0].relationType).toBe('derives')
  })

  it('rejects an explicit relationType that does not match allowedPairs', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 'a', type: 'system', label: 'Sys' }, ctx)
    handlers.get('add_node')!({ tempId: 'b', type: 'requirement', label: 'Req' }, ctx)
    const result = handlers.get('add_relation')!({ sourceId: 'a', targetId: 'b', relationType: 'derives' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.resultText).toMatch(/does not allow/)
    expect(Object.keys(facade._rels)).toHaveLength(0)
  })

  it('omitting relationType lets the store auto-infer', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 'a', type: 'requirement', label: 'A' }, ctx)
    handlers.get('add_node')!({ tempId: 'b', type: 'requirement', label: 'B' }, ctx)
    // Mimics the store's own auto-infer behaviour (derives is the sole
    // requirement->requirement relation type, so inference is unambiguous).
    facade.addRelation = (r) => {
      facade._rels.r1 = { id: 'r1', ...r, relationType: r.relationType ?? 'derives' }
    }
    const result = handlers.get('add_relation')!({ sourceId: 'a', targetId: 'b' }, ctx)
    expect(result.ok).toBe(true)
    expect(facade._rels.r1.relationType).toBe('derives')
  })

  it('delete_relation removes an existing relation', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    facade._rels.r1 = { id: 'r1', sourceId: 'x', targetId: 'y' }
    const handlers = buildToolHandlers()
    const result = handlers.get('delete_relation')!({ id: 'r1' }, ctx)
    expect(result.ok).toBe(true)
    expect(facade._rels.r1).toBeUndefined()
  })
})

describe('view tools', () => {
  it('create_view sets kind via setViewKind', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    const result = handlers.get('create_view')!({ tempId: 'v1', name: 'Governance', kind: 'table' }, ctx)
    expect(result.ok).toBe(true)
    expect(Object.values(facade._views)[0].kind).toBe('table')
  })

  it('reports an error when the facade has no view support', () => {
    const facade: DiagramFacade = {
      getNodes: () => ({}),
      getRelations: () => ({}),
      addNode: () => 'n1',
      updateNode: () => {},
      removeNode: () => {},
      addRelation: () => {},
      removeRelation: () => {},
    }
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    const result = handlers.get('create_view')!({ tempId: 'v1', name: 'X' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.resultText).toMatch(/not editable/)
  })
})

describe('model tools', () => {
  it('search_model runs the query language against the live facade', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    facade._nodes.n1 = { id: 'n1', type: 'system', label: 'Sys', collapsed: false, x: 0, y: 0, width: 1, height: 1 }
    const handlers = buildToolHandlers()
    const result = handlers.get('search_model')!({ query: 'LIST NODES' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.resultText).toMatch(/Sys/)
  })

  it('search_model filters on a custom property via the WHERE fallback', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    facade._nodes.n1 = {
      id: 'n1', type: 'requirement', label: 'R', collapsed: false, x: 0, y: 0, width: 1, height: 1,
      ears_type: 'event-driven',
    } as unknown as C4Node
    const handlers = buildToolHandlers()
    const result = handlers.get('search_model')!({ query: 'LIST NODES WHERE ears_type = "event-driven"' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.resultText).toMatch(/"R"/)
  })

  it('focus_node resolves a tempId and records it', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 't1', type: 'system', label: 'Sys' }, ctx)
    const result = handlers.get('focus_node')!({ id: 't1' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.focusNodeId).toBe(ctx.resolveId('t1'))
  })

  it('reset_diagram clears the diagram and the tempId map', () => {
    const facade = makeFacade(REQUIREMENT_MM)
    const ctx = makeCtx(facade)
    const handlers = buildToolHandlers()
    handlers.get('add_node')!({ tempId: 't1', type: 'system', label: 'Sys' }, ctx)
    const result = handlers.get('reset_diagram')!({}, ctx)
    expect(result.ok).toBe(true)
    expect(Object.keys(facade._nodes)).toHaveLength(0)
    expect(ctx.resolveId('t1')).toBe('t1') // no longer resolves — map was cleared
  })
})
