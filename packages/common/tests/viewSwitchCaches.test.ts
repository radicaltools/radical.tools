import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import { resolveEarsSubject } from '../src/metamodel/index'
import { sortNodes, viewShownNodes } from '../src/viewPipeline'

// The answers views ask for on every switch are kept while what they depend
// on is the same (frozen data, as in Studio's store), and are the same as
// computed afresh.

const node = (id: string, type: string, label: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label, description: '', x: 0, y: 0, width: 100, height: 60, collapsed: false, ...extra } as C4Node)
const rel = (id: string, sourceId: string, targetId: string, relationType: string): C4Relation =>
  ({ id, sourceId, targetId, relationType } as C4Relation)

function model() {
  const nodes: Record<string, C4Node> = {
    n1: node('n1', 'need', 'Need'),
    r1: node('r1', 'requirement', 'Req 10'), r2: node('r2', 'requirement', 'req 9'), r3: node('r3', 'requirement', 'Äpfel'),
    c1: node('c1', 'container', 'Billing'), c2: node('c2', 'container', 'Auth'),
  }
  const relations: Record<string, C4Relation> = {
    a: rel('a', 'r1', 'n1', 'derives'), b: rel('b', 'r2', 'n1', 'derives'),
    s1: rel('s1', 'ghost', 'r1', 'satisfies'), s2: rel('s2', 'c1', 'r1', 'satisfies'), s3: rel('s3', 'c2', 'r1', 'satisfies'), s4: rel('s4', 'c2', 'r2', 'satisfies'),
  }
  const view: DiagramView = { id: 'v', name: 'V', nodeIds: [], positions: {}, kind: 'table', pipeline: { levels: [{ ways: [{ types: ['need'] }] }, { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] }] } }
  return { nodes, relations, view }
}

/** `value` frozen all the way down, as Studio's store (immer) keeps its data. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as object)) deepFreeze(v)
  }
  return value
}

describe('caches behind a view switch', () => {
  it('keep what a view shows while its list, chain and the model are the same, and only then', () => {
    const state = deepFreeze(model())
    const first = viewShownNodes(state.view, state.nodes, state.relations)
    expect([...first!].sort()).toEqual(['n1', 'r1', 'r2'])
    // Saving positions gives a new view object; the answer is kept.
    const moved = deepFreeze({ ...state.view, positions: { n1: { x: 1, y: 2, width: 100, height: 60 } } })
    expect(viewShownNodes(moved, state.nodes, state.relations)).toBe(first)
    // Another chain, another model: computed again.
    const chain = deepFreeze({ ...moved, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } })
    expect([...viewShownNodes(chain, state.nodes, state.relations)!].sort()).toEqual(['r1', 'r2', 'r3'])
    const { b: _b, ...fewer } = state.relations
    expect([...viewShownNodes(moved, state.nodes, deepFreeze(fewer))!].sort()).toEqual(['n1', 'r1'])
    // Data changed in place (the MCP server) is never answered from a cache.
    const live = model()
    expect(viewShownNodes(live.view, live.nodes, live.relations)!.size).toBe(3)
    delete live.relations.b
    expect(viewShownNodes(live.view, live.nodes, live.relations)!.size).toBe(2)
  })

  it('name the same EARS subject on frozen data as afresh: the first satisfier that exists', () => {
    const plain = model()
    const frozen = deepFreeze(model())
    for (const id of ['r1', 'r2', 'r3']) {
      expect(resolveEarsSubject(id, frozen.relations, frozen.nodes)).toBe(resolveEarsSubject(id, plain.relations, plain.nodes))
    }
    expect(resolveEarsSubject('r1', frozen.relations, frozen.nodes)).toBe('Billing')
    const { s2: _s2, ...later } = frozen.relations
    expect(resolveEarsSubject('r1', deepFreeze(later), frozen.nodes)).toBe('Auth')
  })

  it('order as localeCompare with numeric, base sensitivity does', () => {
    const { nodes } = model()
    const list = Object.values(nodes)
    const expected = [...list].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
    expect(sortNodes(list, undefined, { nodes, relations: {}, metamodel: { id: '', name: '', nodeTypes: {}, relationTypes: {} } }).map((n) => n.label)).toEqual(expected.map((n) => n.label))
    expect(sortNodes(list, undefined, { nodes, relations: {}, metamodel: { id: '', name: '', nodeTypes: {}, relationTypes: {} } }).map((n) => n.label)).toEqual(['Äpfel', 'Auth', 'Billing', 'Need', 'req 9', 'Req 10'])
  })
})
