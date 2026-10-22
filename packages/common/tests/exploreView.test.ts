/**
 * A view of type Explore (Explore from here, saved as a view): it keeps its
 * start element, the level each element was added on, the expansion (+)
 * that added it and what each chose, its places (where it draws each
 * element, flat: not relative to a parent) and the relations it does not
 * draw. Studio saves it in a .radical file (JSON) or a Markdown folder
 * (views.json) and reads it back as it was.
 */
import { describe, it, expect } from 'vitest'
import { viewCanvasPositions, withCanvasPositions, type C4Node, type DiagramData, type DiagramView } from '../src/c4'
import { deserializeFromMdFolder, serializeToMdFolder } from '../src/formats/mdFolder'
import { deleteNode, setViewKind, type ModelState } from '../src/model'

const box = (id: string, type: string, parentId?: string): C4Node =>
  ({ id, type, label: id.toUpperCase(), x: 10, y: 20, width: 200, height: 120, collapsed: false, ...(parentId ? { parentId } : {}) } as C4Node)

/** API in Bookstore, grown by API's + (its relations), then Web App's. */
const nodes: C4Node[] = [
  box('bookstore', 'system'),
  box('api', 'container', 'bookstore'),
  box('web', 'container', 'bookstore'),
  box('db', 'database', 'bookstore'),
  box('customer', 'person'),
  box('payments', 'system'),
]
const relations = [
  { id: 'r1', sourceId: 'customer', targetId: 'web', label: 'uses' },
  { id: 'r2', sourceId: 'web', targetId: 'api', label: 'calls' },
  { id: 'r3', sourceId: 'api', targetId: 'db', label: 'reads/writes' },
  { id: 'r4', sourceId: 'api', targetId: 'payments', label: 'charges card' },
  { id: 'r5', sourceId: 'web', targetId: 'db', label: 'caches' },
]

const explored = (): DiagramView => ({
  id: 'v-api',
  name: 'API context',
  folder: 'Explorations',
  kind: 'explore',
  nodeIds: ['api', 'web', 'db', 'payments', 'customer'],
  explore: {
    start: 'api',
    levels: { api: 0, web: 1, db: 1, payments: 1, customer: 2 },
    addedBy: { web: 'x1', db: 'x1', payments: 'x1', customer: 'x2' },
    expansions: {
      x1: { id: 'x1', from: 'api', rows: [{ key: 'l:calls', direction: 'in' }, { key: 'l:reads/writes', direction: 'out' }, { key: 'l:charges card', direction: 'out' }], parent: false, children: false },
      x2: { id: 'x2', from: 'web', rows: null, parent: true, children: true },
    },
  },
  // Where it draws them: flat, Web App at its own place, not in Bookstore.
  positions: {
    api: { x: 400, y: 0, width: 200, height: 120 },
    web: { x: 100, y: 200, width: 200, height: 120 },
    db: { x: 400, y: 200, width: 200, height: 120 },
    payments: { x: 700, y: 200, width: 200, height: 120 },
    customer: { x: 100, y: 400, width: 200, height: 120 },
  },
  hiddenRelationIds: ['r5'],
  viewport: { x: 10, y: 20, zoom: 0.8 },
})

const model = (view = explored()): DiagramData => ({ nodes, relations, views: [view] })
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

/** Where the canvas draws the elements of the view while it is shown (the
 *  store keeps them on the nodes), and others it does not draw. */
const shown = (): Record<string, { x: number; y: number; width: number; height: number }> => ({
  ...explored().positions,
  web: { x: 140, y: 210, width: 200, height: 120 },
  bookstore: { x: -5, y: -5, width: 900, height: 600 },
})

describe('a view of type Explore in a file', () => {
  it('keeps its start, levels, expansions, places and hidden relations through the .radical JSON', () => {
    const file = JSON.stringify(model())
    const back = JSON.parse(file) as DiagramData
    // Read as Studio reads a document: a view keeps the places it draws.
    const [view] = withCanvasPositions(back.views!, byId)
    expect(view).toEqual(explored())
    // Saved while shown: where it draws what it lists, and nothing of the
    // containers it does not draw (Bookstore).
    const saved = viewCanvasPositions(view, byId, shown())
    expect(saved).toEqual({ ...explored().positions, web: { x: 140, y: 210, width: 200, height: 120 } })
  })

  it('keeps them through the Markdown folder (views.json)', () => {
    const view = { ...explored(), positions: viewCanvasPositions(explored(), byId, shown()) }
    const files = serializeToMdFolder(model(view))
    expect(JSON.parse(files['views.json'])[0].kind).toBe('explore')
    const back = deserializeFromMdFolder(files).data
    const [read] = withCanvasPositions(back.views!, Object.fromEntries(back.nodes.map((n) => [n.id, n])))
    expect(read).toEqual(view)
    // Where it was drawn when saved.
    expect(read.positions.web).toEqual({ x: 140, y: 210, width: 200, height: 120 })
    expect(read.positions.bookstore).toBeUndefined()
  })
})

describe('a view of type Explore in the model', () => {
  const state = (): ModelState => ({
    c4Nodes: Object.fromEntries(nodes.map((n) => [n.id, { ...n }])),
    c4Relations: Object.fromEntries(relations.map((r) => [r.id, { ...r }])),
    views: { 'v-api': explored() },
    activeViewId: null,
  })

  it('forgets an element deleted, with its level and what added it', () => {
    const s = state()
    deleteNode(s, 'customer')
    const view = s.views['v-api']
    expect(view.nodeIds).toEqual(['api', 'web', 'db', 'payments'])
    expect(view.explore!.levels).toEqual({ api: 0, web: 1, db: 1, payments: 1 })
    expect(view.explore!.addedBy).toEqual({ web: 'x1', db: 'x1', payments: 'x1' })
    expect(view.positions.customer).toBeUndefined()
  })

  it('switched to another view type keeps its elements, without how it grew', () => {
    const s = state()
    setViewKind(s, 'v-api', 'table')
    const view = s.views['v-api']
    expect(view.kind).toBe('table')
    expect(view.nodeIds).toEqual(explored().nodeIds)
    expect(view.explore).toBeUndefined()
    // Its places are where it drew its elements, flat: a structure view
    // nests them in their containers, so it lays them out anew.
    expect(view.positions).toEqual({})
  })
})
