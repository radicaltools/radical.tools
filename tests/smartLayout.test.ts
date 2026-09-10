/**
 * Core Smart Layout regression coverage.
 *
 * Prior to this file, only radicalLayout.ts (one of the ten ensemble
 * candidates) had vitest coverage — the central scoring / SA / ensemble
 * logic in smartLayout.ts itself had none. These tests guard the two
 * properties that actually matter for the feature's "unique selling point"
 * framing: the cost function agrees with what a human would call messy, and
 * the end-to-end ensemble never hands back something worse than it started.
 */
import { describe, it, expect } from 'vitest'
import { computeCompositeScore, runSmartLayoutCore } from '../src/renderer/src/layout/smartLayout'
import type { C4Node, C4Relation } from '../src/renderer/src/types/c4'

function node(id: string, x: number, y: number, w = 200, h = 100, parentId?: string): C4Node {
  return { id, type: 'system', label: id, x, y, width: w, height: h, collapsed: false, parentId }
}
function rel(id: string, sourceId: string, targetId: string): C4Relation {
  return { id, sourceId, targetId }
}

describe('computeCompositeScore', () => {
  it('scores a layout with crossing edges worse than an equivalent one without', () => {
    // Four nodes near the corners of a square (sizes/offsets deliberately
    // asymmetric — a perfectly symmetric square makes the two diagonal
    // Bézier curves mirror-image tangent at the centre instead of crossing
    // transversally, which the segment-intersection test correctly does not
    // count as a crossing). Diagonal edges (A-D, B-C) cross in the middle;
    // the same nodes wired to their horizontal neighbours (A-B, C-D) do not.
    const nodes: Record<string, C4Node> = {
      A: node('A', 0, 0, 180, 90),
      B: node('B', 520, 10, 220, 110),
      C: node('C', 30, 480, 190, 95),
      D: node('D', 540, 530, 210, 105),
    }

    const crossing: Record<string, C4Relation> = {
      r1: rel('r1', 'A', 'D'),
      r2: rel('r2', 'B', 'C'),
    }
    const clean: Record<string, C4Relation> = {
      r1: rel('r1', 'A', 'B'),
      r2: rel('r2', 'C', 'D'),
    }

    const crossingScore = computeCompositeScore(nodes, crossing)
    const cleanScore = computeCompositeScore(nodes, clean)

    expect(crossingScore.renderedCrossings).toBeGreaterThan(0)
    expect(cleanScore.renderedCrossings).toBe(0)
    expect(crossingScore.composite).toBeGreaterThan(cleanScore.composite)
  })

  it('penalises overlapping siblings', () => {
    // Four static corner anchors keep the bounding box (and so the aspect-
    // ratio / compactness terms) identical between the two scenarios, so the
    // composite delta below isolates the overlap penalty rather than being
    // swamped by an incidental bbox-shape difference.
    const anchors: Record<string, C4Node> = {
      P1: node('P1', 0, 0, 60, 60),
      P2: node('P2', 900, 0, 60, 60),
      P3: node('P3', 0, 900, 60, 60),
      P4: node('P4', 900, 900, 60, 60),
    }
    const relations: Record<string, C4Relation> = {
      rp1: rel('rp1', 'P1', 'P2'),
      rp2: rel('rp2', 'P3', 'P4'),
      rab: rel('rab', 'A', 'B'),
    }

    const apart: Record<string, C4Node> = { ...anchors, A: node('A', 400, 400), B: node('B', 700, 400) }
    const overlapping: Record<string, C4Node> = { ...anchors, A: node('A', 400, 400), B: node('B', 450, 420) }

    const apartScore = computeCompositeScore(apart, relations)
    const overlapScore = computeCompositeScore(overlapping, relations)

    expect(overlapScore.nodeOverlap).toBeGreaterThan(0)
    expect(apartScore.nodeOverlap).toBe(0)
    expect(overlapScore.composite).toBeGreaterThan(apartScore.composite)
  })
})

describe('runSmartLayoutCore (end-to-end ensemble + SA refinement)', () => {
  it('never hands back a result worse than the input, and improves a scattered diagram', async () => {
    // Six root nodes scattered so several of the "logical" edges below cross
    // in the input arrangement — mirrors what a freshly-imported or manually
    // dragged-around diagram looks like before Smart Layout is run.
    const nodes: Record<string, C4Node> = {
      n1: node('n1', 0, 0),
      n2: node('n2', 900, 700),
      n3: node('n3', 1800, 0),
      n4: node('n4', 0, 700),
      n5: node('n5', 900, 0),
      n6: node('n6', 1800, 700),
    }
    const relations: Record<string, C4Relation> = {
      r1: rel('r1', 'n1', 'n2'),
      r2: rel('r2', 'n2', 'n3'),
      r3: rel('r3', 'n4', 'n5'),
      r4: rel('r4', 'n5', 'n6'),
      r5: rel('r5', 'n1', 'n4'),
      r6: rel('r6', 'n3', 'n6'),
      r7: rel('r7', 'n1', 'n6'),
      r8: rel('r8', 'n3', 'n4'),
    }

    const baselineScore = computeCompositeScore(nodes, relations)
    // Sanity check on the fixture itself: it should actually start out messy,
    // otherwise this test doesn't exercise anything.
    expect(baselineScore.composite).toBeGreaterThan(0)

    const result = await runSmartLayoutCore(nodes, relations)

    expect(result.candidates.length).toBeGreaterThan(0)
    // The core guarantee: Smart Layout must never make a diagram look worse
    // than it started, by its own cost function.
    expect(result.winner.score.composite).toBeLessThanOrEqual(baselineScore.composite)
    // And for this deliberately-crossed fixture, it should actually improve it.
    expect(result.winner.metrics.weightedCost).toBeLessThan(result.baseline.weightedCost)
  })
})
