/**
 * Choosing between layouts by aggregated quality (ranking.ts, after Huang,
 * Huang & Lin 2016), and the criteria the paper adds to the score.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aggregatedQuality, bestIndex, bestIndexKeepingCurrent, KEEP_CURRENT_MARGIN } from '../src/ranking'
import { computeCompositeScore, runSmartLayoutCore, type CompositeScore } from '../src/smartLayout'
import type { C4Node, C4Relation } from '@radical/common/c4'

const score = (over: Partial<CompositeScore>): CompositeScore => ({
  crossings: 0, renderedCrossings: 0, overdraws: 0, renderedOverdraws: 0, stubLoopPenalty: 0, nodeOverlap: 0,
  edgeLengthExcess: 0, edgeLengthMean: 0, edgeLengthMax: 0, leafCentrality: 0, aspectPenalty: 0, compactness: 0,
  symmetryDeficit: 0, labelCrowding: 0, corridorCrowding: 0, shallowCrossings: 0, crowdedAngles: 0, edgeLengthSd: 0, labelCollisions: 0, sideLoad: 0, spaceImbalance: 0,
  composite: 0, ...over,
})

describe('aggregated quality', () => {
  it('weighs each criterion by how much the layouts differ in it, not by its units', () => {
    // Thousands of crossings no longer drown everything else: a layout with
    // 3% more crossings but a third of the corridors wins.
    const q = aggregatedQuality([
      score({ renderedCrossings: 30_000, corridorCrowding: 900 }),
      score({ renderedCrossings: 30_900, corridorCrowding: 300 }),
      score({ renderedCrossings: 30_400, corridorCrowding: 600 }),
    ])
    expect(q[1]).toBeLessThan(q[0])
  })

  it('does not blow up a difference too small to mean anything', () => {
    // An aspect penalty of 0.001 against 0 must not outweigh 10 crossings.
    const q = aggregatedQuality([
      score({ renderedCrossings: 10, aspectPenalty: 0 }),
      score({ renderedCrossings: 0, aspectPenalty: 0.001 }),
    ])
    expect(q[1]).toBeLessThan(q[0])
  })

  it('never picks an overlapping layout while one without overlap exists', () => {
    expect(bestIndex([score({ nodeOverlap: 0.5 }), score({ renderedCrossings: 40, corridorCrowding: 99 })])).toBe(1)
    expect(bestIndex([score({ nodeOverlap: 0.5 }), score({ nodeOverlap: 0.2, renderedCrossings: 40 })])).toBe(1)
  })

  it('keeps the layout on screen unless another is clearly better', () => {
    const current = score({ renderedCrossings: 5 })
    const slightly = score({ renderedCrossings: 4.9 })
    expect(bestIndexKeepingCurrent([slightly, current])).toBe(1)
    const clearly = score({ renderedCrossings: 0, corridorCrowding: 0, shallowCrossings: 0 })
    const worse = score({ renderedCrossings: 9, corridorCrowding: 20, shallowCrossings: 4 })
    expect(bestIndexKeepingCurrent([clearly, worse])).toBe(0)
    expect(KEEP_CURRENT_MARGIN).toBeGreaterThan(0)
  })

  it('keeps the layout on screen against one that loses about as much as it gains', () => {
    // g60 after Smart Layout and one delete: the next run traded crossings
    // and sides for overdraws (216 → 221 crossings, 125 → 117 overdraws),
    // better overall by more than the margin, and moved all 62 elements.
    // Here: fewer crossings and overdraws, more on one side; ahead by 0.38,
    // it gains 2.5 standard deviations and loses 2.1.
    const challenger = score({ renderedCrossings: 4, renderedOverdraws: 0, sideLoad: 3 })
    const other = score({ renderedCrossings: 40 })
    const current = score({ renderedCrossings: 10, renderedOverdraws: 6 })
    const q = aggregatedQuality([challenger, other, current], true)
    expect(q[2] - q[0]).toBeGreaterThan(KEEP_CURRENT_MARGIN)
    expect(bestIndexKeepingCurrent([challenger, other, current])).toBe(2)
    // One that gains twice what it loses replaces it.
    const clearly = score({ renderedCrossings: 4, renderedOverdraws: 0, sideLoad: 1 })
    expect(bestIndexKeepingCurrent([clearly, other, current])).toBe(0)
  })

  it('counts a layout several candidates came out as once, when it picks the winner', () => {
    // Three ELK variants giving one Layered TB weighed it three times in the
    // means and deviations, and so decided between two other near equals.
    const a = score({ renderedCrossings: 32, labelCollisions: 3, edgeLengthSd: 1.1 })
    const b = score({ renderedCrossings: 25, compactness: 0.6, edgeLengthSd: 2.5 })
    const c = score({ renderedCrossings: 99, renderedOverdraws: 54, edgeLengthSd: 2.2 })
    const once = aggregatedQuality([a, b, c], true)
    const thrice = aggregatedQuality([a, b, c, { ...c }, { ...c }], true)
    for (let i = 0; i < 3; i++) expect(thrice[i]).toBeCloseTo(once[i], 9)
    expect(aggregatedQuality([a, b, c, { ...c }, { ...c }])[0]).not.toBeCloseTo(once[0], 3)
  })

  it('picks the same winner whatever layout it starts from, and keeps it the next time (item 193)', () => {
    // The sample's 13-element Trace list: its two best layered layouts, and
    // the unarranged layout the first run started from. Ranked with that
    // one, the top-down layout won; the next run, from it, ranked without
    // it, picked the left-right one: MCP smart_layout rewrote the view twice.
    const topDown = score({ leafCentrality: 1.85, aspectPenalty: 0.0042, compactness: 0.0417, symmetryDeficit: 0.655, edgeLengthSd: 0.4, spaceImbalance: 0.0769 })
    const leftRight = score({ leafCentrality: 1.99, symmetryDeficit: 0.777, edgeLengthSd: 0.101, spaceImbalance: 0.1538 })
    const start = score({ renderedCrossings: 4, renderedOverdraws: 4, edgeLengthSd: 3.04, compactness: 2.6, shallowCrossings: 2, crowdedAngles: 2, spaceImbalance: 0.46, labelCrowding: 0.0002 })
    const first = bestIndexKeepingCurrent([topDown, leftRight, start])
    expect(first).toBeLessThan(2)
    const winner = [topDown, leftRight][first]
    expect(bestIndexKeepingCurrent([topDown, leftRight, { ...winner }])).toBe(2)
  })
})

describe('crossing angle and angular resolution', () => {
  const node = (id: string, x: number, y: number): C4Node => ({ id, type: 'container', label: id, x, y, width: 100, height: 60 }) as C4Node
  const rel = (id: string, s: string, t: string): C4Relation => ({ id, sourceId: s, targetId: t }) as C4Relation
  it('counts crossings at a shallow angle, not those at a right angle', () => {
    const square = { a: node('a', 0, 300), b: node('b', 600, 307), c: node('c', 270, 0), d: node('d', 290, 600) }
    const right = computeCompositeScore(square, { ac: rel('ac', 'a', 'b'), cd: rel('cd', 'c', 'd') })
    expect(right.renderedCrossings).toBe(1)
    expect(right.shallowCrossings).toBe(0)
    const flat = { a: node('a', 0, 300), b: node('b', 900, 340), c: node('c', 0, 360), d: node('d', 900, 290) }
    const shallow = computeCompositeScore(flat, { ab: rel('ab', 'a', 'b'), cd: rel('cd', 'c', 'd') })
    expect(shallow.renderedCrossings).toBe(1)
    expect(shallow.shallowCrossings).toBe(1)
  })

  it('counts relations leaving one element in nearly the same direction', () => {
    const hub = node('hub', 0, 0)
    const fan = { hub, x: node('x', 900, 0), y: node('y', 900, 70), z: node('z', 900, 140) }
    const spread = { hub, x: node('x', 900, 0), y: node('y', 0, 700), z: node('z', -900, 0) }
    const rels = { hx: rel('hx', 'hub', 'x'), hy: rel('hy', 'hub', 'y'), hz: rel('hz', 'hub', 'z') }
    expect(computeCompositeScore(fan, rels).crowdedAngles).toBeGreaterThan(0)
    expect(computeCompositeScore(spread, rels).crowdedAngles).toBe(0)
  })
})

describe('a view arranged by hand', () => {
  // Known gap (docs/IMPROVEMENTS.md, "Calibrate Smart Layout's ranking"):
  // since the score sees every line the canvas draws (45 here, not 25), the
  // ranking prefers layouts with far fewer crossings that the author finds
  // worse to read. The weights wait for a calibration on the author's own
  // judgements; until then this is the case it has to meet.
  it.skip('Smart Layout keeps the "Shared packages" view as its author arranged it', async () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/shared-packages-by-hand.json'), 'utf8'))
    const nodes = Object.fromEntries(fixture.nodes.map((n: C4Node) => [n.id, n]))
    const relations = Object.fromEntries(fixture.relations.map((r: C4Relation) => [r.id, r]))
    const result = await runSmartLayoutCore(nodes, relations)
    expect(result.keptCurrent).toBe(true)
  }, 120_000)
})
