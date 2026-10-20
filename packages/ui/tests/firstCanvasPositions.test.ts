/**
 * A canvas view opened for the first time draws its elements where All
 * elements has them.
 *
 * A view with no positions of its own (a new view of a viewpoint, a table
 * turned into a structure view) kept the canvas shown before it: Bookstore
 * at its 360×260 System Context box, its containers wherever another canvas
 * had left them, outside it and over Payment Provider.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const pos = (x: number, y: number, width: number, height: number): NodePosition => ({ x, y, width, height })
const node = (id: string, type: string, parentId: string | undefined, p: NodePosition): C4Node =>
  ({ id, type, label: id, collapsed: false, ...(parentId ? { parentId } : {}), ...p }) as C4Node

/** All elements: Bookstore wraps API and DB, Payments beside it. The view
 *  "ctx" draws Bookstore small, with Payments right next to it; "containers"
 *  and "list" have no positions of their own. */
function model(): DiagramData {
  const all = {
    shop: pos(0, 0, 640, 320),
    api: pos(30, 120, 260, 160),
    db: pos(340, 120, 260, 160),
    pay: pos(760, 0, 360, 260),
  }
  return {
    nodes: [
      node('shop', 'system', undefined, all.shop),
      node('api', 'container', 'shop', all.api),
      node('db', 'database', 'shop', all.db),
      node('pay', 'system', undefined, all.pay),
    ],
    relations: [],
    views: [
      { id: 'ctx', name: 'Context', nodeIds: ['shop', 'pay'], positions: { shop: pos(0, 0, 360, 260), pay: pos(420, 0, 360, 260) } },
      { id: 'containers', name: 'Containers', nodeIds: ['shop', 'api', 'db', 'pay'], positions: {} },
      { id: 'list', name: 'List', kind: 'table', nodeIds: ['shop', 'api', 'db', 'pay'], positions: {} },
    ],
    defaultPositions: all,
  }
}

interface Box { x: number; y: number; width: number; height: number }
const abs = (id: string): Box => {
  const n = s().c4Nodes[id]
  const b = { x: n.x, y: n.y, width: n.width, height: n.height }
  for (let p = n.parentId; p; p = s().c4Nodes[p].parentId) { b.x += s().c4Nodes[p].x; b.y += s().c4Nodes[p].y }
  return b
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const inside = (child: string): boolean => {
  const c = abs(child)
  const p = abs(s().c4Nodes[child].parentId!)
  return c.x >= p.x && c.y >= p.y && c.x + c.width <= p.x + p.width && c.y + c.height <= p.y + p.height
}
const tidy = (): void => {
  expect(inside('api')).toBe(true)
  expect(inside('db')).toBe(true)
  expect(overlap(abs('shop'), abs('pay'))).toBe(false)
  expect(overlap(abs('api'), abs('db'))).toBe(false)
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('a view with no positions of its own', () => {
  it('opens on All elements\' places, not the view shown before it', () => {
    s().setActiveView('ctx')
    s().setActiveView('containers')
    tidy()
    expect(abs('shop')).toEqual(pos(0, 0, 640, 320))
  })

  it('keeps them once it was left', () => {
    s().setActiveView('ctx')
    s().setActiveView('containers')
    s().setActiveView('ctx')
    expect(abs('shop')).toEqual(pos(0, 0, 360, 260))
    s().setActiveView('containers')
    tidy()
  })

  it('the same in Viewer', () => {
    s().setActiveView('ctx')
    s().setAppMode('viewer')
    s().setActiveView('containers')
    tidy()
  })

  it('turned from a table into a structure view', () => {
    s().setActiveView('ctx')
    s().setActiveView('list')
    s().setViewKind('list', 'static')
    tidy()
  })
})
