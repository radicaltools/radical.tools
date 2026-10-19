import { describe, expect, it } from 'vitest'
import type { C4Node } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  describeRefinement,
  forgeGaps,
  formatForgeGaps,
  rejectRefinements,
  snapshotOf,
  stageRefinements,
  type ForgeStageId,
} from '../src/ai/forge'

const node = (id: string, type: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node

/** A node to add: everything but its id. */
const fresh = (type: string, extra: Record<string, unknown> = {}): Omit<C4Node, 'id'> => {
  const { id: _id, ...rest } = node('', type, extra)
  return rest
}

const rel = (id: string, sourceId: string, targetId: string, relationType: string, extra: Record<string, unknown> = {}) =>
  ({ id, sourceId, targetId, relationType, ...extra })

/** The model before a Processes stage: a need, two requirements, a scenario
 *  and a domain with an entity. */
function before() {
  let next = 0
  return createModelFacade({
    nodes: [
      node('n', 'need', { description: 'A web shop.' }),
      node('r1', 'requirement', { ears_type: 'ubiquitous', action: 'take payments' }),
      node('r2', 'requirement', { ears_type: 'ubiquitous', action: 'ship orders' }),
      node('s1', 'scenario', { given: 'a cart', when: 'the customer pays', then: 'the order is paid' }),
      node('d', 'domain'),
      node('e', 'entity', { parentId: 'd' }),
    ],
    relations: [
      rel('x1', 'r1', 'n', 'derives'),
      rel('x2', 'r2', 'n', 'derives'),
      rel('x3', 's1', 'r1', 'verifies'),
    ],
    views: [],
    metamodel: builtInGovernanceMetamodel(),
  }, { newId: () => `id${++next}` })
}

/** What a Processes stage does: its own process and steps, and a few
 *  refinements of earlier stages. */
function runProcesses(facade: ReturnType<typeof before>) {
  const p = facade.addNode(fresh('process', { label: 'Check out' }))
  const step = facade.addNode(fresh('step', { label: 'Pay', parentId: p, order: 1 }))
  facade.addNode(fresh('step', { label: 'Ship', parentId: p, order: 2 }))
  facade.addRelation({ sourceId: p, targetId: 'r1', relationType: 'satisfies' })
  const r3 = facade.addNode(fresh('requirement', { label: 'Refund', ears_type: 'ubiquitous', action: 'refund a cancelled order' }))
  facade.addRelation({ sourceId: r3, targetId: 'n', relationType: 'derives' })
  facade.addRelation({ sourceId: 's1', targetId: 'r2', relationType: 'verifies' })
  facade.updateNode('s1', { then: 'the order is paid and shipped' } as Partial<C4Node>)
  facade.updateNode('r2', { rationale: 'Orders must arrive.' } as Partial<C4Node>)
  facade.updateNode('r1', { x: 500, y: 300 })
  facade.removeNode('e')
  return { p, step, r3 }
}

describe('stageRefinements', () => {
  it('stageRefinements lists what a stage did to earlier stages', () => {
    const facade = before()
    const snapshot = snapshotOf(facade)
    const { r3 } = runProcesses(facade)
    const refinements = stageRefinements('processes', snapshot, snapshotOf(facade))
    expect(refinements.map(describeRefinement).sort()).toEqual([
      'added requirement "Refund"',
      'added verifies s1 → r2',
      'changed requirement "r2" (rationale)',
      'changed scenario "s1" (then)',
      'deleted entity "e"',
    ])
    expect(refinements.find((r) => r.id === r3)?.change).toBe('added')
    expect((refinements.find((r) => r.id === 's1')?.before as unknown as Record<string, unknown>).then).toBe('the order is paid')
  })

  it('counts every node the Review stage adds, and none of a stage that only made its own', () => {
    const facade = before()
    const snapshot = snapshotOf(facade)
    facade.addNode(fresh('scenario', { label: 'Refund', given: 'a', when: 'b', then: 'c' }))
    expect(stageRefinements('review', snapshot, snapshotOf(facade)).map((r) => r.type)).toEqual(['scenario'])
    expect(stageRefinements('scenarios', snapshot, snapshotOf(facade))).toEqual([])
  })
})

describe('rejectRefinements', () => {
  it('rejectRefinements removes additions and restores changes', () => {
    const facade = before()
    const snapshot = snapshotOf(facade)
    const { p, r3 } = runProcesses(facade)
    const refinements = stageRefinements('processes', snapshot, snapshotOf(facade))
    const taken = rejectRefinements(facade, refinements)
    // A deletion cannot be taken back.
    expect(taken).not.toContain('e')
    expect(taken).toHaveLength(4)
    const nodes = facade.getNodes()
    expect(nodes[r3]).toBeUndefined()
    expect((nodes.s1 as unknown as Record<string, unknown>).then).toBe('the order is paid')
    expect((nodes.r2 as unknown as Record<string, unknown>).rationale).toBeUndefined()
    expect(Object.values(facade.getRelations()).some((r) => r.sourceId === 's1' && r.targetId === 'r2')).toBe(false)
    // The stage's own output stays, and so does the move.
    expect(nodes[p]).toBeDefined()
    expect(nodes.r1.x).toBe(500)
    // Taking back again changes nothing.
    expect(rejectRefinements(facade, refinements.filter((r) => r.change === 'added'))).toEqual([])
  })
})

describe('forgeGaps', () => {
  function gapModel() {
    let next = 0
    return createModelFacade({
      nodes: [
        node('n', 'need', { description: 'A web shop.' }),
        node('r1', 'requirement', { label: 'Pay', ears_type: 'ubiquitous', action: 'take payments' }),
        node('r2', 'requirement', { label: 'Ship', ears_type: 'ubiquitous', action: 'ship orders' }),
        node('p', 'process', { label: 'Check out' }),
        node('st', 'step', { label: 'Pack', parentId: 'p', order: 1 }),
        node('d', 'domain'),
        node('e', 'entity', { label: 'Order', parentId: 'd', kind: 'aggregate-root' }),
        node('m', 'state-machine', { label: 'Order lifecycle' }),
        node('ev', 'event', { label: 'OrderLost', parentId: 'm' }),
      ],
      relations: [rel('x1', 'r1', 'n', 'derives'), rel('x2', 'm', 'e', 'lifecycle-of')],
      views: [],
      metamodel: builtInGovernanceMetamodel(),
    }, { newId: () => `id${++next}` })
  }
  const upTo = (last: ForgeStageId): ForgeStageId[] => {
    const all: ForgeStageId[] = ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4']
    return all.slice(0, all.indexOf(last) + 1)
  }
  const messages = (done: ForgeStageId[]): string[] => {
    const facade = gapModel()
    return forgeGaps(done, facade.getNodes(), facade.getRelations(), facade.getMetamodel?.()).map((g) => g.message)
  }

  it('forgeGaps lists only the gaps of the stages done', () => {
    expect(messages(upTo('requirements'))).toEqual(['Requirement "Ship" derives from no need and no other requirement.'])
    const afterStates = messages(upTo('states'))
    expect(afterStates).toContain('No scenario verifies requirement "Pay".')
    expect(afterStates).toContain('No transition is triggered by or raises event "OrderLost".')
    expect(afterStates.some((m) => m.startsWith('Nothing satisfies'))).toBe(false)
    expect(afterStates.some((m) => m.startsWith('Nobody performs'))).toBe(false)
    const afterC4 = messages(upTo('c4'))
    expect(afterC4).toContain('Nothing satisfies requirement "Pay".')
    expect(afterC4).toContain('Nobody performs step "Pack".')
    expect(afterC4).toContain('No element implements state machine "Order lifecycle".')
    expect(afterC4).toContain('No element owns the data of entity "Order" (realises).')
    expect(messages([])).toEqual([])
  })

  it('cuts a long list, saying how many more there are', () => {
    const gaps = Array.from({ length: 5 }, (_, i) => ({ rule: 'r', message: `Gap ${i}.` }))
    expect(formatForgeGaps(gaps, 3)).toEqual(['- Gap 0.', '- Gap 1.', '- Gap 2.', '- … and 2 more'])
  })
})
