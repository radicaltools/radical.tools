// ─── Hub catalogue file format ───────────────────────────────────────────────
//
// Every hub concept is a regular Radical Studio document (`DiagramData`:
// nodes + relations, openable in the studio as-is) with one extra top-level
// `hub` block carrying the catalogue metadata. The catalogue lives in the
// @radical/hub-catalogue package (catalogue/<category>/<id>.radical) and is served
// verbatim under hub/;
// `hub/index.json` (generated at build time, see @radical/hub-catalogue) lists
// lightweight summaries so the UI can browse without downloading every file.
//
// This module is imported by both the renderer and the node-side build
// plugin, so it must stay free of browser / vite / store imports.

export type HubCategory = 'pattern' | 'fitness-function' | 'requirement' | 'adr' | 'blueprint'

/** A single parameter that must be filled in before a hub concept is imported. */
export interface TemplateParam {
  key: string
  label: string
  hint?: string
  type?: 'text' | 'number'
  defaultValue?: string
}

/** Catalogue metadata — the `hub` block of a concept's .radical file. */
export interface HubConceptMeta {
  id: string
  category: HubCategory
  name: string
  description: string
  tags: string[]
  requiredMetamodel?: string
  /** Parameters the user must fill in before import; values are substituted
   *  into node fields using {{KEY}} syntax. */
  templateParams?: TemplateParam[]
  /**
   * IDs of other hub concepts that this blueprint recommends importing alongside
   * its own inline elements. Used by blueprints to reference existing standalone
   * requirements, fitness functions, ADRs, or patterns from the hub catalogue.
   */
  hubRefs?: string[]
}

/** On-disk shape of `hub/<category>/<id>.radical`. */
export interface HubRadicalDoc {
  hub: HubConceptMeta
  nodes: Array<Record<string, unknown>>
  relations?: Array<Record<string, unknown>>
  sequences?: Array<Record<string, unknown>>
  /** Named canvas views (static, or dynamic over a sequence). */
  views?: Array<Record<string, unknown>>
  [extra: string]: unknown
}

/** Fully loaded concept (metadata + model) — what the viewer and importer work with. */
export interface HubConcept extends HubConceptMeta {
  nodes: Array<Record<string, unknown>>
  relations?: Array<Record<string, unknown>>
  /** Named flows over `relations` (Studio dynamic views). */
  sequences?: Array<Record<string, unknown>>
  /** Named canvas views — see hubViews.ts. */
  views?: Array<Record<string, unknown>>
}

/** One entry of `hub/index.json`. Enough to render cards and decide drop
 *  targets without fetching the concept file. */
export interface HubConceptSummary extends HubConceptMeta {
  /** Path of the concept file, relative to the hub root (`<category>/<id>.radical`). */
  file: string
  nodeCount: number
  relationCount: number
  /** Types of root nodes (no parentId) — used to check import containment. */
  rootTypes: string[]
  /** Scalar governance fields of the first node, for card badges. */
  preview: Record<string, string>
}

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

export const HUB_INDEX_FILE = 'index.json'

const PREVIEW_KEYS = ['ears_type', 'priority', 'status', 'category', 'trigger'] as const

export function conceptFile(meta: Pick<HubConceptMeta, 'id' | 'category'>): string {
  return `${meta.category}/${meta.id}.radical`
}

export function docToConcept(doc: HubRadicalDoc): HubConcept {
  const c: HubConcept = { ...doc.hub, nodes: doc.nodes, relations: doc.relations }
  if (doc.sequences?.length) c.sequences = doc.sequences
  if (doc.views?.length) c.views = doc.views
  return c
}

export function conceptToDoc(concept: HubConcept): HubRadicalDoc {
  const { nodes, relations, sequences, views, ...hub } = concept
  const d: HubRadicalDoc = { hub, nodes }
  if (relations) d.relations = relations
  if (sequences?.length) d.sequences = sequences
  if (views?.length) d.views = views
  return d
}

export function summarize(doc: HubRadicalDoc, file: string = conceptFile(doc.hub)): HubConceptSummary {
  const first = doc.nodes[0] ?? {}
  const preview: Record<string, string> = {}
  for (const k of PREVIEW_KEYS) {
    const v = first[k]
    if (v !== undefined && v !== null && v !== '') preview[k] = String(v)
  }
  return {
    ...doc.hub,
    file,
    nodeCount: doc.nodes.length,
    relationCount: doc.relations?.length ?? 0,
    rootTypes: doc.nodes.filter((n) => !n.parentId).map((n) => (n.type as string) ?? 'component'),
    preview,
  }
}

/** Legacy single-file catalogue (`hub-data.json`) — still emitted so older
 *  desktop builds keep working. */
export function toLegacyCatalogue(docs: HubRadicalDoc[]): HubConcept[] {
  return docs.map(docToConcept)
}
