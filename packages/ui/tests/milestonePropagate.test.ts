/**
 * Editing in the past and carrying the edit forward (Propagate).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { builtInGovernanceMetamodel, validateModel } from '@radical/common/metamodel'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, x: number, y: number, parentId?: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...(NODE_SIZES as Record<string, { width: number; height: number }>)[type] ?? { width: 200, height: 100 }, ...(parentId ? { parentId } : {}), ...extra } as C4Node)

/** Milestone "early" has the shop and its API; the live model has a web app
 *  in the shop too, with relations to it, and an ADR. */
function model(): DiagramData {
  return {
    nodes: [{ ...node('shop', 'system', 0, 0), width: 700, height: 400 }, node('api', 'container', 40, 120, 'shop'), node('bank', 'system', 900, 0)],
    relations: [{ id: 'r1', sourceId: 'api', targetId: 'bank' }],
    views: [],
  }
}

let early = ''
beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  early = s().createSnapshot('early')
  const { id: _id, ...draft } = node('web', 'container', 360, 120, 'shop')
  const web = s().addNode(draft)
  s().addRelation({ sourceId: web, targetId: 'bank' })
  s().createSnapshot('later')
})
afterEach(() => s().stopLiveLayout())

const everyModel = (): Array<{ name: string; nodes: Record<string, C4Node>; relations: Record<string, { sourceId: string; targetId: string }> }> => [
  ...s().snapshots.map((x) => ({ name: x.name, nodes: x.nodes as Record<string, C4Node>, relations: x.relations as Record<string, { sourceId: string; targetId: string }> })),
  { name: 'live', nodes: (s().liveBackup?.nodes ?? s().c4Nodes) as Record<string, C4Node>, relations: (s().liveBackup?.relations ?? s().c4Relations) as Record<string, { sourceId: string; targetId: string }> },
]

describe('Propagate a delete made in an early milestone', () => {
  // Only what the early milestone held was removed later on: a child added
  // since kept a parent that was gone (Studio could not draw the model
  // again: "Parent node not found"), and relations added since kept an end
  // that was gone.
  it('takes what lies inside the deleted element, and its relations, out of every later model', () => {
    s().selectMilestone(early)
    s().removeNode('shop')
    s().commitMilestoneChanges('propagate')
    for (const m of everyModel()) {
      for (const n of Object.values(m.nodes)) expect(!n.parentId || !!m.nodes[n.parentId], `${m.name}: ${n.label}'s parent`).toBe(true)
      for (const r of Object.values(m.relations)) expect(!!m.nodes[r.sourceId] && !!m.nodes[r.targetId], `${m.name}: a relation's ends`).toBe(true)
      expect(Object.values(m.nodes).map((n) => n.label).sort(), m.name).toEqual(['bank'])
    }
  })
})

describe('Propagate a change of a property', () => {
  // Only a fixed list of fields was carried forward: a status or any other
  // property of the metamodel stayed as it was in later milestones and the
  // live model.
  it('carries every field forward, properties and relation types included', () => {
    s().selectMilestone(early)
    s().updateNode('api', { technology: 'Go', status: 'deprecated' } as never)
    s().updateRelation('r1', { relationType: 'interacts', label: 'pays' } as never)
    s().commitMilestoneChanges('propagate')
    for (const m of everyModel()) {
      expect((m.nodes.api as unknown as Record<string, unknown>).status, m.name).toBe('deprecated')
      expect(m.nodes.api.technology, m.name).toBe('Go')
      expect((m.relations.r1 as unknown as Record<string, unknown>).relationType, m.name).toBe('interacts')
    }
  })
})

describe('A click on an element in a milestone', () => {
  // A click is a grab and a release that moved nothing: it asked how to
  // save changes nobody had made.
  it('is no edit of the milestone', () => {
    s().selectMilestone(early)
    s().liveGrab('api', 40, 120, 'calm', { x: 40, y: 120 })
    s().liveRelease('api', [], false)
    expect(s().milestoneDirty).toBe(false)
    expect(s().milestonePromptOpen).toBe(false)
  })
})

describe('Propagate a change of a sequence', () => {
  // The whole sequence of the edited milestone was copied into every later
  // milestone and the live model: one note changed in As-is, and the live
  // flow lost the steps added since.
  it('carries forward only the steps and notes the milestone changed', () => {
    s().loadDiagram({
      nodes: [node('a', 'system', 0, 0), node('b', 'system', 400, 0), node('c', 'system', 800, 0)],
      relations: [{ id: 'r1', sourceId: 'a', targetId: 'b' }, { id: 'r2', sourceId: 'b', targetId: 'c' }, { id: 'r3', sourceId: 'c', targetId: 'a' }],
      views: [],
      sequences: [{ id: 'order', name: 'Place Order', relationIds: ['r1', 'r2'], stepDescriptions: ['submits', 'posts'] }],
    } as DiagramData)
    const asIs = s().createSnapshot('as-is')
    s().toggleRelationInSequence('order', 'r3')
    s().updateStepDescription('order', 2, 'returns')
    s().createSnapshot('target')
    s().toggleRelationInSequence('order', 'r1')
    s().selectMilestone(asIs)
    s().updateStepDescription('order', 1, 'POSTS')
    s().removeFromSequence('order', 0)
    s().commitMilestoneChanges('propagate')
    const steps = (seqs: unknown) => {
      const q = (seqs as Record<string, { relationIds: string[]; stepDescriptions?: (string | undefined)[] }>).order
      return q.relationIds.map((r, i) => `${r}:${q.stepDescriptions?.[i] ?? '-'}`)
    }
    expect(steps(s().snapshots[0].sequences)).toEqual(['r2:POSTS'])
    expect(steps(s().snapshots[1].sequences)).toEqual(['r2:POSTS', 'r3:returns'])
    expect(steps(s().liveBackup!.sequences)).toEqual(['r2:POSTS', 'r3:returns', 'r1:-'])
  })
})

describe('Propagate a move into a parent the later models lack', () => {
  // The step went under its new parent in every later model, where that
  // parent had been deleted: an element under a parent that does not exist
  // (a Warnier step drawn at the top level, Parent "—").
  it('leaves the element where it is in a model without that parent', () => {
    s().loadDiagram({
      nodes: [
        { ...node('shop', 'system', 0, 0), width: 700, height: 400 }, node('api', 'container', 40, 120, 'shop'),
        { ...node('vault', 'system', 900, 0), width: 700, height: 400 },
      ],
      relations: [],
      views: [],
    } as DiagramData)
    const before = s().createSnapshot('before')
    s().removeNode('vault')
    s().createSnapshot('after')
    s().selectMilestone(before)
    s().reparentNodes(['api'], 'vault')
    s().commitMilestoneChanges('propagate')
    expect(s().snapshots[0].nodes.api.parentId).toBe('vault')
    for (const m of everyModel().slice(1)) {
      for (const n of Object.values(m.nodes)) expect(!n.parentId || !!m.nodes[n.parentId], `${m.name}: ${n.label}'s parent`).toBe(true)
      expect(m.nodes.api.parentId, m.name).toBe('shop')
    }
  })
})

describe('Propagate a delete of relations later sequences step through', () => {
  // The sample's v1 has no sequences; Web Banking deleted there and
  // propagated took its relations out of the live model, but the live
  // Payment Processing kept its steps r-cust-web and r-web-apigw (a flow
  // naming relations that do not exist), saved so.
  it('takes their steps, with their notes, out of the later milestones and the live sequences', () => {
    s().loadDiagram({
      nodes: [node('a', 'system', 0, 0), node('b', 'system', 400, 0), node('c', 'system', 800, 0)],
      relations: [{ id: 'r1', sourceId: 'a', targetId: 'b' }, { id: 'r2', sourceId: 'b', targetId: 'c' }],
      views: [],
    } as DiagramData)
    const first = s().createSnapshot('first')
    s().addSequence('Order')
    const order = Object.keys(s().sequences)[0]
    s().toggleRelationInSequence(order, 'r1')
    s().toggleRelationInSequence(order, 'r2')
    s().updateStepDescription(order, 0, 'asks')
    s().updateStepDescription(order, 1, 'passes on')
    s().createSnapshot('second')
    s().selectMilestone(first)
    s().removeNode('a')
    s().commitMilestoneChanges('propagate')
    const steps = (seqs: unknown) => {
      const q = (seqs as Record<string, { relationIds: string[]; stepDescriptions?: (string | undefined)[] }>)[order]
      return q.relationIds.map((r, i) => `${r}:${q.stepDescriptions?.[i] ?? '-'}`)
    }
    expect(steps(s().snapshots[1].sequences)).toEqual(['r2:passes on'])
    expect(steps(s().liveBackup!.sequences)).toEqual(['r2:passes on'])
    s().discardMilestoneChanges()
    expect(steps(s().saveDiagram().sequences!.reduce((all, q) => ({ ...all, [q.id]: q }), {}))).toEqual(['r2:passes on'])
  })
})

describe('Propagate a delete of an element a later reference names (F-0054)', () => {
  // An event deleted in an early milestone and propagated left a later
  // transition triggered by it (one the early milestone never had): the
  // live model kept the event's id, and Validation flagged it. A delete on
  // the live model takes it out (forgetNodesInReferences).
  it('takes it out of the references of the later milestones and the live model', () => {
    const nodes = [
      node('m', 'state-machine', 0, 0), node('open', 'state', 0, 0, 'm'), node('held', 'state', 0, 0, 'm'), node('booked', 'state', 0, 0, 'm'),
      node('approved', 'event', 0, 0, 'm'), node('audited', 'event', 0, 0, 'm'),
    ]
    const early = { id: 't1', sourceId: 'open', targetId: 'held', relationType: 'transition', label: '', event: 'approved' } as unknown as C4Relation
    const later = { id: 't2', sourceId: 'held', targetId: 'booked', relationType: 'transition', label: '', event: 'approved', raises: ['approved', 'audited'] } as unknown as C4Relation
    const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
    s().loadDiagram({
      nodes, relations: [early, later], views: [], metamodel: builtInGovernanceMetamodel(),
      snapshots: [
        { id: 'first', name: 'first', timestamp: 1, nodes: byId(nodes), relations: byId([early]) },
        { id: 'second', name: 'second', timestamp: 2, nodes: byId(nodes), relations: byId([early, later]) },
      ],
    } as DiagramData)
    s().selectMilestone('first')
    s().removeNode('approved')
    s().commitMilestoneChanges('propagate')
    const t2 = (relations: unknown) => (relations as Record<string, Record<string, unknown>>).t2
    for (const [name, relations] of [['second', s().snapshots[1].relations], ['live', s().liveBackup!.relations]] as const) {
      expect(t2(relations).event, name).toBeUndefined()
      expect(t2(relations).raises, name).toEqual(['audited'])
    }
    s().discardMilestoneChanges()
    const saved = s().saveDiagram()
    const issues = validateModel(Object.fromEntries(saved.nodes.map((n) => [n.id, n])), Object.fromEntries(saved.relations.map((r) => [r.id, r])), builtInGovernanceMetamodel())
    expect(issues.filter((i) => i.id.startsWith('bad-ref:')).map((i) => i.message)).toEqual([])
  })
})

describe('Propagate a nest or a relation that joins an element to what holds it in a later model (F-0070)', () => {
  // The diff was applied as it was: a nest carried into a model where the
  // element relates to its new holder kept the relation, and a relation
  // carried into a model where one end holds the other was added. Studio
  // refuses both there, draws neither, and offered nothing to remove them.
  const between = (rels: Record<string, C4Relation>, a: string, b: string) => Object.values(rels).filter((r) => r.sourceId === a && r.targetId === b)
  let m = ''
  beforeEach(() => {
    s().loadDiagram({
      nodes: [{ ...node('s1', 'system', 0, 0), width: 700, height: 400 }, node('c', 'container', 40, 120, 's1'), { ...node('s2', 'system', 900, 0), width: 700, height: 400 }],
      relations: [],
      views: [],
    })
    m = s().createSnapshot('m')
    useDiagramStore.setState({ notifications: [] } as any)
  })

  it('a nest made in the milestone takes, in later models, the relation to the new holder, and says so', () => {
    s().addRelation({ sourceId: 'c', targetId: 's2' })
    const later = s().createSnapshot('later')
    s().selectMilestone(m)
    s().reparentNodes(['c'], 's2')
    s().commitMilestoneChanges('propagate')
    const laterSnap = s().snapshots.find((x) => x.id === later)!
    expect(laterSnap.nodes.c.parentId).toBe('s2')
    expect(between(laterSnap.relations as Record<string, C4Relation>, 'c', 's2')).toEqual([])
    expect(s().notifications.map((n) => n.message).join('\n')).toMatch(/containment already joins/)
    s().discardMilestoneChanges()
    expect(s().c4Nodes.c.parentId).toBe('s2')
    expect(between(s().c4Relations, 'c', 's2')).toEqual([])
  })

  it('a relation made in the milestone is not carried into a later model where one end holds the other', () => {
    s().reparentNodes(['c'], 's2')
    s().selectMilestone(m)
    expect(s().c4Nodes.c.parentId).toBe('s1')
    s().addRelation({ sourceId: 'c', targetId: 's2' })
    s().commitMilestoneChanges('propagate')
    expect(between(s().snapshots.find((x) => x.id === m)!.relations as Record<string, C4Relation>, 'c', 's2')).toHaveLength(1)
    s().discardMilestoneChanges()
    expect(s().c4Nodes.c.parentId).toBe('s2')
    expect(between(s().c4Relations, 'c', 's2')).toEqual([])
  })
})
