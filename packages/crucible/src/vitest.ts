// ─── Crucible: a fuzz suite as Vitest tests ─────────────────────────────────
//
// fuzzSuite registers a case per world, which runs the world, and after it a
// case per rule of that world, which fails when a run of the world broke the
// rule outside the known failures. radical check binds tests by name, so a
// scenario or a fitness function can name one rule of one world. Each
// hardened or fixed finding of the file is a case too, which replays its steps.

import { afterAll, describe, expect, it } from 'vitest'
import { Fuzzer, fuzzOptionsFromEnv, type FuzzOptions, type FuzzSuite } from './engine'
import type { Action } from './violation'
import type { Finding } from './findings'

export interface FuzzSuiteOptions {
  /** The describe block's title. */
  title: string
  /** A world's case name (default "in world <world>"); its rules' cases add
   *  ": <rule> holds". */
  worldTitle?: (world: string) => string
  /** The settings (default: the FUZZ_* environment variables). */
  options?: FuzzOptions
  /** The project's findings (loadFindings): each hardened or fixed one of
   *  this file becomes a case that replays its steps. */
  findings?: readonly Finding[]
}

/** Registers the suite's cases; returns the fuzzer, whose summary is logged
 *  after all tests. */
export function fuzzSuite<A extends Action, P, R>(suite: FuzzSuite<A, P, R>, settings: FuzzSuiteOptions): Fuzzer<A, P, R> {
  const options = settings.options ?? fuzzOptionsFromEnv((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {})
  const fuzzer = new Fuzzer(suite, options)
  const worldTitle = settings.worldTitle ?? ((world: string) => `in world ${world}`)
  // Taken now: a suite may silence console.log while it runs.
  const log = console.log.bind(console)
  const long = options.runs !== undefined || options.plan === 'night'
  describe(settings.title, () => {
    for (const world of fuzzer.worlds()) {
      it(worldTitle(world), async () => {
        await fuzzer.runWorld(world)
      }, long ? 24 * 3_600_000 : 600_000)
      for (const rule of suite.rules) {
        it(`${worldTitle(world)}: ${rule} holds`, () => {
          expect(fuzzer.brokenIn(world).has(rule), `a run of ${world} broke ${rule}`).toBe(false)
        })
      }
    }
    for (const regression of fuzzer.regressions(settings.findings ?? [])) {
      it(regression.name, async () => {
        await fuzzer.replay(regression.world, regression.sequence)
      }, 600_000)
    }
  })
  afterAll(() => log(fuzzer.summary()))
  return fuzzer
}
