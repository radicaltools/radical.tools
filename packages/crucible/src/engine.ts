// ─── Crucible: running a fuzz suite ──────────────────────────────────────────
//
// A fuzz suite says what can be done to a system (its actions, as a
// fast-check arbitrary), the worlds it starts from with their CI plans, and how
// one run goes: start, a step per action that does it and checks the rules
// (throwing RuleBroken through the context), end. The Fuzzer runs a world as a
// fast-check property over sequences of actions: a plan's seed, runs and
// longest sequence, or a path to replay; a failure shrinks to the shortest
// sequence that breaks the rule, unless a known entry describes it. Survey mode
// reports each new signature once and goes on, to find many failures in one run.

import fc from 'fast-check'
import { RuleBroken, type Action, type Violation } from './violation'
import { knownMatches, signatureOf, type Known } from './signature'
import { findingTestName, type Finding } from './findings'

/** How a world runs in CI: fixed, so every run of CI sees the same sequences. */
export interface Plan {
  seed: number
  runs: number
  /** The longest sequence of actions. */
  maxLength: number
}

/** What a run of the suite is asked for, from the FUZZ_* settings. */
export interface FuzzOptions {
  /** ci: each world's plan; night: a random seed and 2000 runs of each world. */
  plan: 'ci' | 'night'
  runs?: number
  seed?: number
  /** Run this world only. */
  world?: string
  /** A counterexample's path to replay (with the seed and length it was found with). */
  path?: string
  /** The longest sequence, in place of the plan's. */
  length?: number
  /** Report each failure, take its signature as known, and go on. */
  survey: boolean
  /** Where survey mode appends its reports (else they are logged). */
  surveyFile?: string
  /** Where survey mode appends one JSON line per failure, for findings. */
  findingsFile?: string
  /** Known entries filter nothing (to see whether one still happens). */
  noKnown: boolean
  /** Report the first failure as found, without shrinking it. */
  noShrink: boolean
  /** The runs before this one pass without running. */
  from: number
}

/** The FUZZ_* settings: FUZZ_PLAN (ci or night), FUZZ_RUNS, FUZZ_SEED,
 *  FUZZ_WORLD (or FUZZ_MODEL), FUZZ_PATH, FUZZ_LENGTH, FUZZ_SURVEY (1, or the
 *  file to report into), FUZZ_FINDINGS, FUZZ_NO_KNOWN, FUZZ_NO_SHRINK, FUZZ_FROM. */
export function fuzzOptionsFromEnv(env: Record<string, string | undefined>): FuzzOptions {
  const num = (v: string | undefined) => (v ? Number(v) : undefined)
  return {
    plan: env.FUZZ_PLAN === 'night' ? 'night' : 'ci',
    runs: num(env.FUZZ_RUNS),
    seed: num(env.FUZZ_SEED),
    world: env.FUZZ_WORLD || env.FUZZ_MODEL || undefined,
    path: env.FUZZ_PATH || undefined,
    length: num(env.FUZZ_LENGTH),
    survey: !!env.FUZZ_SURVEY,
    surveyFile: env.FUZZ_SURVEY && env.FUZZ_SURVEY !== '1' ? env.FUZZ_SURVEY : undefined,
    findingsFile: env.FUZZ_FINDINGS || undefined,
    noKnown: !!env.FUZZ_NO_KNOWN,
    noShrink: !!env.FUZZ_NO_SHRINK,
    from: num(env.FUZZ_FROM) ?? 0,
  }
}

/** What a step reads and writes of its run: the steps recorded so far, and how
 *  to fail or ask whether a violation is known. */
export interface RunContext<A extends Action> {
  readonly world: string
  /** The actions done so far; a step adds its own. */
  readonly actions: A[]
  /** What each action did, as resolved; a step adds its own. */
  readonly trace: string[]
  /** Ends the run: the rule is broken. */
  fail(violation: Violation): never
  /** The known entry that describes `violation` (its hit counted), for a step
   *  that goes on past a known failure; undefined when none does. */
  known(violation: Violation): Known<A> | undefined
}

export interface FuzzSuite<A extends Action, P = unknown, R = unknown> {
  /** The suite's name, in its summary and its findings. */
  name: string
  /** The fuzz file, as findings name it (from the repository's top). */
  file?: string
  /** Every rule a step checks: each gets a test case per world. */
  rules: readonly string[]
  actions: fc.Arbitrary<A>
  /** The worlds a run starts from, with their CI plans. */
  worlds: Readonly<Record<string, Plan>>
  /** Once per world, before its runs. */
  prepare(world: string): Promise<P> | P
  /** The start of one run. */
  start(world: string, prepared: P, context: RunContext<A>): Promise<R> | R
  /** One action and the checks after it; fails through the context. */
  step(run: R, action: A, context: RunContext<A>): Promise<void> | void
  /** The end of one run, failed or not. */
  end?(run: R, context: RunContext<A>): Promise<void> | void
  known?: readonly Known<A>[]
  /** Keys whose next path segment is an id, for signatures (see pathShape). */
  idKeys?: readonly string[]
  /** Whether a step, as resolved, found nothing to act on (counted apart). */
  isNoOp?(resolved: string): boolean
  /** An action for a report (default: its kind and arguments). */
  describe?(action: A): string
}

/** One failure a survey found, as a JSON line of the findings file. */
export interface SurveyRecord {
  suite: string
  file?: string
  world: string
  rule: string
  signature: string
  seed: number
  path?: string
  length: number
  /** The actions of the shrunk sequence, for a report. */
  actions: string[]
  /** The same actions as data, for the finding's test to replay. */
  sequence: unknown[]
  /** What each did, as resolved. */
  steps: string[]
  detail: string
}

/** Appends to a file. node:fs is loaded only when a survey writes one, so
 *  that a suite in a browser package typechecks without Node's types. */
async function appendFile(file: string, text: string): Promise<void> {
  const fs = (await import('node:fs' as string)) as { appendFileSync(file: string, text: string): void }
  fs.appendFileSync(file, text)
}

/** An action as "{ a: 'add', parent: 3 }". */
export function showAction(action: Action): string {
  const { a, ...args } = action as Action & Record<string, unknown>
  const list = Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  return `{ a: '${a}'${list ? `, ${list}` : ''} }`
}

/** A finding of the suite's file replayed as a test case. */
export interface Regression<A extends Action> {
  /** "<id> stays fixed: <title>". */
  name: string
  world: string
  sequence: A[]
}

/** The failures a world's runs ended in, by rule. */
export interface WorldResult {
  world: string
  seed: number
  runs: number
  /** Rules broken outside the known failures. */
  broken: Set<string>
}

export class Fuzzer<A extends Action, P = unknown, R = unknown> {
  readonly stats = { runs: 0, steps: 0, noOps: 0 }
  /** Hits per known entry. */
  readonly knownHits = new Map<Known<A>, number>()
  private readonly broken = new Map<string, Set<string>>()
  private readonly surveySkip = new Set<string>()
  private readonly seeds = new Map<string, number>()
  private readonly prepared = new Map<string, Promise<P>>()
  private runIndex = 0

  constructor(readonly suite: FuzzSuite<A, P, R>, readonly options: FuzzOptions) {}

  /** The worlds this run covers (all, or the one asked for). */
  worlds(): string[] {
    return Object.keys(this.suite.worlds).filter((w) => !this.options.world || this.options.world === w)
  }

  /** The rules a world's runs broke outside the known failures. */
  brokenIn(world: string): ReadonlySet<string> {
    return this.broken.get(world) ?? new Set()
  }

  /** The seed a world runs with: the one asked for, a random one at night,
   *  else its plan's. */
  seedOf(world: string): number {
    let seed = this.seeds.get(world)
    if (seed === undefined) {
      seed = this.options.seed ?? (this.options.plan === 'night' ? Date.now() % 2 ** 31 : this.suite.worlds[world].seed)
      this.seeds.set(world, seed)
    }
    return seed
  }

  /** Runs one world as a property; throws fast-check's report when a rule is
   *  broken outside the known failures (in survey mode, only when a failure
   *  is not a broken rule). */
  async runWorld(world: string): Promise<WorldResult> {
    const plan = this.suite.worlds[world]
    if (!plan) throw new Error(`${this.suite.name} has no world ${world}`)
    const prepared = await this.suite.prepare(world)
    const length = this.options.length ?? plan.maxLength
    const property = fc.asyncProperty(fc.array(this.suite.actions, { minLength: 1, maxLength: length, size: 'max' }), async (actions) => {
      await this.runSequence(world, prepared, actions)
    })
    const seed = this.seedOf(world)
    const runs = this.options.runs ?? (this.options.plan === 'night' ? 2000 : plan.runs)
    const parameters = { seed, numRuns: runs, ...(this.options.path ? { path: this.options.path } : {}), verbose: 1 as const, endOnFailure: this.options.noShrink }
    const broken = this.broken.get(world) ?? new Set<string>()
    this.broken.set(world, broken)
    if (!this.options.survey) {
      const result = await fc.check(property, parameters)
      if (result.failed) {
        const e = result.errorInstance
        if (e instanceof RuleBroken) broken.add(e.violation.rule)
        // fast-check's report (seed, path, the shrunk counterexample), then
        // what broke: the rule, what differs and the steps as resolved.
        const report = `${fc.defaultReportMessage(result) ?? 'The property failed.'}\nGot error: ${e instanceof Error ? e.message : String(e)}`
        throw Object.assign(new Error(report), { cause: e })
      }
      return { world, seed, runs, broken }
    }
    // Survey: report each failure, then go on with its signature taken as
    // known, to find the others in one go.
    for (let round = 0; round < 25; round++) {
      const result = await fc.check(property, parameters)
      if (!result.failed) break
      const e = result.errorInstance
      const report = `\n===== SURVEY ${world} #${round + 1}\n${fc.defaultReportMessage(result)}\n${(e as Error | undefined)?.message ?? ''}\n`
      if (this.options.surveyFile) await appendFile(this.options.surveyFile, report)
      else console.log(report)
      if (!(e instanceof RuleBroken)) break
      const signature = signatureOf(e.violation, e.actions[e.actions.length - 1]?.a, this.suite.idKeys)
      broken.add(e.violation.rule)
      this.surveySkip.add(signature)
      if (this.options.findingsFile) {
        const record: SurveyRecord = {
          suite: this.suite.name,
          ...(this.suite.file ? { file: this.suite.file } : {}),
          world,
          rule: e.violation.rule,
          signature,
          seed: result.seed,
          ...(result.counterexamplePath ? { path: result.counterexamplePath } : {}),
          length,
          actions: (e.actions as A[]).map((a) => (this.suite.describe ?? showAction)(a)),
          sequence: JSON.parse(JSON.stringify(e.actions)) as unknown[],
          steps: [...e.trace],
          detail: e.violation.detail,
        }
        await appendFile(this.options.findingsFile, JSON.stringify(record) + '\n')
      }
    }
    return { world, seed, runs, broken }
  }

  /** A case for each hardened or fixed finding of the suite's file that has
   *  a sequence to replay in one of its worlds. */
  regressions(findings: readonly Finding[]): Regression<A>[] {
    return findings
      .filter((f) => f.file === this.suite.file && (f.status === 'hardened' || f.status === 'fixed') && Array.isArray(f.sequence) && !!f.world && !!this.suite.worlds[f.world])
      .map((f) => ({ name: findingTestName(f), world: f.world!, sequence: f.sequence as A[] }))
  }

  /** Runs one sequence in a world once, as a test: no fast-check, no known
   *  failures; throws RuleBroken when a rule breaks. */
  async replay(world: string, sequence: A[]): Promise<void> {
    if (!this.suite.worlds[world]) throw new Error(`${this.suite.name} has no world ${world}`)
    let prepared = this.prepared.get(world)
    if (!prepared) {
      prepared = Promise.resolve(this.suite.prepare(world))
      this.prepared.set(world, prepared)
    }
    await this.runSequence(world, await prepared, sequence, { known: false })
  }

  private async runSequence(world: string, prepared: P, actions: A[], how: { known: boolean } = { known: true }): Promise<void> {
    if (how.known && ++this.runIndex < this.options.from) return
    const context = this.context(world, how.known)
    const run = await this.suite.start(world, prepared, context)
    try {
      this.stats.runs++
      for (const action of actions) {
        await this.suite.step(run, action, context)
        this.stats.steps++
        if (this.suite.isNoOp?.(context.trace[context.trace.length - 1] ?? '')) this.stats.noOps++
      }
    } catch (e) {
      if (e instanceof RuleBroken && how.known) {
        const known = this.knownFor(e.violation, e.actions as A[], e.trace)
        if (known) return
        if (this.surveySkip.has(signatureOf(e.violation, e.actions[e.actions.length - 1]?.a, this.suite.idKeys))) return
        e.message = `${world}: ${e.message}`
      } else if (e instanceof RuleBroken) {
        e.message = `${world}: ${e.message}`
      }
      throw e
    } finally {
      await this.suite.end?.(run, context)
    }
  }

  private context(world: string, known = true): RunContext<A> {
    const actions: A[] = []
    const trace: string[] = []
    return {
      world,
      actions,
      trace,
      fail: (violation) => {
        throw new RuleBroken(violation, trace, [...actions])
      },
      known: (violation) => (known ? this.knownFor(violation, actions, trace) : undefined),
    }
  }

  /** The known entry that describes the violation, its hit counted. */
  private knownFor(violation: Violation, actions: readonly A[], trace: readonly string[]): Known<A> | undefined {
    if (this.options.noKnown) return undefined
    const known = this.suite.known?.find((k) => knownMatches(k, { actions, violation, trace }))
    if (known) this.knownHits.set(known, (this.knownHits.get(known) ?? 0) + 1)
    return known
  }

  /** The summary of what ran: runs, steps, the seeds, the known entries hit
   *  and those no run hit. */
  summary(): string {
    const lines = [`${this.suite.name}: ${this.stats.runs} runs, ${this.stats.steps} steps (${this.stats.noOps} found nothing to act on)`]
    if (this.seeds.size) lines.push(`seeds: ${[...this.seeds].map(([w, s]) => `${w} ${s}`).join(', ')}`)
    if (this.knownHits.size) lines.push(`known violations hit: ${[...this.knownHits].map(([k, n]) => `${n}× ${k.note}`).join('; ')}`)
    const unhit = (this.suite.known ?? []).filter((k) => !this.knownHits.has(k))
    if (unhit.length && !this.options.noKnown) lines.push(`known entries no run hit: ${unhit.map((k) => k.note).join('; ')}`)
    return lines.join('\n')
  }
}
