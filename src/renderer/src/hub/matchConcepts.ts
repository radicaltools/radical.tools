// ─── Hub concept relevance search ───────────────────────────────────────────
// Plain keyword-overlap scoring over the already-loaded catalogue summaries
// (`hub/index.json`, via useHubStore) — no embeddings infra exists, and
// hubStore's own browse search is already substring-based, so this matches
// that simplicity. Used by Radical Forge to surface prior art from the Hub
// and to ground the AI's own generation in it (see ai/forgePrompts.ts).

import type { HubCategory, HubConceptSummary } from '../store/hubStore'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new',
  'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put',
  'say', 'she', 'too', 'use', 'that', 'with', 'this', 'from', 'they', 'have',
  'will', 'your', 'when', 'what', 'which', 'their', 'system', 'systems',
  'users', 'user', 'application', 'app', 'into', 'each', 'then', 'than',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  )
}

/** Overlap-based relevance score — tag matches count double (curated
 *  keywords are a stronger signal than prose overlap). */
export function scoreConceptRelevance(queryTokens: Set<string>, concept: HubConceptSummary): number {
  let score = 0
  for (const t of tokenize(`${concept.name} ${concept.description}`)) {
    if (queryTokens.has(t)) score += 1
  }
  for (const tag of concept.tags) {
    if (queryTokens.has(tag.toLowerCase())) score += 2
  }
  return score
}

/** Top `limit` catalogue concepts relevant to `queryText`, restricted to
 *  `categories` and to concepts compatible with `activeMetamodelId` (skips
 *  concepts authored for a different custom metamodel). Returns [] when
 *  nothing scores above zero. */
export function findRelevantConcepts(
  concepts: HubConceptSummary[],
  categories: HubCategory | HubCategory[],
  queryText: string,
  activeMetamodelId: string | undefined,
  limit = 4,
): HubConceptSummary[] {
  const cats = new Set(Array.isArray(categories) ? categories : [categories])
  const queryTokens = tokenize(queryText)
  if (queryTokens.size === 0) return []

  return concepts
    .filter((c) => cats.has(c.category))
    .filter((c) => !c.requiredMetamodel || c.requiredMetamodel === activeMetamodelId)
    .map((c) => ({ concept: c, score: scoreConceptRelevance(queryTokens, c) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.concept)
}
