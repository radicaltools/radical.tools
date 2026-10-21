/**
 * Wiki search tests.
 *
 * Covers:
 *   - a page is found by its name, wherever in it and in any case
 *   - a page is found by its description, the sentence of a requirement and
 *     its text fields, with the words around the match as a snippet
 *   - a state-driven sentence reads as the page writes it, with its state
 *   - a name match needs no snippet; no match is null
 *   - field labels lose the hint a form puts in brackets
 */
import { describe, it, expect } from 'vitest'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { fieldTitle, searchableTexts, wikiSearchHit } from '../src/components/wikiSearch'

const mm = builtInGovernanceMetamodel()
const node = (id: string, type: string, label: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 10, height: 10, ...extra }) as unknown as C4Node

const nodes: Record<string, C4Node> = {
  pay: node('pay', 'container', 'Payments Service', {
    description: 'Processes domestic and cross-border payment instructions for retail and corporate customers.',
    technology: 'Go 1.22 / gRPC',
  }),
  req: node('req', 'requirement', 'Instant confirmation', {
    ears_type: 'event-driven',
    trigger: 'a payment is accepted',
    action: 'confirm it within two seconds',
    rationale: 'Customers abandon transfers that look stuck.',
  }),
  need: node('need', 'need', 'Retail brief', { description: 'Line one.\n\nLine two says ledger.', source: 'Product owner' }),
}
const relations: Record<string, C4Relation> = {
  r: { id: 'r', sourceId: 'pay', targetId: 'req', relationType: 'satisfies' },
}
const hit = (id: string, query: string) => wikiSearchHit(nodes[id], query, nodes, relations, mm)

describe('wikiSearchHit', () => {
  it('finds a page by its name, in any case, without a snippet', () => {
    expect(hit('pay', 'ments s')).toEqual({ nameAt: 3 })
  })

  it('finds a page by its description and shows the words around the match', () => {
    const found = hit('pay', 'cross-border')
    expect(found?.nameAt).toBe(-1)
    expect(found?.snippet).toMatchObject({ field: undefined, match: 'cross-border' })
    expect(found?.snippet?.before).toBe('Processes domestic and ')
    expect(found?.snippet?.after).toBe(' payment instructions for retail and corporate customers.')
  })

  it('marks with an ellipsis where the snippet leaves text out', () => {
    expect(hit('pay', 'corporate')?.snippet?.before.startsWith('…')).toBe(true)
    expect(hit('pay', 'processes')?.snippet?.after.endsWith('…')).toBe(true)
  })

  it('finds a requirement by its sentence, with the element that satisfies it as subject', () => {
    expect(hit('req', 'payments service shall')?.snippet?.match).toBe('Payments Service shall')
  })

  it('reads a state-driven sentence with the state it points at, as the page does', () => {
    const withState: Record<string, C4Node> = {
      ...nodes,
      sm: node('sm', 'state-machine', 'Order lifecycle'),
      confirmed: node('confirmed', 'state', 'Confirmed', { parentId: 'sm' }),
      order: node('order', 'entity', 'Order'),
      waits: node('waits', 'requirement', 'Ship confirmed orders', {
        ears_type: 'state-driven',
        precondition: 'the order is waiting',
        precondition_state: 'confirmed',
        action: 'ship it',
      }),
    }
    const rels: Record<string, C4Relation> = {
      ...relations,
      life: { id: 'life', sourceId: 'sm', targetId: 'order', relationType: 'lifecycle-of' },
    }
    const find = (query: string) => wikiSearchHit(withState.waits, query, withState, rels, mm)
    expect(find('order is confirmed')?.snippet?.match).toBe('Order is Confirmed')
    expect(find('waiting')).toBeNull()
  })

  it('names the field a match is in, and reads text across line breaks', () => {
    expect(hit('req', 'look stuck')?.snippet).toMatchObject({ field: 'Rationale', match: 'look stuck' })
    expect(hit('pay', 'grpc')?.snippet).toMatchObject({ field: 'Technology', match: 'gRPC' })
    expect(hit('need', 'one. line two')?.snippet?.match).toBe('one. Line two')
  })

  it('is null when nothing matches or nothing is asked', () => {
    expect(hit('pay', 'kafka')).toBeNull()
    expect(hit('pay', '')).toBeNull()
  })
})

describe('searchableTexts', () => {
  it('leaves out the clauses a requirement sentence already says', () => {
    expect(searchableTexts(nodes.req, nodes, relations, mm).map((t) => t.field)).toEqual([undefined, 'Rationale'])
  })

  it('falls back to description and technology without a metamodel', () => {
    expect(searchableTexts(nodes.pay, nodes, relations, undefined).map((t) => t.field)).toEqual([undefined, 'Technology'])
  })
})

describe('fieldTitle', () => {
  it('drops the hint in brackets', () => {
    expect(fieldTitle('Source (who / where from)')).toBe('Source')
    expect(fieldTitle('Rationale')).toBe('Rationale')
  })
})
