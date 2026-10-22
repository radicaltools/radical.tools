// ─── Crucible: runs that replay ──────────────────────────────────────────────
//
// A counterexample replays only when the run makes the same choices again:
// the system's random numbers, the ids it makes and its clock must come from
// counters the run resets. These are the pieces a suite wires in.

/** A seeded random number generator (mulberry32): `next` stands in for
 *  Math.random, `reset` starts it again from a seed. */
export function mulberry32(seed = 1): { next: () => number; reset: (seed: number) => void } {
  let state = (seed >>> 0) || 1
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    reset(next: number) {
      state = (next >>> 0) || 1
    },
  }
}

/** UUIDs counted from one ("00000000-0000-4000-8000-000000000001", …), to
 *  stand in for crypto.randomUUID; `reset` counts from one again, `count`
 *  says how many were made since. */
export function sequentialIds(): { next: () => `${string}-${string}-${string}-${string}-${string}`; reset: () => void; count: () => number } {
  let counter = 0
  return {
    next: () => `00000000-0000-4000-8000-${(++counter).toString(16).padStart(12, '0')}`,
    reset() { counter = 0 },
    count: () => counter,
  }
}

/** A d3-timer stand-in whose timers fire only when `tick` is called, 16 ms of
 *  a clock that runs only then: a suite mocks d3-timer with it
 *  (vi.mock('d3-timer', …)) and drives what runs on timers to rest itself. */
export function manualTimers(): {
  timer: (cb: (elapsed: number) => void, delay?: number) => { stop(): void; restart(cb: (elapsed: number) => void, delay?: number): void }
  now: () => number
  tick: () => void
  /** The timers running now. */
  timers: Set<unknown>
} {
  interface ManualTimer { cb: (elapsed: number) => void; t0: number; stop(): void; restart(cb: (elapsed: number) => void, delay?: number): void }
  const timers = new Set<ManualTimer>()
  let clock = 0
  const timer = (cb: (elapsed: number) => void, delay = 0): ManualTimer => {
    const t: ManualTimer = {
      cb,
      t0: clock + delay,
      stop() { timers.delete(t) },
      restart(next, d = 0) { t.cb = next; t.t0 = clock + d; timers.add(t) },
    }
    timers.add(t)
    return t
  }
  return {
    timer,
    now: () => clock,
    tick() {
      clock += 16
      for (const t of [...timers]) if (timers.has(t)) t.cb(clock - t.t0)
    },
    timers,
  }
}
