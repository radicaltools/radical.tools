import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { nodeSummary } from '../src/nodeSummary'

const node = (id: string, type: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, ...extra }) as C4Node

describe('element summary', () => {
  const svc = node('svc', 'container', { label: 'Payments Service', technology: 'Java', description: 'Moves money.\n\nMore detail.' })
  const req = node('req', 'requirement', { ears_type: 'event-driven', trigger: 'a payment is submitted', action: 'check the limit', description: 'Why.' })
  const nodes: Record<string, C4Node> = { svc, req }
  const relations: Record<string, C4Relation> = { s: { id: 's', sourceId: 'svc', targetId: 'req', relationType: 'satisfies' } as C4Relation }
  const summary = (n: C4Node) => nodeSummary(n, { ...nodes, [n.id]: n }, relations)

  it('says what each type means by it', () => {
    expect(summary(req)).toBe('When a payment is submitted, Payments Service shall check the limit.')
    expect(summary(node('sc', 'scenario', { given: 'a batch', when: 'it is approved twice', then: 'the second is rejected' })))
      .toBe('When it is approved twice → then the second is rejected')
    expect(summary(node('adr', 'adr', { status: 'accepted', decision: 'Use Postgres.' }))).toBe('Accepted: Use Postgres.')
    expect(summary(node('ff', 'fitness-fn', { description: 'p95 latency of checkout', threshold: '< 300 ms' }))).toBe('p95 latency of checkout — threshold < 300 ms')
    expect(summary(node('m', 'mockup', { screen: '/checkout', description: 'Pay for the basket' }))).toBe('/checkout — Pay for the basket')
    expect(summary(svc)).toBe('[Java] Moves money.')
  })

  it('falls back to the description\'s first sentence, in one line', () => {
    expect(summary(node('n', 'need', { description: '# Brief\nCustomers want\n  click & collect. They say so often.\n\nDetails.' }))).toBe('Brief Customers want click & collect.')
    expect(summary(node('r2', 'requirement', { description: 'Not written as EARS yet.' }))).toBe('Not written as EARS yet.')
    expect(summary(node('x', 'scenario'))).toBe('')
  })
})
