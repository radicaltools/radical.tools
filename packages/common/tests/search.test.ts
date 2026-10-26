import { expect, it } from 'vitest'
import { foldText, parseSearch, searchModel, searchSuggestions, type SearchData } from '../src/search'
import { runModelQuery } from '../src/ai/queryLanguage'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, DiagramView } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 240, height: 140, collapsed: false, ...props }) as C4Node

const view = (id: string, name: string, extra: Partial<DiagramView> = {}): DiagramView => ({ id, name, nodeIds: [], positions: {}, ...extra })

const metamodel = builtInGovernanceMetamodel()

const DATA: SearchData = {
  metamodel,
  nodes: {
    shop: node('shop', 'system', 'Shop'),
    zrodlo: node('zrodlo', 'container', 'Źródło płatności', { parentId: 'shop' }),
    pay: node('pay', 'container', 'Payment Service', { parentId: 'shop', technology: 'Go' }),
    books: node('books', 'container', 'Books', { parentId: 'shop', description: 'Keeps every order in the ledger, one line a book, for audits.' }),
    adr: node('adr', 'adr', 'Use Postgres', { status: 'accepted', decision: 'We keep orders in Postgres.' }),
    adr2: node('adr2', 'adr', 'Use Kafka for orders', { status: 'proposed' }),
  },
  relations: {
    r1: { id: 'r1', sourceId: 'pay', targetId: 'books', label: 'writes payments to', x: 0, y: 0, width: 0, height: 0 } as never,
  },
  views: {
    ctx: view('ctx', 'Shop context', { nodeIds: ['shop'], folder: 'C4/Context' }),
    pays: view('pays', 'Payments', { nodeIds: ['pay', 'books'], folder: 'C4' }),
    orders: view('orders', 'Order table', { kind: 'table', nodeIds: ['books', 'adr2'] }),
  },
  sequences: { seq: { id: 'seq', name: 'Pay for an order', relationIds: ['r1'] } },
  presentations: [{ id: 'deck', name: 'Quarterly review', slides: [
    { id: 's1', name: 'Where we are', snapshotId: null, viewport: { x: 0, y: 0, zoom: 1 } },
    { id: 's2', name: 'The order flow', snapshotId: null, viewId: 'pays', viewport: { x: 0, y: 0, zoom: 1 } },
  ] }],
  milestones: [{ id: 'm1', name: 'Order rework done', timestamp: Date.UTC(2026, 9, 1) }],
}

const ids = (q: string, data: SearchData = DATA): string[] => searchModel(data, q).hits.map((h) => `${h.kind}:${h.id}`)

it('every word matches, in any order, without case or accents', () => {
  expect(foldText('Źródło płatności')).toBe('zrodlo platnosci')
  expect(ids('zrodlo')).toContain('element:zrodlo')
  expect(ids('PŁATNOŚCI')).toContain('element:zrodlo')
  expect(ids('service payment')[0]).toBe('element:pay')
  // Every word has to match somewhere.
  expect(ids('payment kafka')).toEqual([])
  // A word matches the technology too.
  expect(ids('payment go')[0]).toBe('element:pay')
})

it("initials match an element's name", () => {
  expect(ids('ps')).toContain('element:pay')
  const hit = searchModel(DATA, 'ps').hits.find((h) => h.id === 'pay')!
  // The initials are marked.
  expect(hit.marks).toEqual([[0, 1], [8, 9]])
  // One letter is no initials.
  expect(ids('p').filter((x) => x === 'element:pay')).toEqual(['element:pay'])
})

it('the match is marked, and a hit in a description shows the words around it', () => {
  const pay = searchModel(DATA, 'serv').hits.find((h) => h.id === 'pay')!
  expect(pay.marks).toEqual([[8, 12]])
  expect(pay.label.slice(8, 12)).toBe('Serv')
  const zr = searchModel(DATA, 'zrodlo').hits.find((h) => h.id === 'zrodlo')!
  expect(zr.label.slice(...zr.marks[0])).toBe('Źródło')

  const books = searchModel(DATA, 'ledger').hits.find((h) => h.id === 'books')!
  expect(books.snippet?.field).toBe('Description')
  expect(books.snippet?.text).toContain('in the ledger')
  const [a, b] = books.snippet!.marks[0]
  expect(books.snippet!.text.slice(a, b)).toBe('ledger')
  // A property's value is found and named.
  const adr = searchModel(DATA, 'postgres orders').hits.find((h) => h.id === 'adr')!
  expect(adr.snippet?.field).toBe('Decision')
})

it('prefixes limit the kinds, the view, the types and the properties', () => {
  // Every kind of place, with nothing narrowed.
  expect(ids('order')).toEqual(expect.arrayContaining(['view:orders', 'element:adr2', 'sequence:seq', 'slide:s2', 'milestone:m1', 'element:books']))
  expect(searchModel(DATA, 'order').counts).toMatchObject({ view: 1, sequence: 1, slide: 1, milestone: 1 })
  expect(ids('v: order')).toEqual(['view:orders'])
  expect(ids('v:order')).toEqual(['view:orders'])
  expect(ids('p:order')).toEqual(['slide:s2'])
  expect(ids('m: order')).toEqual(['milestone:m1'])
  expect(ids('s:')).toEqual(['sequence:seq'])
  expect(ids('f: context')).toEqual(['folder:C4/Context'])
  // A view's folder and type find it.
  expect(ids('v: table')).toEqual(['view:orders'])
  // in: a view by its name, quoted or from its start.
  expect(ids('in:"Order table" order').sort()).toEqual(['element:adr2', 'element:books'])
  expect(ids('in:payments').sort()).toEqual(['element:books', 'element:pay', 'relation:r1'].sort())
  expect(parseSearch('in:nowhere x', DATA).missingView).toBe('nowhere')
  expect(ids('in:nowhere x')).toEqual([])
  // @: the view shown.
  const shown: SearchData = { ...DATA, current: { id: 'orders', name: 'Order table', nodes: new Set(['books', 'adr2']) } }
  expect(ids('@ o', shown).sort()).toEqual(['element:adr2', 'element:books'])
  // type: by id or name, and a property by its key or name.
  expect(ids('type:adr').sort()).toEqual(['element:adr', 'element:adr2'])
  expect(ids('t:Contain pay')).toEqual(['element:pay'])
  expect(ids('type:adr status:accepted')).toEqual(['element:adr'])
  expect(ids('status:prop')).toEqual(['element:adr2'])

  // What the bar suggests for the word typed last.
  expect(searchSuggestions('in:pay', DATA).map((s) => s.query)).toEqual(['in:Payments '])
  expect(searchSuggestions('in:', DATA).map((s) => s.label)).toEqual(['Order table', 'Payments', 'Shop context'])
  expect(searchSuggestions('ty', DATA)[0].query).toBe('type:')
  expect(searchSuggestions('x type:ad', DATA).map((s) => s.query)).toEqual(['x type:adr '])
  expect(searchSuggestions('status:', DATA).map((s) => s.label)).toEqual(expect.arrayContaining(['proposed', 'accepted']))
  expect(searchSuggestions('payment ', DATA)).toEqual([])
})

it('FIND in the query language returns the hits as Quick Search finds them', () => {
    const ctx = { nodes: DATA.nodes, relations: DATA.relations, views: DATA.views, sequences: DATA.sequences, metamodel }
    const found = runModelQuery('FIND ledger', ctx).result as { total: number; hits: Array<Record<string, string>> }
    expect(found.total).toBe(1)
    expect(found.hits[0]).toMatchObject({ kind: 'element', id: 'books', label: 'Books', type: 'container' })
    expect(found.hits[0].match).toMatch(/^Description: .*ledger/)
    const views = runModelQuery('FIND v: payments', ctx).result as { hits: Array<{ kind: string; id: string }> }
    expect(views.hits).toEqual([expect.objectContaining({ kind: 'view', id: 'pays' })])
    const limited = runModelQuery('FIND o LIMIT 2', ctx).result as { total: number; hits: unknown[] }
    expect(limited.hits).toHaveLength(2)
  expect(limited.total).toBeGreaterThan(2)
})
