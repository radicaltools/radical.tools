import { describe, expect, it } from 'vitest'
import { PairingHeap, PriorityQueue } from 'webcola'
import { mergePairs } from '../src/webcolaHeap'

type Heap = { elem: unknown; subheaps: Heap[]; merge(other: Heap, lessThan: (a: unknown, b: unknown) => boolean): Heap }

// WebCoLa's own mergePairs, as it was before the patch.
function recursiveMergePairs(this: Heap, lessThan: (a: unknown, b: unknown) => boolean): Heap {
  if (this.subheaps.length === 0) return new PairingHeap(null) as unknown as Heap
  if (this.subheaps.length === 1) return this.subheaps[0]
  const firstPair = this.subheaps.pop()!.merge(this.subheaps.pop()!, lessThan)
  const remaining = recursiveMergePairs.call(this, lessThan)
  return firstPair.merge(remaining, lessThan)
}

const proto = PairingHeap.prototype as unknown as { mergePairs: typeof mergePairs }
const shape = (h: Heap): unknown => [h.elem, h.subheaps.map(shape)]

/** The heap after each pop, as the pairs merge it. */
function pops(values: number[], merge: typeof mergePairs): unknown[] {
  const patched = proto.mergePairs
  proto.mergePairs = merge
  try {
    const q = new PriorityQueue<number>((a, b) => a <= b)
    for (const v of values) q.push(v)
    const out: unknown[] = []
    while (!q.empty()) out.push([q.pop(), shape((q as unknown as { root: Heap }).root)])
    return out
  } finally {
    proto.mergePairs = patched
  }
}

describe('WebCoLa pairing heap', () => {
  it('merges as WebCoLa did, so layouts stay the same', () => {
    let seed = 7
    const values = Array.from({ length: 300 }, () => (seed = (seed * 16807) % 2147483647) % 1000)
    expect(pops(values, mergePairs)).toEqual(pops(values, recursiveMergePairs))
  })

  it('takes a heap of 1,000,000 sub-heaps without running out of stack', () => {
    const q = new PriorityQueue<number>((a, b) => a <= b)
    // The first is the least: each one after it is a sub-heap of the root.
    for (let i = 1; i <= 1_000_000; i++) q.push(i)
    expect(() => { for (let i = 1; i <= 1000; i++) expect(q.pop()).toBe(i) }).not.toThrow()
  })
})
