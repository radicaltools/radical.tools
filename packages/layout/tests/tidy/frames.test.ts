/**
 * A frame a view shows only part of: its children as All elements places
 * them stand among the ones the view leaves out, far from the frame's top
 * left. Smart Layout hands the frame back fitted round what the view shows,
 * even when no move is left to make.
 */
import { describe, it, expect } from 'vitest'
import { TIDY_BUDGET, runTidyLayout } from '../../src/tidy'
import { applyLayoutPositions, resizeParentsBottomUp, viewLayoutInput } from '../../src/viewInput'
import { compoundPadding } from '../../src/geometry'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'

const node = (id: string, type: string, parentId: string | undefined, x: number, y: number, width: number, height: number): C4Node =>
  ({ id, type, label: id, parentId, x, y, width, height, collapsed: false } as unknown as C4Node)

/** The domain Crucible of radical.tools' own model: 31 elements in it, two
 *  of them entities, at the right end of a 6800 px frame in All elements. */
function crucible(): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation>; view: DiagramView } {
  const nodes: Record<string, C4Node> = {
    sys: node('sys', 'softwareSystem', undefined, 0, 0, 7000, 600),
    dom: node('dom', 'domain', 'sys', 100, 150, 6800, 230),
    fuzz: node('fuzz', 'entity', 'dom', 2450, 120, 170, 56),
    finding: node('finding', 'entity', 'dom', 2640, 120, 170, 56),
  }
  for (let i = 0; i < 12; i++) nodes[`req${i}`] = node(`req${i}`, 'requirement', 'dom', 30 + i * 200, 120, 170, 56)
  const relations: Record<string, C4Relation> = {
    r1: { id: 'r1', sourceId: 'finding', targetId: 'fuzz', relationType: 'references' } as unknown as C4Relation,
  }
  const view = { id: 'v', name: 'Crucible', kind: 'static', nodeIds: ['dom', 'fuzz', 'finding'], expandedNodeIds: ['dom'], positions: {} } as unknown as DiagramView
  return { nodes, relations, view }
}

/** Smart Layout of a view as the MCP server and Studio run it: Tidy, then
 *  the result written and the frames refitted; nothing when it kept the canvas. */
function smartLayout(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, view: DiagramView) {
  const input = viewLayoutInput(view, nodes, relations)
  const result = runTidyLayout(input.nodes, input.relations, { frames: [...input.frames], budget: TIDY_BUDGET })
  const out = structuredClone(nodes)
  if (!result.keptCurrent) {
    applyLayoutPositions(out, result.winner.positions, input)
    resizeParentsBottomUp(out, input)
  }
  return { result, out }
}

describe('a frame the view shows part of', () => {
  it('is fitted round what the view shows, though no move was left to make', () => {
    const { nodes, relations, view } = crucible()
    const { result, out } = smartLayout(nodes, relations, view)
    const pad = compoundPadding('domain')
    const kids = [out.fuzz, out.finding]
    expect(result.keptCurrent).toBe(false)
    expect(Math.min(...kids.map((k) => k.x))).toBe(pad.side)
    expect(Math.min(...kids.map((k) => k.y))).toBe(pad.top)
    expect(out.dom.width).toBeLessThan(600)
    // The two entities keep their places relative to each other.
    expect(out.finding.x - out.fuzz.x).toBe(190)
    expect(out.finding.y).toBe(out.fuzz.y)
  })

  it('says so among the steps', () => {
    const { nodes, relations, view } = crucible()
    const { result } = smartLayout(nodes, relations, view)
    expect(result.tidy.steps[0]?.kind).toBe('fit')
    expect(result.tidy.steps[0]?.moved.dom).toBeDefined()
  })

  it('a canvas whose frames already wrap what it shows is kept as it is', () => {
    const { nodes, relations, view } = crucible()
    const first = smartLayout(nodes, relations, view).out
    const again = smartLayout(first, relations, view)
    expect(again.result.keptCurrent).toBe(true)
  })
})
