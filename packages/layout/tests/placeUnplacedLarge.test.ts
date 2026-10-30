import { describe, expect, it } from 'vitest'
import { placeUnplaced } from '../src/geometry'
import type { C4Node } from '@radical/common/c4'

// Elements added outside Studio (an agent, a hand-written file) have no
// place on a canvas yet: placing them looked up each one's siblings and
// children by going through the whole model, again for each one placed.

function largeModel(): { nodes: Record<string, C4Node>; positions: Record<string, { x: number; y: number; width: number; height: number }> } {
  const nodes: Record<string, C4Node> = {}
  const positions: Record<string, { x: number; y: number; width: number; height: number }> = {}
  const add = (id: string, type: string, x: number, y: number, width: number, height: number, parentId?: string, placed = true) => {
    nodes[id] = { id, type, label: id, x, y, width, height, collapsed: false, parentId } as C4Node
    if (placed) positions[id] = { x, y, width, height }
  }
  // 250 systems of 8 containers of 9 components: what a large landscape has
  // at its top is a few hundred systems, not thousands.
  for (let s = 0; s < 250; s++) {
    add(`sys${s}`, 'system', (s % 25) * 3000, Math.floor(s / 25) * 3000, 2900, 2900)
    for (let c = 0; c < 8; c++) {
      add(`api${s}-${c}`, 'container', 40 + (c % 4) * 700, 60 + Math.floor(c / 4) * 1300, 660, 1200, `sys${s}`)
      for (let k = 0; k < 9; k++) add(`cmp${s}-${c}-${k}`, 'component', 30 + (k % 3) * 210, 60 + Math.floor(k / 3) * 380, 190, 340, `api${s}-${c}`, !(s % 3 === 0 && c === 0 && k === 8))
    }
  }
  return { nodes, positions }
}

describe('placing what has no place yet in a model of 20,000 elements', () => {
  it('places them within 300 ms', () => {
    let best = Infinity
    for (let run = 0; run < 3; run++) {
      const { nodes, positions } = largeModel()
      const missing = Object.keys(nodes).filter((id) => !positions[id]).length
      expect(Object.keys(nodes).length).toBeGreaterThan(20_000)
      expect(missing).toBeGreaterThan(50)
      const t = performance.now()
      const placed = placeUnplaced(nodes, positions)
      best = Math.min(best, performance.now() - t)
      expect(placed.length).toBe(missing)
    }
    expect(best).toBeLessThan(300)
  })
})
