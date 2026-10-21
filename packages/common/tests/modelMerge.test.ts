import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'
import { mergeModelEdits, mergeModels, modelEdits } from '../src/modelMerge'

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

  it('takes an empty text, an unticked box or an empty list for no value, as the folder writes them', () => {
    const b = clone(base)
    b.nodes.push(node('new', 'New', { description: '', external: false, tags: [] } as Partial<C4Node>))
    const ours = clone(base) // the add taken back
    const theirs = clone(base) // the folder read back: the element, its empty fields not written
    theirs.nodes.push(node('new', 'New'))
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(conflicts).toEqual([])
    expect(byId(merged.nodes, 'new')).toBeUndefined()
  })

  it('removes what one side removed and the other only moved or framed anew', () => {
    const ours = clone(base)
    ours.views = []
    ours.nodes = ours.nodes.filter((n) => n.id !== 'bank')
    const theirs = clone(base)
    theirs.views![0].viewport = { x: 10, y: 20, zoom: 0.5 }
    theirs.views![0].positions = { shop: { x: 99, y: 0, width: 200, height: 100 } }
    Object.assign(theirs.nodes.find((n) => n.id === 'bank')!, { x: 400, y: 30 })
    const { merged, conflicts } = mergeModels(base, ours, theirs)
    expect(conflicts).toEqual([])
    expect(merged.views).toEqual([])
    expect(byId(merged.nodes, 'bank')).toBeUndefined()
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

  it('takes a coordinate moved by less than a pixel for one nobody moved (item 165)', () => {
    const ours = clone(base)
    ours.views![0].positions = { shop: { x: 300, y: 400, width: 200, height: 100 } }
    const theirs = clone(base)
    theirs.views![0].positions = { shop: { x: 0, y: 0.04, width: 200, height: 100 } }
    expect(mergeModels(base, ours, theirs).merged.views![0].positions).toEqual(ours.views![0].positions)
    expect(mergeModels(base, theirs, ours).merged.views![0].positions).toEqual(ours.views![0].positions)
  })

  it('names a pin, a row or a grid in a conflict by its elements, not its id', () => {
    const withRules = clone(base)
    withRules.defaultLayoutConstraints = [
      { id: 'c0ffee', type: 'pin', nodeIds: ['shop'] },
      { id: 'beef', type: 'align', axis: 'horizontal', nodeIds: ['shop', 'bank'] },
    ]
    const ours = clone(withRules)
    ours.defaultLayoutConstraints = []
    const theirs = clone(withRules)
    theirs.defaultLayoutConstraints = [
      { id: 'c0ffee', type: 'pin', nodeIds: ['shop', 'bank'], extra: 1 } as never,
      { id: 'beef', type: 'align', axis: 'vertical', nodeIds: ['shop', 'bank'] },
    ]
    const { conflicts } = mergeModels(withRules, ours, theirs)
    expect(conflicts.join(' ')).not.toMatch(/c0ffee|beef/)
    expect(conflicts).toEqual(expect.arrayContaining(['the pins of Shop, Bank', 'the column of Shop, Bank']))
  })

  it('takes the other side whole when only one changed', () => {
    const theirs = clone(base)
    theirs.nodes[0].label = 'Bookshop'
    expect(mergeModels(base, clone(base), theirs).merged).toEqual(theirs)
    expect(mergeModels(base, theirs, clone(base)).merged).toEqual(theirs)
  })
})

describe('mergeModels: order and id lists', () => {
  const views = (...names: string[]) => names.map((n) => ({ id: n, name: n, nodeIds: [], positions: {} }))
  const withViews = (list: DiagramData['views']): DiagramData => ({ ...clone(base), views: list })

  it('keeps a reorder made on one side, with the other side\'s changes', () => {
    const b = withViews(views('A', 'B', 'C'))
    const ours = withViews(views('B', 'A', 'C'))
    const theirs = withViews(views('A', 'B', 'C', 'D'))
    theirs.views![2].name = 'Third'
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(merged.views!.map((v) => v.id)).toEqual(['B', 'A', 'C', 'D'])
    expect(byId(merged.views, 'C')!.name).toBe('Third')
    expect(conflicts).toEqual([])
    // And the other way round.
    expect(mergeModels(b, theirs, ours).merged.views!.map((v) => v.id)).toEqual(['B', 'A', 'C', 'D'])
  })

  it('keeps theirs where both reordered differently, and says so', () => {
    const b = withViews(views('A', 'B', 'C'))
    const { merged, conflicts } = mergeModels(b, withViews(views('C', 'A', 'B')), withViews(views('B', 'A', 'C')))
    expect(merged.views!.map((v) => v.id)).toEqual(['B', 'A', 'C'])
    expect(conflicts).toEqual(['order of views'])
  })

  it('merges a view\'s element and hidden relation lists as sets: what either side added stays, what either removed goes', () => {
    const b = withViews([{ id: 'v', name: 'Containers', nodeIds: ['shop', 'bank'], hiddenRelationIds: ['r1'], positions: {} }])
    const ours = clone(b)
    ours.views![0].nodeIds = ['shop', 'bank', 'user']
    ours.views![0].hiddenRelationIds = []
    const theirs = clone(b)
    theirs.views![0].nodeIds = ['shop', 'stock']
    theirs.views![0].hiddenRelationIds = ['r1', 'r2']
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(merged.views![0].nodeIds).toEqual(['shop', 'user', 'stock'])
    expect(merged.views![0].hiddenRelationIds).toEqual(['r2'])
    expect(conflicts).toEqual([])
  })
})

describe('mergeModels: a sequence\'s steps and notes', () => {
  // The steps (relationIds) and their notes (stepDescriptions) merged apart:
  // Studio removed step 1 while an agent changed note 3, and the merge put
  // Studio's steps beside the agent's notes, every note one step off.
  const withSteps = (relationIds: string[], stepDescriptions?: (string | undefined)[]): DiagramData =>
    ({ ...clone(base), sequences: [{ id: 's', name: 'Place Order', relationIds, ...(stepDescriptions ? { stepDescriptions } : {}) }] })
  const pairs = (d: DiagramData) => {
    const q = d.sequences![0]
    return q.relationIds.map((r, i) => `${r}:${q.stepDescriptions?.[i] ?? '-'}`)
  }
  const b = withSteps(['r1', 'r2', 'r3', 'r4'], ['submits', 'posts', 'stores', 'charges'])

  it('keeps each note on its step when one side removes a step and the other changes a note', () => {
    const ours = withSteps(['r2', 'r3', 'r4'], ['posts', 'stores', 'charges'])
    const theirs = withSteps(['r1', 'r2', 'r3', 'r4'], ['submits', 'posts', 'STORES', 'charges'])
    for (const [o, t] of [[ours, theirs], [theirs, ours]]) {
      const { merged, conflicts } = mergeModels(b, o, t)
      expect(pairs(merged)).toEqual(['r2:posts', 'r3:STORES', 'r4:charges'])
      expect(conflicts).toEqual([])
    }
  })

  it('keeps each note on its step when one side moves a step and the other changes a note', () => {
    const ours = withSteps(['r2', 'r1', 'r3', 'r4'], ['posts', 'submits', 'stores', 'charges'])
    const theirs = withSteps(['r1', 'r2', 'r3', 'r4'], ['submits', 'posts', 'STORES', 'charges'])
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(pairs(merged)).toEqual(['r2:posts', 'r1:submits', 'r3:STORES', 'r4:charges'])
    expect(conflicts).toEqual([])
  })

  it('keeps the steps both sides added, each with its note, and the steps a side repeats', () => {
    const ours = withSteps(['r1', 'r2', 'r9', 'r3', 'r4'], ['submits', 'posts', 'checks', 'stores', 'charges'])
    const theirs = withSteps(['r1', 'r2', 'r3', 'r4', 'r1'], ['submits', 'posts', 'stores', 'charges', 'again'])
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(pairs(merged)).toEqual(['r1:submits', 'r2:posts', 'r9:checks', 'r3:stores', 'r4:charges', 'r1:again'])
    expect(conflicts).toEqual([])
  })

  it('keeps theirs where both changed one note, and says so', () => {
    const ours = withSteps(['r1', 'r2', 'r3', 'r4'], ['submits', 'ours', 'stores', 'charges'])
    const theirs = withSteps(['r1', 'r2', 'r3'], ['submits', 'theirs', 'stores'])
    const { merged, conflicts } = mergeModels(b, ours, theirs)
    expect(pairs(merged)).toEqual(['r1:submits', 'r2:theirs', 'r3:stores'])
    expect(conflicts).toEqual(['Place Order: steps'])
  })
})

describe('modelEdits and mergeModelEdits', () => {
  it('keep only what ours changed, and merge it into theirs as mergeModels would', () => {
    const ours = clone(base)
    ours.nodes.find((n) => n.id === 'shop')!.description = 'Sells and lends books'
    ours.nodes = ours.nodes.filter((n) => n.id !== 'bank')
    ours.nodes.push(node('stock', 'Stock'))
    ours.views = [...ours.views!, { id: 'v0', name: 'First', nodeIds: [], positions: {} }].reverse()
    ours.defaultEdgeStyle = 'orthogonal'
    const edits = modelEdits(base, ours)
    // Only the entries that changed, and the ids' order.
    expect(Object.keys(edits).sort()).toEqual(['defaultEdgeStyle', 'nodes', 'views'])
    const nodes = edits.nodes as { base: Record<string, unknown>; ours: Record<string, unknown> }
    expect(Object.keys(nodes.ours).sort()).toEqual(['bank', 'shop', 'stock'])
    expect(nodes.ours.bank).toBeNull()
    expect(nodes.base.stock).toBeNull()

    const theirs = clone(base)
    theirs.nodes.find((n) => n.id === 'shop')!.technology = 'Node.js'
    theirs.nodes.find((n) => n.id === 'user')!.label = 'Reader'
    theirs.nodes.push(node('courier', 'Courier'))
    const viaEdits = mergeModelEdits(JSON.parse(JSON.stringify(edits)), theirs)
    expect(viaEdits).toEqual(mergeModels(base, ours, theirs))
    expect(viaEdits.merged.nodes.map((n) => n.id)).toEqual(['shop', 'user', 'stock', 'courier'])
    expect(byId(viaEdits.merged.nodes, 'shop')).toMatchObject({ description: 'Sells and lends books', technology: 'Node.js' })
    expect(viaEdits.merged.views!.map((v) => v.id)).toEqual(['v0', 'v1'])
    expect(viaEdits.merged.defaultEdgeStyle).toBe('orthogonal')
  })

  it('change nothing when theirs already has them', () => {
    const ours = clone(base)
    ours.nodes[0].label = 'Bookshop'
    expect(mergeModelEdits(modelEdits(base, ours), ours)).toEqual({ merged: ours, conflicts: [] })
    expect(modelEdits(base, clone(base))).toEqual({})
  })
})
