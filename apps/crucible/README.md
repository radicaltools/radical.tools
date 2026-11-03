# @radicaltools/crucible

The engine of [Radical Crucible](https://radical.tools): write a fuzz file that checks your
system's rules after every step of random sequences of actions. A failure shrinks to the
shortest sequence that breaks a rule, and `radical fuzz` runs the file, on fixed seeds with
every change and on a random seed at night.

```sh
npm install --save-dev @radicaltools/crucible vitest @radicaltools/cli
```

## A fuzz file

```ts
// tests/cart.fuzz.test.ts
import { fc, type FuzzSuite } from '@radicaltools/crucible'
import { fuzzSuite } from '@radicaltools/crucible/vitest'

type Action = { a: 'add'; price: number } | { a: 'clear' }
interface Run { lines: number[]; total: number }

const suite: FuzzSuite<Action, null, Run> = {
  name: 'cart',
  file: 'tests/cart.fuzz.test.ts',
  rules: ['totalMatchesLines'],
  actions: fc.oneof(
    fc.record({ a: fc.constant('add' as const), price: fc.integer({ min: 1, max: 100 }) }),
    fc.constant({ a: 'clear' as const }),
  ),
  // The models a run starts from, each with the seed and runs of the fixed plan.
  worlds: { empty: { seed: 1, runs: 100, maxLength: 20 } },
  prepare: () => null,
  start: () => ({ lines: [], total: 0 }),
  step(run, action, ctx) {
    ctx.actions.push(action)
    if (action.a === 'add') {
      run.lines.push(action.price)
      run.total += action.price
    } else {
      run.lines = []
      run.total = 0
    }
    ctx.trace.push(`${action.a}: total ${run.total}`)
    const sum = run.lines.reduce((a, b) => a + b, 0)
    if (sum !== run.total) ctx.fail({ rule: 'totalMatchesLines', detail: `${run.total}, not ${sum}`, differences: [] })
  },
}

fuzzSuite(suite, { title: 'cart' })
```

It reports a test case for each world and one for each rule of each world (`in world empty:
totalMatchesLines holds`), which `radical verify` can bind to a scenario or a fitness function.

## Running it

List the file in `.radical/crucible/crucible.json`:

```json
{
  "findings": ".radical/crucible/findings",
  "fuzz": [{ "file": "tests/cart.fuzz.test.ts", "cwd": "." }]
}
```

```sh
npx radical fuzz                  # the fixed seeds
npx radical fuzz night            # a random seed and 2000 runs of each world
npx radical fuzz --survey         # goes on after each failure, and records each new one as a finding
npx radical fuzz --replay F-0003  # runs a finding again
```

## Entry points

- `@radicaltools/crucible`: `Fuzzer`, `fc` (fast-check), `differences`, `RuleBroken`,
  `fuzzOptionsFromEnv`, `mulberry32`, `sequentialIds`, `manualTimers`, and the findings' parsing.
- `@radicaltools/crucible/vitest`: `fuzzSuite` registers a suite as test cases.
- `@radicaltools/crucible/findings`: `readFindings` and `writeFinding`, for the finding files.

MIT licensed.
