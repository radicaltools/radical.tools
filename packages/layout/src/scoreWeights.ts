/**
 * Weights of the Smart Layout aesthetic cost, shared by the full
 * render-aware score (smartLayout.ts) and the incremental annealing energy
 * (annealing.ts) so the two cannot drift apart.
 *
 * Tuned so that:
 *   1 visible crossing  ≈ 80
 *   1 unit node overlap ≈ 150 (plus a quadratic shock)
 *   1 long edge         ≈ 5
 *   bad aspect ratio    ≈ 10–40
 *   sparse compactness  ≈ 0–30
 * → crossings still dominate, but ranking and annealing have *gradient*
 *   even when the crossing count is locally constant.
 *
 * Revised after observed failure modes (Person/External-System placed
 * centrally with very long edges through the diagram):
 *   - edgeLengthMean catches uniformly-spread layouts the outlier-only
 *     edgeLengthExcess couldn't see.
 *   - leafCentrality pushes degree-1/2 nodes to the periphery so they stop
 *     sitting between two clusters and crossing everything.
 */

export const W_CROSS    = 80
export const W_OVERDRAW = 12
export const W_STUBLOOP = 30
/** Raised from 50 — overlap used to be cheaper than the edge length it saved. */
export const W_OVERLAP  = 150
/** edgeLengthExcess (long-tail outliers). */
export const W_LONG     = 5
/** edgeLengthMean (global tightness). */
export const W_LMEAN    = 25
/** edgeLengthMax — one edge spanning the whole canvas while the mean looks fine. */
export const W_LMAX     = 30
export const W_LEAF     = 20
/** Tall (>2:1) layouts are hard to read in any presentation viewport; paired with a cubic exponent. */
export const W_ASPECT   = 30
export const W_COMPACT  = 8
export const W_SYMMETRY = 4
/** Per labelled relation whose ends leave no room for its label (≈ an
 *  overdraw: the label has to cover a node). */
export const W_LABEL    = 15

/** Mean edge length (in node sizes) above which the length term kicks in. */
export const LEN_MEAN_KNEE = 3
/** Longest edge (in node sizes) above which the max-length term kicks in. */
export const LEN_MAX_KNEE = 5
/** Bounding-box aspect ratio the aspect term aims for. */
export const TARGET_ASPECT = Math.SQRT2

/** Overlap cost for `overlap` expressed in mean-node-area units. */
export function overlapCost(overlap: number): number {
  return overlap * W_OVERLAP + overlap * overlap * W_OVERLAP * 5
}

export function aspectPenalty(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0
  const ar = width > height ? width / height : height / width
  return Math.max(0, ar - TARGET_ASPECT) ** 3
}
