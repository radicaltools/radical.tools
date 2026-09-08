import { create } from 'zustand'
import {
  HUB_INDEX_FILE,
  docToConcept,
  type HubConcept,
  type HubConceptSummary,
  type HubRadicalDoc,
  type TemplateParam,
} from '../hub/hubFormat'

export type { HubConcept, HubConceptMeta, HubConceptSummary, HubCategory, TemplateParam } from '../hub/hubFormat'

// ─── Hub catalogue ───────────────────────────────────────────────────────────
//
// `hub/index.json` lists concept summaries; each concept is a Radical Studio
// document at `hub/<category>/<id>.radical` fetched on demand (see hubFormat.ts).

/**
 * Persisted record of a hub concept import that used template parameters.
 * Stored in the diagram so the user can reconfigure values later.
 */
export interface HubImportRecord {
  conceptId: string
  conceptName: string
  templateParams: TemplateParam[]
  /** Current substitution values (may change on reconfigure). */
  paramValues: Record<string, string>
  /** New node IDs (UUIDs) that were created by this import. */
  nodeIds: string[]
  /**
   * Original template nodes keyed by new node UUID.
   * Contains the {{TOKEN}} placeholders before substitution.
   * Positions (x/y/width/height) are excluded — they are user-managed.
   */
  originalNodes: Record<string, Record<string, unknown>>
  /**
   * Per-node template params keyed by new node UUID.
   * Derived from node-level templateParams at import time.
   * Used by RightPanel to show only the params relevant to a given node.
   */
  nodeParams?: Record<string, TemplateParam[]>
}

// ─── Store types ────────────────────────────────────────────────────────────

interface HubState {
  concepts: HubConceptSummary[]
  /** Fully loaded concepts keyed by id. */
  loaded: Record<string, HubConcept>
  loading: boolean
  error: string | null
  lastFetched: number | null

  // Filters
  activeCategory: string | null
  searchQuery: string
  activeTag: string | null

  // Actions
  fetchConcepts: () => Promise<void>
  /** Fetch a concept file (cached). Throws on network / parse errors. */
  loadConcept: (id: string) => Promise<HubConcept>
  loadConcepts: (ids: string[]) => Promise<HubConcept[]>
  setCategory: (cat: string | null) => void
  setSearch: (q: string) => void
  setTag: (tag: string | null) => void
  resetFilters: () => void

  // Computed-like
  filteredConcepts: () => HubConceptSummary[]
  allTags: () => Array<{ tag: string; count: number }>
}

// ─── Constants ──────────────────────────────────────────────────────────────

const REMOTE_BASE = 'https://hub.radical.tools/hub/'
const LOCAL_BASE = '/hub/'
const HUB_BASE = import.meta.env.DEV ? LOCAL_BASE : REMOTE_BASE
const FALLBACK_BASE = import.meta.env.DEV ? REMOTE_BASE : LOCAL_BASE
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(HUB_BASE + path)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch {
    res = await fetch(FALLBACK_BASE + path)
    if (!res.ok) throw new Error(`Fallback fetch failed: HTTP ${res.status}`)
  }
  // Guard against HTML error pages being returned instead of JSON
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('json')) {
    throw new Error('Hub returned non-JSON response. CORS or network issue.')
  }
  return (await res.json()) as T
}

const inflight = new Map<string, Promise<HubConcept>>()

// ─── Store ──────────────────────────────────────────────────────────────────

export const useHubStore = create<HubState>()((set, get) => ({
  concepts: [],
  loaded: {},
  loading: false,
  error: null,
  lastFetched: null,

  activeCategory: null,
  searchQuery: '',
  activeTag: null,

  async fetchConcepts() {
    const { lastFetched, loading } = get()
    if (loading) return
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return

    set({ loading: true, error: null })
    try {
      const data = await fetchJson<HubConceptSummary[]>(HUB_INDEX_FILE)
      set({ concepts: data, lastFetched: Date.now(), loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch hub data',
        loading: false,
      })
    }
  },

  loadConcept(id) {
    const cached = get().loaded[id]
    if (cached) return Promise.resolve(cached)
    const pending = inflight.get(id)
    if (pending) return pending
    const summary = get().concepts.find((c) => c.id === id)
    if (!summary) return Promise.reject(new Error(`Unknown hub concept "${id}"`))
    const p = fetchJson<HubRadicalDoc>(summary.file)
      .then((doc) => {
        const concept = docToConcept(doc)
        set((s) => ({ loaded: { ...s.loaded, [id]: concept } }))
        return concept
      })
      .finally(() => inflight.delete(id))
    inflight.set(id, p)
    return p
  },

  loadConcepts(ids) {
    return Promise.all(ids.map((id) => get().loadConcept(id)))
  },

  setCategory(cat) {
    set({ activeCategory: cat })
  },
  setSearch(q) {
    set({ searchQuery: q })
  },
  setTag(tag) {
    set({ activeTag: tag })
  },
  resetFilters() {
    set({ activeCategory: null, searchQuery: '', activeTag: null })
  },

  filteredConcepts() {
    const { concepts, activeCategory, searchQuery, activeTag } = get()
    const q = searchQuery.toLowerCase().trim()
    return concepts.filter((c) => {
      if (activeCategory && c.category !== activeCategory) return false
      if (activeTag && !c.tags.includes(activeTag)) return false
      if (q) {
        const haystack = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  },

  allTags() {
    const counts = new Map<string, number>()
    for (const c of get().concepts) {
      for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  },
}))
