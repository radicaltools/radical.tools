import { describe, expect, it } from 'vitest'
import type { C4Node } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createModelFacade } from '../src/ai/modelFacade'
import type { ToolRunContext } from '../src/ai/tools'
import {
  applyProposal,
  describeProposal,
  formatProposal,
  parseProposal,
  refinementGuard,
  snapshotOf,
  type ForgeProposal,
} from '../src/ai/forge'

const node = (id: string, type: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node

/** The model before a Processes stage: a need, a requirement and its scenario. */
function before() {
  let next = 0
  return createModelFacade({
    nodes: [
      node('n', 'need', { label: 'Web shop', description: 'A web shop.' }),
      node('r1', 'requirement', { label: 'Pay', ears_type: 'ubiquitous', action: 'take payments' }),
      node('s1', 'scenario', { label: 'Card payment', given: 'a cart', when: 'the customer pays', then: 'the order is paid' }),
      node('d', 'domain', { label: 'Sales' }),
    ],
    relations: [
      { id: 'x1', sourceId: 'r1', targetId: 'n', relationType: 'derives' },
      { id: 'x2', sourceId: 's1', targetId: 'r1', relationType: 'verifies' },
    ],
    views: [],
    metamodel: builtInGovernanceMetamodel(),
  }, { newId: () => `id${++next}` })
}

function contextOf(facade: ReturnType<typeof before>): ToolRunContext {
  const temp = new Map<string, string>()
  return {
    diagram: facade,
    resolveId: (id) => temp.get(id) ?? id,
    registerTempId: (tempId, realId) => { temp.set(tempId, realId) },
    resetTempIds: () => temp.clear(),
    placeNext: () => ({ x: 0, y: 0 }),
  }
}

const refund: ForgeProposal = {
  reason: 'The return process refunds an order, but no requirement asks for it.',
  changes: [
    { tool: 'add_node', input: { tempId: 'refund', type: 'requirement', label: 'Refund', properties: { ears_type: 'event-driven', trigger: 'an order is returned', action: 'refund the payment' } } },
    { tool: 'add_relation', input: { sourceId: 'refund', targetId: 'n', relationType: 'derives' } },
    { tool: 'update_node', input: { id: 'r1', properties: { action: 'take card payments' } } },
    { tool: 'move_node', input: { id: 'refund', parentId: null } },
  ],
}

describe('Forge proposals', () => {
  it('parseProposal takes additions and corrections, and no deletions', () => {
    expect(parseProposal({ reason: 'x', changes: [{ tool: 'delete_node', input: { id: 'r1' } }] })).toContain('never deletes')
    expect(parseProposal({ reason: '', changes: [] })).toContain('reason is required')
    expect(parseProposal({ reason: 'x', changes: [] })).toContain('at least one change')
    expect(parseProposal({ reason: ' Found it. ', changes: refund.changes })).toEqual({ ...refund, reason: 'Found it.' })
  })

  it('describeProposal names every element, field and link it would write', () => {
    const facade = before()
    const lines = describeProposal(refund, facade.getNodes(), facade.getRelations())
    expect(lines).toEqual([
      {
        change: 'add',
        text: 'Add requirement "Refund"',
        details: ['ears_type: "event-driven"', 'trigger: "an order is returned"', 'action: "refund the payment"'],
      },
      { change: 'link', text: 'Link requirement "Refund" → need "Web shop" (derives)', details: [] },
      { change: 'change', text: 'Change requirement "Pay"', details: ['action: "take payments" → "take card payments"'] },
      { change: 'move', text: 'Move requirement "Refund" to the root', details: [] },
    ])
    const text = formatProposal(refund, lines)
    expect(text).toContain('Found: The return process refunds an order')
    expect(text).toContain('3. Change requirement "Pay"\n   action: "take payments" → "take card payments"')
    // A relation's change names its ends and shows the old value.
    const relLines = describeProposal({ reason: 'r', changes: [{ tool: 'update_relation', input: { id: 'x2', label: 'checks' } }] }, facade.getNodes(), facade.getRelations())
    expect(relLines[0]).toEqual({ change: 'change', text: 'Change the link scenario "Card payment" → requirement "Pay" (verifies)', details: ['label: (empty) → "checks"'] })
  })

  it('applyProposal applies every change or none', async () => {
    const facade = before()
    const ctx = contextOf(facade)
    const done = await applyProposal(refund, ctx)
    expect(done.ok).toBe(true)
    const added = Object.values(facade.getNodes()).find((n) => n.label === 'Refund')!
    expect(added).toMatchObject({ type: 'requirement', action: 'refund the payment' })
    expect(Object.values(facade.getRelations()).some((r) => r.sourceId === added.id && r.targetId === 'n')).toBe(true)
    expect((facade.getNodes().r1 as unknown as { action: string }).action).toBe('take card payments')
    if (done.ok) {
      expect(done.added).toContain(added.id)
      expect(done.refinements.map((r) => `${r.change} ${r.label}`)).toEqual(['added Refund', 'changed Pay'])
    }

    // The last change names a node there is none of: nothing stays.
    const snapshot = snapshotOf(facade)
    const broken: ForgeProposal = {
      reason: 'Shipping needs a requirement.',
      changes: [
        { tool: 'add_node', input: { tempId: 'ship', type: 'requirement', label: 'Ship', properties: { ears_type: 'ubiquitous', action: 'ship orders' } } },
        { tool: 'update_node', input: { id: 's1', properties: { then: 'the order is paid and shipped' } } },
        { tool: 'add_relation', input: { sourceId: 'ship', targetId: 'nobody', relationType: 'derives' } },
      ],
    }
    const failed = await applyProposal(broken, ctx)
    expect(failed.ok).toBe(false)
    expect(failed.text).toContain('Change 3 (add_relation) failed, so nothing was written')
    expect(snapshotOf(facade)).toEqual(snapshot)
  })

  it('refinementGuard refuses writes to earlier stages and lets the stage write its own', () => {
    const facade = before()
    const state = { stage: 'processes' as const, before: snapshotOf(facade), proposed: new Set(['p-req', 'p-rel']) }
    const resolve = (id: string): string => ({ checkout: 'p1', pay: 'st1' } as Record<string, string>)[id] ?? id
    const guard = (name: string, input: unknown): string | null => refinementGuard(state, name, input, resolve)
    // Its own process and steps, a link from them to an earlier requirement, an update of what it added.
    expect(guard('add_node', { tempId: 'checkout', type: 'process', label: 'Check out' })).toBeNull()
    expect(guard('add_node', { tempId: 'pay', type: 'step', label: 'Pay', parentId: 'checkout' })).toBeNull()
    expect(guard('add_relation', { sourceId: 'checkout', targetId: 'r1', relationType: 'satisfies' })).toBeNull()
    expect(guard('update_node', { id: 'pay', label: 'Pay by card' })).toBeNull()
    expect(guard('search_model', { query: 'LIST NODES' })).toBeNull()
    // Earlier stages: each refused, pointing at the proposal tool.
    expect(guard('add_node', { tempId: 'r', type: 'requirement', label: 'Refund' })).toMatch(/requirement belongs to an earlier stage.*propose_refinement/)
    expect(guard('update_node', { id: 's1', label: 'x' })).toMatch(/"Card payment" belongs to an earlier stage.*propose_refinement/)
    expect(guard('move_node', { id: 'r1', parentId: 'd' })).toContain('propose_refinement')
    expect(guard('delete_node', { id: 's1' })).toContain('never deletes')
    expect(guard('add_relation', { sourceId: 's1', targetId: 'n', relationType: 'traces-to' })).toContain('both ends belong to earlier stages')
    expect(guard('update_relation', { id: 'x2', label: 'checks' })).toContain('propose_refinement')
    expect(guard('delete_relation', { id: 'x1' })).toContain('never deletes')
    expect(guard('reset_diagram', {})).toContain('never clears')
    // What an accepted proposal added counts as an earlier stage's.
    expect(guard('update_node', { id: 'p-req', label: 'x' })).toContain('propose_refinement')
    expect(guard('update_relation', { id: 'p-rel', label: 'x' })).toContain('propose_refinement')
    expect(guard('add_relation', { sourceId: 'p-req', targetId: 'n' })).toContain('both ends')
    // Over MCP the message names the MCP tool.
    expect(refinementGuard(state, 'update_node', { id: 's1' }, resolve, 'forge_propose_refinement')).toContain('forge_propose_refinement')
  })
})
