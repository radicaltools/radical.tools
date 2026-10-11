/**
 * Room for relation labels: the gaps labelled relations need between
 * siblings, finalizeLayout keeping them, and Smart Layout leaving them.
 */
import { describe, it, expect } from 'vitest'
import { NODE_SIZES, type C4Node, type C4Relation } from '@radical/common/c4'
import { labelGaps, labelNeed, labelSizeOf, pairKey } from '../src/labelRoom'
import { finalizeLayout, separateBoxes, CHILD_GAP, ROOT_GAP } from '../src/layoutFinalize'
import { computeCompositeScore, runSmartLayoutCore } from '../src/smartLayout'

function node(id: string, type: C4Node['type'], extras: Partial<C4Node> = {}): C4Node {
  return { id, type, label: id, x: 0, y: 0, collapsed: false, ...NODE_SIZES[type], ...extras }
}
function rel(id: string, sourceId: string, targetId: string, label?: string, technology?: string): C4Relation {
  return { id, sourceId, targetId, label, technology }
}

describe('labelGaps', () => {
  const nodes: Record<string, C4Node> = {
    p: node('p', 'person'),
    S: node('S', 'system', { width: 800, height: 600 }),
    a: node('a', 'container', { parentId: 'S' }),
    b: node('b', 'container', { parentId: 'S' }),
    X: node('X', 'system'),
  }

  it('asks for the room of the largest label between the siblings a relation joins', () => {
    const relations = {
      r1: rel('r1', 'a', 'b', 'Reads'),
      r2: rel('r2', 'b', 'a', 'Publishes accepted operations to subscribers', 'Kafka'),
    }
    const gaps = labelGaps(nodes, relations)
    const big = labelNeed(labelSizeOf(relations.r2, nodes)!)
    expect(gaps.get(pairKey('a', 'b'))).toEqual(big)
    expect(big.y).toBeGreaterThan(3 * 17 * 1.4)
  })

  it('puts a relation between descendants on their ancestors that are siblings', () => {
    const gaps = labelGaps(nodes, { r: rel('r', 'p', 'a', 'Uses'), s: rel('s', 'a', 'X', 'Calls') })
    expect(gaps.has(pairKey('p', 'S'))).toBe(true)
    expect(gaps.has(pairKey('S', 'X'))).toBe(true)
    expect(gaps.has(pairKey('p', 'a'))).toBe(false)
  })

  it('needs no room for unlabelled relations or ones into an ancestor', () => {
    expect(labelGaps(nodes, { r: rel('r', 'a', 'b'), s: rel('s', 'a', 'S', 'Part of') }).size).toBe(0)
  })
})

describe('finalizeLayout with label gaps', () => {
  it('separates siblings joined by a labelled relation by the label, others by the base gap', () => {
    const boxes = [
      { x: 0, y: 0, width: 200, height: 100 },
      { x: 0, y: 110, width: 200, height: 100 },
      { x: 400, y: 0, width: 200, height: 100 },
      { x: 400, y: 110, width: 200, height: 100 },
    ]
    separateBoxes(boxes, CHILD_GAP, undefined, (i, j) => (i === 0 && j === 1 ? { x: 150, y: 60 } : undefined))
    expect(boxes[1].y - (boxes[0].y + boxes[0].height)).toBeGreaterThanOrEqual(60 - 1e-6)
    expect(boxes[3].y - (boxes[2].y + boxes[2].height)).toBeCloseTo(CHILD_GAP)
  })

  it('leaves room for a label between two stacked roots', () => {
    const nodes: Record<string, C4Node> = { a: node('a', 'system'), b: node('b', 'system', { y: NODE_SIZES.system.height + 5 }) }
    const relations = { r: rel('r', 'a', 'b', 'Sends invoices every night', 'SFTP') }
    const out = finalizeLayout(nodes, {}, labelGaps(nodes, relations))
    const need = labelNeed(labelSizeOf(relations.r, nodes)!)
    expect(out.b.y - (out.a.y + out.a.height!)).toBeGreaterThanOrEqual(need.y - 1e-6)
    expect(need.y).toBeGreaterThan(ROOT_GAP)
  })
})

describe('Smart Layout', () => {
  it('leaves each labelled relation room for its label', async () => {
    const nodes: Record<string, C4Node> = {
      u: node('u', 'person'),
      S: node('S', 'system'),
      c1: node('c1', 'container', { parentId: 'S' }),
      c2: node('c2', 'container', { parentId: 'S' }),
      c3: node('c3', 'database', { parentId: 'S' }),
      E: node('E', 'system', { external: true }),
    }
    const relations: Record<string, C4Relation> = {
      r1: rel('r1', 'u', 'c1', 'Browses and places orders', 'HTTPS'),
      r2: rel('r2', 'c1', 'c2', 'Calls the order API', 'JSON/HTTPS'),
      r3: rel('r3', 'c2', 'c3', 'Reads and writes orders', 'JDBC'),
      r4: rel('r4', 'c2', 'E', 'Charges the card', 'REST'),
    }
    const result = await runSmartLayoutCore(nodes, relations)
    const laid: Record<string, C4Node> = {}
    for (const [id, n] of Object.entries(nodes)) laid[id] = { ...n, ...result.winner.positions[id] }
    expect(computeCompositeScore(laid, relations).labelCrowding).toBeCloseTo(0, 6)
    // Between siblings: the label plus its margins, on the axis they are apart on.
    const box = (id: string) => laid[id]
    for (const [a, b, r] of [['c1', 'c2', 'r2'], ['c2', 'c3', 'r3']] as const) {
      const need = labelNeed(labelSizeOf(relations[r], nodes)!)
      const gapX = Math.max(box(a).x, box(b).x) - Math.min(box(a).x + box(a).width, box(b).x + box(b).width)
      const gapY = Math.max(box(a).y, box(b).y) - Math.min(box(a).y + box(a).height, box(b).y + box(b).height)
      expect(gapX >= need.x - 1e-6 || gapY >= need.y - 1e-6).toBe(true)
    }
  })
})
