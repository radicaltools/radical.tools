/**
 * An element added while Smart Layout runs is placed as a new element once
 * the layout is applied (D11).
 *
 * Its drop point was a place in the layout Smart Layout then replaced: on
 * 300 elements it stood 893 px from the nearest one.
 */
import { it, expect, afterEach } from 'vitest'
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
afterEach(() => s().stopLiveLayout())

/** A chain of systems scattered far apart: Smart Layout pulls them in. */
function scattered(): DiagramData {
  const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, type: 'system', label: `N${i}`, x: (i % 4) * 2400, y: Math.floor(i / 4) * 2400, width: 300, height: 180, collapsed: false })) as C4Node[]
  const relations = nodes.slice(1).map((n, i) => ({ id: `r${i}`, sourceId: `n${i}`, targetId: n.id })) as C4Relation[]
  return { nodes, relations, views: [{ id: 'v', name: 'V', nodeIds: [], positions: {} }] } as DiagramData
}

it('places what was added during the layout by what it relates to, in the layout\'s undo step', async () => {
  s().setAppMode('designer')
  s().loadDiagram(scattered())
  s().setActiveView('v')
  const running = s().runSmartLayout()
  // Dropped where n7 stood before the layout, related to n7.
  const id = s().addNode({ type: 'system', label: 'Late', x: 7200, y: 2700, width: 300, height: 180, collapsed: false } as Omit<C4Node, 'id'>)
  s().addRelation({ sourceId: 'n7', targetId: id, label: 'calls' })
  await running
  const nodes = s().c4Nodes
  expect(nodes.n7.x).not.toBe(7200) // the layout moved the diagram
  const late = nodes[id]
  const gap = (a: C4Node, b: C4Node) => Math.hypot(
    Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width)),
    Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height)))
  expect(gap(late, nodes.n7)).toBeLessThan(400)
  for (const other of Object.values(nodes)) {
    if (other.id === id) continue
    const clear = late.x + late.width <= other.x || other.x + other.width <= late.x || late.y + late.height <= other.y || other.y + other.height <= late.y
    expect(clear, other.id).toBe(true)
  }
  // One Undo takes back the layout and the placement; the add is its own step.
  s().undo()
  expect(s().c4Nodes[id].x).toBe(7200)
  s().undo()
  s().undo()
  expect(s().c4Nodes[id]).toBeUndefined()
}, 60_000)

/** A system holding three containers of three components each, the
 *  components related across containers, scattered far apart. */
function nested(): DiagramData {
  const nodes: C4Node[] = [{ id: 'sys', type: 'system', label: 'Sys', x: 0, y: 0, width: 4000, height: 3000, collapsed: false } as C4Node]
  const relations: C4Relation[] = []
  for (let c = 0; c < 3; c++) {
    nodes.push({ id: `c${c}`, type: 'container', label: `C${c}`, parentId: 'sys', x: 30 + c * 1300, y: 120 + (c % 2) * 1200, width: 1200, height: 900, collapsed: false } as C4Node)
    for (let k = 0; k < 3; k++) {
      nodes.push({ id: `k${c}${k}`, type: 'component', label: `K${c}.${k}`, parentId: `c${c}`, x: 20 + k * 380, y: 120 + k * 200, width: 240, height: 150, collapsed: false } as C4Node)
      if (c > 0) relations.push({ id: `r${c}${k}`, sourceId: `k${c - 1}${k}`, targetId: `k${c}${(k + 1) % 3}` } as C4Relation)
    }
  }
  return { nodes, relations, views: [{ id: 'v', name: 'V', nodeIds: [], positions: {} }] } as DiagramData
}

it.each([['Smart Layout', undefined], ['Tree Layout', 'tree']] as const)('places what was moved into another parent during %s by the rule for moves (item 240)', async (_, layoutMode) => {
  // Its place was one in the old parent, as the layout found it: applied
  // under the new parent, it lay on its new siblings, or the parent grew
  // over the next container.
  s().setAppMode('designer')
  const data = nested()
  data.views![0].layoutMode = layoutMode
  s().loadDiagram(data)
  s().setActiveView('v')
  const running = s().runSmartLayout()
  s().reparentNodes(['k00'], 'c1', { quiet: true })
  await running
  const nodes = s().c4Nodes
  expect(nodes.k00.parentId).toBe('c1')
  const out: string[] = []
  const ids = Object.keys(nodes)
  const box = (id: string) => ({ x: nodes[id].x, y: nodes[id].y, w: nodes[id].width, h: nodes[id].height })
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b || nodes[a].parentId !== nodes[b].parentId) continue
      const p = box(a), q = box(b)
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) out.push(`${a} ~ ${b}`)
    }
    const parent = nodes[a].parentId
    if (parent) {
      const c = box(a)
      if (c.x < 0 || c.y < 0 || c.x + c.w > nodes[parent].width || c.y + c.h > nodes[parent].height) out.push(`${a} outside`)
    }
  }
  expect(out).toEqual([])
}, 60_000)
