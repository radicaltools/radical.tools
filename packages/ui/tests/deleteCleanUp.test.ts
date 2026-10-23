/**
 * Every way of taking an element out of the model cleans up after it as a
 * delete does (model.deleteNode): the steps of its relations leave the
 * sequences, the references that named it (a transition's event, a
 * requirement's precondition state) let go of it, and the views forget it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { builtInGovernanceMetamodel, validateModel } from '@radical/common/metamodel'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, x: number, y: number, parentId?: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, width: 200, height: 100, ...(parentId ? { parentId } : {}), ...extra } as C4Node)

/** A machine whose composite state `busy` holds `working`; a requirement
 *  holds while the machine is busy, and a flow steps through the
 *  transition into it. */
function machine(): DiagramData {
  return {
    nodes: [
      { ...node('m', 'state-machine', 0, 0), width: 1200, height: 600 },
      node('idle', 'state', 40, 80, 'm'),
      { ...node('busy', 'state', 400, 80, 'm'), width: 400, height: 300 },
      node('working', 'state', 40, 80, 'busy'),
      node('go', 'event', 900, 80, 'm'),
      node('req', 'requirement', 0, 800, undefined, { ears_type: 'state-driven', precondition_state: 'busy', action: 'report progress' }),
    ],
    relations: [
      { id: 't1', sourceId: 'idle', targetId: 'busy', relationType: 'transition', label: '', event: 'go' } as DiagramData['relations'][number],
      { id: 't2', sourceId: 'idle', targetId: 'working', relationType: 'transition', label: '' } as DiagramData['relations'][number],
    ],
    sequences: [{ id: 'flow', name: 'Flow', relationIds: ['t1', 't2'] }],
    views: [{ id: 'v', name: 'v', nodeIds: ['m', 'idle', 'busy', 'working', 'go'], positions: {}, collapsedNodeIds: ['busy'] }],
    metamodel: builtInGovernanceMetamodel(),
  }
}

const badRefs = () => validateModel(s().c4Nodes, s().c4Relations, s().metamodel).filter((i) => i.id.startsWith('bad-ref:')).map((i) => i.message)

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(machine())
})
afterEach(() => s().stopLiveLayout())

describe('Unwrap (remove an element, keep what it holds)', () => {
  it('cleans up after the element as a delete does: references, sequence steps and views', () => {
    s().unwrapNode('busy')
    expect(s().c4Nodes.busy).toBeUndefined()
    expect(s().c4Nodes.working.parentId).toBe('m')
    expect((s().c4Nodes.req as unknown as Record<string, unknown>).precondition_state).toBeUndefined()
    expect(badRefs()).toEqual([])
    expect(s().sequences.flow.relationIds).toEqual(['t2'])
    expect(s().views.v.nodeIds).not.toContain('busy')
    expect(s().views.v.collapsedNodeIds ?? []).not.toContain('busy')
  })
})
