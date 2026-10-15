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

/**
 * Corridors: relations squeezed through one narrow place. A layout that
 * puts the users of a library in a row above it sends a dozen parallel
 * lines down through it, their labels stacked in between, while a layout
 * with the users around the library spreads them out; the first had fewer
 * crossings and won, though people read the second more easily (the
 * "Shared packages" view of radical.tools' own model, 2026-10-14). Counted
 * in squares of CORRIDOR_CELL px along the drawn curves, away from their
 * ends (relations meeting at a node are no corridor): every relation past
 * CORRIDOR_FREE in one square, squared, costs W_CORRIDOR.
 */
export const CORRIDOR_CELL = 50
export const CORRIDOR_FREE = 2
/** Distance from either end of a relation within which it is not counted. */
export const CORRIDOR_END_CLEAR = 60
/** One square with four relations ≈ ¾ of a crossing. */
export const W_CORRIDOR = 15

/**
 * Calm lines and even use of space: what made an author prefer a layout
 * with more crossings ("Shared packages", 2026-10-15). Seven relations on
 * one side of one element read as a comb; elements crowded into one corner
 * of a container next to an empty one read as unfinished.
 *  - sideLoad: Σ over the sides of the elements of (relations on the side
 *    past SIDE_FREE)².
 *  - spaceImbalance: Σ over containers of four or more (and the canvas) of
 *    the largest minus the smallest share of their elements in a quadrant.
 */
export const SIDE_FREE = 4
export const W_SIDE_LOAD = 20
export const W_SPACE_IMBALANCE = 60

/** A relation label covering another label or an element after placement
 *  (scored on the ranking's routed relations only): about half a crossing. */
export const W_LABEL_COLLISION = 40

/**
 * Crossing angle and angular resolution (Huang, Huang & Lin, "Evaluating
 * overall quality of graph visualizations based on aesthetics
 * aggregation", Information Sciences 330, 2016): relations crossing at a
 * shallow angle, and relations leaving one element in nearly the same
 * direction, are hard to tell apart. Counted rather than taken as the
 * smallest angle, which one bad spot decides (every layout of the "Shared
 * packages" view had one of 0–1°).
 */
export const SHALLOW_CROSSING_DEG = 30
export const CROWDED_ANGLE_DEG = 10

/** Mean edge length (in node sizes) above which the length term kicks in. */
export const LEN_MEAN_KNEE = 3
/** Longest edge (in node sizes) above which the max-length term kicks in. */
export const LEN_MAX_KNEE = 5
/** Bounding-box aspect ratio the aspect term aims for. */
export const TARGET_ASPECT = Math.SQRT2

/**
 * Size from which a diagram is scored as if it had this many relations.
 * Crossings grow with the square of the relations and the sums over
 * relations (overdraws, long edges, crowded labels) with their number,
 * while the size terms (aspect, compactness) stay single numbers: on
 * radical.tools' own model (890 elements, 1776 relations, ~27 000
 * crossings) compactness weighed less than two crossings, and a sprawling
 * layout and a tight one scored within 3% of each other. Scaled to this
 * size, the terms keep the balance they were tuned for on diagrams of tens
 * of relations; up to it the score is unchanged.
 */
export const SCALE_FROM_EDGES = 150

/** Factor on the sums over relations: 1 up to SCALE_FROM_EDGES, then
 *  SCALE_FROM_EDGES / relations. */
export function edgeScale(edgeCount: number): number {
  return Math.min(1, SCALE_FROM_EDGES / Math.max(edgeCount, 1))
}

/** Factor on counts over pairs of relations (crossings): edgeScale squared. */
export function pairScale(edgeCount: number): number {
  return edgeScale(edgeCount) ** 2
}

/** Elements from which compactness counts the leaves' area only (a
 *  group's area is about the box around its children, so counting it made
 *  any layout of a large grouped model look tight); below, as it was. */
export const LEAF_COMPACTNESS_FROM_NODES = 150

/** Overlap cost for `overlap` expressed in mean-node-area units. */
export function overlapCost(overlap: number): number {
  return overlap * W_OVERLAP + overlap * overlap * W_OVERLAP * 5
}

export function aspectPenalty(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0
  const ar = width > height ? width / height : height / width
  return Math.max(0, ar - TARGET_ASPECT) ** 3
}
