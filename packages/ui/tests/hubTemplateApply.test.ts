/**
 * Changing the values of an imported Hub template ("Apply" in the Hub
 * template section). It rewrote every text field of every imported element
 * from the Hub's original (an element renamed since lost its new name), one
 * undo step per element, and Undo left the new values in the record.
 */
import { it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, label: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type: 'requirement', label, collapsed: false, x: 0, y: 0, width: 200, height: 80, ...extra } as C4Node)

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram({
    nodes: [node('req', 'Disputes', { action: 'investigate within 10 days' }), node('api', 'Posting API v2')],
    relations: [],
    hubTemplates: {
      imp: {
        conceptId: 'bp', conceptName: 'Fintech', templateParams: [{ key: 'DAYS', label: 'Days' }] as never,
        paramValues: { DAYS: '10' }, nodeIds: ['req', 'api'],
        originalNodes: { req: { label: 'Disputes', action: 'investigate within {{DAYS}} days' }, api: { label: 'Posting API' } },
      },
    } as never,
  })
})
afterEach(() => s().stopLiveLayout())

it('changes only the fields that hold a parameter, as one undo step', () => {
  s().applyHubTemplate('imp', { DAYS: '5' })
  expect((s().c4Nodes.req as unknown as Record<string, unknown>).action).toBe('investigate within 5 days')
  expect(s().c4Nodes.api.label).toBe('Posting API v2')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('5')
  s().undo()
  expect((s().c4Nodes.req as unknown as Record<string, unknown>).action).toBe('investigate within 10 days')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('10')
})
