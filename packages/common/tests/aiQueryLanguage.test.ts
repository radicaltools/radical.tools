import { describe, expect, it } from 'vitest'
import { formatModelQueryResults, runModelQuery } from '../src/ai/queryLanguage'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'

const nodes: Record<string, C4Node> = {
  sys1: {
    id: 'sys1', type: 'system', label: 'Payments', technology: 'Node.js', collapsed: false,
    x: 0, y: 0, width: 100, height: 100,
  },
  c1: {
    id: 'c1', type: 'container', label: 'API Gateway', technology: 'React', parentId: 'sys1', collapsed: false,
    x: 0, y: 0, width: 100, height: 100,
  },
  c2: {
    id: 'c2', type: 'database', label: 'Ledger DB', technology: 'Postgres', parentId: 'sys1', collapsed: false,
    x: 0, y: 0, width: 100, height: 100,
  },
  c3: {
    id: 'c3', type: 'container', label: 'Auth Service', technology: 'Go', parentId: 'sys1', collapsed: false,
    x: 0, y: 0, width: 100, height: 100,
  },
  c4: {
    id: 'c4', type: 'container', label: 'Worker', technology: 'Kafka', parentId: 'sys1', collapsed: false,
    x: 0, y: 0, width: 100, height: 100,
  },
}

const relations: Record<string, C4Relation> = {
  r1: { id: 'r1', sourceId: 'c1', targetId: 'c2', label: 'reads', technology: 'SQL' },
  r2: { id: 'r2', sourceId: 'c1', targetId: 'c3', label: 'auth', technology: 'HTTPS' },
  r3: { id: 'r3', sourceId: 'c3', targetId: 'c2', label: 'reads', technology: 'SQL' },
  r4: { id: 'r4', sourceId: 'c4', targetId: 'c3', label: 'calls', technology: 'gRPC' },
}

const views: Record<string, DiagramView> = {
  v1: {
    id: 'v1',
    name: 'Payments View',
    nodeIds: ['c1', 'c2'],
    positions: {},
    hiddenRelationIds: [],
  },
}

describe('runModelQuery', () => {
  it('matches a list value (a multiple reference) when one of its ids does', () => {
    const withList = { ...relations, r5: { ...relations.r4, id: 'r5', raises: ['e1', 'e2'] } as C4Relation, r6: { ...relations.r4, id: 'r6', raises: [] } as unknown as C4Relation }
    const ids = (q: string) => (runModelQuery(q, { nodes, relations: withList, views }).result as { rows: { id: string }[] }).rows.map((r) => r.id)
    expect(ids('LIST RELATIONS WHERE raises = "e2"')).toEqual(['r5'])
    expect(ids('LIST RELATIONS WHERE raises = null')).toEqual(['r1', 'r2', 'r3', 'r4', 'r6'])
    expect(ids('LIST RELATIONS WHERE raises != "e2"')).toEqual(['r1', 'r2', 'r3', 'r4', 'r6'])
  })

  it('lists nodes with WHERE and LIMIT', () => {
    const result = runModelQuery('LIST NODES WHERE label ~ "api" LIMIT 1', { nodes, relations, views })
    expect(result.command).toBe('LIST NODES')
    expect(result.result).toEqual({
      total: 1,
      rows: [
        expect.objectContaining({ id: 'c1', label: 'API Gateway' }),
      ],
    })
  })

  it('supports OR, NOT and parentheses in WHERE expressions', () => {
    const result = runModelQuery(
      'LIST NODES WHERE NOT type = "database" AND (technology ~ "go" OR technology ~ "react")',
      { nodes, relations, views },
    )
    expect(result.command).toBe('LIST NODES')
    expect(result.result).toEqual({
      total: 2,
      rows: [
        expect.objectContaining({ id: 'c1', label: 'API Gateway' }),
        expect.objectContaining({ id: 'c3', label: 'Auth Service' }),
      ],
    })
  })

  it('lists unique technologies with counts', () => {
    const result = runModelQuery('LIST TECHNOLOGIES', { nodes, relations, views })
    expect(result.command).toBe('LIST TECHNOLOGIES')
    expect(result.result).toEqual({
      total: 8,
      rows: expect.arrayContaining([
        expect.objectContaining({ technology: 'React', nodeCount: 1, relationCount: 0 }),
        expect.objectContaining({ technology: 'SQL', nodeCount: 0, relationCount: 2 }),
        expect.objectContaining({ technology: 'gRPC', nodeCount: 0, relationCount: 1 }),
      ]),
    })
  })

  it('returns node neighbors and relations', () => {
    const result = runModelQuery('GET NEIGHBORS OF c1', { nodes, relations, views })
    expect(result.command).toBe('GET NEIGHBORS OF')
    expect(result.result).toEqual(expect.objectContaining({
      nodeId: 'c1',
      total: 2,
      neighbors: expect.arrayContaining([
        expect.objectContaining({ id: 'c2', label: 'Ledger DB' }),
        expect.objectContaining({ id: 'c3', label: 'Auth Service' }),
      ]),
      relations: expect.arrayContaining([
        expect.objectContaining({ id: 'r1', targetId: 'c2' }),
        expect.objectContaining({ id: 'r2', targetId: 'c3' }),
      ]),
    }))
  })

  it('supports multi-hop neighbor traversal with depth information', () => {
    const result = runModelQuery('GET NEIGHBORS OF c4 DEPTH 2', { nodes, relations, views })
    expect(result.command).toBe('GET NEIGHBORS OF')
    expect(result.result).toEqual(expect.objectContaining({
      nodeId: 'c4',
      total: 3,
      rows: expect.arrayContaining([
        expect.objectContaining({ depth: 1, node: expect.objectContaining({ id: 'c3' }) }),
        expect.objectContaining({ depth: 2, node: expect.objectContaining({ id: 'c1' }) }),
        expect.objectContaining({ depth: 2, node: expect.objectContaining({ id: 'c2' }) }),
      ]),
    }))
  })

  it('supports dependency and dependent traversals across multiple hops', () => {
    const dependencies = runModelQuery('GET DEPENDENCIES OF c4 DEPTH 2', { nodes, relations, views })
    expect(dependencies.command).toBe('GET DEPENDENCIES OF')
    expect(dependencies.result).toEqual(expect.objectContaining({
      nodeId: 'c4',
      rows: expect.arrayContaining([
        expect.objectContaining({ depth: 1, node: expect.objectContaining({ id: 'c3' }) }),
        expect.objectContaining({ depth: 2, node: expect.objectContaining({ id: 'c2' }) }),
      ]),
    }))

    const dependents = runModelQuery('GET DEPENDENTS OF c2 DEPTH 2', { nodes, relations, views })
    expect(dependents.command).toBe('GET DEPENDENTS OF')
    expect(dependents.result).toEqual(expect.objectContaining({
      nodeId: 'c2',
      rows: expect.arrayContaining([
        expect.objectContaining({ depth: 1, node: expect.objectContaining({ id: 'c1' }) }),
        expect.objectContaining({ depth: 1, node: expect.objectContaining({ id: 'c3' }) }),
        expect.objectContaining({ depth: 2, node: expect.objectContaining({ id: 'c4' }) }),
      ]),
    }))
  })

  it('formats results as JSON', () => {
    const out = formatModelQueryResults([
      runModelQuery('STATS MODEL', { nodes, relations, views }),
    ])
    expect(out).toMatch(/"nodeCount": 5/)
    expect(out).toMatch(/"viewCount": 1/)
  })

  it('rejects unsupported queries', () => {
    expect(() => runModelQuery('DROP TABLE nodes', { nodes, relations, views })).toThrow(/Unsupported query/)
  })

  it('filters nodes by a custom/governance property via the generic field fallback', () => {
    const reqNodes: Record<string, C4Node> = {
      ...nodes,
      req1: {
        id: 'req1', type: 'requirement', label: 'Req A', collapsed: false, x: 0, y: 0, width: 1, height: 1,
        ears_type: 'event-driven',
      } as unknown as C4Node,
    }
    const result = runModelQuery('LIST NODES WHERE ears_type = "event-driven"', { nodes: reqNodes, relations, views })
    expect(result.result).toEqual({ total: 1, rows: [expect.objectContaining({ id: 'req1', ears_type: 'event-driven' })] })
  })

  it('filters relations by relationType', () => {
    const relsWithDerives: Record<string, C4Relation> = {
      ...relations,
      r5: { id: 'r5', sourceId: 'req1', targetId: 'req2', relationType: 'derives' },
    }
    const result = runModelQuery('LIST RELATIONS WHERE relationType = "derives"', { nodes, relations: relsWithDerives, views })
    expect(result.result).toEqual({ total: 1, rows: [expect.objectContaining({ id: 'r5', relationType: 'derives' })] })
  })

  it('filters relations by whether their source or target is external', () => {
    const box = { collapsed: false, x: 0, y: 0, width: 100, height: 100 }
    const outside: Record<string, C4Node> = {
      user: { id: 'user', type: 'person', label: 'Customer', ...box },
      bank: { id: 'bank', type: 'system', label: 'Bank', external: true, ...box },
      web: { id: 'web', type: 'webapp', label: 'Shop', ...box },
    }
    const calls: Record<string, C4Relation> = {
      a: { id: 'a', sourceId: 'user', targetId: 'web', relationType: 'interacts' },
      b: { id: 'b', sourceId: 'bank', targetId: 'web', relationType: 'interacts' },
      c: { id: 'c', sourceId: 'web', targetId: 'bank', relationType: 'interacts' },
    }
    const ids = (query: string): string[] =>
      (runModelQuery(query, { nodes: outside, relations: calls }).result as { rows: Array<{ id: string }> }).rows.map((r) => r.id)
    expect(ids('LIST RELATIONS WHERE source.external = true')).toEqual(['b'])
    expect(ids('LIST RELATIONS WHERE target.external != true')).toEqual(['a', 'b'])
  })

  it('filters views by kind', () => {
    const viewsWithTable: Record<string, DiagramView> = {
      ...views,
      v2: { id: 'v2', name: 'Gov', kind: 'table', nodeIds: [], positions: {} },
    }
    const result = runModelQuery('LIST VIEWS WHERE kind = "table"', { nodes, relations, views: viewsWithTable })
    expect(result.result).toEqual({ total: 1, rows: [expect.objectContaining({ id: 'v2', kind: 'table' })] })
  })
})
describe('a view that lists no elements', () => {
  // It shows every element in Studio; the query language answered that it
  // was empty.
  const all: Record<string, DiagramView> = { ...views, everything: { id: 'everything', name: 'Everything', nodeIds: [], positions: {} } }
  it('shows every element', () => {
    const view = runModelQuery('GET VIEW everything', { nodes, relations, views: all }).result as { view: { nodeCount: number; relationCount: number } }
    expect(view.view.nodeCount).toBe(Object.keys(nodes).length)
    expect(view.view.relationCount).toBe(Object.keys(relations).length)
    const node = runModelQuery('GET NODE c4', { nodes, relations, views: all }).result as { views: Array<{ id: string }> }
    expect(node.views.map((v) => v.id)).toContain('everything')
  })

  it('unless it was emptied: then it shows none', () => {
    const emptied: Record<string, DiagramView> = { gone: { id: 'gone', name: 'Gone', nodeIds: [], positions: {}, empty: true } }
    const view = runModelQuery('GET VIEW gone', { nodes, relations, views: emptied }).result as { view: { nodeCount: number } }
    expect(view.view.nodeCount).toBe(0)
  })
})
