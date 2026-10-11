/**
 * Hub matching benchmark: how well Radical Forge's lexical ranking
 * (@radical/common/ai/forge/hubMatches.ts) finds the concepts an architect
 * would expect for each brief in hubMatchingBriefs.ts. `suggested` is what
 * the wizard shows without AI; `candidates` is what the clarify call lets the
 * model pick from, so every expected concept must be among them. The floors
 * sit a little under the measured values: a change that lowers them is a
 * regression; one that raises them should raise the floors too. Tune only on
 * BRIEFS, never on HOLDOUT_BRIEFS.
 */
import { describe, expect, it } from 'vitest'
import { readCatalogue, buildIndex } from '../src/catalogue'
import { forgeHubCandidates } from '@radical/common/ai/forge'
import { HOLDOUT_BRIEFS, BRIEFS } from './hubMatchingBriefs'
import { measure, type Matcher, type Metrics } from './hubMatchingMetrics'

const concepts = buildIndex(readCatalogue())
const metamodel = 'c4-ddd-governance-builtin'
const cache = new Map<string, ReturnType<typeof forgeHubCandidates>>()
const run = (text: string) => {
  if (!cache.has(text)) cache.set(text, forgeHubCandidates(concepts, text, metamodel))
  return cache.get(text)!
}

const matcher: Matcher = {
  suggested: (text, stage) => run(text).stages[stage]?.suggested ?? [],
  // The C4 candidates also carry the blueprint and principle requirements;
  // the benchmark scores patterns and ADRs.
  candidates: (text, stage) => (run(text).stages[stage]?.candidates ?? [])
    .filter((c) => c.category !== 'blueprint' && !(stage === 'c4' && c.category === 'requirement')),
  blueprint: (text) => run(text).blueprint,
}

function report(label: string, m: Metrics & { perBrief: string[] }): void {
  const { perBrief, ...metrics } = m
  console.info(`${label}: ${JSON.stringify(metrics)}\n${perBrief.join('\n')}`)
}

describe('Hub matching benchmark', () => {
  it('finds the expected concepts for the tuning briefs', () => {
    const m = measure(matcher, BRIEFS)
    report('briefs', m)
    expect(m.precision).toBeGreaterThanOrEqual(0.45)
    expect(m.recall).toBeGreaterThanOrEqual(0.52)
    expect(m.recall12).toBeGreaterThanOrEqual(0.8)
    expect(m.recallAll).toBe(1)
    expect(m.blueprint).toBeGreaterThanOrEqual(0.85)
    expect(m.wrongBlueprint).toBe(0)
  })

  it('generalises to briefs it was never tuned on', () => {
    const m = measure(matcher, HOLDOUT_BRIEFS)
    report('holdout', m)
    expect(m.precision).toBeGreaterThanOrEqual(0.35)
    expect(m.recall).toBeGreaterThanOrEqual(0.4)
    expect(m.recall12).toBeGreaterThanOrEqual(0.58)
    expect(m.recallAll).toBe(1)
    // The blueprint threshold prefers none to a wrong one.
    expect(m.blueprint).toBeGreaterThanOrEqual(0.3)
    expect(m.wrongBlueprint).toBe(0)
  })
})
