// ─── Canvas level of detail ────────────────────────────────────────────────
// Zoomed out, a card's text is a fraction of a pixel: the canvas draws each
// element as a block of its type's colour with its name (nodes/C4Nodes,
// withDetail), and React Flow has two handles to measure per element
// instead of eight. On architecture/ (888 elements) the whole model opened
// in 0.38 s, most of it the browser building and measuring full cards.

/** Below this zoom the canvas draws simple blocks; at it and above, cards.
 *  The same as the zoom below which relation labels are hidden. */
export const LOW_DETAIL_BELOW = 0.3
/** Leaving or entering low detail takes this much more zoom, so that a
 *  zoom held at the threshold does not swap the cards back and forth. */
const MARGIN = 0.03

/** Whether `zoom` draws simple blocks, given whether it did. */
export function lowDetailAt(zoom: number, wasLow: boolean): boolean {
  return wasLow ? zoom < LOW_DETAIL_BELOW + MARGIN : zoom < LOW_DETAIL_BELOW - MARGIN
}
