/**
 * "Wrap into…" makes room for the parent it makes, as a drop does.
 *
 * The new parent is sized round the selection, with room for its header:
 * it reached over the elements beside the selection and stayed there (the
 * sample's Fraud Detection, wrapped into a Group, lay on Accounts DB and
 * Transactions DB; the bookstore's API on the database), also after a
 * reload (F-0020). It pushes what it covers clear, pinned elements too, as
 * a drop and an added element do; nothing else moves.
 *
 * What it wraps stays where it is drawn, and the new parent hugs it: it
 * went below the header of the parent round it (the bookstore's API down
 * 70 px), at its type's size, over what stood beside it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pinnedNodeIds, type C4Node, type DiagramData } from '@radical/common/c4'
import { builtInC4Metamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState

interface Box { x: number; y: number; width: number; height: number }
/** What the canvas draws, in canvas coordinates. */
const drawn = (): Record<string, Box> => {
  const rf = s().rfNodes
  const byId = Object.fromEntries(rf.map((n) => [n.id, n]))
  const out: Record<string, Box> = {}
  for (const n of rf) {
    if (n.hidden) continue
    let { x, y } = n.position
    for (let p = n.parentNode; p; p = byId[p].parentNode) { x += byId[p].position.x; y += byId[p].position.y }
    out[n.id] = { x, y, width: n.width as number, height: n.height as number }
  }
  return out
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** Siblings on top of each other, and children outside their parent. */
const violations = (): string[] => {
  const boxes = drawn()
  const nodes = s().c4Nodes
  const ids = Object.keys(boxes)
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (nodes[ids[i]].parentId === nodes[ids[j]].parentId && overlap(boxes[ids[i]], boxes[ids[j]])) out.push(`${ids[i]} ~ ${ids[j]}`)
    }
  }
  for (const id of ids) {
    const p = nodes[id].parentId
    if (!p || !boxes[p]) continue
    const [c, f] = [boxes[id], boxes[p]]
    if (c.x < f.x || c.y < f.y || c.x + c.width > f.x + f.width || c.y + c.height > f.y + f.height) out.push(`${id} outside ${p}`)
  }
  return out
}

/** The bookstore's Containers: Web App, API and the database in a row in
 *  Bookstore, a person above it, a system beside it. The database `dbX`
 *  from Bookstore's left. */
const bookstore = (pinned: string[] = [], dbX = 640): DiagramData => ({
  nodes: [
    { id: 'customer', type: 'person', label: 'Customer', x: 355, y: 0, width: 150, height: 170, collapsed: false },
    { id: 'shop', type: 'system', label: 'Bookstore', x: 0, y: 270, width: 860, height: 350, collapsed: false },
    { id: 'web', type: 'webapp', label: 'Web App', parentId: 'shop', x: 30, y: 120, width: 210, height: 140, collapsed: false },
    { id: 'api', type: 'container', label: 'API', parentId: 'shop', x: 290, y: 120, width: 300, height: 200, collapsed: false },
    { id: 'db', type: 'database', label: 'Database', parentId: 'shop', x: dbX, y: 155, width: 190, height: 130, collapsed: false },
    { id: 'bank', type: 'system', label: 'Payments', x: 960, y: 355, width: 300, height: 180, collapsed: false },
  ] as C4Node[],
  relations: [
    { id: 'r1', sourceId: 'customer', targetId: 'web' },
    { id: 'r2', sourceId: 'web', targetId: 'api' },
    { id: 'r3', sourceId: 'api', targetId: 'db' },
    { id: 'r4', sourceId: 'api', targetId: 'bank' },
  ],
  views: [{
    id: 'v', name: 'Containers', nodeIds: ['customer', 'shop', 'web', 'api', 'db', 'bank'], positions: {},
    ...(pinned.length ? { layoutConstraints: [{ id: 'pin', type: 'pin', nodeIds: pinned }] } : {}),
  }],
  metamodel: builtInC4Metamodel(),
})

/** The new parent "Wrap into…" made. */
const wrapper = (): C4Node => Object.values(s().c4Nodes).find((n) => n.type === 'group')!

beforeEach(() => s().setAppMode('designer'))
afterEach(() => s().stopLiveLayout())

describe('"Wrap into…"', () => {
  it('leaves the new parent clear of the elements beside what it wraps', () => {
    s().loadDiagram(bookstore())
    s().setActiveView('v')
    expect(violations()).toEqual([])
    s().setSelectedNodeIds(['api'])
    s().wrapSelectionInNewParent('group')
    expect(s().c4Nodes.api.parentId).toBe(wrapper().id)
    expect(violations()).toEqual([])
  })

  it('keeps what it wraps where it is drawn, hugs it, and moves nothing it does not cover', () => {
    // API went 70 px down with its group, below Bookstore's header, and the
    // group, at 520 × 360, lay over the database.
    for (const selection of [['api'], ['web', 'api']]) {
      s().loadDiagram(bookstore())
      s().setActiveView('v')
      const before = drawn()
      s().setSelectedNodeIds(selection)
      s().wrapSelectionInNewParent('group')
      const after = drawn()
      const g = after[wrapper().id]
      const left = Math.min(...selection.map((id) => before[id].x))
      const top = Math.min(...selection.map((id) => before[id].y))
      const right = Math.max(...selection.map((id) => before[id].x + before[id].width))
      const bottom = Math.max(...selection.map((id) => before[id].y + before[id].height))
      expect(g, selection.join()).toEqual({ x: left - 30, y: top - 70, width: right - left + 60, height: bottom - top + 100 })
      for (const id of Object.keys(before)) {
        if (id !== 'shop') expect(after[id], `${id} (${selection.join()})`).toEqual(before[id])
      }
      // Bookstore grows left as far as it must to hold the group, with the
      // room it had round Web App; the rest of its frame stays.
      const [b, a] = [before.shop, after.shop]
      expect({ x: a.x, y: a.y, right: a.x + a.width, bottom: a.y + a.height }, selection.join())
        .toEqual({ x: Math.min(b.x, g.x - 30), y: b.y, right: b.x + b.width, bottom: b.y + b.height })
      expect(violations()).toEqual([])
    }
  })

  it('pushes a pinned neighbour clear too, and moves nothing out of its way', () => {
    // The database 20 px right of API: inside the group's padding.
    s().loadDiagram(bookstore(['db'], 550))
    s().setActiveView('v')
    const before = drawn()
    s().setSelectedNodeIds(['api'])
    s().wrapSelectionInNewParent('group')
    expect(violations()).toEqual([])
    const after = drawn()
    // The database went to the right, clear of it, and stays pinned there.
    expect(after.db.x).toBeGreaterThan(before.db.x)
    expect(after.db.y).toBe(before.db.y)
    expect(pinnedNodeIds(s().views.v.layoutConstraints ?? [])).toContain('db')
    // Customer, above Bookstore, is out of its way.
    expect(after.customer).toEqual(before.customer)
  })

  it('makes room as one undo step', () => {
    s().loadDiagram(bookstore())
    s().setActiveView('v')
    const before = drawn()
    s().setSelectedNodeIds(['api'])
    s().wrapSelectionInNewParent('group')
    s().undo()
    expect(Object.values(s().c4Nodes).some((n) => n.type === 'group')).toBe(false)
    expect(drawn()).toEqual(before)
  })
})
