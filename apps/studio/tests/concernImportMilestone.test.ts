/**
 * A concern pack imported while a milestone is shown is an edit of the
 * milestone, its view included. The view used to be made in the live
 * model's views at once: saved before the milestone question was
 * answered, and kept after Discard, listing elements that do not exist.
 */
import { it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { HubConcept } from '@radical/common/hubFormat'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { importConcernPackIntoDiagram } from '../src/renderer/src/hub/importConcept'

const s = useDiagramStore.getState
const node = (id: string, type: string, label: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, collapsed: false, x: 0, y: 0, width: 200, height: 100, ...extra } as C4Node)

const PACK: HubConcept = {
  id: 'concern-x', category: 'concern', name: 'Secrets', description: 'd', tags: [],
  concern: { id: 'secrets', trigger: 'LIST NODES WHERE type = "webapp"', why: 'w', group: 'security' },
  nodes: [
    { id: 'need', type: 'need', label: 'N', x: 0, y: 0 },
    { id: 'req', type: 'requirement', label: 'R', ears_type: 'ubiquitous', action: 'do', x: 300, y: 0 },
    { id: 'adr', type: 'adr', label: 'D', concern: 'secrets', x: 600, y: 0 },
  ],
  relations: [{ id: 'r', relationType: 'derives', sourceId: 'req', targetId: 'need' }],
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [node('shop', 'system', 'Shop', { width: 400, height: 300 }), node('web', 'webapp', 'Web', { parentId: 'shop', x: 40, y: 60 })],
    relations: [],
    views: [{ id: 'v', name: 'Shop', kind: 'static', nodeIds: ['shop', 'web'], positions: {} }],
  } as never)
  s().setActiveView('v')
})
afterEach(() => s().stopLiveLayout())

const savedViews = () => s().saveDiagram().views!.map((v) => ({ id: v.id, nodeIds: [...v.nodeIds].sort() }))
const inMilestone = () => {
  s().selectMilestone(s().createSnapshot('v1'))
  expect(s().activeSnapshotId).toBeTruthy()
}

it('a concern pack imported in a milestone and discarded leaves the live views as they were', () => {
  const before = savedViews()
  inMilestone()
  const { nodeIds } = importConcernPackIntoDiagram(PACK, {}, ['web'])
  expect(nodeIds).toHaveLength(3)
  // Not decided yet: the live model's views are as they were.
  expect(savedViews()).toEqual(before)
  s().discardMilestoneChanges()
  expect(Object.keys(s().c4Nodes).sort()).toEqual(['shop', 'web'])
  expect(savedViews()).toEqual(before)
})

it('a concern pack imported in a milestone and propagated brings its view into the live model', () => {
  inMilestone()
  const { nodeIds } = importConcernPackIntoDiagram(PACK, {}, ['web'])
  s().commitMilestoneChanges('propagate')
  const view = s().saveDiagram().views!.find((v) => v.folder === 'Concerns')
  expect(view?.nodeIds.slice().sort()).toEqual([...nodeIds, 'shop', 'web'].sort())
  s().discardMilestoneChanges()
  expect(Object.values(s().views).filter((v) => v.folder === 'Concerns')).toHaveLength(1)
})
