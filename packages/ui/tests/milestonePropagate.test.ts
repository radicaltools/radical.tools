/**
 * Editing in the past and carrying the edit forward (Propagate).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
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
