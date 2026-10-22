// A toy system for the engine's tests: a counter with undo. Two bugs: an
// increase may take it past 20, and Undo of a doubling of an odd number gives
// back one less.

import { differences, describeDifference, fc, type FuzzSuite, type Known, type RunContext } from '../src/index'

export type CounterAction = { a: 'inc'; by: number } | { a: 'double' } | { a: 'undo' }

interface Counter { n: number; history: number[] }

export const counterActions: fc.Arbitrary<CounterAction> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ a: fc.constant('inc' as const), by: fc.integer({ min: 1, max: 3 }) }) },
  { weight: 1, arbitrary: fc.constant({ a: 'double' as const }) },
  { weight: 2, arbitrary: fc.constant({ a: 'undo' as const }) },
)

export interface CounterBugs { bound?: boolean; undoOfDouble?: boolean }

export function counterSuite(bugs: CounterBugs = {}, known: Known<CounterAction>[] = [], plan = { seed: 7, runs: 60, maxLength: 12 }): FuzzSuite<CounterAction, null, Counter> {
  const fail = (ctx: RunContext<CounterAction>, rule: string, line: string, was: unknown, now: unknown) => {
    const d = differences({ n: was }, { n: now })
    ctx.fail({ rule, detail: `${line}:\n      ${d.map(describeDifference).join('\n      ')}`, differences: d })
  }
  return {
    name: 'counter',
    file: 'tests/counter.ts',
    rules: ['bounded', 'undoRestores'],
    actions: counterActions,
    worlds: { zero: plan },
    prepare: () => null,
    start: () => ({ n: 0, history: [] }),
    step(run, action, ctx) {
      ctx.actions.push(action)
      const before = run.n
      if (action.a === 'undo') {
        const last = run.history.pop()
        ctx.trace.push(last === undefined ? 'undo: nothing to undo' : `undo to ${last}`)
        if (last !== undefined) run.n = last
        return
      }
      run.history.push(run.n)
      if (action.a === 'inc') run.n = bugs.bound ? run.n + action.by : Math.min(20, run.n + action.by)
      else run.n = bugs.bound ? run.n * 2 : Math.min(20, run.n * 2)
      ctx.trace.push(`${action.a} ${before} → ${run.n}`)
      if (run.n > 20) fail(ctx, 'bounded', `${action.a} took the counter past 20`, before, run.n)
      // Undo gives back the number before the step.
      const undone = action.a === 'double' && bugs.undoOfDouble && before % 2 === 1 ? before - 1 : before
      if (undone !== before) fail(ctx, 'undoRestores', `Undo of ${action.a} did not give back ${before}`, before, undone)
    },
    known,
    isNoOp: (line) => /nothing to undo/.test(line),
  }
}
