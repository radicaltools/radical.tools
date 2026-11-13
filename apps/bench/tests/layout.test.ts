// The benchmark in the monorepo (ADR Benchmark in the monorepo, runs off
// git): git ignores the results of runs, and none of the benchmark itself.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const BENCH = fileURLToPath(new URL('..', import.meta.url))

/** The paths of `paths` (from apps/bench) git ignores. */
function ignored(paths: string[]): string[] {
  try {
    return execFileSync('git', ['check-ignore', '--no-index', ...paths], { cwd: BENCH, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch (error) {
    // check-ignore exits 1 when it ignores none of them.
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
}

describe('radical.bench in the monorepo', () => {
  it('keeps the results of runs out of git (Run results stay off git)', () => {
    const results = ['runs/pilot13/sonnet/c/1/po.jsonl', 'runs/pilot13/sonnet-c-1.out', 'results/pilot3-report.md']
    const bench = ['harness/run.mjs', 'systems/shop/hidden/00.md', 'systems/shop/tests/s00.mjs', 'arms/c.md', 'reference/shop/src/server.ts']
    expect(ignored(results)).toEqual(results)
    expect(ignored(bench)).toEqual([])
  })
})
