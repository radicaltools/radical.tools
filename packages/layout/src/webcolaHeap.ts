/**
 * WebCoLa's pairing heap (behind the shortest paths that start() works out
 * between all elements) merges its sub-heaps recursively, one level for
 * each pair. Its depth grows with the number of elements: on a model of
 * 21,000 elements start() failed with "Maximum call stack size exceeded"
 * and the live layout did nothing. The same merge, in a loop.
 */

import { PairingHeap } from 'webcola'

type Heap = { elem: unknown; subheaps: Heap[]; merge(other: Heap, lessThan: (a: unknown, b: unknown) => boolean): Heap }

/** As WebCoLa's mergePairs: the last two sub-heaps merged, then the two
 *  before them, …, and those pairs merged from the innermost out with what
 *  is left (the one sub-heap without a pair, or an empty heap). */
export function mergePairs(this: Heap, lessThan: (a: unknown, b: unknown) => boolean): Heap {
  const subheaps = this.subheaps
  if (subheaps.length === 0) return new PairingHeap(null) as unknown as Heap
  if (subheaps.length === 1) return subheaps[0]
  const pairs: Heap[] = []
  while (subheaps.length >= 2) pairs.push(subheaps.pop()!.merge(subheaps.pop()!, lessThan))
  let rest: Heap = subheaps.length === 1 ? subheaps[0] : new PairingHeap(null) as unknown as Heap
  for (let i = pairs.length - 1; i >= 0; i--) rest = pairs[i].merge(rest, lessThan)
  return rest
}

;(PairingHeap.prototype as unknown as { mergePairs: typeof mergePairs }).mergePairs = mergePairs
