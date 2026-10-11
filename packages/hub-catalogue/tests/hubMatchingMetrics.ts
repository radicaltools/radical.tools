// Scores a Hub matcher against the benchmark briefs (hubMatchingBriefs.ts).

import type { HubConceptSummary } from '@radical/common/hubFormat'
import { BRIEFS, type Brief } from './hubMatchingBriefs'

export type Stage = 'requirements' | 'fitness' | 'c4'
export const STAGES: Stage[] = ['requirements', 'fitness', 'c4']

export interface Matcher {
  /** What is suggested without AI (the stage card before the model picks). */
  suggested(brief: string, stage: Stage): HubConceptSummary[]
  /** What the model gets to pick from, best first. */
  candidates(brief: string, stage: Stage): HubConceptSummary[]
  blueprint?(brief: string): HubConceptSummary | undefined
}

export interface Metrics {
  /** Share of suggested concepts that are expected (no-AI precision). */
  precision: number
  /** Share of expected concepts among the suggestions. */
  recall: number
  /** Share of expected concepts among the first 12 candidates. */
  recall12: number
  /** Share of expected concepts anywhere in the candidates. */
  recallAll: number
  /** Briefs whose blueprint came first (of those that have one). */
  blueprint: number
  /** Briefs given a blueprint that does not fit them. */
  wrongBlueprint: number
  /** Briefs with no suggestion at all in some stage. */
  empty: number
}

const expected = (b: Brief, stage: Stage): string[] =>
  stage === 'c4' ? b.c4 : stage === 'fitness' ? b.fitness : b.requirements

export function measure(m: Matcher, briefs: Brief[] = BRIEFS): Metrics & { perBrief: string[] } {
  let hits = 0, shown = 0, wanted = 0, hits12 = 0, hitsAll = 0, empty = 0, bp = 0, bpBriefs = 0, wrongBp = 0
  const perBrief: string[] = []
  for (const b of briefs) {
    const line: string[] = [b.name.padEnd(22)]
    let emptyHere = false
    for (const stage of STAGES) {
      const want = new Set(expected(b, stage))
      const sug = m.suggested(b.text, stage).filter((c) => c.category !== 'blueprint' && !(stage === 'c4' && c.category === 'requirement'))
      const cand = m.candidates(b.text, stage).map((c) => c.id)
      const h = sug.filter((c) => want.has(c.id)).length
      hits += h
      shown += sug.length
      wanted += want.size
      hits12 += cand.slice(0, 12).filter((id) => want.has(id)).length
      hitsAll += cand.filter((id) => want.has(id)).length
      if (!sug.length) emptyHere = true
      line.push(`${stage} ${h}/${sug.length}`)
    }
    if (emptyHere) empty++
    const got = m.blueprint?.(b.text)?.id
    if (got && got !== b.blueprint) wrongBp++
    if (b.blueprint) {
      bpBriefs++
      if (got === b.blueprint) bp++
    }
    if (b.blueprint || got) line.push(`bp ${got ?? '-'}`)
    perBrief.push(line.join('  '))
  }
  const r = (n: number, d: number): number => (d ? Math.round((n / d) * 100) / 100 : 0)
  return {
    precision: r(hits, shown),
    recall: r(hits, wanted),
    recall12: r(hits12, wanted),
    recallAll: r(hitsAll, wanted),
    blueprint: r(bp, bpBriefs),
    wrongBlueprint: wrongBp,
    empty,
    perBrief,
  }
}
