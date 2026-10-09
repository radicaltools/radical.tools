// ─── Hub concept relevance search ───────────────────────────────────────────
// Which Hub catalogue concepts (hub/index.json, via Studio's useHubStore or
// the MCP server's bundled copy) a Forge run should consider, per stage.
//
// Two steps. A lexical ranking, here, with no model and no embeddings: terms
// are weighted by how rare they are in the catalogue (IDF) and by where they
// occur (name and tags over description over node content), words are
// stemmed lightly and folded into synonym groups ("shopper", "checkout" and
// "e-commerce" meet in one), and the blueprint that fits the description
// lifts the concepts it links to (hubRefs), as do the stage's best matches.
// Its top few are what the wizard suggests without AI. The second step is
// the model's: the clarify call (./clarify.ts) gets the stage's ranked
// candidates and picks the ones that fit, which also covers descriptions in
// other languages that no word list matches.
//
// hubMatching.test.ts in @radical/hub-catalogue measures both against
// benchmark briefs; change the weights there, not by feel.

import type { HubCategory, HubConceptSummary } from '../../hubFormat'
import { FORGE_STAGES, type ForgeStageId } from './prompts'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new',
  'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put',
  'say', 'she', 'too', 'use', 'that', 'with', 'this', 'from', 'they', 'have',
  'will', 'your', 'when', 'what', 'which', 'their', 'system', 'systems',
  'users', 'user', 'application', 'app', 'into', 'each', 'then', 'than',
  'must', 'should', 'every', 'within', 'them', 'some', 'other', 'more', 'only',
  'any', 'also', 'once', 'own', 'after', 'before', 'there', 'where',
  'shall', 'while', 'keep', 'keeps', 'make', 'made', 'many', 'same', 'such',
])

/** Words that mean the same thing for matching, folded into one group term
 *  on both sides. Ambiguous words ("store": a shop or a data store) stay out. */
const SYNONYM_GROUPS: Record<string, string[]> = {
  commerce: ['shop', 'shopping', 'shopper', 'ecommerce', 'commerce', 'retail', 'storefront', 'checkout', 'cart', 'basket', 'product', 'merchant'],
  payment: ['pay', 'payment', 'card', 'billing', 'invoice', 'wallet', 'refund', 'commission', 'payout'],
  fintech: ['bank', 'banking', 'fintech', 'ledger', 'transfer', 'balance', 'psd2', 'reconciliation', 'double-entry'],
  authentication: ['login', 'signin', 'sso', 'oauth', 'oidc', 'password', 'biometric', 'authentication', 'mfa', 'two-factor', '2fa', 'identity'],
  tenancy: ['tenant', 'multitenant', 'multi-tenant', 'multi-tenancy', 'saas', 'b2b'],
  ai: ['llm', 'chatbot', 'assistant', 'gpt', 'rag', 'genai', 'agentic'],
  realtime: ['realtime', 'real-time', 'live', 'collaborative', 'collaboration', 'presence', 'websocket', 'whiteboard', 'crdt', 'offline'],
  marketplace: ['marketplace', 'seller', 'vendor', 'buyer', 'two-sided'],
  analytics: ['analytics', 'analyst', 'dashboard', 'report', 'reporting', 'warehouse', 'lake', 'lakehouse', 'etl', 'nightly'],
  privacy: ['gdpr', 'privacy', 'personal', 'pii', 'hipaa', 'erasure', 'consent'],
  legacy: ['legacy', 'mainframe', 'migration', 'migrate', 'modernise', 'modernize', 'monolith', 'replace'],
  events: ['event', 'kafka', 'broker', 'stream', 'streaming', 'asynchronous', 'messaging', 'telemetry', 'sensor'],
  scale: ['peak', 'spike', 'throughput', 'burst', 'autoscaling', 'black', 'friday', 'per-second', 'capacity'],
  delivery: ['deploy', 'deployment', 'release', 'ci-cd', 'pipeline', 'downtime'],
  observability: ['observability', 'monitoring', 'logs', 'logging', 'tracing', 'traces', 'metrics', 'alert', 'alerting'],
  api: ['api', 'rest', 'graphql', 'openapi', 'partner', 'sdk', 'contract', 'integration'],
  accessibility: ['accessibility', 'wcag', 'a11y', 'screen-reader', 'reader'],
  security: ['security', 'secure', 'encryption', 'encrypted', 'encrypt', 'owasp', 'vulnerability', 'fraud'],
  audit: ['audit', 'auditing', 'logged'],
}

const strip = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const SUFFIXES = [['ations', ''], ['ation', ''], ['ments', ''], ['ment', ''], ['ings', ''], ['ing', ''], ['ities', ''], ['ity', ''], ['ies', 'y'], ['ers', ''], ['er', ''], ['ed', ''], ['es', ''], ['s', '']] as const

/** A light English stemmer: enough to meet "reserve"/"reservation" and
 *  "payments"/"pay", not a linguistic one. */
function stem(word: string): string {
  for (const [suffix, replacement] of SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) return word.slice(0, -suffix.length) + replacement
  }
  return word
}

const GROUP_OF = new Map<string, string>()
for (const [group, members] of Object.entries(SYNONYM_GROUPS)) {
  for (const member of members) {
    for (const form of [member, member.replace(/-/g, '')]) {
      GROUP_OF.set(form, `#${group}`)
      GROUP_OF.set(stem(form), `#${group}`)
    }
  }
}

/** The matching terms of a text: stems plus the synonym groups they are in.
 *  Hyphenated words count whole ("e-commerce" → "ecommerce") and in parts. */
export function matchTerms(text: string): Set<string> {
  const out = new Set<string>()
  const add = (raw: string): void => {
    const group = GROUP_OF.get(raw) ?? GROUP_OF.get(stem(raw))
    if (group) out.add(group)
    if (raw.length >= 3 && !STOPWORDS.has(raw)) out.add(stem(raw))
  }
  for (const chunk of strip(text).split(/[^a-z0-9-]+/)) {
    if (!chunk.replace(/-/g, '')) continue
    add(chunk.replace(/-/g, ''))
    if (chunk.includes('-')) {
      if (GROUP_OF.has(chunk)) out.add(GROUP_OF.get(chunk)!)
      for (const part of chunk.split('-')) if (part) add(part)
    }
  }
  return out
}

/** How much a term counts by where it occurs in a concept. */
const FIELD_WEIGHTS = { name: 3, tags: 3, description: 1.5, content: 1 } as const

interface IndexedConcept {
  concept: HubConceptSummary
  /** Term → its weight in this concept (the best field it occurs in). */
  terms: Map<string, number>
}

interface CatalogueIndex {
  docs: Map<string, IndexedConcept>
  idf: Map<string, number>
}

const indexes = new WeakMap<HubConceptSummary[], CatalogueIndex>()

function indexCatalogue(concepts: HubConceptSummary[]): CatalogueIndex {
  const cached = indexes.get(concepts)
  if (cached) return cached
  const docs = new Map<string, IndexedConcept>()
  const df = new Map<string, number>()
  for (const concept of concepts) {
    const terms = new Map<string, number>()
    const put = (text: string | undefined, weight: number): void => {
      for (const term of matchTerms(text ?? '')) terms.set(term, Math.max(terms.get(term) ?? 0, weight))
    }
    put(concept.searchText, FIELD_WEIGHTS.content)
    put(concept.description, FIELD_WEIGHTS.description)
    put(concept.tags.join(' '), FIELD_WEIGHTS.tags)
    put(concept.name, FIELD_WEIGHTS.name)
    docs.set(concept.id, { concept, terms })
    for (const term of terms.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = concepts.length
  const idf = new Map([...df].map(([term, count]) => [term, Math.log(1 + n / count)]))
  const index = { docs, idf }
  indexes.set(concepts, index)
  return index
}

/** Relevance of one concept of `concepts` to a query's terms: each shared
 *  term counts its rarity in the catalogue times its weight in the concept. */
export function scoreConceptRelevance(queryTerms: Set<string>, concept: HubConceptSummary, concepts: HubConceptSummary[] = [concept]): number {
  const index = indexCatalogue(concepts)
  const doc = index.docs.get(concept.id) ?? indexCatalogue([concept]).docs.get(concept.id)!
  let score = 0
  for (const term of queryTerms) {
    const weight = doc.terms.get(term)
    if (weight) score += weight * (index.idf.get(term) ?? 1)
  }
  return score
}

interface Ranked {
  concept: HubConceptSummary
  score: number
}

const usable = (c: HubConceptSummary, metamodelId: string | undefined): boolean =>
  !c.requiredMetamodel || c.requiredMetamodel === metamodelId

const byScore = (a: Ranked, b: Ranked): number => b.score - a.score || a.concept.name.localeCompare(b.concept.name)

function rank(
  concepts: HubConceptSummary[], categories: HubCategory[], queryTerms: Set<string>, metamodelId: string | undefined,
  filter: (c: HubConceptSummary) => boolean = () => true,
): Ranked[] {
  const cats = new Set(categories)
  return concepts
    .filter((c) => cats.has(c.category) && usable(c, metamodelId) && filter(c))
    .map((concept) => ({ concept, score: scoreConceptRelevance(queryTerms, concept, concepts) }))
    .sort(byScore)
}

/** A suggestion must score at least this, and this share of the stage's best. */
const MIN_SCORE = 4
const MIN_SHARE_OF_BEST = 0.4
const SUGGESTED_LIMIT = 4
/** The model sees at most this many candidates per stage. */
export const CANDIDATE_LIMIT = 60

function suggestions(ranked: Ranked[], limit: number): HubConceptSummary[] {
  const best = ranked[0]?.score ?? 0
  return ranked
    .filter((r) => r.score >= MIN_SCORE && r.score >= best * MIN_SHARE_OF_BEST)
    .slice(0, limit)
    .map((r) => r.concept)
}

/** Top `limit` catalogue concepts relevant to `queryText`, restricted to
 *  `categories` and to concepts compatible with `activeMetamodelId` (skips
 *  concepts authored for a different custom metamodel). Returns [] when
 *  nothing is relevant enough. */
export function findRelevantConcepts(
  concepts: HubConceptSummary[],
  categories: HubCategory | HubCategory[],
  queryText: string,
  activeMetamodelId: string | undefined,
  limit = SUGGESTED_LIMIT,
): HubConceptSummary[] {
  const terms = matchTerms(queryText)
  if (!terms.size) return []
  return suggestions(rank(concepts, Array.isArray(categories) ? categories : [categories], terms, activeMetamodelId), limit)
}

/** A blueprint must score this, and this many times the runner-up: a wrong
 *  blueprint lifts the wrong concepts in every stage, so it errs on the side
 *  of none (the model can still pick one from the C4 candidates). */
const BLUEPRINT_MIN_SCORE = 25
const BLUEPRINT_LEAD = 1.3

/** The blueprint that fits the description, when one clearly does. */
export function matchBlueprint(
  concepts: HubConceptSummary[], description: string, activeMetamodelId: string | undefined,
): HubConceptSummary | undefined {
  const [first, second] = rank(concepts, ['blueprint'], matchTerms(description), activeMetamodelId)
  if (!first || first.score < BLUEPRINT_MIN_SCORE) return undefined
  if (second && first.score < second.score * BLUEPRINT_LEAD) return undefined
  return first.concept
}

/** Hub categories worth surfacing as prior art for each stage — the C4 stage
 *  is where decomposition/coupling guidance (patterns, ADRs) matters most.
 *  `scenarios`, `states` and `mockups` have no matching Hub category. */
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

/** A concept the fitting blueprint links to gains this share of the stage's
 *  best score; one a top match of the stage links to, the second. */
const BLUEPRINT_BOOST = 0.6
const NEIGHBOUR_BOOST = 0.25
const NEIGHBOUR_SOURCES = 2

/** Adds the blueprint's and the best matches' links to the ranking. */
function boost(ranked: Ranked[], blueprint: HubConceptSummary | undefined): Ranked[] {
  const best = ranked[0]?.score ?? 0
  if (!best) return ranked
  const fromBlueprint = new Set(blueprint?.hubRefs ?? [])
  const fromNeighbours = new Set(ranked.slice(0, NEIGHBOUR_SOURCES).flatMap((r) => r.concept.hubRefs ?? []))
  return ranked
    .map((r) => ({
      concept: r.concept,
      score: r.score
        + (fromBlueprint.has(r.concept.id) ? best * BLUEPRINT_BOOST : 0)
        + (fromNeighbours.has(r.concept.id) ? best * NEIGHBOUR_BOOST : 0),
    }))
    .sort(byScore)
}

export interface StageHubMatches {
  /** The best few: shown before (or without) the model's pick, and applied
   *  when nobody picks. */
  suggested: HubConceptSummary[]
  /** Everything the model may pick from for this stage, best first. */
  candidates: HubConceptSummary[]
}

export interface ForgeHubCandidates {
  /** The blueprint that fits the whole description, if one clearly does. */
  blueprint?: HubConceptSummary
  stages: Partial<Record<ForgeStageId, StageHubMatches>>
}

/** Every stage's Hub suggestions and candidates for one description. */
export function forgeHubCandidates(
  concepts: HubConceptSummary[],
  description: string,
  activeMetamodelId: string | undefined,
): ForgeHubCandidates {
  const out: ForgeHubCandidates = { stages: {} }
  if (!description.trim()) return out
  const terms = matchTerms(description)
  const blueprint = matchBlueprint(concepts, description, activeMetamodelId)
  if (blueprint) out.blueprint = blueprint
  for (const stage of FORGE_STAGES) {
    const categories = HUB_CATEGORIES_FOR_STAGE[stage.id]
    if (!categories) continue
    const ranked = boost(rank(concepts, categories, terms, activeMetamodelId), blueprint)
    const suggested = suggestions(ranked, SUGGESTED_LIMIT)
    const candidates = ranked.slice(0, CANDIDATE_LIMIT).map((r) => r.concept)
    if (stage.id === 'c4') {
      // Decomposition guidance also draws on "principle"-tagged requirements,
      // ranked apart so the (much larger) pattern/ADR pool doesn't crowd them
      // out. Blueprints, to import as a skeleton, come first: the fitting one
      // suggested, all of them (a handful) for the model to pick from.
      const principles = boost(rank(concepts, ['requirement'], terms, activeMetamodelId, (c) => c.tags.includes(PRINCIPLE_TAG)), blueprint)
      suggested.push(...suggestions(principles, PRINCIPLE_MATCH_LIMIT))
      candidates.push(...principles.slice(0, CANDIDATE_LIMIT / 3).map((r) => r.concept))
      const blueprints = rank(concepts, ['blueprint'], terms, activeMetamodelId).map((r) => r.concept)
      candidates.unshift(...(blueprint ? [blueprint, ...blueprints.filter((b) => b !== blueprint)] : blueprints))
      if (blueprint) suggested.unshift(blueprint)
    }
    out.stages[stage.id] = { suggested, candidates }
  }
  return out
}

/** The suggested Hub concepts of every Forge stage — what the wizard shows on
 *  each stage card until the model has picked. */
export function forgeHubMatches(
  concepts: HubConceptSummary[],
  description: string,
  activeMetamodelId: string | undefined,
): Partial<Record<ForgeStageId, HubConceptSummary[]>> {
  const { stages } = forgeHubCandidates(concepts, description, activeMetamodelId)
  return Object.fromEntries(Object.entries(stages).map(([id, m]) => [id, m!.suggested]))
}
