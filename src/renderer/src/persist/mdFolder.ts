// ─── Markdown-folder persistence ─────────────────────────────────────────────
//
// An alternative to the single-JSON persistence: the model is exploded into a
// folder of Markdown files that mirror the metamodel's containment hierarchy —
// one `.md` per element (a C4 container, an ADR, a requirement, …). Container
// elements (system / container / domain / group / blueprint) become directories
// holding an `_index.md` for themselves plus their children.
//
// Semantic content lives in the Markdown files (YAML frontmatter for the
// structured fields, the body for the element's description prose). Everything
// that is *not* semantic — node positions, camera state, views, sequences,
// snapshots, presentations, the metamodel and hub templates — is kept in JSON
// sidecar files so a folder round-trips losslessly back into `DiagramData`.
//
// The functions here are pure (no Electron / DOM), operating on a plain
// `Record<relativePath, fileContent>` map so they can be unit-tested and reused
// by both the Electron and web builds.

import type {
  DiagramData,
  C4Node,
  C4Relation,
  DiagramSequence,
  DiagramView,
  DiagramSnapshot,
  Presentation,
  NodePosition,
} from '../types/c4'
import { isContainerType } from '../types/c4'
import type { Metamodel } from '../types/metamodel'

/** File map: relative POSIX path → UTF-8 file content. */
export type FolderFiles = Record<string, string>

export const MD_MANIFEST_FILE = 'radical.md'
const LAYOUT_FILE = '_layout.json'
const RELATIONS_FILE = 'relations.json'
const RELATIONS_MD_FILE = 'relations.md'
const VIEWS_FILE = 'views.json'
const SEQUENCES_FILE = 'sequences.json'
const SNAPSHOTS_FILE = 'snapshots.json'
const PRESENTATIONS_FILE = 'presentations.json'
const METAMODEL_FILE = 'metamodel.json'
const HUB_TEMPLATES_FILE = 'hubTemplates.json'
const NODES_DIR = 'nodes'
const SEQUENCES_DIR = 'sequences'
const VIEWS_DIR = 'views'
const INDEX_BASENAME = '_index.md'

const FORMAT_VERSION = 1

/** Node geometry keys — now written into each node's frontmatter (positions-as-meta). */
const NODE_LAYOUT_KEYS = new Set(['x', 'y', 'width', 'height', 'collapsed'])
/** Node keys reconstructed from the folder structure / body, not the extra frontmatter loop. */
const NODE_NONFRONT_KEYS = new Set([...NODE_LAYOUT_KEYS, 'parentId', 'description'])

type Scalar = string | number | boolean

interface NodeLayout {
  x: number
  y: number
  width: number
  height: number
  collapsed: boolean
}

interface LayoutSidecar {
  nodes?: Record<string, NodeLayout>
  defaultPositions?: Record<string, NodePosition>
  defaultViewport?: { x: number; y: number; zoom: number } | null
  /** Per-view transient UI state (positions, camera, collapse sets, treemap/wiki),
   *  keyed by view id. The view's identity + membership live in views/<slug>.md. */
  views?: Record<string, Record<string, unknown>>
}

// ─── YAML frontmatter (minimal, lossless for our scalar/multiline needs) ─────

/** Canonical JSON for sidecars: object keys sorted recursively (order is never
 *  semantic in JSON), array order preserved (it may be — e.g. view tab order),
 *  2-space indented, with a trailing newline. Deterministic output keeps git
 *  diffs minimal regardless of the store's internal key/insertion order. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value), null, 2) + '\n'
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortObjectKeys((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

/** Serialize a flat object as a `---`-delimited frontmatter block. Strings are
 *  JSON-quoted (so `"3"` never round-trips to a number), numbers/booleans are
 *  bare, and multi-line strings use a `|` block scalar. */
function serializeFrontmatter(obj: Record<string, Scalar>): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (value.includes('\n')) {
        lines.push(`${key}: |`)
        for (const line of value.split('\n')) lines.push('  ' + line)
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`)
      }
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

function parseScalar(raw: string): Scalar {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string
    } catch {
      return raw
    }
  }
  return raw
}

/** Parse a Markdown file into its frontmatter object and body text. */
function parseMarkdown(content: string): { front: Record<string, Scalar>; body: string } {
  const front: Record<string, Scalar> = {}
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { front, body: normalized.trim() }
  }
  const lines = normalized.split('\n')
  let i = 1
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line === '---') {
      i++
      break
    }
    const match = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    const rest = match[2]
    if (rest === '|') {
      // Block scalar: consume following lines indented by 2 spaces.
      const blockLines: string[] = []
      while (i + 1 < lines.length && (lines[i + 1].startsWith('  ') || lines[i + 1] === '')) {
        i++
        if (lines[i] === '---') { i--; break }
        blockLines.push(lines[i].startsWith('  ') ? lines[i].slice(2) : lines[i])
      }
      // Drop a single trailing empty line introduced by a terminal newline.
      if (blockLines.length && blockLines[blockLines.length - 1] === '') blockLines.pop()
      front[key] = blockLines.join('\n')
    } else {
      front[key] = parseScalar(rest)
    }
  }
  const body = lines.slice(i).join('\n').trim()
  return { front, body }
}

// ─── Slug helpers ────────────────────────────────────────────────────────────

function slugify(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}

/** Allocate a unique slug within a directory (case-insensitive), appending
 *  `-2`, `-3`, … on collision. Filenames are cosmetic; ids live in frontmatter. */
function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base
  let n = 2
  while (used.has(slug.toLowerCase())) {
    slug = `${base}-${n++}`
  }
  used.add(slug.toLowerCase())
  return slug
}

// ─── Relations table (single relations.md) ───────────────────────────────────

const REL_COL_TO_KEY: Record<string, string> = {
  id: 'id',
  source: 'sourceId',
  target: 'targetId',
  label: 'label',
  technology: 'technology',
  type: 'relationType',
}
const REL_CORE_COLS = ['id', 'source', 'target', 'label', 'technology', 'type']
const REL_KNOWN_KEYS = new Set(['id', 'sourceId', 'targetId', 'label', 'technology', 'relationType'])

function escCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}
function unescCell(value: string): string {
  return value.replace(/<br>/g, '\n').replace(/\\\|/g, '|').replace(/\\\\/g, '\\')
}
function splitTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split(/(?<!\\)\|/).map((c) => c.trim())
}

/** Serialize relations as a single Markdown table. Lossless for the fixed C4
 *  relation fields plus any extra scalar props (appended as sorted columns). */
export function serializeRelationsTable(relations: C4Relation[]): string {
  const extraKeys = new Set<string>()
  for (const r of relations) {
    for (const k of Object.keys(r)) if (!REL_KNOWN_KEYS.has(k)) extraKeys.add(k)
  }
  const cols = [...REL_CORE_COLS, ...[...extraKeys].sort()]
  const cell = (r: C4Relation, col: string): string => {
    const key = REL_COL_TO_KEY[col] ?? col
    const v = (r as unknown as Record<string, unknown>)[key]
    return v === undefined || v === null ? '' : escCell(String(v))
  }
  const rows = [
    `| ${cols.join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...relations.map((r) => `| ${cols.map((c) => cell(r, c)).join(' | ')} |`),
  ]
  return rows.join('\n') + '\n'
}

/** Parse a relations.md table back into C4Relation records. Header-driven so
 *  extra columns round-trip; rows missing id/source/target are skipped. */
export function parseRelationsTable(md: string): C4Relation[] {
  const lines = md
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
  if (lines.length < 2) return []
  const header = splitTableRow(lines[0])
  const out: C4Relation[] = []
  for (const line of lines.slice(2)) {
    const cells = splitTableRow(line)
    const rel: Record<string, string> = {}
    header.forEach((col, i) => {
      const key = REL_COL_TO_KEY[col] ?? col
      const val = unescCell(cells[i] ?? '')
      if (val !== '') rel[key] = val
    })
    if (rel.id && rel.sourceId && rel.targetId) out.push(rel as unknown as C4Relation)
  }
  return out
}

// ─── Sequences (sequences/<slug>.md as ordered lists) ────────────────────

function escStep(value: string): string {
  return value.replace(/\r?\n/g, '<br>')
}
function unescStep(value: string): string {
  return value.replace(/<br>/g, '\n')
}

const SEQ_STEP_RE = /^\s*\d+\.\s+`([^`]+)`(?:\s+—\s+(.*))?$/

/** Serialize one sequence as frontmatter (id/name) + an ordered list where each
 *  item is a backtick-wrapped relation id, optionally followed by ` — <desc>`. */
export function serializeSequence(seq: DiagramSequence): string {
  const front = serializeFrontmatter({ id: seq.id, name: seq.name })
  const items = seq.relationIds.map((rid, i) => {
    const desc = seq.stepDescriptions?.[i]
    const base = `${i + 1}. \`${rid}\``
    return desc ? `${base} — ${escStep(desc)}` : base
  })
  return front + '\n\n' + items.join('\n') + '\n'
}

/** Parse a sequence markdown file back into a DiagramSequence. `stepDescriptions`
 *  is only set when at least one step carries one (matches the store's shape). */
export function parseSequence(content: string): DiagramSequence {
  const { front, body } = parseMarkdown(content)
  const relationIds: string[] = []
  const stepDescriptions: (string | undefined)[] = []
  let anyDesc = false
  for (const line of body.split('\n')) {
    const m = SEQ_STEP_RE.exec(line)
    if (!m) continue
    relationIds.push(m[1])
    if (m[2] !== undefined && m[2] !== '') {
      stepDescriptions.push(unescStep(m[2]))
      anyDesc = true
    } else {
      stepDescriptions.push(undefined)
    }
  }
  const seq: DiagramSequence = {
    id: String(front.id ?? ''),
    name: typeof front.name === 'string' ? front.name : String(front.name ?? ''),
    relationIds,
  }
  if (anyDesc) seq.stepDescriptions = stepDescriptions
  return seq
}

function readSequences(files: FolderFiles): DiagramSequence[] | undefined {
  const mdPaths = Object.keys(files).filter(
    (p) => p.startsWith(SEQUENCES_DIR + '/') && p.endsWith('.md'),
  )
  if (mdPaths.length > 0) {
    const seqs = mdPaths.map((p) => parseSequence(files[p])).filter((s) => s.id)
    seqs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return seqs
  }
  return readJson<DiagramSequence[]>(files[SEQUENCES_FILE])
}

// ─── Views (views/<slug>.md — frontmatter + node list) ────────────────────

/** View keys that describe the view's identity; everything else is transient UI
 *  state stashed in the layout sidecar. `nodeIds` is emitted as the node list. */
const VIEW_FRONT_KEYS = new Set(['id', 'name', 'kind', 'sequenceId', 'layoutMode'])

function viewLayoutState(view: DiagramView): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(view)) {
    if (VIEW_FRONT_KEYS.has(k) || k === 'nodeIds') continue
    if (v === undefined) continue
    state[k] = v
  }
  return state
}

/** Serialize a view as frontmatter (identity scalars) + a `## Nodes` list. */
export function serializeView(view: DiagramView): string {
  const front: Record<string, Scalar> = { id: view.id, name: view.name }
  if (view.kind) front.kind = view.kind
  if (view.sequenceId) front.sequenceId = view.sequenceId
  if (view.layoutMode) front.layoutMode = view.layoutMode
  const items = view.nodeIds.map((id) => `- \`${id}\``)
  const body = items.length ? `## Nodes\n${items.join('\n')}` : '## Nodes'
  return serializeFrontmatter(front) + '\n\n' + body + '\n'
}

/** Parse a view markdown file, merging in its transient state from the layout
 *  sidecar (keyed by view id). */
export function parseViewMd(
  content: string,
  viewsState: Record<string, Record<string, unknown>> | undefined,
): DiagramView {
  const { front, body } = parseMarkdown(content)
  const id = String(front.id ?? '')
  const nodeIds: string[] = []
  for (const line of body.split('\n')) {
    const m = /^-\s+`([^`]+)`\s*$/.exec(line.trim())
    if (m) nodeIds.push(m[1])
  }
  const state = viewsState?.[id] ?? {}
  const view: Record<string, unknown> = {
    id,
    name: typeof front.name === 'string' ? front.name : String(front.name ?? ''),
    nodeIds,
    positions: {},
    ...state,
  }
  if (front.kind) view.kind = front.kind
  if (front.sequenceId) view.sequenceId = front.sequenceId
  if (front.layoutMode) view.layoutMode = front.layoutMode
  if (!view.positions) view.positions = {}
  return view as unknown as DiagramView
}

function readViews(
  files: FolderFiles,
  viewsState: Record<string, Record<string, unknown>> | undefined,
): DiagramView[] | undefined {
  const mdPaths = Object.keys(files).filter((p) => p.startsWith(VIEWS_DIR + '/') && p.endsWith('.md'))
  if (mdPaths.length > 0) {
    const views = mdPaths.map((p) => parseViewMd(files[p], viewsState)).filter((v) => v.id)
    views.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return views
  }
  return readJson<DiagramView[]>(files[VIEWS_FILE])
}

// ─── Serialize: DiagramData → folder files ───────────────────────────────────

export function serializeToMdFolder(data: DiagramData, modelName?: string): FolderFiles {
  const files: FolderFiles = {}
  const layout: LayoutSidecar = {}

  // Manifest.
  files[MD_MANIFEST_FILE] = serializeFrontmatter({
    radicalFormat: 'md-folder',
    version: FORMAT_VERSION,
    ...(modelName ? { name: modelName } : {}),
  }) + `\n\n# ${modelName ?? 'Radical model'}\n\nThis folder is a Radical.Tools model persisted as Markdown files: one \`.md\` per element (geometry in its frontmatter), \`relations.md\` for relations, \`sequences/\` for interaction sequences, \`views/\` for views, plus a few JSON sidecars for machine state (snapshots, presentations, metamodel). Edit the \`.md\` files freely; the app keeps them in sync.\n`

  // Index nodes by parent for a hierarchical walk.
  const childrenOf = new Map<string | undefined, C4Node[]>()
  const nodeById = new Map<string, C4Node>()
  for (const node of data.nodes) nodeById.set(node.id, node)
  for (const node of data.nodes) {
    const parent = node.parentId && nodeById.has(node.parentId) ? node.parentId : undefined
    const list = childrenOf.get(parent) ?? []
    list.push(node)
    childrenOf.set(parent, list)
  }

  const emitNode = (node: C4Node, dir: string, slug: string): void => {
    // Geometry lives in the node's own frontmatter (positions-as-meta).
    const front: Record<string, Scalar> = {
      id: node.id,
      type: node.type,
      label: node.label,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
      collapsed: !!node.collapsed,
    }
    // Sort remaining (custom metamodel) props for deterministic, git-stable output.
    const extraKeys = Object.keys(node)
      .filter((key) => key !== 'id' && key !== 'type' && key !== 'label' && !NODE_NONFRONT_KEYS.has(key))
      .sort()
    for (const key of extraKeys) {
      const value = (node as unknown as Record<string, unknown>)[key]
      if (value === undefined || value === null) continue
      if (typeof value === 'object') continue // defensive: no nested props expected
      front[key] = value as Scalar
    }
    const body = typeof node.description === 'string' ? node.description.trim() : ''
    const md = serializeFrontmatter(front) + (body ? `\n\n${body}\n` : '\n')

    const kids = childrenOf.get(node.id) ?? []
    const isDir = isContainerType(node.type) || kids.length > 0
    if (isDir) {
      const nodeDir = `${dir}/${slug}`
      files[`${nodeDir}/${INDEX_BASENAME}`] = md
      writeChildren(kids, nodeDir)
    } else {
      files[`${dir}/${slug}.md`] = md
    }
  }

  function writeChildren(nodes: C4Node[], dir: string): void {
    const used = new Set<string>()
    // Emit siblings in a stable id order so slug de-dup suffixes (`-2`) are
    // assigned deterministically regardless of the store's array order.
    const ordered = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const node of ordered) {
      const slug = uniqueSlug(slugify(node.label || node.type, node.type), used)
      emitNode(node, dir, slug)
    }
  }

  writeChildren(childrenOf.get(undefined) ?? [], NODES_DIR)

  // Relations → single Markdown table. Order is not semantic → sort by id.
  if (data.relations && data.relations.length > 0) {
    const relations = [...data.relations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    files[RELATIONS_MD_FILE] = serializeRelationsTable(relations)
  }

  // Sequences → one Markdown file each (ordered lists). Stable id order so
  // slug de-dup suffixes are deterministic.
  if (data.sequences && data.sequences.length > 0) {
    const used = new Set<string>()
    const ordered = [...data.sequences].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const seq of ordered) {
      const slug = uniqueSlug(slugify(seq.name || seq.id, seq.id), used)
      files[`${SEQUENCES_DIR}/${slug}.md`] = serializeSequence(seq)
    }
  }

  // Views → one Markdown file each (frontmatter + node list). Transient UI
  // state (positions, camera, collapse/expand sets, treemap/wiki) goes into
  // the layout sidecar keyed by view id, keeping the .md human-authorable.
  if (data.views && data.views.length > 0) {
    const used = new Set<string>()
    const ordered = [...data.views].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const view of ordered) {
      const slug = uniqueSlug(slugify(view.name || view.id, view.id), used)
      files[`${VIEWS_DIR}/${slug}.md`] = serializeView(view)
      const state = viewLayoutState(view)
      if (Object.keys(state).length > 0) (layout.views ??= {})[view.id] = state
    }
  }

  // Layout sidecar — default-view camera/positions + per-view UI state.
  // (Per-node geometry now lives in each node's frontmatter.)
  if (data.defaultPositions) layout.defaultPositions = data.defaultPositions
  if (data.defaultViewport !== undefined) layout.defaultViewport = data.defaultViewport
  if (
    layout.defaultPositions ||
    layout.defaultViewport !== undefined ||
    (layout.views && Object.keys(layout.views).length > 0)
  ) {
    files[LAYOUT_FILE] = stableStringify(layout)
  }

  // Non-semantic / structurally-complex collections → JSON sidecars.
  writeJsonIfPresent(files, SNAPSHOTS_FILE, data.snapshots, (s) => !!s && s.length > 0)
  writeJsonIfPresent(files, PRESENTATIONS_FILE, data.presentations, (p) => !!p && p.length > 0)
  if (data.metamodel) files[METAMODEL_FILE] = stableStringify(data.metamodel)
  if (data.hubTemplates && Object.keys(data.hubTemplates).length > 0) {
    files[HUB_TEMPLATES_FILE] = stableStringify(data.hubTemplates)
  }

  return files
}

function writeJsonIfPresent<T>(
  files: FolderFiles,
  name: string,
  value: T | undefined,
  present: (v: T) => boolean,
): void {
  if (value !== undefined && present(value)) files[name] = stableStringify(value)
}

// ─── Deserialize: folder files → DiagramData ─────────────────────────────────

export function deserializeFromMdFolder(files: FolderFiles): DiagramData {
  const layout = readJson<LayoutSidecar>(files[LAYOUT_FILE]) ?? { nodes: {} }

  interface ParsedNode {
    front: Record<string, Scalar>
    body: string
    /** Directory key that identifies this node as a container (or null). */
    ownDirKey: string | null
    parentDirKey: string
  }

  const parsedByDirKey = new Map<string, string>() // dirKey → node id
  const parsed: ParsedNode[] = []

  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(NODES_DIR + '/') || !path.endsWith('.md')) continue
    const { front, body } = parseMarkdown(content)
    if (!front.id || !front.type) continue
    const isIndex = path.endsWith('/' + INDEX_BASENAME)
    if (isIndex) {
      const ownDirKey = dirname(path) // e.g. nodes/system-a
      parsed.push({ front, body, ownDirKey, parentDirKey: dirname(ownDirKey) })
      parsedByDirKey.set(ownDirKey, String(front.id))
    } else {
      parsed.push({ front, body, ownDirKey: null, parentDirKey: dirname(path) })
    }
  }

  const nodes: C4Node[] = parsed.map((p) => {
    const id = String(p.front.id)
    const parentId = p.parentDirKey === NODES_DIR ? undefined : parsedByDirKey.get(p.parentDirKey)
    // Geometry comes from frontmatter; fall back to the legacy _layout.json map.
    const lay = layout.nodes?.[id]
    const numOf = (v: Scalar | undefined, fallback: number): number =>
      typeof v === 'number' ? v : fallback
    const node: Record<string, unknown> = {
      id,
      type: p.front.type,
      label: typeof p.front.label === 'string' ? p.front.label : String(p.front.label ?? ''),
      x: numOf(p.front.x, lay?.x ?? 0),
      y: numOf(p.front.y, lay?.y ?? 0),
      width: numOf(p.front.width, lay?.width ?? 0),
      height: numOf(p.front.height, lay?.height ?? 0),
      collapsed:
        typeof p.front.collapsed === 'boolean' ? p.front.collapsed : !!(lay?.collapsed ?? false),
    }
    if (parentId) node.parentId = parentId
    if (p.body) node.description = p.body
    for (const [key, value] of Object.entries(p.front)) {
      if (key === 'id' || key === 'type' || key === 'label') continue
      if (NODE_LAYOUT_KEYS.has(key)) continue
      node[key] = value
    }
    return node as unknown as C4Node
  })

  const relations = files[RELATIONS_MD_FILE]
    ? parseRelationsTable(files[RELATIONS_MD_FILE])
    : (readJson<C4Relation[]>(files[RELATIONS_FILE]) ?? [])
  const data: DiagramData = { nodes, relations }

  const views = readViews(files, layout.views)
  if (views) data.views = views
  const sequences = readSequences(files)
  if (sequences) data.sequences = sequences
  const snapshots = readJson<DiagramSnapshot[]>(files[SNAPSHOTS_FILE])
  if (snapshots) data.snapshots = snapshots
  const presentations = readJson<Presentation[]>(files[PRESENTATIONS_FILE])
  if (presentations) data.presentations = presentations
  const metamodel = readJson<Metamodel>(files[METAMODEL_FILE])
  if (metamodel) data.metamodel = metamodel
  const hubTemplates = readJson<DiagramData['hubTemplates']>(files[HUB_TEMPLATES_FILE])
  if (hubTemplates) data.hubTemplates = hubTemplates

  if (layout.defaultPositions) data.defaultPositions = layout.defaultPositions
  if (layout.defaultViewport !== undefined) data.defaultViewport = layout.defaultViewport

  return data
}

/** True when the file map looks like a Radical md-folder (has the manifest). */
export function isMdFolder(files: FolderFiles): boolean {
  return typeof files[MD_MANIFEST_FILE] === 'string'
}

function readJson<T>(content: string | undefined): T | undefined {
  if (!content) return undefined
  try {
    return JSON.parse(content) as T
  } catch {
    return undefined
  }
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}
