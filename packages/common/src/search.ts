// ─── Search of a model ───────────────────────────────────────────────────────
//
// What Quick Search, the find bar over a view and the query language's FIND
// look through: every kind of place in a model (views, their folders,
// elements, relations, sequences, presentations and their slides,
// milestones), by the words typed. Every word has to match, in any order,
// without case or accents; a short word also matches the initials of a
// name. Prefixes narrow it: `v:` views, `f:` folders, `e:` elements, `r:`
// relations, `s:` sequences, `p:` presentations and slides, `m:` milestones,
// `@` the view shown, `in:` a view by name, `type:` (or `t:`) a type, and a
// property's key or name with a value (`status:accepted`).

import type { C4Node, C4Relation, DiagramSequence, DiagramView, Presentation } from './c4'
import { normalizeViewFolder, viewFolderPaths } from './c4'
import type { Metamodel, PropertyDef } from './metamodel/types'
import { viewShownNodes } from './viewPipeline'
import { viewpointOfView, viewpointsOf } from './viewpoints'

export type SearchKind = 'view' | 'folder' | 'element' | 'relation' | 'sequence' | 'presentation' | 'slide' | 'milestone'

/** The kinds in the order their sections are listed. */
export const SEARCH_KINDS: readonly SearchKind[] = ['view', 'folder', 'element', 'relation', 'sequence', 'presentation', 'slide', 'milestone']

/** The prefixes that narrow a search to kinds of place, as typed. */
export const KIND_PREFIXES: ReadonlyArray<{ prefix: string; kinds: SearchKind[]; label: string }> = [
  { prefix: 'v:', kinds: ['view'], label: 'views' },
  { prefix: 'f:', kinds: ['folder'], label: 'folders' },
  { prefix: 'e:', kinds: ['element'], label: 'elements' },
  { prefix: 'r:', kinds: ['relation'], label: 'relations' },
  { prefix: 's:', kinds: ['sequence'], label: 'sequences' },
  { prefix: 'p:', kinds: ['presentation', 'slide'], label: 'presentations and slides' },
  { prefix: 'm:', kinds: ['milestone'], label: 'milestones' },
]

const KIND_WORDS: Record<string, SearchKind[]> = {
  v: ['view'], view: ['view'], views: ['view'],
  f: ['folder'], folder: ['folder'], folders: ['folder'],
  e: ['element'], element: ['element'], elements: ['element'],
  r: ['relation'], rel: ['relation'], relation: ['relation'], relations: ['relation'],
  s: ['sequence'], seq: ['sequence'], sequence: ['sequence'], sequences: ['sequence'],
  p: ['presentation', 'slide'], presentation: ['presentation', 'slide'], presentations: ['presentation', 'slide'], slide: ['slide'], slides: ['slide'],
  m: ['milestone'], milestone: ['milestone'], milestones: ['milestone'],
}

/** A milestone as search reads it. */
export interface SearchMilestone { id: string; name: string; timestamp?: number }

export interface SearchData {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  views?: Record<string, DiagramView>
  sequences?: Record<string, DiagramSequence>
  presentations?: Presentation[]
  milestones?: SearchMilestone[]
  metamodel?: Metamodel | null
  /** The elements each view shows, when the caller has them already
   *  (computed for the view `in:` names otherwise). */
  viewNodes?: Record<string, ReadonlySet<string>>
  /** The view shown, for `@`: its id (null: All elements) and the elements
   *  it shows (null: all of them). */
  current?: { id: string | null; name: string; nodes: ReadonlySet<string> | null }
}

/** A range of a text, from `start` up to `end`. */
export type Mark = [start: number, end: number]

export interface SearchHit {
  kind: SearchKind
  /** The view's, element's… id; a folder's path. */
  id: string
  label: string
  /** What else names it: an element's path, the ends of a relation, the
   *  presentation of a slide, a view's type and folder. */
  detail: string
  /** Where the words match the label. */
  marks: Mark[]
  /** A match outside the label: the words around it, and the field's name. */
  snippet?: { field?: string; text: string; marks: Mark[] }
  score: number
  /** An element's type. */
  type?: string
  /** A slide's presentation and where the slide is in it. */
  presentationId?: string
  slideIndex?: number
}

export interface ParsedSearch {
  /** Typed after `>`: commands, not places. */
  command: boolean
  /** The words to match, folded (foldText). */
  words: string[]
  /** The kinds a prefix narrows to; null: all. */
  kinds: SearchKind[] | null
  /** `@` or `in:`: only the elements and relations of this view. */
  scope: { viewId: string | null; name: string; nodes: ReadonlySet<string> | null } | null
  /** `in:` named a view that is not there. */
  missingView?: string
  /** `type:`: the types (ids) to keep. */
  types: string[] | null
  /** Property filters: the property's key and the value, folded. */
  properties: Array<{ key: string; label: string; value: string }>
}

export interface SearchResult {
  query: ParsedSearch
  /** Best first. */
  hits: SearchHit[]
  counts: Record<SearchKind, number>
}

// ── Folding ──────────────────────────────────────────────────────────────────

const SPECIAL: Record<string, string> = { ł: 'l', Ł: 'l', ß: 'ss', ø: 'o', Ø: 'o', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', đ: 'd', Đ: 'd', ı: 'i' }

function foldChar(c: string): string {
  return SPECIAL[c] ?? c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** `text` without case and accents: "Źródło" is "zrodlo". */
export function foldText(text: string): string {
  let out = ''
  for (const c of text) out += foldChar(c)
  return out
}

/** The folded text, and for each of its characters where it is in `text`. */
function foldWithMap(text: string): { folded: string; at: number[] } {
  let folded = ''
  const at: number[] = []
  let i = 0
  for (const c of text) {
    const f = foldChar(c)
    for (let k = 0; k < f.length; k++) at.push(i)
    folded += f
    i += c.length
  }
  at.push(i)
  return { folded, at }
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/** The words of a query: a quoted part is one, `in:"Order flow"` too. */
function tokens(query: string): string[] {
  return query.match(/[^\s"]+:"[^"]*"?|"[^"]*"?|\S+/g) ?? []
}

const unquote = (s: string): string => s.replace(/^"/, '').replace(/"$/, '')

/** The properties of the metamodel's node types, by what a prefix may name
 *  them: the key and the name folded, its spaces as `_` or `-` or none. */
function propertyNames(metamodel: Metamodel | null | undefined): Map<string, PropertyDef> {
  const out = new Map<string, PropertyDef>()
  for (const t of Object.values(metamodel?.nodeTypes ?? {})) {
    for (const p of t.properties ?? []) {
      if (p.type === 'ref') continue
      const label = foldText(p.label)
      for (const name of [p.key.toLowerCase(), label.replace(/\s+/g, '_'), label.replace(/\s+/g, '-'), label.replace(/\s+/g, '')]) {
        if (!out.has(name)) out.set(name, p)
      }
    }
  }
  return out
}

/** The view a name stands for: the one of that name, else the first whose
 *  name starts with it, else one that holds it. */
function viewNamed(views: Record<string, DiagramView>, name: string): DiagramView | undefined {
  const want = foldText(name.trim())
  if (!want) return undefined
  const list = Object.values(views).sort((a, b) => a.name.localeCompare(b.name))
  return list.find((v) => foldText(v.name) === want)
    ?? list.find((v) => foldText(v.name).startsWith(want))
    ?? list.find((v) => foldText(v.name).includes(want))
}

/** The types a `type:` value stands for: the id or the name, from its start. */
function typesNamed(data: SearchData, value: string): string[] {
  const want = foldText(value)
  const ids = new Set<string>([...Object.keys(data.metamodel?.nodeTypes ?? {}), ...Object.values(data.nodes).map((n) => n.type)])
  const named = (id: string): string => foldText(data.metamodel?.nodeTypes[id]?.label ?? id)
  const exact = [...ids].filter((id) => id.toLowerCase() === want || named(id) === want)
  if (exact.length) return exact
  return [...ids].filter((id) => id.toLowerCase().startsWith(want) || named(id).startsWith(want))
}

export function parseSearch(query: string, data: SearchData): ParsedSearch {
  const out: ParsedSearch = { command: false, words: [], kinds: null, scope: null, types: null, properties: [] }
  let text = query.trim()
  if (text.startsWith('>')) {
    out.command = true
    text = text.slice(1)
  }
  const props = propertyNames(data.metamodel)
  const kinds = new Set<SearchKind>()
  for (const token of tokens(text)) {
    if (out.command) { out.words.push(foldText(unquote(token))); continue }
    if (token.startsWith('@')) {
      const cur = data.current
      out.scope = { viewId: cur?.id ?? null, name: cur?.name ?? 'All elements', nodes: cur?.nodes ?? null }
      const rest = unquote(token.slice(1))
      if (rest) out.words.push(foldText(rest))
      continue
    }
    const prefixed = /^([a-z][\w-]*):(.*)$/i.exec(token)
    if (prefixed) {
      const key = prefixed[1].toLowerCase()
      const value = unquote(prefixed[2])
      if (KIND_WORDS[key]) {
        for (const k of KIND_WORDS[key]) kinds.add(k)
        if (value) out.words.push(foldText(value))
        continue
      }
      if (key === 'in') {
        if (!value) continue
        const view = viewNamed(data.views ?? {}, value)
        if (!view) { out.missingView = value; continue }
        out.scope = { viewId: view.id, name: view.name, nodes: shownBy(data, view) }
        continue
      }
      if (key === 'type' || key === 't') {
        if (value) out.types = [...(out.types ?? []), ...typesNamed(data, value)]
        continue
      }
      const prop = props.get(foldText(key))
      if (prop) {
        if (value) out.properties.push({ key: prop.key, label: prop.label, value: foldText(value) })
        continue
      }
    }
    const word = foldText(unquote(token))
    if (word) out.words.push(word)
  }
  if (kinds.size) out.kinds = SEARCH_KINDS.filter((k) => kinds.has(k))
  // A view, a type or a property is about elements (and, for a view, the
  // relations it draws).
  if (!out.kinds && (out.scope || out.types || out.properties.length)) out.kinds = out.scope && !out.types && !out.properties.length ? ['element', 'relation'] : ['element']
  return out
}

function shownBy(data: SearchData, view: DiagramView): ReadonlySet<string> | null {
  return data.viewNodes?.[view.id] ?? viewShownNodes(view, data.nodes, data.relations) ?? null
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** A text of a place to match, how much a match there counts, and its name
 *  when a match there is shown as a snippet. */
interface Field { text: string; weight: number; label?: boolean; name?: string; snippet?: boolean }

interface WordMatch { field: number; start: number; end: number; score: number }

const isWordStart = (folded: string, i: number): boolean => i === 0 || !/[a-z0-9]/.test(folded[i - 1])

/** The best place `word` matches the folded `text`, and how well. */
function matchIn(folded: string, word: string): { start: number; score: number } | null {
  let best: { start: number; score: number } | null = null
  for (let i = folded.indexOf(word); i !== -1; i = folded.indexOf(word, i + 1)) {
    let score = 10
    if (isWordStart(folded, i)) score += 6
    if (i === 0) score += 6
    if (i === 0 && word.length === folded.length) score += 12
    if (!best || score > best.score) best = { start: i, score }
    if (score >= 16) break
  }
  return best
}

/** The initials of a name: "Payment Service API" is "psa". */
function initials(folded: string): string {
  return (folded.match(/[a-z0-9]+/g) ?? []).map((w) => w[0]).join('')
}

interface Folded { folded: string; at: number[] }

/** How the words match the fields, or null when one of them matches none. */
function matchFields(fields: Field[], words: string[], foldedFields: Folded[]): { score: number; matches: WordMatch[] } | null {
  if (!words.length) return { score: 0, matches: [] }
  const matches: WordMatch[] = []
  let score = 0
  for (const word of words) {
    let best: WordMatch | null = null
    fields.forEach((f, i) => {
      const m = matchIn(foldedFields[i].folded, word)
      if (!m) return
      const s = m.score * f.weight
      if (!best || s > best.score) best = { field: i, start: m.start, end: m.start + word.length, score: s }
    })
    if (!best) return null
    matches.push(best)
    score += (best as WordMatch).score
  }
  return { score, matches }
}

/** The original text's ranges for folded ranges, joined where they touch. */
function marksOf(f: Folded, ranges: Array<[number, number]>): Mark[] {
  const marks = ranges
    .map(([a, b]): Mark => [f.at[a], f.at[b - 1] + 1])
    .sort((x, y) => x[0] - y[0])
  const out: Mark[] = []
  for (const m of marks) {
    const last = out[out.length - 1]
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1])
    else out.push([m[0], m[1]])
  }
  return out
}

const SNIPPET_BEFORE = 28
const SNIPPET_LENGTH = 90

/** The words around a match in `text`: the line it is on, cut short. */
function snippetOf(text: string, f: Folded, ranges: Array<[number, number]>): { text: string; marks: Mark[] } {
  const marks = marksOf(f, ranges)
  const first = marks[0]?.[0] ?? 0
  const flat = text.replace(/\s+/g, ' ')
  // Whitespace runs collapse: count where the match lands in the flat text.
  const shift = text.slice(0, first).length - text.slice(0, first).replace(/\s+/g, ' ').length
  const at = first - shift
  let start = Math.max(0, at - SNIPPET_BEFORE)
  if (start > 0) {
    const space = flat.lastIndexOf(' ', at - 1)
    if (space >= start - 12 && space < at) start = space + 1
  }
  const end = Math.min(flat.length, start + SNIPPET_LENGTH)
  const lead = start > 0 ? '…' : ''
  const tail = end < flat.length ? '…' : ''
  const moved = (n: number): number => {
    const s = text.slice(0, n).length - text.slice(0, n).replace(/\s+/g, ' ').length
    return n - s - start + lead.length
  }
  const shown = lead + flat.slice(start, end) + tail
  return {
    text: shown,
    marks: marks.map(([a, b]): Mark => [moved(a), moved(b)]).filter(([a, b]) => a >= lead.length && b <= shown.length - tail.length),
  }
}

/** A hit for `fields` (the first is the label), or null. */
function hitFor(fields: Field[], parsed: ParsedSearch, allowInitials: boolean): Pick<SearchHit, 'marks' | 'snippet' | 'score'> | null {
  const folded = fields.map((f) => foldWithMap(f.text))
  const m = matchFields(fields, parsed.words, folded)
  let score = m?.score ?? 0
  const matches = m?.matches ?? []
  if (!m) {
    // One short word: the initials of the label ("ps", Payment Service).
    const word = parsed.words.length === 1 ? parsed.words[0] : ''
    if (!allowInitials || word.length < 2 || !/^[a-z0-9]+$/.test(word)) return null
    const ini = initials(folded[0].folded)
    if (ini.length < 2 || !ini.startsWith(word)) return null
    score = 9 * fields[0].weight
    const starts = [...folded[0].folded.matchAll(/[a-z0-9]+/g)].slice(0, word.length).map((x) => x.index ?? 0)
    return { score, marks: marksOf(folded[0], starts.map((s) => [s, s + 1])) }
  }
  if (!parsed.words.length) score = 1
  // The words together in the label as typed.
  if (parsed.words.length > 1 && folded[0].folded.includes(parsed.words.join(' '))) score += 15
  const inLabel = matches.filter((x) => x.field === 0).map((x): [number, number] => [x.start, x.end])
  const out: Pick<SearchHit, 'marks' | 'snippet' | 'score'> = { score, marks: marksOf(folded[0], inLabel) }
  const elsewhere = matches.filter((x) => x.field !== 0 && fields[x.field].snippet)
  if (elsewhere.length && matches.every((x) => x.field !== 0 || inLabel.length < parsed.words.length)) {
    const where = elsewhere[0].field
    const ranges = matches.filter((x) => x.field === where).map((x): [number, number] => [x.start, x.end])
    out.snippet = { field: fields[where].name, ...snippetOf(fields[where].text, folded[where], ranges) }
  }
  return out
}

// ── The places ───────────────────────────────────────────────────────────────

const VIEW_TYPE: Record<string, string> = {
  dynamic: 'Flow', treemap: 'Hierarchy', table: 'Table', matrix: 'Matrix', wiki: 'Wiki', warnier: 'Warnier', explore: 'Explore',
}
/** A view's type as its card names it. */
export function viewTypeName(view: Pick<DiagramView, 'kind'>): string {
  return VIEW_TYPE[view.kind ?? ''] ?? 'Structure'
}

const isGroup = (v: DiagramView, mm: Metamodel | null | undefined): boolean =>
  !!v.viewpoint && !v.subject && !v.partOf && !!viewpointsOf(mm).find((t) => t.id === v.viewpoint)?.subject

const BASE_KEYS = new Set(['id', 'type', 'label', 'description', 'technology', 'parentId', 'collapsed', 'external', 'x', 'y', 'width', 'height', 'order', 'pinned', 'positions'])

/** An element's property values as text, with the property's name: those
 *  its type declares, or without a metamodel every text field of its own. */
function propertyFields(node: C4Node, metamodel: Metamodel | null | undefined): Array<{ key: string; name: string; text: string }> {
  const values = node as unknown as Record<string, unknown>
  const defs = metamodel?.nodeTypes[node.type]?.properties
  const out: Array<{ key: string; name: string; text: string }> = []
  if (defs) {
    for (const p of defs) {
      if (p.type === 'ref') continue
      const v = values[p.key]
      if (typeof v === 'string' && v.trim()) out.push({ key: p.key, name: p.label, text: v })
      else if (typeof v === 'number') out.push({ key: p.key, name: p.label, text: String(v) })
    }
    return out
  }
  for (const [key, v] of Object.entries(values)) {
    if (!BASE_KEYS.has(key) && typeof v === 'string' && v.trim()) out.push({ key, name: key, text: v })
  }
  return out
}

function pathOf(nodes: Record<string, C4Node>, id: string): string {
  const parts: string[] = []
  const seen = new Set<string>()
  for (let cur = nodes[nodes[id]?.parentId ?? '']; cur && !seen.has(cur.id); cur = nodes[cur.parentId ?? '']) {
    seen.add(cur.id)
    parts.unshift(cur.label || cur.type)
  }
  return parts.join(' / ')
}

const wants = (parsed: ParsedSearch, kind: SearchKind): boolean => !parsed.kinds || parsed.kinds.includes(kind)

/** Every place of `data` the query finds, best first. */
export function searchModel(data: SearchData, query: string | ParsedSearch): SearchResult {
  const parsed = typeof query === 'string' ? parseSearch(query, data) : query
  const counts = Object.fromEntries(SEARCH_KINDS.map((k) => [k, 0])) as Record<SearchKind, number>
  const result: SearchResult = { query: parsed, hits: [], counts }
  if (parsed.command || parsed.missingView) return result
  const filtered = !!(parsed.scope || parsed.types || parsed.properties.length)
  if (!parsed.words.length && !filtered && !parsed.kinds) return result
  const mm = data.metamodel
  const views = data.views ?? {}
  const push = (hit: SearchHit): void => { result.hits.push(hit); counts[hit.kind]++ }
  const typeName = (t: string): string => mm?.nodeTypes[t]?.label ?? t

  if (wants(parsed, 'view')) {
    for (const v of Object.values(views)) {
      const viewpoint = viewpointOfView(v, mm)
      const subject = v.subject ? data.nodes[v.subject]?.label : undefined
      const group = isGroup(v, mm)
      const type = group ? 'Views per element' : viewTypeName(v)
      const folder = normalizeViewFolder(v.folder)
      const hit = hitFor([
        { text: v.name, weight: 3, label: true },
        { text: folder, weight: 1.5, name: 'Folder' },
        { text: viewpoint?.label ?? '', weight: 1.2, name: 'Viewpoint' },
        { text: type, weight: 1.2 },
        { text: subject ?? '', weight: 1.5, name: 'Of' },
      ], parsed, true)
      if (!hit) continue
      push({ kind: 'view', id: v.id, label: v.name, detail: [type, viewpoint?.label, folder].filter(Boolean).join(' · '), ...hit, score: hit.score + 5 })
    }
  }

  if (wants(parsed, 'folder')) {
    const all = Object.values(views)
    for (const path of viewFolderPaths(all)) {
      const name = path.split('/').pop() ?? path
      const hit = hitFor([{ text: name, weight: 3, label: true }, { text: path, weight: 1.5 }], parsed, false)
      if (!hit) continue
      const n = all.filter((v) => { const f = normalizeViewFolder(v.folder); return f === path || f.startsWith(`${path}/`) }).length
      push({ kind: 'folder', id: path, label: name, detail: `${path === name ? '' : `${path} · `}${n} view${n === 1 ? '' : 's'}`, ...hit, score: hit.score + 3 })
    }
  }

  const scope = parsed.scope
  const inScope = (id: string): boolean => !scope?.nodes || scope.nodes.has(id)
  if (wants(parsed, 'element')) {
    for (const n of Object.values(data.nodes)) {
      if (!inScope(n.id)) continue
      if (parsed.types && !parsed.types.includes(n.type)) continue
      const props = propertyFields(n, mm)
      if (parsed.properties.length && !parsed.properties.every((p) => props.some((f) => f.key === p.key && foldText(f.text).includes(p.value)))) continue
      const hit = hitFor([
        { text: n.label || typeName(n.type), weight: 3, label: true },
        { text: typeName(n.type), weight: 1.2 },
        { text: n.technology ?? '', weight: 1.5, name: 'Technology' },
        { text: n.description ?? '', weight: 1, name: 'Description', snippet: true },
        ...props.map((p): Field => ({ text: p.text, weight: 1, name: p.name, snippet: true })),
      ], parsed, true)
      if (!hit) continue
      const path = pathOf(data.nodes, n.id)
      push({ kind: 'element', id: n.id, label: n.label || typeName(n.type), detail: [typeName(n.type), path].filter(Boolean).join(' · '), type: n.type, ...hit })
    }
  }

  if (wants(parsed, 'relation') && !parsed.types && !parsed.properties.length) {
    for (const r of Object.values(data.relations)) {
      const src = data.nodes[r.sourceId]
      const tgt = data.nodes[r.targetId]
      if (!src || !tgt || !inScope(r.sourceId) || !inScope(r.targetId)) continue
      const label = r.label || `${src.label} → ${tgt.label}`
      const kindName = r.relationType ? (mm?.relationTypes[r.relationType]?.label ?? r.relationType) : ''
      const hit = hitFor([
        { text: label, weight: 3, label: true },
        { text: src.label, weight: 1.5 },
        { text: tgt.label, weight: 1.5 },
        { text: r.technology ?? '', weight: 1.5, name: 'Technology' },
        { text: kindName, weight: 1 },
      ], parsed, false)
      if (!hit) continue
      push({ kind: 'relation', id: r.id, label, detail: [kindName, `${src.label} → ${tgt.label}`].filter(Boolean).join(' · '), ...hit, score: hit.score - 2 })
    }
  }

  if (!filtered && wants(parsed, 'sequence')) {
    for (const s of Object.values(data.sequences ?? {})) {
      const steps = s.relationIds.map((id, i) => s.stepDescriptions?.[i] || data.relations[id]?.label || '').filter(Boolean).join(' · ')
      const hit = hitFor([{ text: s.name, weight: 3, label: true }, { text: steps, weight: 1, name: 'Steps', snippet: true }], parsed, true)
      if (!hit) continue
      const n = s.relationIds.length
      push({ kind: 'sequence', id: s.id, label: s.name, detail: `${n} step${n === 1 ? '' : 's'}`, ...hit })
    }
  }

  if (!filtered) {
    for (const p of data.presentations ?? []) {
      if (wants(parsed, 'presentation')) {
        const hit = hitFor([{ text: p.name, weight: 3, label: true }], parsed, true)
        if (hit) push({ kind: 'presentation', id: p.id, label: p.name, detail: `${p.slides.length} slide${p.slides.length === 1 ? '' : 's'}`, ...hit })
      }
      if (wants(parsed, 'slide')) {
        p.slides.forEach((s, i) => {
          const view = s.viewId ? views[s.viewId]?.name : undefined
          const hit = hitFor([{ text: s.name, weight: 3, label: true }, { text: view ?? '', weight: 1, name: 'View' }, { text: p.name, weight: 0.8 }], parsed, false)
          if (hit) push({ kind: 'slide', id: s.id, label: s.name, detail: `${p.name} · slide ${i + 1}${view ? ` · ${view}` : ''}`, presentationId: p.id, slideIndex: i, ...hit, score: hit.score - 1 })
        })
      }
    }
    if (wants(parsed, 'milestone')) {
      for (const m of data.milestones ?? []) {
        const hit = hitFor([{ text: m.name, weight: 3, label: true }], parsed, true)
        if (hit) push({ kind: 'milestone', id: m.id, label: m.name, detail: m.timestamp ? new Date(m.timestamp).toISOString().slice(0, 10) : 'Milestone', ...hit })
      }
    }
  }

  result.hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return result
}

// ── Suggestions ──────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  /** What the chip shows. */
  label: string
  /** The query once it is taken. */
  query: string
  hint?: string
}

const quoted = (s: string): string => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '')}"` : s)

/** What may complete the last word typed: a prefix, a view for `in:`, a
 *  type for `type:`, a value of a property. Tab takes the first. */
export function searchSuggestions(query: string, data: SearchData, limit = 8): SearchSuggestion[] {
  if (!query || /\s$/.test(query) || query.trimStart().startsWith('>')) return []
  const all = tokens(query)
  const last = all[all.length - 1]
  if (!last) return []
  const before = query.slice(0, query.length - last.length)
  const take = (insert: string): string => `${before}${insert} `
  const prefixed = /^([a-z][\w-]*):(.*)$/i.exec(last)
  const out: SearchSuggestion[] = []
  if (prefixed) {
    const key = prefixed[1].toLowerCase()
    const value = foldText(unquote(prefixed[2]))
    if (key === 'in') {
      for (const v of Object.values(data.views ?? {}).sort((a, b) => a.name.localeCompare(b.name))) {
        const name = foldText(v.name)
        if (value && !name.includes(value)) continue
        out.push({ label: v.name, query: take(`in:${quoted(v.name)}`), hint: viewTypeName(v) })
      }
    } else if (key === 'type' || key === 't') {
      const used = new Set<string>(Object.values(data.nodes).map((n) => n.type))
      for (const [id, t] of Object.entries(data.metamodel?.nodeTypes ?? {})) {
        if (!used.has(id)) continue
        if (value && !id.toLowerCase().startsWith(value) && !foldText(t.label).startsWith(value)) continue
        out.push({ label: t.label, query: take(`${key}:${id}`), hint: 'type' })
      }
    } else {
      const prop = propertyNames(data.metamodel).get(foldText(key))
      for (const option of prop?.options ?? []) {
        if (value && !foldText(option).startsWith(value)) continue
        out.push({ label: option, query: take(`${key}:${quoted(option)}`), hint: prop?.label })
      }
    }
    return out.slice(0, limit)
  }
  const word = foldText(unquote(last))
  if (word.length < 2 || last.startsWith('@')) return []
  for (const key of ['in', 'type']) {
    if (key.startsWith(word) && key !== word) out.push({ label: `${key}:`, query: `${before}${key}:`, hint: key === 'in' ? 'in a view' : 'of a type' })
  }
  if (word.length >= 3) {
    const seen = new Set<string>()
    for (const [name, p] of propertyNames(data.metamodel)) {
      if (!p.options?.length || seen.has(p.key) || !name.startsWith(word)) continue
      seen.add(p.key)
      out.push({ label: `${p.key}:`, query: `${before}${p.key}:`, hint: p.label })
    }
  }
  return out.slice(0, limit)
}
