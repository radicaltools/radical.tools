// What a fuzz file gets from the package's entry points. The archive itself is checked by
// scripts/test-package.mjs, outside the monorepo.

import { describe, expect, it } from 'vitest'
import { Fuzzer, fc, fuzzOptionsFromEnv, type FuzzSuite } from '../src/index'
import { fuzzSuite } from '../src/vitest'
import { findingTestName, readFindings } from '../src/findings'

type Action = { a: 'inc'; by: number } | { a: 'undo' }
interface Run { n: number; last: number[] }

/** A counter whose Undo after an increase of more than 5 gives back one too few. */
const counter = (bug: boolean): FuzzSuite<Action, null, Run> => ({
  name: 'counter',
  rules: ['undoRestores', 'notNegative'],
  actions: fc.oneof(
    fc.record({ a: fc.constant('inc' as const), by: fc.integer({ min: 1, max: 9 }) }),
    fc.constant({ a: 'undo' as const }),
  ),
  worlds: { zero: { seed: 7, runs: 200, maxLength: 8 } },
  prepare: () => null,
  start: () => ({ n: 0, last: [] }),
  step(run, action, ctx) {
    ctx.actions.push(action)
    if (action.a === 'inc') {
      run.last.push(run.n)
      run.n += action.by
      ctx.trace.push(`inc to ${run.n}`)
      return
    }
    const before = run.last.pop()
    if (before === undefined) {
      ctx.trace.push('nothing to undo')
      return
    }
    const wrong = bug && run.n - before > 5
    run.n = wrong ? before - 1 : before
    ctx.trace.push(`undo to ${run.n}`)
    if (run.n !== before) ctx.fail({ rule: 'undoRestores', detail: `Undo gave ${run.n}, not ${before}`, differences: [] })
  },
})

describe('Crucible engine package', () => {
  it('a suite written with the package has a case per world and per rule', async () => {
    const healthy = new Fuzzer(counter(false), fuzzOptionsFromEnv({}))
    await healthy.runWorld('zero')
    expect([...healthy.brokenIn('zero')]).toEqual([])

    const buggy = new Fuzzer(counter(true), fuzzOptionsFromEnv({}))
    await expect(buggy.runWorld('zero')).rejects.toThrow('undoRestores')
    expect([...buggy.brokenIn('zero')]).toEqual(['undoRestores'])
  })
  it('offers the Vitest registration and the finding files', () => {
    expect(typeof fuzzSuite).toBe('function')
    expect(typeof readFindings).toBe('function')
    expect(typeof findingTestName).toBe('function')
  })
})
