import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'
import { mergeModels } from '../src/modelMerge'

const node = (id: string, label: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type: 'system', label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node
const rel = (id: string, sourceId: string, targetId: string, label = ''): C4Relation => ({ id, sourceId, targetId, label }) as C4Relation

const base: DiagramData = {
  nodes: [node('shop', 'Shop', { description: 'Sells books' }), node('bank', 'Bank'), node('user', 'Customer')],
  relations: [rel('r1', 'user', 'shop', 'buys')],
  views: [{ id: 'v1', name: 'Context', nodeIds: [], positions: { shop: { x: 0, y: 0, width: 200, height: 100 } } }],
}
const clone = (d: DiagramData): DiagramData => JSON.parse(JSON.stringify(d))
const byId = <T extends { id: string }>(list: T[] | undefined, id: string) => list?.find((e) => e.id === id)

describe('mergeModels', () => {
  it('keeps both sides\' changes to different elements, fields, relations and views', () => {
    const ours = clone(base)
    ours.nodes.find((n) => n.id === 'shop')!.description = 'Sells and lends books'
    ours.nodes.push(node('stock', 'Stock'))
    ours.views![0].name = 'System context'
    const theirs = clone(base)
    theirs.nodes.find((n) => n.id === 'shop')!.technology = 'Node.js'
    theirs.nodes.find((n) => n.id === 'bank')!.label = 'Payment Provider'
    theirs.relations.push(rel('r2', 'shop', 'bank', 'charges'))
    const { merged, conflicts } = mergeModels(base, ours, theirs)
    expect(conflicts).toEqual([])
    expect(byId(merged.nodes, 'shop')).toMatchObject({ description: 'Sells and lends books', technology: 'Node.js' })
    expect(byId(merged.nodes, 'bank')!.label).toBe('Payment Provider')
    expect(merged.nodes.map((n) => n.id)).toEqual(['shop', 'bank', 'user', 'stock'])
    expect(merged.relations.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(merged.views![0].name).toBe('System context')
  })

  it('removes what one side removed and the other left alone, and keeps what the other changed', () => {
    const ours = clone(base)
    ours.nodes = ours.nodes.filter((n) => n.id !== 'bank')
    ours.relations = []
    const theirs = clone(base)
    theirs.relations[0].label = 'orders'
    const { merged, conflicts } = mergeModels(base, ours, theirs)
    expect(merged.nodes.map((n) => n.id)).toEqual(['shop', 'user'])
    // Removed by us, changed by them: theirs wins, and it is reported.
    expect(merged.relations.map((r) => r.label)).toEqual(['orders'])
    expect(conflicts).toEqual(['orders'])
  })

  it('keeps theirs where both changed the same field, and says so; positions merge without a word', () => {
    const ours = clone(base)
    ours.nodes.find((n) => n.id === 'shop')!.description = 'Ours'
    Object.assign(ours.nodes.find((n) => n.id === 'user')!, { x: 50, y: 60 })
    ours.views![0].positions = { shop: { x: 10, y: 10, width: 200, height: 100 } }
    const theirs = clone(base)
    theirs.nodes.find((n) => n.id === 'shop')!.description = 'Theirs'
    Object.assign(theirs.nodes.find((n) => n.id === 'user')!, { x: 90 })
    theirs.views![0].positions = { shop: { x: 99, y: 0, width: 200, height: 100 }, bank: { x: 300, y: 0, width: 200, height: 100 } }
    const { merged, conflicts } = mergeModels(base, ours, theirs)
    expect(byId(merged.nodes, 'shop')!.description).toBe('Theirs')
    expect(conflicts).toEqual(['Shop: description'])
    // Each coordinate from the side that moved it; theirs where both did.
    expect(byId(merged.nodes, 'user')).toMatchObject({ x: 90, y: 60 })
    expect(merged.views![0].positions).toEqual({ shop: { x: 99, y: 10, width: 200, height: 100 }, bank: { x: 300, y: 0, width: 200, height: 100 } })
  })

  it('takes the other side whole when only one changed', () => {
    const theirs = clone(base)
    theirs.nodes[0].label = 'Bookshop'
    expect(mergeModels(base, clone(base), theirs).merged).toEqual(theirs)
    expect(mergeModels(base, theirs, clone(base)).merged).toEqual(theirs)
  })
})
