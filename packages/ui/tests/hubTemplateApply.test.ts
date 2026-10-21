/**
 * Changing the values of an imported Hub template ("Apply" in the Hub
 * template section). It rewrote every text field of every imported element
 * from the Hub's original (an element renamed since lost its new name), one
 * undo step per element, and Undo left the new values in the record.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

it('in a milestone, asks how to keep it, and the record goes the way of the edit', () => {
  const action = () => (s().c4Nodes.req as unknown as Record<string, unknown>).action
  const snap = s().createSnapshot('As-is')
  s().selectMilestone(snap)
  s().applyHubTemplate('imp', { DAYS: '5' })
  expect(s().milestoneDirty).toBe(true)
  expect(s().milestonePromptOpen).toBe(true)
  // Saved meanwhile, the live model keeps its record.
  expect(s().saveDiagram().hubTemplates?.imp.paramValues.DAYS).toBe('10')

  // Discarded: the live text and its record as they were.
  s().discardMilestoneChanges()
  expect(action()).toBe('investigate within 10 days')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('10')

  // Propagated: the live text and its record changed.
  s().selectMilestone(snap)
  s().applyHubTemplate('imp', { DAYS: '7' })
  s().commitMilestoneChanges('propagate')
  s().discardMilestoneChanges()
  expect(action()).toBe('investigate within 7 days')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('7')
})

it('in a milestone, shows the values the milestone has, and a Propagate of another edit leaves the live record', () => {
  // The record was the live model's: the card said 10, the Hub Template
  // section 15.
  const snap = s().createSnapshot('As-is')
  s().applyHubTemplate('imp', { DAYS: '15' })
  s().selectMilestone(snap)
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('10')
  s().updateNode('api', { label: 'Posting API v1' })
  s().commitMilestoneChanges('propagate')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('10')
  s().discardMilestoneChanges()
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('15')
  // An Apply in it goes forward with its text.
  s().selectMilestone(snap)
  s().applyHubTemplate('imp', { DAYS: '5' })
  s().commitMilestoneChanges('propagate')
  s().discardMilestoneChanges()
  expect((s().c4Nodes.req as unknown as Record<string, unknown>).action).toBe('investigate within 5 days')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('5')
})

it('a milestone looked at in Viewer leaves Designer the live record', () => {
  const snap = s().createSnapshot('As-is')
  s().applyHubTemplate('imp', { DAYS: '15' })
  s().setAppMode('viewer')
  s().selectMilestone(snap)
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('10')
  s().setAppMode('designer')
  expect(s().hubTemplates.imp.paramValues.DAYS).toBe('15')
  expect(s().saveDiagram().hubTemplates?.imp.paramValues.DAYS).toBe('15')
})

describe('Apply on what was edited since the import', () => {
  const load = () => s().loadDiagram({
    nodes: [
      node('adr', 'ADR-007 Orders on PostgreSQL', { type: 'adr', decision: 'Use PostgreSQL as the primary store.' }),
      node('other', 'Keeps Oracle', { type: 'adr', decision: 'We moved to Oracle.' }),
      node('a', 'Shop'), node('b', 'Search'),
    ],
    relations: [{ id: 'r', sourceId: 'a', targetId: 'b', label: 'search in 800 ms' }],
    sequences: [{ id: 'flow', name: 'Shopper journey', relationIds: ['r'], stepDescriptions: ['results within 800 ms'] }],
    hubTemplates: {
      imp: {
        conceptId: 'bp', conceptName: 'E-commerce',
        templateParams: [{ key: 'DATABASE', label: 'Database', defaultValue: 'PostgreSQL' }, { key: 'P95', label: 'p95', defaultValue: '800' }] as never,
        paramValues: { DATABASE: 'PostgreSQL', P95: '800' }, nodeIds: ['adr', 'other', 'a', 'b'],
        originalNodes: {
          adr: { label: 'ADR: {{DATABASE}} as primary data store', decision: 'Use {{DATABASE}} as the primary store.' },
          other: { label: 'ADR: {{DATABASE}} too', decision: 'Use {{DATABASE}}.' },
          a: { label: 'Shop' }, b: { label: 'Search' },
        },
        originalRelations: { r: { label: 'search in {{P95}} ms' } },
        originalSequences: { flow: { stepDescriptions: ['results within {{P95}} ms'] } },
      },
    } as never,
  })
  const field = (id: string, key: string) => (s().c4Nodes[id] as unknown as Record<string, unknown>)[key]

  // Item 196 and D7: a renamed element got its Hub label back.
  it('replaces only the old value in the text as it is now, and leaves a text without it alone', () => {
    load()
    s().applyHubTemplate('imp', { DATABASE: 'MySQL', P95: '800' })
    expect(s().c4Nodes.adr.label).toBe('ADR-007 Orders on MySQL')
    expect(field('adr', 'decision')).toBe('Use MySQL as the primary store.')
    expect(s().c4Nodes.other.label).toBe('Keeps Oracle')
    expect(field('other', 'decision')).toBe('We moved to Oracle.')
  })

  // Item 194: the flow's step notes and the relation stayed at 800.
  it('reaches the relations and the step notes of the flows, as one undo step', () => {
    load()
    s().applyHubTemplate('imp', { DATABASE: 'PostgreSQL', P95: '500' })
    expect(s().c4Relations.r.label).toBe('search in 500 ms')
    expect(s().sequences.flow.stepDescriptions).toEqual(['results within 500 ms'])
    s().undo()
    expect(s().c4Relations.r.label).toBe('search in 800 ms')
    expect(s().sequences.flow.stepDescriptions).toEqual(['results within 800 ms'])
  })

  // D18: a value left blank takes the template's default.
  it('gives a value left blank the template\'s default', () => {
    load()
    s().applyHubTemplate('imp', { DATABASE: 'MySQL', P95: '500' })
    s().applyHubTemplate('imp', { DATABASE: '', P95: '500' })
    expect(s().hubTemplates.imp.paramValues.DATABASE).toBe('PostgreSQL')
    expect(s().c4Nodes.adr.label).toBe('ADR-007 Orders on PostgreSQL')
  })
})

// Runs 35 to 44: a templated import made in a milestone and discarded left
// its record behind (fixed with item 146; checked here).
it('a templated import discarded in a milestone leaves no record', () => {
  const snap = s().createSnapshot('As-is')
  s().selectMilestone(snap)
  s()._pushUndo()
  s()._markMilestoneEdit()
  s().upsertHubTemplate('imp2', { conceptId: 'x', conceptName: 'X', templateParams: [], paramValues: {}, nodeIds: [], originalNodes: {} })
  s().discardMilestoneChanges()
  expect(s().hubTemplates.imp2).toBeUndefined()
})

// Item 195: a concept file from the Hub's Download, opened as a model.
it('a Hub concept file opens with its template filled and editable', () => {
  s().loadDiagram({
    hub: { id: 'req-x', category: 'requirement', name: 'API Response Time', description: '', tags: [], templateParams: [{ key: 'P95_MS', label: 'p95', defaultValue: '300' }] },
    nodes: [node('r1', 'API Response Time', { action: 'respond within {{P95_MS}} ms' })],
    relations: [],
  } as never)
  expect((s().c4Nodes.r1 as unknown as Record<string, unknown>).action).toBe('respond within 300 ms')
  const [id] = Object.keys(s().hubTemplates)
  s().applyHubTemplate(id, { P95_MS: '250' })
  expect((s().c4Nodes.r1 as unknown as Record<string, unknown>).action).toBe('respond within 250 ms')
})
