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
