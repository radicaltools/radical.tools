/**
 * An expand makes room for what it opens, and leaves nothing on top of
 * anything else.
 *
 * A tidy grid of 48 root systems with a collapsed system of 20 containers in
 * the middle: Expand moved 22 of them and left 2 pairs on top of each other
 * (100 roots: 8 pairs; the user's injury model: 20 pairs, up to 220×101 px).
 * The pairwise pushes of separateSiblings, both of a pair half way, into
 * others, did not settle in their 20 passes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState

/** `roots` systems in rows of `columns`, 60 px apart, with a collapsed
 *  system of `inside` containers in the middle; the containers inside it
 *  saved on top of each other, as a layout made at another size left them. */
function grid(roots: number, inside: number, columns: number, overlapping = false): DiagramData {
  const nodes: C4Node[] = []
  const middle = Math.floor(roots / 2)
  let index = 0
  for (let i = 0; i <= roots; i++) {
    const x = (i % columns) * 360
    const y = Math.floor(i / columns) * 240
    if (i === middle) {
      nodes.push({ id: 'big', type: 'system', label: 'Big', x, y, width: 280, height: 180, collapsed: true } as C4Node)
      for (let k = 0; k < inside; k++) {
        const at = overlapping ? { x: 30 + k * 40, y: 120 + k * 20 } : { x: 30 + (k % 5) * 260, y: 120 + Math.floor(k / 5) * 200 }
        nodes.push({ id: `c${k}`, type: 'container', label: `Container ${k}`, parentId: 'big', ...at, width: 220, height: 140, collapsed: false } as C4Node)
      }
    } else {
      nodes.push({ id: `r${index++}`, type: 'system', label: `Root ${index}`, x, y, width: 300, height: 180, collapsed: false } as C4Node)
    }
  }
  return { nodes, relations: [], views: [{ id: 'all', name: 'All', nodeIds: [], positions: {} }] }
}

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

beforeEach(() => s().setAppMode('designer'))
afterEach(() => s().stopLiveLayout())

describe('expanding a container among many root elements', () => {
  for (const [roots, inside, columns] of [[48, 20, 8], [100, 20, 10], [24, 6, 6], [48, 40, 8]]) {
    it(`leaves nothing on top of anything else (${roots} roots, ${inside} inside)`, () => {
      s().loadDiagram(grid(roots, inside, columns))
      s().setActiveView('all')
      expect(violations()).toEqual([])
      s().toggleCollapse('big')
      expect(s().rfNodes.find((n) => n.id === 'c0')?.hidden).toBe(false)
      expect(violations()).toEqual([])
    })
  }

  it('moves only what lies in the way, and what that then lies on', () => {
    s().loadDiagram(grid(48, 20, 8))
    s().setActiveView('all')
    const before = drawn()
    s().toggleCollapse('big')
    const after = drawn()
    const moved = Object.keys(before).filter((id) => id !== 'big' && (after[id].x !== before[id].x || after[id].y !== before[id].y))
    // The corners of the grid are out of reach.
    // Big stands at the left edge of the grid, in its fourth row: the
    // columns on the right are out of its reach.
    const column = (id: string): number => { const i = Number(id.slice(1)); return (i < 24 ? i : i + 1) % 8 }
    expect(moved.filter((id) => column(id) >= 5)).toEqual([])
    expect(moved.length).toBeLessThan(30)
  })

  it('opens what it holds clear of each other', () => {
    s().loadDiagram(grid(24, 6, 6, true))
    s().setActiveView('all')
    s().toggleCollapse('big')
    expect(violations()).toEqual([])
  })
})
