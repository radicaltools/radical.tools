// ─── Hub concept relevance search ───────────────────────────────────────────
// Plain keyword-overlap scoring over the catalogue summaries (`hub/index.json`,
// via Studio's useHubStore or the MCP server's bundled copy) — no embeddings
// infra exists, and hubStore's own browse search is already substring-based,
// so this matches that simplicity. Used by Radical Forge to surface prior art
// from the Hub and to ground the AI's own generation in it (see ./prompts.ts).

import type { HubCategory, HubConceptSummary } from '../../hubFormat'
import { FORGE_STAGES, type ForgeStageId } from './prompts'

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

/** Hub categories worth surfacing as prior art for each stage — the C4 stage
 *  is where decomposition/coupling guidance (patterns, ADRs) matters most.
 *  `scenarios` has no matching Hub category (no Gherkin content there). */
const HUB_CATEGORIES_FOR_STAGE: Partial<Record<ForgeStageId, HubCategory[]>> = {
  requirements: ['requirement'],
  c4: ['pattern', 'adr'],
  fitness: ['fitness-function'],
}

/** Requirements tagged this way are generic, domain-agnostic engineering
 *  tenets (idempotency, least privilege, resource isolation, ...) rather
 *  than product-specific behaviour — a "principle" is modeled as a kind of
 *  requirement (a tag), not a new concept type. The C4 stage treats them as
 *  decomposition guidance alongside patterns/ADRs. */
const PRINCIPLE_TAG = 'principle'
const PRINCIPLE_MATCH_LIMIT = 2

/** The Hub suggestions of every Forge stage for one description — what the
 *  wizard shows on each stage card and what the stage prompt is given. */
export function forgeHubMatches(
  concepts: HubConceptSummary[],
  description: string,
  activeMetamodelId: string | undefined,
): Partial<Record<ForgeStageId, HubConceptSummary[]>> {
  const out: Partial<Record<ForgeStageId, HubConceptSummary[]>> = {}
  if (!description.trim()) return out
  for (const stage of FORGE_STAGES) {
    const categories = HUB_CATEGORIES_FOR_STAGE[stage.id]
    if (categories) out[stage.id] = findRelevantConcepts(concepts, categories, description, activeMetamodelId)
  }
  // Decomposition guidance for the C4 stage also draws on "principle"-tagged
  // requirements (see PRINCIPLE_TAG above) — searched separately so they
  // don't get crowded out by the (much larger) pattern/adr pool.
  const principleReqs = concepts.filter((c) => c.category === 'requirement' && c.tags.includes(PRINCIPLE_TAG))
  const principleMatches = findRelevantConcepts(principleReqs, 'requirement', description, activeMetamodelId, PRINCIPLE_MATCH_LIMIT)
  if (principleMatches.length) out.c4 = [...(out.c4 ?? []), ...principleMatches]
  return out
}
