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
const VIEWS_FILE = 'views.json'
const SEQUENCES_FILE = 'sequences.json'
const SNAPSHOTS_FILE = 'snapshots.json'
const PRESENTATIONS_FILE = 'presentations.json'
const METAMODEL_FILE = 'metamodel.json'
const HUB_TEMPLATES_FILE = 'hubTemplates.json'
const NODES_DIR = 'nodes'
const INDEX_BASENAME = '_index.md'

const FORMAT_VERSION = 1

/** Node keys that are layout/state, not semantic — kept out of the `.md`. */
const NODE_LAYOUT_KEYS = new Set(['x', 'y', 'width', 'height', 'collapsed'])
/** Node keys reconstructed from the folder structure / body, not frontmatter. */
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
  nodes: Record<string, NodeLayout>
  defaultPositions?: Record<string, NodePosition>
  defaultViewport?: { x: number; y: number; zoom: number } | null
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

// ─── Serialize: DiagramData → folder files ───────────────────────────────────

export function serializeToMdFolder(data: DiagramData, modelName?: string): FolderFiles {
  const files: FolderFiles = {}
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

  // Layout sidecar.
  if (data.defaultPositions) layout.defaultPositions = data.defaultPositions
  if (data.defaultViewport !== undefined) layout.defaultViewport = data.defaultViewport
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
    const lay = layout.nodes[id] ?? { x: 0, y: 0, width: 0, height: 0, collapsed: false }
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

  const relations = readJson<C4Relation[]>(files[RELATIONS_FILE]) ?? []
  const data: DiagramData = { nodes, relations }

  const views = readJson<DiagramView[]>(files[VIEWS_FILE])
  if (views) data.views = views
  const sequences = readJson<DiagramSequence[]>(files[SEQUENCES_FILE])
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
