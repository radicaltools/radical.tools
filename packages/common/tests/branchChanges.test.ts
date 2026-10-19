import { describe, expect, it } from 'vitest'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import type { ModelCopy } from '../src/model'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { baseCopy, branchChanges, changeWork, viewChangeCounts, wordDiff } from '../src/branchChanges'
import { baseSince, forgeModelBase, isBaseOld, mayReplaceWithForgeBase, parseModelBase, serializeModelBase } from '../src/formats/modelBase'
import type { TestCase } from '../src/check'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })
const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((i) => [i.id, i]))
const copy = (nodes: C4Node[], relations: C4Relation[] = []): ModelCopy => ({ nodes: byId(nodes), relations: byId(relations) })

describe('branch changes', () => {
  it('marks what is new, changed and removed since the base, and keeps the removed ones to draw', () => {
    const base = copy([node('a', 'system', 'Shop'), node('b', 'system', 'Billing'), node('c', 'system', 'Old')], [rel('r1', 'interacts', 'a', 'c')])
    const now = copy([node('a', 'system', 'Shop', { description: 'Sells books', x: 900 }), node('b', 'system', 'Billing', { y: 40 }), node('d', 'system', 'New')], [rel('r2', 'interacts', 'a', 'd')])
    const changes = branchChanges(base, now.nodes, now.relations)
    expect(changes.nodes).toEqual({ a: 'changed', c: 'removed', d: 'new' })
    expect(changes.relations).toEqual({ r1: 'removed', r2: 'new' })
    expect(changes.counts).toEqual({ added: 1, changed: 1, removed: 1 })
    expect(changes.removedNodes.map((n) => n.id)).toEqual(['c'])
    expect(changes.removedRelations.map((r) => r.id)).toEqual(['r1'])
  })

  it('counts the changes each view shows', () => {
    const nodes = byId([node('a', 'system', 'Shop'), node('d', 'system', 'New'), node('e', 'person', 'Customer')])
    const views = [
      { id: 'all', name: 'All', nodeIds: [] },
      { id: 'list', name: 'Listed', nodeIds: ['a', 'e', 'c'] },
      { id: 'people', name: 'People', nodeIds: ['e'] },
    ] as unknown as DiagramView[]
    expect(viewChangeCounts(views, nodes, {}, { a: 'changed', c: 'removed', d: 'new' })).toEqual({ all: 3, list: 2, people: 0 })
  })

  it('names the words removed and added', () => {
    expect(wordDiff('take the payment', 'take the card payment within 2 s')).toEqual([
      { kind: 'same', text: 'take the ' },
      { kind: 'added', text: 'card ' },
      { kind: 'same', text: 'payment' },
      { kind: 'added', text: ' within 2 s' },
    ])
    expect(wordDiff('a b c', 'a c')).toEqual([{ kind: 'same', text: 'a ' }, { kind: 'removed', text: 'b ' }, { kind: 'same', text: 'c' }])
    expect(wordDiff('', 'new')).toEqual([{ kind: 'added', text: 'new' }])
  })
})

describe('change status', () => {
  const tc = (file: string, title: string, status: TestCase['status']): TestCase => ({ file, title: [title], status })
  const tests: TestCase[] = [
    tc('src/pay.test.ts', 'pays', 'passed'),
    tc('src/refund.test.ts', 'refunds', 'failed'),
    tc('src/old.test.ts', 'invoices', 'passed'),
    tc('src/card.test.ts', 'other test', 'passed'),
    tc('src/edit.test.ts', 'edits', 'passed'),
  ]
  const scenario = (id: string, testIds: string) => node(id, 'scenario', id, { given: 'g', when: 'w', then: 't', tests: testIds })
  const base = copy([
    node('changed', 'requirement', 'Edit', { action: 'edit the order' }), scenario('s-edit', 'src/edit.test.ts › edits'),
    node('gone', 'requirement', 'Invoice', { action: 'send an invoice' }), scenario('s-old', 'src/old.test.ts › invoices'),
  ], [rel('v-edit', 'verifies', 's-edit', 'changed'), rel('v-old', 'verifies', 's-old', 'gone')])
  const now = copy([
    node('pay', 'requirement', 'Pay', { action: 'take the payment' }), scenario('s-pay', 'src/pay.test.ts › pays'), node('svc', 'component', 'Checkout'),
    node('refund', 'requirement', 'Refund', { action: 'refund' }), scenario('s-refund', 'src/refund.test.ts › refunds'),
    node('card', 'requirement', 'Card', { action: 'take a card' }), scenario('s-card', 'src/card.test.ts › takes a card'),
    node('bare', 'requirement', 'Bare', { action: 'do' }),
    node('changed', 'requirement', 'Edit', { action: 'edit the order within a day' }), scenario('s-edit', 'src/edit.test.ts › edits'),
    node('dec', 'adr', 'Decide', { status: 'accepted' }),
  ], [
    rel('v-pay', 'verifies', 's-pay', 'pay'), rel('sat', 'satisfies', 'svc', 'pay'), rel('v-refund', 'verifies', 's-refund', 'refund'),
    rel('v-card', 'verifies', 's-card', 'card'), rel('v-edit', 'verifies', 's-edit', 'changed'),
  ])
  const status = (work: ReturnType<typeof changeWork>) => Object.fromEntries(work.items.map((i) => [i.id, i.status]))

  it('says how far each changed requirement and ADR has got by the test report', () => {
    const work = changeWork(branchChanges(base, now.nodes, now.relations), base, now, builtInGovernanceMetamodel(), tests)
    expect(status(work)).toEqual({
      pay: 'verified', refund: 'failing', card: 'test-not-written', bare: 'no-checker', dec: 'no-checker',
      changed: 'tests-unchanged', gone: 'test-still-runs',
    })
    expect(work).toMatchObject({ newRequirements: 4, newVerified: 1 })
    expect(work.items.find((i) => i.id === 'pay')).toMatchObject({ kind: 'added', satisfiedBy: [{ id: 'svc', label: 'Checkout' }], checkers: [{ id: 's-pay' }] })
    expect(work.items.find((i) => i.id === 'card')!.tests).toEqual([{ id: 'src/card.test.ts › takes a card', outcome: 'not-found' }])
    expect(work.items.find((i) => i.id === 'gone')).toMatchObject({ kind: 'removed', checkers: [{ id: 's-old', label: 's-old' }] })
  })

  it('counts a changed requirement verified when its scenario changed with it, and nothing without a report', () => {
    const edited = copy(Object.values(now.nodes).map((n) => n.id === 's-edit' ? { ...n, then: 't, within a day' } as C4Node : n), Object.values(now.relations))
    expect(status(changeWork(branchChanges(base, edited.nodes, edited.relations), base, edited, builtInGovernanceMetamodel(), tests)).changed).toBe('verified')
    const none = changeWork(branchChanges(base, now.nodes, now.relations), base, now, builtInGovernanceMetamodel(), undefined)
    expect(status(none)).toMatchObject({ pay: 'no-report', gone: 'removed' })
  })
})

describe('base file', () => {
  const nodes = [node('a', 'system', 'Shop')]
  it('round-trips, and turns down what is no base', () => {
    const text = serializeModelBase({ commit: 'abc1234def', described: 'merge base with origin/main', branch: 'feature', nodes, relations: [] }, new Date('2026-10-16T10:00:00Z'))
    const base = parseModelBase(text)
    expect(base).toEqual({ version: 1, commit: 'abc1234def', described: 'merge base with origin/main', branch: 'feature', savedAt: '2026-10-16T10:00:00.000Z', nodes, relations: [] })
    expect(baseCopy(base!).nodes.a.label).toBe('Shop')
    expect(parseModelBase('{ nope')).toBeNull()
    expect(parseModelBase(JSON.stringify({ ...base, version: 2 }))).toBeNull()
    expect(parseModelBase(JSON.stringify({ ...base, nodes: [{ id: 'x' }] }))).toBeNull()
    expect(parseModelBase(JSON.stringify({ ...base, savedAt: 'yesterday' }))).toBeNull()
  })

  it('is old after a day', () => {
    const savedAt = '2026-10-16T10:00:00.000Z'
    expect(isBaseOld({ savedAt }, Date.parse('2026-10-17T09:00:00Z'))).toBe(false)
    expect(isBaseOld({ savedAt }, Date.parse('2026-10-17T11:00:00Z'))).toBe(true)
  })

  it('a Forge run saves its own base where git has none', () => {
    const git = serializeModelBase({ commit: 'abc1234def', described: 'merge base with origin/main', branch: 'feature', nodes, relations: [] })
    const forge = forgeModelBase(nodes, [], new Date('2026-10-16T10:00:00Z'))
    expect(mayReplaceWithForgeBase(null)).toBe(true)
    expect(mayReplaceWithForgeBase('{ "version": 1 }')).toBe(true)
    expect(mayReplaceWithForgeBase(forge)).toBe(true)
    expect(mayReplaceWithForgeBase(git)).toBe(false)
    const base = parseModelBase(forge)!
    expect(base).toMatchObject({ source: 'forge', commit: '', branch: null, nodes })
    expect(isBaseOld(base, Date.parse('2026-12-01T00:00:00Z'))).toBe(false)
    expect(baseSince(base)).toBe('the start of the Forge run')
    expect(baseSince(parseModelBase(git)!)).toBe('main abc1234')
    // Only a Forge base may go without a commit.
    expect(parseModelBase(JSON.stringify({ ...JSON.parse(git), commit: '' }))).toBeNull()
    expect(parseModelBase(JSON.stringify({ ...JSON.parse(forge), source: 'svn' }))).toBeNull()
  })
})
