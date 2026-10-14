import { describe, expect, it } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { looksUnarranged } from '../src/store/diagramStore'

// Run 19: containers Smart Layout had packed while collapsed (240×160 each)
// keep their expanded size in the file (708×410). The notice "This diagram
// is not laid out yet" read the stored size, so after a reload it asked for
// a layout that Smart Layout then said already scored best.

const node = (id: string, x: number, y: number, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type: 'container', label: id, description: '', x, y, width: 708, height: 410, collapsed: false, ...extra }) as C4Node

function packedCollapsed(): Record<string, C4Node> {
  const nodes: Record<string, C4Node> = {}
  for (let i = 0; i < 10; i++) {
    const id = `c${i}`
    nodes[id] = node(id, (i % 5) * 260, Math.floor(i / 5) * 180, { collapsed: true })
    // What each one holds, at its own coordinates (hidden while collapsed).
    nodes[`${id}k`] = node(`${id}k`, 30, 120, { type: 'component', parentId: id, width: 200, height: 120 } as Partial<C4Node>)
    nodes[`${id}k2`] = node(`${id}k2`, 30, 120, { type: 'component', parentId: id, width: 200, height: 120 } as Partial<C4Node>)
  }
  return nodes
}

describe('the "not laid out yet" notice', () => {
  it('takes collapsed containers at the size they are drawn, without what they hold', () => {
    expect(looksUnarranged(packedCollapsed())).toBe(false)
  })

  it('takes a container a view collapses at its collapsed size too', () => {
    const nodes = packedCollapsed()
    for (const n of Object.values(nodes)) n.collapsed = false
    const view = { id: 'v', name: 'V', kind: 'static', nodeIds: [], positions: {}, collapsedNodeIds: Object.keys(nodes).filter((id) => !nodes[id].parentId) } as never
    expect(looksUnarranged(nodes, 'v', view)).toBe(false)
  })

  it('still sees a diagram whose expanded containers lie on each other', () => {
    const nodes = packedCollapsed()
    for (const n of Object.values(nodes)) n.collapsed = false
    expect(looksUnarranged(nodes)).toBe(true)
  })
})
