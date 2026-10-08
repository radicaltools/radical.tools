/**
 * Opt-in: the second step of Hub matching, the model picking from each
 * stage's candidates in the clarify call, scored on the same briefs as
 * hubMatching.test.ts. It calls the Anthropic API with Studio's clarify model,
 * so it runs only with a key:
 *
 *   HUB_BENCH_ANTHROPIC_KEY=sk-… npx vitest run tests/hubMatchingModel.test.ts -w @radical/hub-catalogue
 *
 * About 60 short calls per run (20 briefs × 3 stages).
 */
import { describe, expect, it } from 'vitest'
import { readCatalogue, buildIndex } from '../src/catalogue'
import { FORGE_STAGES, buildClarifyPrompt, forgeHubCandidates, parseClarifyReply, pickedHubConcepts } from '@radical/common/ai/forge'
import type { HubConceptSummary } from '@radical/common/hubFormat'
import { BRIEFS, HOLDOUT_BRIEFS, type Brief } from './hubMatchingBriefs'
import { STAGES, type Stage } from './hubMatchingMetrics'

const KEY = process.env.HUB_BENCH_ANTHROPIC_KEY
const MODEL = process.env.HUB_BENCH_MODEL ?? 'claude-haiku-4-5'
const concepts = buildIndex(readCatalogue())

async function pick(brief: Brief, stage: Stage): Promise<HubConceptSummary[]> {
  const candidates = forgeHubCandidates(concepts, brief.text, 'c4-ddd-governance-builtin').stages[stage]?.candidates ?? []
  const title = FORGE_STAGES.find((s) => s.id === stage)!.title
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: buildClarifyPrompt(title, brief.text, candidates) }] }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content: Array<{ type: string; text?: string }> }
  const reply = parseClarifyReply(data.content.map((b) => b.text ?? '').join(''))
  return reply ? pickedHubConcepts(reply, candidates).picked : []
}

async function score(briefs: Brief[]): Promise<{ precision: number; recall: number; lines: string[] }> {
  let hits = 0, picked = 0, wanted = 0
  const lines: string[] = []
  for (const brief of briefs) {
    const parts = [brief.name.padEnd(22)]
    for (const stage of STAGES) {
      const want = new Set(stage === 'c4' ? brief.c4 : stage === 'fitness' ? brief.fitness : brief.requirements)
      // Blueprints and principle requirements are fair picks for C4 but not scored.
      const got = (await pick(brief, stage)).filter((c) => c.category !== 'blueprint' && !(stage === 'c4' && c.category === 'requirement'))
      const h = got.filter((c) => want.has(c.id)).length
      hits += h
      picked += got.length
      wanted += want.size
      parts.push(`${stage} ${h}/${got.length}`)
    }
    lines.push(parts.join('  '))
  }
  const r = (n: number, d: number): number => (d ? Math.round((n / d) * 100) / 100 : 0)
  return { precision: r(hits, picked), recall: r(hits, wanted), lines }
}

describe.skipIf(!KEY)('Hub matching benchmark: the model\'s pick', () => {
  for (const [label, briefs] of [['briefs', BRIEFS], ['holdout', HOLDOUT_BRIEFS]] as const) {
    it(`picks the expected concepts (${label})`, async () => {
      const { precision, recall, lines } = await score(briefs)
      console.info(`${label} (${MODEL}): precision ${precision}, recall ${recall}\n${lines.join('\n')}`)
      expect(precision).toBeGreaterThan(0)
    }, 300_000)
  }
})
