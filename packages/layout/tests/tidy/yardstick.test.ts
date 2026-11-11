/**
 * The yardstick (bench/yardstick.ts): what a reader sees on the Hub's
 * blueprints and patterns after Smart Layout, held to the baseline in
 * bench/tidy-yardstick.json. A change to Tidy's cost or moves that leaves
 * more crossings as drawn, more lines over elements, more slanted lines,
 * longer lines or a larger diagram fails here; one that leaves fewer
 * lowers the baseline (`npx tsx bench/tidy-yard.mts --write`).
 */
import { describe, it, expect } from 'vitest'
import { baseline, benchModels, measure, total, worse } from '../../bench/yardstick'

describe('Tidy yardstick', () => {
  it('reads no worse on the bench models than its baseline', { timeout: 240_000 }, () => {
    const now = total(benchModels().map((f) => measure(f)))
    expect(worse(now, baseline())).toEqual([])
  })
})
