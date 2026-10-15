/**
 * Which of several layouts of one diagram wins.
 *
 * A weighted sum of aesthetics needs weights that hold at every size, and
 * ours did not: on radical.tools' own model the crossings (which grow with
 * the square of the relations) outweighed everything else, and a sprawling
 * layout and a tight one scored within 3%. Following Huang, Huang & Lin
 * ("Evaluating overall quality of graph visualizations based on aesthetics
 * aggregation", Information Sciences 330, 2016), each criterion is instead
 * standardised over the layouts being compared — how far a layout is from
 * their mean, in their standard deviations — and the standardised values
 * are summed with equal weights.
 *
 * Two changes to the paper's measure:
 *  - Each criterion has a floor under its standard deviation, the smallest
 *    difference that means anything (one crossing, half a unit of
 *    compactness): standardised as such, an aspect penalty of 0.001 against
 *    0 counted as much as ten crossings against none.
 *  - Overlapping elements are not traded off: a layout with overlap wins
 *    only when every layout has some, and then the least.
 *
 * Only the choice between layouts works this way. The annealer, which
 * compares small moves of one layout, keeps the weighted energy.
 */
import type { CompositeScore } from './smartLayout'

interface Criterion {
  key: keyof CompositeScore
  /** The smallest difference that means anything. */
  floor: number
}

/** Lower is better for each. The first four are the paper's (crossings,
 *  crossing angle, angular resolution, uniform edge lengths); the others are
 *  what nested, labelled C4 diagrams need besides. */
export const RANK_CRITERIA: readonly Criterion[] = [
  { key: 'renderedCrossings', floor: 1 },
  { key: 'shallowCrossings', floor: 1 },
  { key: 'crowdedAngles', floor: 1 },
  { key: 'edgeLengthSd', floor: 0.25 },
  { key: 'renderedOverdraws', floor: 1 },
  { key: 'corridorCrowding', floor: 2 },
  { key: 'compactness', floor: 0.5 },
  { key: 'aspectPenalty', floor: 0.05 },
  { key: 'labelCrowding', floor: 0.25 },
  { key: 'labelCollisions', floor: 1 },
  { key: 'sideLoad', floor: 1 },
  { key: 'spaceImbalance', floor: 0.1 },
]

/** Node overlap (in mean node areas) from which a layout is overlapping. */
const OVERLAP_TOLERANCE = 0.01

/** The aggregated quality of each score among `scores`: the sum over
 *  RANK_CRITERIA of its standardised value. Lower is better. */
export function aggregatedQuality(scores: readonly CompositeScore[]): number[] {
  const total = scores.map(() => 0)
  if (scores.length < 2) return total
  for (const { key, floor } of RANK_CRITERIA) {
    const values = scores.map((s) => Number(s[key]) || 0)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length)
    const scale = Math.max(sd, floor)
    values.forEach((v, i) => { total[i] += (v - mean) / scale })
  }
  return total
}

/** The index of the best of `scores`: the best aggregated quality among the
 *  layouts without overlap, or the least overlap when all have some. Ties
 *  go to the earlier one. */
export function bestIndex(scores: readonly CompositeScore[]): number {
  const quality = aggregatedQuality(scores)
  const clean = scores.map((s, i) => i).filter((i) => scores[i].nodeOverlap <= OVERLAP_TOLERANCE)
  const pool = clean.length > 0 ? clean : scores.map((_, i) => i)
  const leastOverlap = Math.min(...pool.map((i) => scores[i].nodeOverlap))
  let best = -1
  for (const i of pool) {
    if (clean.length === 0 && scores[i].nodeOverlap > leastOverlap) continue
    if (best < 0 || quality[i] < quality[best]) best = i
  }
  return best
}

/**
 * How much better (in summed standard deviations) a new layout has to be
 * than the one on screen to replace it (0.5 kept a layout a user had just
 * dragged an element out of line in, and Smart Layout seemed to do nothing). A standardised score depends on
 * what it is compared with, so running Smart Layout again on the layout it
 * just made could otherwise swap it for one a hair "better" among the new
 * set: a layout that stands should not churn.
 */
export const KEEP_CURRENT_MARGIN = 0.25

/** Like bestIndex, with the last score the layout on screen: it is kept
 *  (its index returned) unless another is better by KEEP_CURRENT_MARGIN. */
export function bestIndexKeepingCurrent(scores: readonly CompositeScore[]): number {
  const best = bestIndex(scores)
  const current = scores.length - 1
  if (best === current) return current
  const quality = aggregatedQuality(scores)
  const currentClean = scores[current].nodeOverlap <= OVERLAP_TOLERANCE || scores[current].nodeOverlap <= scores[best].nodeOverlap
  return currentClean && quality[current] - quality[best] < KEEP_CURRENT_MARGIN ? current : best
}

/** `items` ordered best first by aggregated quality among them (overlapping
 *  ones after the others). */
export function rankByQuality<T extends { score: CompositeScore }>(items: readonly T[]): T[] {
  const quality = aggregatedQuality(items.map((it) => it.score))
  const overlapping = (it: T) => it.score.nodeOverlap > OVERLAP_TOLERANCE
  return items
    .map((it, i) => ({ it, q: quality[i] }))
    .sort((a, b) => Number(overlapping(a.it)) - Number(overlapping(b.it)) || a.q - b.q)
    .map(({ it }) => it)
}
