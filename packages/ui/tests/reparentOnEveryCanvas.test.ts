/**
 * An element moved into another parent lies inside it on every canvas.
 *
 * Each canvas (All elements, every view) keeps its own positions, relative
 * to the parent. A move rebased the element's place on the canvas shown
 * only: the others kept its old parent-relative place, now read against
 * the new parent. Quote FX indented under Validate in the Warnier view
 * stood on Payment Process at its old offset in the process, which there
 * put it inside Approve, over Hold for review.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const pos = (x: number, y: number, width: number, height: number): NodePosition => ({ x, y, width, height })
const node = (id: string, type: string, parentId: string | undefined, p: NodePosition): C4Node =>
  ({ id, type, label: id, collapsed: false, ...(parentId ? { parentId } : {}), ...p }) as C4Node

/** A process with three steps in a row, Hold inside Approve. The view
 *  "flow" draws them in a column instead; "outline" is a Warnier view. */
function model(): DiagramData {
  const all = {
    pay: pos(0, 0, 1180, 520),
    validate: pos(30, 120, 300, 200),
    fx: pos(360, 120, 300, 200),
    approve: pos(690, 120, 460, 370),
    hold: pos(30, 120, 300, 200),
  }
  return {
    nodes: [
      node('pay', 'process', undefined, all.pay),
      node('validate', 'step', 'pay', all.validate),
      node('fx', 'step', 'pay', all.fx),
      node('approve', 'step', 'pay', all.approve),
      node('hold', 'step', 'approve', all.hold),
    ],
    relations: [],
    views: [
      {
        id: 'flow', name: 'Flow', nodeIds: ['pay', 'validate', 'fx', 'approve', 'hold'],
        positions: {
          pay: pos(0, 0, 520, 1180),
          validate: pos(30, 120, 300, 200),
          fx: pos(30, 360, 300, 200),
          approve: pos(30, 600, 460, 370),
          hold: pos(30, 120, 300, 200),
        },
      },
      { id: 'outline', name: 'Outline', kind: 'warnier', nodeIds: [], positions: {} },
    ],
    defaultPositions: all,
  }
}

interface Box { x: number; y: number; width: number; height: number }
const box = (id: string): Box => {
  const n = s().c4Nodes[id]
  return { x: n.x, y: n.y, width: n.width, height: n.height }
}
const abs = (id: string): Box => {
  const b = box(id)
  for (let p = s().c4Nodes[id].parentId; p; p = s().c4Nodes[p].parentId) { b.x += s().c4Nodes[p].x; b.y += s().c4Nodes[p].y }
  return b
}
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** `child` lies inside the frame of its parent. */
const inside = (child: string): boolean => {
  const c = box(child)
  const p = box(s().c4Nodes[child].parentId!)
  return c.x >= 0 && c.y >= 0 && c.x + c.width <= p.width && c.y + c.height <= p.height
}

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
})
afterEach(() => s().stopLiveLayout())

describe('a step indented in the Warnier view', () => {
  const indent = (): void => {
    s().setActiveView('outline')
    s().reparentNodes(['fx'], 'validate', { quiet: true })
    expect(s().c4Nodes.fx.parentId).toBe('validate')
  }

  it('lies inside its new parent on a view, clear of the other steps', () => {
    indent()
    s().setActiveView('flow')
    expect(inside('fx')).toBe(true)
    expect(inside('validate')).toBe(true)
    expect(overlap(abs('fx'), abs('approve'))).toBe(false)
    expect(overlap(abs('fx'), abs('hold'))).toBe(false)
  })

  it('lies inside its new parent on All elements', () => {
    s().setActiveView('flow')
    indent()
    s().setActiveView(null)
    expect(inside('fx')).toBe(true)
    expect(inside('validate')).toBe(true)
    expect(overlap(abs('fx'), abs('approve'))).toBe(false)
  })

  it('the same after a save and a reload', () => {
    indent()
    const saved = JSON.parse(JSON.stringify(s().saveDiagram())) as DiagramData
    s().loadDiagram(saved)
    s().setActiveView('flow')
    expect(inside('fx')).toBe(true)
    expect(overlap(abs('fx'), abs('hold'))).toBe(false)
  })
})

describe('a step outdented in the Warnier view', () => {
  it('keeps its place on a view where it lies inside its new parent', () => {
    s().setActiveView('flow')
    const before = abs('hold')
    s().setActiveView('outline')
    s().reparentNodes(['hold'], 'pay', { quiet: true })
    s().setActiveView('flow')
    expect(s().c4Nodes.hold.parentId).toBe('pay')
    expect(abs('hold')).toMatchObject({ x: before.x, y: before.y })
    expect(inside('hold')).toBe(true)
  })
})
