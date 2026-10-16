import { describe, expect, it } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import type { ModelCopy } from '../src/model'
import { countModelChanges, formatModelChanges, modelChangeReport } from '../src/modelChanges'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

const copy = (nodes: C4Node[], relations: C4Relation[] = []): ModelCopy => ({
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  relations: Object.fromEntries(relations.map((r) => [r.id, r])),
})

const base = () => [
  node('area', 'group', 'Payments'),
  node('need', 'need', 'Brief', { parentId: 'area', description: 'Customers pay by card.' }),
  node('req', 'requirement', 'Pay', { parentId: 'area', action: 'take the payment', ears_type: 'event-driven', trigger: 'the customer confirms' }),
  node('svc', 'component', 'Checkout', { description: 'src/checkout.ts' }),
  node('old', 'requirement', 'Invoice', { parentId: 'area', action: 'send an invoice' }),
]
const baseRelations = (): C4Relation[] => [
  { id: 'd1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
  { id: 's1', relationType: 'satisfies', sourceId: 'svc', targetId: 'req' },
  { id: 's2', relationType: 'satisfies', sourceId: 'svc', targetId: 'old' },
]

describe('model changes', () => {
  it('leaves out positions, sizes and folding', () => {
    const before = copy(base(), baseRelations())
    const moved = base().map((n) => ({ ...n, x: n.x + 500, y: 40, width: 320, height: 180, collapsed: true }))
    const report = modelChangeReport(before, copy(moved, baseRelations()))
    expect(countModelChanges(report)).toBe(0)
  })

  it('names each change with its old and new value, its place and its relations', () => {
    const before = copy(base(), baseRelations())
    const nodes = base()
      .filter((n) => n.id !== 'old')
      .map((n) => (n.id === 'req' ? { ...n, x: 900, action: 'take the payment within 2 seconds' } : n))
    nodes.push(node('sc', 'scenario', 'Card payment', { parentId: 'area', given: 'a basket', when: 'the customer pays', then: 'the order is paid', tests: 'src/pay.test.ts › pays\nsrc/pay.test.ts › refunds' }))
    const relations = [
      ...baseRelations().filter((r) => r.id !== 's2'),
      { id: 'v1', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
    ]
    const after = copy(nodes, relations)
    const report = modelChangeReport(before, after)

    expect(report.elements.changed).toEqual([{
      id: 'req', type: 'requirement', label: 'Pay', path: ['Payments'],
      changes: [{ field: 'action', before: 'take the payment', after: 'take the payment within 2 seconds' }],
      related: [
        { id: 'need', type: 'need', label: 'Brief', relationType: 'derives', direction: 'out' },
        { id: 'svc', type: 'component', label: 'Checkout', relationType: 'satisfies', direction: 'in' },
        { id: 'sc', type: 'scenario', label: 'Card payment', relationType: 'verifies', direction: 'in' },
      ],
    }])
    expect(report.elements.added.map((e) => [e.id, e.fields])).toEqual([
      ['sc', { given: 'a basket', when: 'the customer pays', then: 'the order is paid', tests: 'src/pay.test.ts › pays\nsrc/pay.test.ts › refunds' }],
    ])
    // A removed element comes with its relations as they were.
    expect(report.elements.removed).toMatchObject([{ id: 'old', label: 'Invoice', fields: { action: 'send an invoice' }, related: [{ id: 'svc', relationType: 'satisfies' }] }])
    expect(report.relations.added).toMatchObject([{ id: 'v1', relationType: 'verifies', source: { label: 'Card payment' }, target: { label: 'Pay' } }])
    expect(report.relations.removed).toMatchObject([{ id: 's2', source: { label: 'Checkout' }, target: { label: 'Invoice' } }])

    const text = formatModelChanges(report, before, after)
    expect(text).toContain('Elements added (1):\n- scenario "Card payment" (sc) in Payments\n')
    // A multi-line value goes on, indented, under its field.
    expect(text).toContain('    tests: src/pay.test.ts › pays\n      src/pay.test.ts › refunds')
    expect(text).toContain('    action: take the payment → take the payment within 2 seconds')
    expect(text).toContain('      ← satisfies component "Checkout" (svc)')
    expect(text).toContain('Elements removed (1):\n- requirement "Invoice" (old) in Payments')
    expect(text).toContain('Relations removed (1):\n- component "Checkout" (svc) → requirement "Invoice" (old) [satisfies] (s2)')
    expect(text).not.toMatch(/\bx:|width/)
  })

  it('shows a long text before and after on lines of their own, and a move by place', () => {
    const long = 'The customer pays by card, and the payment is taken before the order is confirmed.'
    const before = copy(base(), baseRelations())
    const after = copy(base().map((n) => (n.id === 'need' ? { ...n, description: `${long} Refunds too.`, parentId: undefined } : n)), baseRelations())
    const text = formatModelChanges(modelChangeReport(before, after), before, after)
    expect(text).toContain(`    description before: Customers pay by card.\n    description now: ${long} Refunds too.`)
    expect(text).toContain('    moved: Payments → (root)')
  })
})
