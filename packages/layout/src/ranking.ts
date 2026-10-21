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
 *  RANK_CRITERIA of its standardised value. Lower is better. With
 *  `distinct`, each layout counts once in the means and deviations (see
 *  bestIndexKeepingCurrent). */
export function aggregatedQuality(scores: readonly CompositeScore[], distinct = false): number[] {
  return standardised(scores, distinct).map((values) => values.reduce((sum, v) => sum + v, 0))
}

/** Each score's standardised value per criterion of RANK_CRITERIA: how far
 *  it is from the mean of `scores`, in their standard deviations (or the
 *  criterion's floor). All zero for fewer than two scores. */
function standardised(scores: readonly CompositeScore[], distinct: boolean): number[][] {
  const values = scores.map(() => RANK_CRITERIA.map(() => 0))
  if (scores.length < 2) return values
  const seen = new Set<string>()
  const counted = !distinct ? scores : scores.filter((s) => {
    const key = RANK_CRITERIA.map(({ key }) => Number(s[key]) || 0).join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  RANK_CRITERIA.forEach(({ key, floor }, c) => {
    const pool = counted.map((s) => Number(s[key]) || 0)
    const mean = pool.reduce((sum, v) => sum + v, 0) / pool.length
    const sd = Math.sqrt(pool.reduce((sum, v) => sum + (v - mean) ** 2, 0) / pool.length)
    const scale = Math.max(sd, floor)
    scores.forEach((s, i) => { values[i][c] = ((Number(s[key]) || 0) - mean) / scale })
  })
  return values
}

/** The index of the best of `scores`: the best aggregated quality among the
 *  layouts without overlap, or the least overlap when all have some. Ties
 *  go to the earlier one. */
export function bestIndex(scores: readonly CompositeScore[], distinct = false): number {
  const quality = aggregatedQuality(scores, distinct)
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

/**
 * And how much more it has to gain than it loses, criterion by criterion
 * (the standardised values it is better in, against those it is worse in).
 * Ahead by the margin alone, a layout that traded about as much as it
 * gained replaced the one on screen: Smart Layout run again after one
 * element of 63 was deleted moved all 62 others for 216 → 221 crossings
 * and 125 → 117 overdraws.
 */
export const KEEP_CURRENT_RATIO = 2

/** Like bestIndex, with the last score the layout on screen: it is kept
 *  (its index returned) unless the best of the others is clearly better:
 *  by KEEP_CURRENT_MARGIN, gaining KEEP_CURRENT_RATIO times what it loses.
 *  That best is the best among the others alone: with the layout on
 *  screen in the ranking, how bad it was moved the means and
 *  deviations, so the winner depended on where the run started, and a run
 *  from the layout it had just made picked another one (MCP smart_layout
 *  called twice rewrote the view twice). Each layout counts once in the
 *  means and deviations: candidates that came out as the same layout
 *  (Layered TB from three ELK variants, or the layout on screen when it is
 *  one of them) weighed it two or three times, and moved every other
 *  layout's standing towards or away from it; with the layout on screen
 *  left out, that decided between near equals. */
export function bestIndexKeepingCurrent(scores: readonly CompositeScore[]): number {
  const current = scores.length - 1
  if (current <= 0) return current
  if (bestIndex(scores, true) === current) return current
  const best = bestIndex(scores.slice(0, current), true)
  const values = standardised(scores, true)
  const quality = values.map((v) => v.reduce((sum, x) => sum + x, 0))
  const currentClean = scores[current].nodeOverlap <= OVERLAP_TOLERANCE || scores[current].nodeOverlap <= scores[best].nodeOverlap
  if (!currentClean) return best
  if (quality[current] - quality[best] < KEEP_CURRENT_MARGIN) return current
  let gains = 0
  let losses = 0
  values[best].forEach((v, c) => {
    const d = values[current][c] - v
    if (d > 0) gains += d
    else losses -= d
  })
  return gains >= KEEP_CURRENT_RATIO * losses ? best : current
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
