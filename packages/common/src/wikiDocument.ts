// Wiki content, independent of React, Markdown/HTML serializers and publication.
// Studio and headless exporters read this projection; only their rendering differs.
import { TYPE_LABELS, viewShowsEveryNode, type C4Node, type C4Relation, type DiagramView } from './c4'
import { isMarkdownField } from './markdown'
import { composeEarsSentence, isPropertyVisible, propertyText, refIds, relationDetails, relationSentences, relationTypeForProse, requirementStatePhrase, resolveEarsSubject, typeNoun, type Metamodel, type PropertyDef, type RelationSentence } from './metamodel'
import { pipelineOf, runPipeline, type ChainRow } from './viewPipeline'

export const WIKI_ROOT = '__root__'
const NO_METAMODEL: Metamodel = { id: '', name: '', nodeTypes: {}, relationTypes: {} }
const TECH_TYPES = new Set(['container', 'component', 'database', 'webapp', 'queue'])
const INFOBOX_TEXT_KEYS = new Set(['technology', 'date', 'version', 'owner', 'author', 'team', 'url', 'link', 'repo', 'repository', 'reference', 'ref', 'tags', 'tag'])
const EARS_CLAUSE_KEYS = new Set(['trigger', 'precondition', 'unwanted_condition', 'feature', 'action'])

export function wikiFieldTitle(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '') || label
}

export interface WikiContext {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel?: Metamodel | null
}
export interface WikiField {
  definition: PropertyDef
  title: string
  value: unknown
  text: string
  markdown: boolean
  references: { id: string; label: string }[]
}
export interface WikiRelationGroup extends RelationSentence {
  label: string
  description?: string
  entries: { relation: C4Relation; other?: C4Node; details: string[] }[]
}
export interface WikiRequirement {
  started: boolean
  subject?: string
  state?: string
  sentence: string
  complete: boolean
}
export type WikiBlock =
  | { kind: 'lead'; field: WikiField }
  | { kind: 'requirement'; requirement: WikiRequirement }
  | { kind: 'relations'; groups: WikiRelationGroup[] }
  | { kind: 'contents' }
  | { kind: 'wireframe'; nodeId: string }
  | { kind: 'section'; field: WikiField }
  | { kind: 'children'; nodes: C4Node[] }

export interface WikiPage {
  node: C4Node
  typeLabel: string
  parent?: C4Node
  breadcrumb: C4Node[]
  lead?: WikiField
  facts: WikiField[]
  bylineFacts: { key: string; label: string; text: string }[]
  sections: WikiField[]
  requirement?: WikiRequirement
  ownRelations: C4Relation[]
  relationGroups: WikiRelationGroup[]
  children: C4Node[]
  blocks: WikiBlock[]
}

export function wikiRelationGroups(nodeId: string, relations: C4Relation[], context: WikiContext): WikiRelationGroup[] {
  return relationSentences(nodeId, relations, context.nodes, context.metamodel ?? undefined).map((sentence) => {
    const def = sentence.typeId ? context.metamodel?.relationTypes[sentence.typeId] : undefined
    const phrase = sentence.phrase.text.charAt(0).toUpperCase() + sentence.phrase.text.slice(1)
    return {
      ...sentence, label: sentence.phrase.reads ? phrase : `← ${phrase}:`, description: def?.description,
      entries: sentence.relations.map((relation) => ({
        relation,
        other: context.nodes[sentence.direction === 'out' ? relation.targetId : relation.sourceId],
        details: relationDetails(relation, def, context.nodes),
      })),
    }
  })
}

function fieldOf(definition: PropertyDef, node: C4Node, context: WikiContext): WikiField {
  const value = (node as unknown as Record<string, unknown>)[definition.key]
  return {
    definition, title: wikiFieldTitle(definition.label), value,
    text: propertyText(definition, value, context.nodes), markdown: isMarkdownField(definition.key, definition),
    references: definition.type === 'ref' ? refIds(value).map((id) => ({ id, label: context.nodes[id]?.label ?? id })) : [],
  }
}

/** The same content for a reader and a designer; empty fields retain their
 * source definitions so Studio can render editors without reclassifying them. */
function pageOf(node: C4Node, context: WikiContext, children: C4Node[], touching: C4Relation[], visibleSet: Set<string> | null, chapterOf?: string): WikiPage {
  const { nodes, relations, metamodel } = context
  const values = node as unknown as Record<string, unknown>
  const def = metamodel?.nodeTypes[node.type]
  const props = (def?.properties ?? []).filter((p) => p.key !== 'label' && isPropertyVisible(p, values) && !(node.type === 'requirement' && EARS_CLAUSE_KEYS.has(p.key)))
  let lead: WikiField | undefined
  const facts: WikiField[] = [], sections: WikiField[] = []
  for (const prop of props) {
    const field = fieldOf(prop, node, context)
    const fact = ['enum', 'boolean', 'number', 'ref'].includes(prop.type) || (prop.type === 'text' && INFOBOX_TEXT_KEYS.has(prop.key))
    if (fact) facts.push(field)
    else if (!lead && prop.type === 'textarea' && prop.key === 'description') lead = field
    else sections.push(field)
  }
  if (!def) {
    lead = fieldOf({ key: 'description', label: 'Description', type: 'textarea' }, node, context)
    if (TECH_TYPES.has(node.type)) facts.push(fieldOf({ key: 'technology', label: 'Technology', type: 'text' }, node, context))
    facts.push(fieldOf({ key: 'external', label: 'External', type: 'boolean' }, node, context))
  }
  let requirement: WikiRequirement | undefined
  if (node.type === 'requirement') {
    // Subjects and state phrases read the full model, as Studio does, even
    // when their source elements are not pages in this particular wiki.
    const subject = resolveEarsSubject(node.id, relations, nodes)
    const state = requirementStatePhrase(node, nodes, relations) || undefined
    requirement = { ...composeEarsSentence(values, subject, state), subject, state, started: [...EARS_CLAUSE_KEYS].some((key) => String(values[key] ?? '').trim()) }
  }
  const hierarchy = def?.hierarchyRelation
  const ownRelations = touching.filter((r) => {
    if (r.sourceId === node.id) return !(chapterOf && r.targetId === chapterOf && r.relationType === hierarchy) && (!visibleSet || visibleSet.has(r.targetId))
    return r.targetId === node.id && !(hierarchy && r.relationType === hierarchy) && (!visibleSet || visibleSet.has(r.sourceId))
  })
  const relationGroups = wikiRelationGroups(node.id, ownRelations, context)
  const breadcrumb: C4Node[] = [], seen = new Set<string>()
  for (let current: C4Node | undefined = node; current && !seen.has(current.id); current = current.parentId ? nodes[current.parentId] : undefined) { seen.add(current.id); breadcrumb.unshift(current) }
  const bylineFacts = facts
    .filter((f) => !(node.type === 'requirement' && f.definition.key === 'ears_type' && !requirement?.started) && !!f.text)
    .map((f) => ({ key: f.definition.key, label: f.definition.type === 'boolean' || f.definition.key === 'technology' ? '' : typeNoun(f.definition.label), text: f.text }))
  const blocks: WikiBlock[] = []
  if (lead) blocks.push({ kind: 'lead', field: lead })
  if (requirement) blocks.push({ kind: 'requirement', requirement })
  if (relationGroups.length) blocks.push({ kind: 'relations', groups: relationGroups })
  blocks.push({ kind: 'contents' })
  if (node.type === 'mockup') blocks.push({ kind: 'wireframe', nodeId: node.id })
  for (const field of sections) blocks.push({ kind: 'section', field })
  blocks.push({ kind: 'children', nodes: children })
  return { node, typeLabel: def?.label ?? TYPE_LABELS[node.type] ?? node.type, parent: node.parentId ? nodes[node.parentId] : undefined, breadcrumb, lead, facts, bylineFacts, sections, requirement, ownRelations, relationGroups, children, blocks }
}

/** A snapshot of a wiki's scope and content. No DOM, Node APIs or rendering libraries. */
export function createWikiDocument(view: DiagramView | null | undefined, context: WikiContext) {
  const { nodes, relations, metamodel } = context
  const all = Object.values(nodes), allRelations = Object.values(relations)
  const touching = new Map<string, C4Relation[]>()
  for (const r of allRelations) for (const id of new Set([r.sourceId, r.targetId])) { const list = touching.get(id) ?? []; list.push(r); touching.set(id, list) }
  let visibleSet: Set<string> | null = null
  if (view && !viewShowsEveryNode(view)) {
    visibleSet = new Set<string>()
    for (const first of view.nodeIds) {
      const seen = new Set<string>()
      for (let id: string | undefined = first; id && nodes[id] && !seen.has(id); id = nodes[id].parentId) { seen.add(id); visibleSet.add(id) }
    }
  }
  const chain = view && pipelineOf(view)?.levels?.length ? runPipeline(view, { ...context, metamodel: metamodel ?? NO_METAMODEL }) : null
  if (chain) visibleSet = new Set(chain.nodes.map((n) => n.id))
  const nodeList = all.filter((n) => !visibleSet || visibleSet.has(n.id))
  const containment: Record<string, C4Node[]> = Object.create(null)
  for (const node of nodeList) (containment[node.parentId ?? WIKI_ROOT] ??= []).push(node)
  for (const list of Object.values(containment)) list.sort((a, b) => a.label.localeCompare(b.label))
  let chainChildren: Record<string, C4Node[]> | null = null
  if (chain?.rows) {
    chainChildren = Object.create(null) as Record<string, C4Node[]>
    chainChildren[WIKI_ROOT] = chain.levels[0]?.shown ?? []
    const ancestors: string[] = []
    for (const row of chain.rows) {
      ancestors.length = row.depth
      const parentId = ancestors[row.depth - 1]
      ancestors[row.depth] = row.node.id
      if (!parentId) continue
      const list = chainChildren[parentId] ??= []
      if (!list.some((n) => n.id === row.node.id)) list.push(row.node)
    }
  }
  const navigationChildren = chainChildren ?? containment
  const roots = navigationChildren[WIKI_ROOT] ?? []
  const childrenCache = new Map<string, C4Node[]>()
  const childrenOf = (id: string): C4Node[] => {
    const cached = childrenCache.get(id)
    if (cached) return cached
    const hierarchy = metamodel?.nodeTypes[nodes[id]?.type]?.hierarchyRelation
    const children = chainChildren ? chainChildren[id] ?? [] : hierarchy
      ? (touching.get(id) ?? []).filter((r) => r.relationType === hierarchy && r.targetId === id).map((r) => nodes[r.sourceId]).filter((n): n is C4Node => !!n && (!visibleSet || visibleSet.has(n.id))).sort((a, b) => a.label.localeCompare(b.label))
      : containment[id] ?? []
    childrenCache.set(id, children); return children
  }
  const pages = new Map<string, Map<string | undefined, WikiPage>>()
  const page = (id: string, chapterOf?: string): WikiPage => {
    if (!nodes[id] || (visibleSet && !visibleSet.has(id))) throw new Error(`Element is outside this wiki: ${id}`)
    const contexts = pages.get(id) ?? new Map<string | undefined, WikiPage>()
    let built = contexts.get(chapterOf)
    if (!built) { built = pageOf(nodes[id], context, childrenOf(id), touching.get(id) ?? [], visibleSet, chapterOf); contexts.set(chapterOf, built); pages.set(id, contexts) }
    return built
  }
  // Complete occurrences for documents/page trees; Studio chooses how deeply
  // to render these same children according to its interactive reading mode.
  // A chain already defines the occurrences at each configured level.
  // Walking its merged child index again would invent paths across levels.
  let documentRows: ChainRow[] | undefined = chain?.rows ?? undefined
  const rowsOf = (): ChainRow[] => {
    if (documentRows) return documentRows
    const rows: ChainRow[] = []
    const pending = [...roots].reverse().map((node) => ({ node, depth: 0, path: node.id, ancestors: new Set<string>() }))
    while (pending.length) {
      const row = pending.pop()!
      if (row.ancestors.has(row.node.id)) continue
      const ancestors = new Set(row.ancestors).add(row.node.id)
      const children = childrenOf(row.node.id).filter((n) => !ancestors.has(n.id))
      rows.push({ node: row.node, depth: row.depth, path: row.path, alsoIn: 0, hasChildren: children.length > 0 })
      for (const node of [...children].reverse()) pending.push({ node, depth: row.depth + 1, path: `${row.path}/${node.id}`, ancestors })
    }
    const counts = new Map<string, number>()
    for (const row of rows) counts.set(row.node.id, (counts.get(row.node.id) ?? 0) + 1)
    for (const row of rows) row.alsoIn = counts.get(row.node.id)! - 1
    documentRows = rows
    return rows
  }
  const typeCounts = new Map<string, number>(), relationCounts = new Map<string, number>()
  for (const node of nodeList) typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1)
  // The relations between the wiki's pages (the Overview's count).
  let relationCount = 0
  for (const r of allRelations) {
    if (visibleSet && !(visibleSet.has(r.sourceId) && visibleSet.has(r.targetId))) continue
    if (nodes[r.sourceId] && nodes[r.targetId]) relationCount++
    const type = relationTypeForProse(r, nodes, metamodel ?? undefined)
    if (type) relationCounts.set(type, (relationCounts.get(type) ?? 0) + 1)
  }
  return { visibleSet, nodeList, roots, navigationChildren, childrenOf, get rows() { return rowsOf() }, page, relationCount, glossary: { typeCounts, relationCounts } }
}

export type WikiDocument = ReturnType<typeof createWikiDocument>
