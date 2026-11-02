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

import { migrateChecks } from './checksMigration'
import type {
  DiagramData,
  C4Node,
  C4Relation,
  DiagramSequence,
  DiagramView,
  DiagramSnapshot,
  Presentation,
  LayoutConstraint,
  EdgeStyle,
  NodePosition,
} from '../c4'
import { NODE_SIZES, isContainerType } from '../c4'
import type { Metamodel } from '../metamodel'
import { modelValue, ownModel } from '../model'

/** File map: relative POSIX path → UTF-8 file content. */
export type FolderFiles = Record<string, string>

export const MD_MANIFEST_FILE = 'radical.md'
const LAYOUT_FILE = '_layout.json'
const RELATIONS_FILE = 'relations.json'
const VIEWS_FILE = 'views.json'
const SEQUENCES_FILE = 'sequences.json'
const SNAPSHOTS_FILE = 'snapshots.json'
const PRESENTATIONS_FILE = 'presentations.json'
const METAMODEL_FILE = 'metamodel.json'
const HUB_TEMPLATES_FILE = 'hubTemplates.json'
const NODES_DIR = 'nodes'
const INDEX_BASENAME = '_index.md'

/** Top-level JSON sidecars this format writes. Only these (plus the manifest
 *  and node `.md` files) are ever pruned from a folder — see `staleMdFolderFiles`. */
const SIDECAR_FILES = new Set([
  LAYOUT_FILE,
  RELATIONS_FILE,
  VIEWS_FILE,
  SEQUENCES_FILE,
  SNAPSHOTS_FILE,
  PRESENTATIONS_FILE,
  METAMODEL_FILE,
  HUB_TEMPLATES_FILE,
])

/** The version of the Markdown-folder format this code reads and writes
 *  (`version` in radical.md), independent of the product's version. */
export const MD_FOLDER_FORMAT_VERSION = 1
const FORMAT_VERSION = MD_FOLDER_FORMAT_VERSION

/** Node keys that are layout/state, not semantic — kept out of the `.md`. */
const NODE_LAYOUT_KEYS = new Set(['x', 'y', 'width', 'height', 'collapsed'])
/** Node keys reconstructed from the folder structure / body, not frontmatter. */
const NODE_NONFRONT_KEYS = new Set([...NODE_LAYOUT_KEYS, 'parentId', 'description'])

/** A frontmatter value: a scalar, or a list of strings (a multiple reference
 *  property's node ids), written as a JSON array on one line. */
type Scalar = string | number | boolean | string[]

interface NodeLayout {
  x: number
  y: number
  width: number
  height: number
  collapsed: boolean
}

interface LayoutSidecar {
  nodes: Record<string, NodeLayout>
  defaultPositions?: Record<string, NodePosition>
  defaultViewport?: { x: number; y: number; zoom: number } | null
  defaultLayoutConstraints?: LayoutConstraint[]
  defaultEdgeStyle?: EdgeStyle
}

// ─── YAML frontmatter (minimal, lossless for our scalar/multiline needs) ─────

/** Canonical JSON for sidecars: object keys sorted recursively (order is never
 *  semantic in JSON), array order preserved (it may be — e.g. view tab order),
 *  2-space indented, with a trailing newline. Deterministic output keeps git
 *  diffs minimal regardless of the store's internal key/insertion order. */
function stableStringify(value: unknown, ordered?: ReadonlySet<string>): string {
  return JSON.stringify(sortObjectKeys(value, ordered), null, 2) + '\n'
}

/** `value` with its objects' keys sorted, but those of the objects under a
 *  key in `ordered` (at any depth), whose order is the model's. */
function sortObjectKeys(value: unknown, ordered?: ReadonlySet<string>, keep = false): unknown {
  if (Array.isArray(value)) return value.map((item) => sortObjectKeys(item, ordered))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const keys = Object.keys(value as Record<string, unknown>)
    for (const key of keep ? keys : keys.sort()) {
      out[key] = sortObjectKeys((value as Record<string, unknown>)[key], ordered, !!ordered?.has(key) && !keep)
    }
    return out
  }
  return value
}

/** The metamodel's types are in the order they were added, which the
 *  metamodel editor and the palette show: read back A–Z, they changed order. */
const METAMODEL_ORDERED_KEYS: ReadonlySet<string> = new Set(['nodeTypes', 'relationTypes'])

const BARE_KEY = /^[A-Za-z0-9_-]+$/

/** Serialize a flat object as a `---`-delimited frontmatter block. Strings are
 *  JSON-quoted (so `"3"` never round-trips to a number), numbers/booleans are
 *  bare, and multi-line strings use a `|` block scalar. */
function serializeFrontmatter(obj: Record<string, Scalar>): string {
  const lines: string[] = ['---']
  for (const [name, value] of Object.entries(obj)) {
    // A key the reader takes bare, or else JSON-quoted (a property may be
    // keyed "SLA target" or "właściciel").
    const key = BARE_KEY.test(name) ? name : JSON.stringify(name)
    if (typeof value === 'string') {
      if (value.includes('\n')) {
        lines.push(`${key}: |`)
        for (const line of value.split('\n')) lines.push('  ' + line)
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`)
      }
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
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
  if (raw.startsWith('[')) {
    try {
      const list = JSON.parse(raw) as unknown
      if (Array.isArray(list) && list.every((v) => typeof v === 'string')) return list as string[]
    } catch {
      // not a list after all: keep the text
    }
    return raw
  }
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string
    } catch {
      return raw
    }
  }
  return raw
}

/** `content` without a leading UTF-8 byte-order mark. Notepad, PowerShell 5
 *  and Visual Studio may save one; the browser drops it when it decodes a
 *  file, Node's fs keeps it, so a node file read by the MCP server or the
 *  CLI had no frontmatter and was no element. */
export function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

/** Parse a Markdown file into its frontmatter object and body text. */
function parseMarkdown(content: string): { front: Record<string, Scalar>; body: string } {
  const front: Record<string, Scalar> = {}
  const normalized = stripBom(content).replace(/\r\n/g, '\n')
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
    const match = /^([A-Za-z0-9_-]+|"(?:[^"\\]|\\.)*"):\s?(.*)$/.exec(line)
    if (!match) continue
    let key = match[1]
    if (key.startsWith('"')) {
      try { key = JSON.parse(key) as string } catch { continue }
    }
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
  // 60 characters, not UTF-16 units: a cut through a character outside the
  // BMP left half of it, which the disk writes as U+FFFD, and the next
  // write took the file for a stale one and deleted it.
  return [...slug].slice(0, 60).join('') || fallback
}

/** A sibling to name in its directory: a directory (`slug/_index.md`) or a
 *  file (`slug.md`), wanting the slug of its label, or keeping `keep`. */
interface SlugClaim {
  id: string
  base: string
  dir: boolean
  /** The slug it has in the folder now, kept unless a sibling holds it. */
  keep?: string
  /** The slug to take when it is free, before `base`. */
  want?: string
}

/** Name the siblings of one directory: each keeps the slug it has where it
 *  can, the rest take their label's slug, appending `-2`, `-3`, … on a
 *  collision (case-insensitive), in id order. A directory `x/` and a file
 *  `x.md` do not collide. Filenames are cosmetic; ids live in frontmatter,
 *  but a file that moves for a sibling's rename is a change nobody made. */
function allocateSlugs(claims: SlugClaim[]): Map<string, string> {
  const used = new Set<string>()
  const name = (slug: string, dir: boolean): string => slug.toLowerCase() + (dir ? '/' : '.md')
  const slugs = new Map<string, string>()
  const ordered = [...claims].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const claim of ordered) {
    if (claim.keep === undefined || used.has(name(claim.keep, claim.dir))) continue
    used.add(name(claim.keep, claim.dir))
    slugs.set(claim.id, claim.keep)
  }
  for (const claim of ordered) {
    if (slugs.has(claim.id)) continue
    let slug = claim.want !== undefined && !used.has(name(claim.want, claim.dir)) ? claim.want : claim.base
    let n = 2
    while (used.has(name(slug, claim.dir))) slug = `${claim.base}-${n++}`
    used.add(name(slug, claim.dir))
    slugs.set(claim.id, slug)
  }
  return slugs
}

// ─── Serialize: DiagramData → folder files ───────────────────────────────────

export function serializeToMdFolder(data: DiagramData, modelName?: string): FolderFiles {
  return serializeToMdFolderWithPaths(data, modelName).files
}

export interface SerializeMdFolderResult {
  files: FolderFiles
  /** nodeId → relative path of the `.md` file holding that node. */
  nodePaths: Record<string, string>
}

/** `serializeToMdFolder`, also reporting where each node's file landed —
 *  paths move when a node is renamed, re-parented or gains its first child. */
export function serializeToMdFolderWithPaths(model: DiagramData, modelName?: string): SerializeMdFolderResult {
  // Another model's elements (a federation) are never written here: they
  // come from .radical/federation.json, which radical federation fetch writes.
  const data = ownModel(model)
  const files: FolderFiles = {}
  const nodePaths: Record<string, string> = {}
  const layout: LayoutSidecar = { nodes: {} }

  // Manifest.
  files[MD_MANIFEST_FILE] = serializeFrontmatter({
    radicalFormat: 'md-folder',
    version: FORMAT_VERSION,
    ...(modelName ? { name: modelName } : {}),
  }) + `\n\n# ${modelName ?? 'Radical model'}\n\nThis folder is a Radical.Tools model persisted as Markdown files (one per element) plus JSON sidecar files. Edit the \`.md\` files freely; the app keeps them in sync.\n`

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

  const defaultOf = (type: string, key: string): unknown =>
    data.metamodel?.nodeTypes[type]?.properties?.find((p) => p.key === key)?.default

  const emitNode = (node: C4Node, dir: string, slug: string): void => {
    // Record layout / state in the sidecar, not the Markdown.
    layout.nodes[node.id] = {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
      collapsed: !!node.collapsed,
    }

    const front: Record<string, Scalar> = {
      id: node.id,
      type: node.type,
      label: node.label,
    }
    // Sort remaining (custom metamodel) props for deterministic, git-stable output.
    const extraKeys = Object.keys(node)
      .filter((key) => key !== 'id' && key !== 'type' && key !== 'label' && !NODE_NONFRONT_KEYS.has(key))
      .sort()
    for (const key of extraKeys) {
      const value = (node as unknown as Record<string, unknown>)[key]
      if (value === undefined || value === null) continue
      // An empty text, an unticked box or an empty list is no value
      // (modelValue): a change undone by hand leaves the file as it was.
      // Unless the property has a default, which would show instead.
      if (modelValue(value) === null && modelValue(defaultOf(node.type, key)) === null) continue
      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) { front[key] = value as string[]; continue }
      if (typeof value === 'object') continue // defensive: no nested props expected
      front[key] = value as Scalar
    }
    const body = typeof node.description === 'string' ? node.description.trim() : ''
    const md = serializeFrontmatter(front) + (body ? `\n\n${body}\n` : '\n')

    const kids = childrenOf.get(node.id) ?? []
    if (isDirNode(node)) {
      const nodeDir = `${dir}/${slug}`
      nodePaths[node.id] = `${nodeDir}/${INDEX_BASENAME}`
      files[nodePaths[node.id]] = md
      writeChildren(kids, nodeDir)
    } else {
      nodePaths[node.id] = `${dir}/${slug}.md`
      files[nodePaths[node.id]] = md
    }
  }

  const isDirNode = (node: C4Node): boolean => isContainerType(node.type) || (childrenOf.get(node.id)?.length ?? 0) > 0

  function writeChildren(nodes: C4Node[], dir: string): void {
    // Slugs go by id order, so the de-dup suffixes (`-2`) do not depend on
    // the store's array order (keepMdFolderPaths keeps the folder's own).
    const slugs = allocateSlugs(nodes.map((node) => ({ id: node.id, base: slugify(node.label || node.type, node.type), dir: isDirNode(node) })))
    const ordered = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    for (const node of ordered) emitNode(node, dir, slugs.get(node.id)!)
  }

  writeChildren(childrenOf.get(undefined) ?? [], NODES_DIR)

  // Layout sidecar.
  if (data.defaultPositions) layout.defaultPositions = data.defaultPositions
  if (data.defaultViewport !== undefined) layout.defaultViewport = data.defaultViewport
  if (data.defaultLayoutConstraints?.length) layout.defaultLayoutConstraints = data.defaultLayoutConstraints
  if (data.defaultEdgeStyle && data.defaultEdgeStyle !== 'curved') layout.defaultEdgeStyle = data.defaultEdgeStyle
  files[LAYOUT_FILE] = stableStringify(layout)

  // Non-semantic / structurally-complex collections → JSON sidecars.
  // Relation order is not semantic → sort by id for stable diffs.
  if (data.relations && data.relations.length > 0) {
    const relations = [...data.relations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    files[RELATIONS_FILE] = stableStringify(relations)
  }
  writeJsonIfPresent(files, VIEWS_FILE, data.views, (v) => !!v && v.length > 0)
  writeJsonIfPresent(files, SEQUENCES_FILE, data.sequences, (s) => !!s && s.length > 0)
  writeJsonIfPresent(files, SNAPSHOTS_FILE, data.snapshots, (s) => !!s && s.length > 0)
  writeJsonIfPresent(files, PRESENTATIONS_FILE, data.presentations, (p) => !!p && p.length > 0)
  if (data.metamodel) files[METAMODEL_FILE] = stableStringify(data.metamodel, METAMODEL_ORDERED_KEYS)
  if (data.hubTemplates && Object.keys(data.hubTemplates).length > 0) {
    files[HUB_TEMPLATES_FILE] = stableStringify(data.hubTemplates)
  }

  return { files, nodePaths }
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

export interface DeserializeMdFolderResult {
  data: DiagramData
  /** The model's name in `radical.md`, where it has one. */
  name?: string
}

export function deserializeFromMdFolder(
  files: FolderFiles,
): DeserializeMdFolderResult {
  const layout = readJson<LayoutSidecar>(files, LAYOUT_FILE) ?? { nodes: {} }

  interface ParsedNode {
    path: string
    front: Record<string, Scalar>
    body: string
    /** Directory key that identifies this node as a container (or null). */
    ownDirKey: string | null
    parentDirKey: string
  }

  const storedMetamodel = readJson<Metamodel>(files, METAMODEL_FILE)
  const typeSize = (type: string): { width: number; height: number } => {
    const def = storedMetamodel?.nodeTypes?.[type]
    if (def?.width && def?.height) return { width: def.width, height: def.height }
    return NODE_SIZES[type as keyof typeof NODE_SIZES] ?? { width: 200, height: 100 }
  }

  const parsedByDirKey = new Map<string, string>() // dirKey → node id
  const parsed: ParsedNode[] = []

  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(NODES_DIR + '/') || !path.endsWith('.md')) continue
    // Skipped as "not a node", an element in a file git could not merge
    // vanished without a word, and the next save dropped its layout.
    if (CONFLICT_MARKER.test(content)) throw new MalformedFolderFileError(path, 'git conflict markers')
    const { front, body } = parseMarkdown(content)
    if (!front.id || !front.type) continue
    const isIndex = path.endsWith('/' + INDEX_BASENAME)
    if (isIndex) {
      const ownDirKey = dirname(path) // e.g. nodes/system-a
      parsed.push({ path, front, body, ownDirKey, parentDirKey: dirname(ownDirKey) })
      parsedByDirKey.set(ownDirKey, String(front.id))
    } else {
      parsed.push({ path, front, body, ownDirKey: null, parentDirKey: dirname(path) })
    }
  }


  const nodes: C4Node[] = parsed.map((p) => {
    const id = String(p.front.id)
    const parentId = p.parentDirKey === NODES_DIR ? undefined : parsedByDirKey.get(p.parentDirKey)
    // A node the layout does not know (a file written by hand, or brought in
    // by git) has its type's size; Studio gives it a place (placeUnplaced).
    const size = typeSize(String(p.front.type))
    const lay = layout.nodes[id] ?? { x: 0, y: 0, width: size.width, height: size.height, collapsed: false }
    const node: Record<string, unknown> = {
      id,
      type: p.front.type,
      label: typeof p.front.label === 'string' ? p.front.label : String(p.front.label ?? ''),
      x: lay.x,
      y: lay.y,
      width: lay.width,
      height: lay.height,
      collapsed: !!lay.collapsed,
    }
    if (parentId) node.parentId = parentId
    if (p.body) node.description = p.body
    for (const [key, value] of Object.entries(p.front)) {
      if (key === 'id' || key === 'type' || key === 'label') continue
      node[key] = value
    }
    return node as unknown as C4Node
  })

  const relations = readJson<C4Relation[]>(files, RELATIONS_FILE) ?? []
  const data: DiagramData = { nodes, relations }

  const views = readJson<DiagramView[]>(files, VIEWS_FILE)
  if (views) data.views = views
  const sequences = readJson<DiagramSequence[]>(files, SEQUENCES_FILE)
  if (sequences) data.sequences = sequences
  const snapshots = readJson<DiagramSnapshot[]>(files, SNAPSHOTS_FILE)
  if (snapshots) data.snapshots = snapshots
  const presentations = readJson<Presentation[]>(files, PRESENTATIONS_FILE)
  if (presentations) data.presentations = presentations
  if (storedMetamodel) data.metamodel = storedMetamodel
  const hubTemplates = readJson<DiagramData['hubTemplates']>(files, HUB_TEMPLATES_FILE)
  if (hubTemplates) data.hubTemplates = hubTemplates

  if (layout.defaultPositions) data.defaultPositions = layout.defaultPositions
  if (layout.defaultViewport !== undefined) data.defaultViewport = layout.defaultViewport
  if (layout.defaultLayoutConstraints?.length) data.defaultLayoutConstraints = layout.defaultLayoutConstraints
  if (layout.defaultEdgeStyle === 'orthogonal') data.defaultEdgeStyle = layout.defaultEdgeStyle

  const manifest = typeof files[MD_MANIFEST_FILE] === 'string' ? parseMarkdown(files[MD_MANIFEST_FILE]).front.name : undefined
  return { data: migrateChecks(data), ...(typeof manifest === 'string' && manifest.trim() ? { name: manifest.trim() } : {}) }
}

/** True when the file map looks like a Radical md-folder (has the manifest). */
export function isMdFolder(files: FolderFiles): boolean {
  return typeof files[MD_MANIFEST_FILE] === 'string'
}

/** True for a path where this format keeps model content: the manifest, a
 *  known JSON sidecar, or a `.md` under `nodes/`. The files a folder session
 *  reads, stamps and watches — everything else in the folder is ignored. */
export function isMdFolderModelPath(path: string): boolean {
  if (path === MD_MANIFEST_FILE || SIDECAR_FILES.has(path)) return true
  return path.startsWith(NODES_DIR + '/') && path.endsWith('.md')
}

/** True for a file this format writes and may therefore delete: the manifest,
 *  a known JSON sidecar, or a node `.md` under `nodes/` carrying an `id` and
 *  `type` in its frontmatter. Anything else in the folder — a `package.json`,
 *  a hand-written `nodes/README.md` — belongs to the user. */
export function isOwnedMdFolderFile(path: string, content: string): boolean {
  if (path === MD_MANIFEST_FILE || SIDECAR_FILES.has(path)) return true
  if (!isMdFolderModelPath(path)) return false
  const { front } = parseMarkdown(content)
  return !!front.id && !!front.type
}

/** True when `content` is a manifest this version reads: Markdown-folder
 *  format, version 1. */
export function isValidMdFolderManifest(content: string | undefined): boolean {
  return content !== undefined
    && /^radicalFormat:\s*["']?md-folder["']?\s*$/m.test(content)
    && /^version:\s*1\s*$/m.test(content)
}

/** The JSON sidecars a folder may hold. */
export const MD_FOLDER_JSON_FILES: readonly string[] = [...SIDECAR_FILES]

/** A `.md` file under `nodes/`, as its frontmatter reads. */
export interface MdFolderNodeFile {
  path: string
  id?: string
  type?: string
  /** The file starts with a frontmatter block. A file without one (a
   *  hand-written README) is no node and not meant to be. */
  frontmatter: boolean
  /** Git left conflict markers in it. */
  conflict: boolean
}

/** Every `.md` file under `nodes/` with the node its frontmatter names. */
export function mdFolderNodeFiles(files: FolderFiles): MdFolderNodeFile[] {
  return Object.entries(files)
    .filter(([path]) => path.startsWith(NODES_DIR + '/') && path.endsWith('.md'))
    .map(([path, content]) => {
      const { front } = parseMarkdown(content)
      return {
        path,
        ...(front.id ? { id: String(front.id) } : {}),
        ...(front.type ? { type: String(front.type) } : {}),
        frontmatter: stripBom(content).replace(/\r\n/g, '\n').startsWith('---\n'),
        conflict: CONFLICT_MARKER.test(content),
      }
    })
}

/** Paths in `existing` (what is on disk now) that a write of `next` leaves
 *  stale: files we own that `next` no longer contains. */
export function staleMdFolderFiles(existing: FolderFiles, next: FolderFiles): string[] {
  return Object.keys(existing).filter(
    (path) => !(path in next) && isOwnedMdFolderFile(path, existing[path]),
  )
}

/** A node's file, where it sits in the folder's tree. */
interface PlacedNodeFile {
  id: string
  path: string
  /** Its slug: the file's name without `.md`, or its directory's name. */
  slug: string
  /** The slug its label gives (slugify). */
  base: string
  dir: boolean
  /** The directory holding it: `nodes`, or a parent's directory. */
  parentKey: string
}

function placedNodeFiles(files: FolderFiles): Map<string, PlacedNodeFile> {
  const placed = new Map<string, PlacedNodeFile>()
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(NODES_DIR + '/') || !path.endsWith('.md')) continue
    const { front } = parseMarkdown(content)
    if (!front.id || !front.type) continue
    const dir = path.endsWith('/' + INDEX_BASENAME)
    const own = dir ? dirname(path) : path.slice(0, -'.md'.length)
    const type = String(front.type)
    const label = typeof front.label === 'string' ? front.label : String(front.label ?? '')
    placed.set(String(front.id), { id: String(front.id), path, slug: own.slice(own.lastIndexOf('/') + 1), base: slugify(label || type, type), dir, parentKey: dirname(own) })
  }
  return placed
}

/** `slug` is `base`, or `base` with a de-dup suffix (`-2`). */
function fitsBase(slug: string, base: string): boolean {
  const [s, b] = [slug.toLowerCase(), base.toLowerCase()]
  return s === b || (s.startsWith(`${b}-`) && /^\d+$/.test(s.slice(b.length + 1)))
}

/** `next` (a serialized model) with each node's file where `existing` (the
 *  folder as it is) has it: an element keeps its path unless it is renamed
 *  or moved itself. The serializer names files afresh: renaming one element
 *  to its sibling's label, or adding an element named as one already there,
 *  moved the other's file to `-2` when its id sorted later. A node keeps its
 *  slug when its parent is the same and its label gives that slug, with or
 *  without a de-dup suffix; its children go with it. */
export function keepMdFolderPaths(existing: FolderFiles, next: FolderFiles): FolderFiles {
  const before = placedNodeFiles(existing)
  if (before.size === 0) return next
  const after = placedNodeFiles(next)
  const parentOf = (placed: Map<string, PlacedNodeFile>): Map<string, string | undefined> => {
    const byDir = new Map<string, string>()
    for (const file of placed.values()) if (file.dir) byDir.set(dirname(file.path), file.id)
    return new Map([...placed.values()].map((file) => [file.id, file.parentKey === NODES_DIR ? undefined : byDir.get(file.parentKey)]))
  }
  const parentBefore = parentOf(before)
  const parentAfter = parentOf(after)
  const kidsOf = new Map<string | undefined, PlacedNodeFile[]>()
  for (const file of after.values()) {
    const parent = parentAfter.get(file.id)
    const kids = kidsOf.get(parent) ?? []
    kids.push(file)
    kidsOf.set(parent, kids)
  }

  const out: FolderFiles = {}
  const nodePaths = new Set([...after.values()].map((file) => file.path))
  for (const [path, content] of Object.entries(next)) if (!nodePaths.has(path)) out[path] = content
  let moved = false
  const placed = new Set<string>()
  const place = (parent: string | undefined, dir: string): void => {
    const kids = kidsOf.get(parent) ?? []
    const slugs = allocateSlugs(kids.map((file) => {
      const was = before.get(file.id)
      const keep = was && parentBefore.get(file.id) === parent && fitsBase(was.slug, file.base)
      return { id: file.id, base: file.base, dir: file.dir, want: file.slug, ...(keep ? { keep: was.slug } : {}) }
    }))
    for (const file of kids) {
      const slug = slugs.get(file.id)!
      const path = file.dir ? `${dir}/${slug}/${INDEX_BASENAME}` : `${dir}/${slug}.md`
      if (path !== file.path) moved = true
      placed.add(file.id)
      out[path] = next[file.path]
      if (file.dir) place(file.id, `${dir}/${slug}`)
    }
  }
  place(undefined, NODES_DIR)
  // A node the walk did not reach (none, from the serializer) stays put.
  for (const file of after.values()) if (!placed.has(file.id)) out[file.path] = next[file.path]
  return moved ? out : next
}

/** A file of the folder that is there but cannot be read as what it is. */
export class MalformedFolderFileError extends Error {
  constructor(readonly path: string, readonly reason = 'malformed JSON') {
    super(`${reason[0].toUpperCase()}${reason.slice(1)} in ${path}`)
    this.name = 'MalformedFolderFileError'
  }
}

/** Lines git leaves in a file it could not merge. */
const CONFLICT_MARKER = /^(<{7}|>{7})( |$)|^={7}$/m

/** The JSON file at `path`, or undefined when the folder has none. A file
 *  that is there and does not parse is an error. It used to read as "no
 *  such file": a trailing comma in relations.json (or git conflict markers,
 *  or a file caught half written) gave a model with no relations and no
 *  message, and the next save removed the file as stale. */
function readJson<T>(files: FolderFiles, path: string): T | undefined {
  const content = files[path]
  if (content === undefined) return undefined
  try {
    return JSON.parse(stripBom(content)) as T
  } catch {
    throw new MalformedFolderFileError(path)
  }
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}
