/**
 * A relation drawn on the canvas (a handle, Alt-drag): item 191 and D5.
 *   - on a canvas whose filter is a chain it is of the type the chain
 *     follows, or refused with a word (it was added, not drawn, and a
 *     second try added a copy);
 *   - where several relation types fit the pair, Studio asks which (it was
 *     added with none); a type the aggregate rules refuse is not offered.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramView } from '@radical/common/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, width: 200, height: 80, ...props } as C4Node)
// As React Flow hands a connection made from a handle to the store.
const connect = (source: string, target: string) => s().onConnect({ source, target, sourceHandle: null, targetHandle: null })
const lastNotice = (): string | undefined => s().notifications[s().notifications.length - 1]?.message

const TRACE: DiagramView = { id: 'trace', name: 'Trace', nodeIds: [], positions: {}, pipeline: { levels: [
  { ways: [{ types: ['need'] }] },
  { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
] } }

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram({
    nodes: [node('need', 'need'), node('req', 'requirement'), node('sc', 'scenario'),
      node('order', 'entity', { kind: 'aggregate-root' }), node('customer', 'entity', { kind: 'aggregate-root' }), node('line', 'entity', { kind: 'entity' })],
    relations: [],
    views: [TRACE],
    metamodel: builtInGovernanceMetamodel(),
  })
})
afterEach(() => s().stopLiveLayout())

describe('a relation drawn on a canvas whose filter is a chain', () => {
  it('is of the type the chain follows', () => {
    s().setActiveView('trace')
    connect('req', 'need')
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ sourceId: 'req', targetId: 'need', relationType: 'derives' })])
  })

  it('is refused, with a word, when the chain would not draw it', () => {
    s().setActiveView('trace')
    connect('sc', 'req')
    connect('sc', 'req')
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(lastNotice()).toBe('Not added: this view shows only the relations its filter follows, and none leads from sc to req.')
  })
})

describe('a relation drawn where several types fit', () => {
  it('asks which, and adds the one chosen', () => {
    connect('line', 'order')
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(s().relationTypeChoice).toEqual({ sourceId: 'line', targetId: 'order', types: ['part-of', 'references'] })
    s().chooseRelationType('part-of')
    expect(s().relationTypeChoice).toBeNull()
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ sourceId: 'line', targetId: 'order', relationType: 'part-of' })])
  })

  it('adds nothing when the question is dismissed', () => {
    connect('line', 'order')
    s().chooseRelationType(null)
    expect(Object.values(s().c4Relations)).toEqual([])
  })

  it('does not offer part-of between two aggregate roots: references it is', () => {
    connect('order', 'customer')
    expect(s().relationTypeChoice).toBeNull()
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ relationType: 'references' })])
  })
})

// Decided 2026-10-21 (runs 65 to 69): a relation type with no pairs fits
// every pair. Where only it fits, a new relation gets it (Alt-drag made one
// with no type, unasked); where it fits besides another, Studio asks.
describe('a relation drawn with an any-pair type in the metamodel', () => {
  beforeEach(() => {
    const metamodel = builtInC4Metamodel()
    metamodel.relationTypes.misc = { id: 'misc', label: 'Misc', allowedPairs: [] }
    s().loadDiagram({ nodes: [node('user', 'person'), node('shop', 'system'), node('db', 'database')], relations: [], views: [], metamodel })
  })

  it('gets that type where only it fits', () => {
    connect('db', 'user')
    expect(s().relationTypeChoice).toBeNull()
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ sourceId: 'db', targetId: 'user', relationType: 'misc' })])
  })

  it('asks where it fits besides another', () => {
    connect('user', 'shop')
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(s().relationTypeChoice).toEqual({ sourceId: 'user', targetId: 'shop', types: ['interacts', 'misc'] })
  })
})

// F-0035 (decided 2026-10-23): a governance relation to what holds an
// element may be drawn, and a move keeps it; a structural one is refused.
describe('a relation drawn between an element and what holds it', () => {
  beforeEach(() => {
    s().loadDiagram({
      nodes: [node('shop', 'system'), node('req', 'requirement'), node('api', 'container', { parentId: 'shop' })],
      relations: [],
      views: [],
      metamodel: builtInGovernanceMetamodel(),
    })
  })

  it('is added when it is a governance one, and stays when the requirement is moved into the system', () => {
    connect('shop', 'req')
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ sourceId: 'shop', targetId: 'req', relationType: 'satisfies' })])
    s().reparentNodes(['req'], 'shop')
    expect(s().c4Nodes.req.parentId).toBe('shop')
    expect(Object.values(s().c4Relations)).toEqual([expect.objectContaining({ sourceId: 'shop', targetId: 'req', relationType: 'satisfies' })])
  })

  it('is refused, with the reason, when it is a structural one', () => {
    connect('api', 'shop')
    expect(Object.values(s().c4Relations)).toEqual([])
    expect(lastNotice()).toMatch(/shop holds api, and containment already joins them/)
    expect(s().addRelation({ sourceId: 'api', targetId: 'shop', relationType: 'interacts' })).toBeNull()
    expect(s().addRelation({ sourceId: 'api', targetId: 'gone' })).toBeNull()
    expect(lastNotice()).toMatch(/"gone" is no element of the model/)
  })
})
