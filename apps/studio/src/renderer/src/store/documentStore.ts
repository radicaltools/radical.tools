// ─── Document persistence layer ──────────────────────────────────────────────
//
// Provides a small library/CRUD around DiagramData with two backends:
//   • 'ls' — payload kept in localStorage under `radical-doc:<id>`
//   • 'fs' — payload kept in a file on disk; we only track its path here
//
// The list of documents and the active id is persisted in localStorage under
// `radical-docs-index`. This module is intentionally framework-agnostic
// (plain functions + zustand store) so the diagram store can wire into it.

import { create } from 'zustand'
import type { DiagramData, C4Node } from '@radical/common/c4'
import { host } from '../platform/host'
import {
  serializeToMdFolder,
  serializeToMdFolderWithPaths,
  deserializeFromMdFolder,
  extractNodeBody,
  isMdFolder,
  type FolderFiles,
} from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import {
  webFolderSupported,
  pickWebDirectory,
  readOneFileFromHandle,
  handleFolderStorage,
  type FsDirHandle,
  verifyPermission,
  saveHandle,
  loadHandle,
  removeHandle,
  writeSelectionToHandle,
} from '../persist/webFolder'

const LS_INDEX_KEY = 'radical-docs-index'
const LS_DOC_PREFIX = 'radical-doc:'
/** Legacy single-slot key from the previous persistence iteration. */
const LS_LEGACY_KEY = 'radical-diagram-v1'

/** Web md-folder docs (source==='md', no native host folder access) whose directory handle
 *  has verified read/write permission this session. Writes are skipped until a
 *  folder is "connected" so a permission-pending handle can never clobber the
 *  user's files with an empty/stale model after a reload. */
const connectedWebFolders = new Set<string>()

/** Id of the document ensureActive() seeded on this boot because the index was
 *  empty, i.e. a first visit. The welcome screen hides it from "recent" so a
 *  newcomer is not greeted by a model they never made. */
let bootSeededId: string | null = null

/** Md-folder docs (source==='md') loaded lazily: docId → nodeId → relative
 *  .md file path, for node bodies not read into memory at load time. Static
 *  once populated — "already hydrated" is tracked by the caller (diagramStore),
 *  not here; re-fetching a path here is idempotent, just redundant I/O. */
const mdBodyPaths = new Map<string, Record<string, string>>()

/** docId → the md-folder files as `loadDocument` last read them, bodies
 *  included, for the descriptions not yet hydrated (see changeFlash). */
const mdLoadedFiles = new Map<string, Record<string, string>>()

/** Per-document chain of disk writes (fs / md docs). A folder write is many
 *  files followed by a prune, so two overlapping writes can each prune what the
 *  other just wrote — a renamed node would lose both its old and new file.
 *  Writes therefore run one at a time. */
const saveChains = new Map<string, Promise<void>>()
/** Newest payload per document not yet handed to a write: saves that queue up
 *  behind a slow write collapse into one write of the latest state. */
const queuedSaves = new Map<string, DiagramData>()

/** Web md-folder docs: the session over each doc's directory handle, which
 *  remembers what was last read so writes never clobber outside edits. (In
 *  Electron the main process keeps the equivalent session per folder.) */
const webSessions = new Map<string, MdFolderSession>()
/** How often a web md-folder doc's directory is checked for outside edits. */
const WEB_FOLDER_POLL_MS = 2000

/** Per md doc, who to tell when its folder changes outside Studio — set by
 *  `watchDocument`. */
const externalChangeListeners = new Map<string, () => void>()
/** Hosts whose folder-change events are already routed to the listeners. */
const routedHosts = new WeakSet<object>()

function notifyExternalChange(id: string): void {
  externalChangeListeners.get(id)?.()
}

function webSession(id: string, handle: FsDirHandle): MdFolderSession {
  let session = webSessions.get(id)
  if (!session) {
    session = new MdFolderSession(handleFolderStorage(handle))
    session.onExternalChange = () => notifyExternalChange(id)
    webSessions.set(id, session)
  }
  return session
}

export type DocumentSource = 'ls' | 'fs' | 'md'

export interface DocumentMeta {
  id: string
  name: string
  source: DocumentSource
  /** Absolute path on disk (only for `source === 'fs'`). */
  filePath?: string
  /** Absolute folder path on disk (only for `source === 'md'`). */
  folderPath?: string
  /** Epoch ms of last successful save through this layer. */
  lastModified: number
}

interface DocumentsIndex {
  docs: DocumentMeta[]
  activeId: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID()
}

function readIndex(): DocumentsIndex {
  if (typeof localStorage === 'undefined') return { docs: [], activeId: null }
  try {
    const raw = localStorage.getItem(LS_INDEX_KEY)
    if (!raw) return { docs: [], activeId: null }
    const parsed = JSON.parse(raw) as DocumentsIndex
    if (!parsed || !Array.isArray(parsed.docs)) return { docs: [], activeId: null }
    return parsed
  } catch {
    return { docs: [], activeId: null }
  }
}

function writeIndex(idx: DocumentsIndex): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_INDEX_KEY, JSON.stringify(idx)) } catch (e) {
    console.warn('[documentStore] writeIndex failed:', e)
  }
}

function lsKeyFor(id: string): string {
  return LS_DOC_PREFIX + id
}

/** The stored content of a localStorage document, read synchronously. */
export function readLocalDocument(id: string): DiagramData | null {
  return readLSPayload(id)
}

function readLSPayload(id: string): DiagramData | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(lsKeyFor(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DiagramData
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.relations)) return null
    return parsed
  } catch (e) {
    console.warn('[documentStore] readLSPayload failed:', e)
    return null
  }
}

function writeLSPayload(id: string, data: DiagramData): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(lsKeyFor(id), JSON.stringify(data)) } catch (e) {
    console.warn('[documentStore] writeLSPayload failed:', e)
  }
}

function deleteLSPayload(id: string): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(lsKeyFor(id)) } catch { /* noop */ }
}

/** A model file's name without its extension (.radical, .c4.json or .json). */
function stripModelExtension(fileName: string): string {
  return fileName.replace(/\.radical$/i, '').replace(/\.c4\.json$/i, '').replace(/\.json$/i, '') || fileName
}

function defaultNameFromPath(filePath: string): string {
  return stripModelExtension(filePath.split(/[\\/]/).pop() ?? filePath)
}

function defaultNameFromFolder(folderPath: string): string {
  const base = folderPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? folderPath
  return base || folderPath
}

/** Fetch one md-folder node's body from disk (Electron file or web handle),
 *  without caching it anywhere — the caller decides what to do with it. */
async function fetchNodeBody(id: string, nodeId: string): Promise<string | undefined> {
  const h = host()
  const meta = readIndex().docs.find(d => d.id === id)
  if (!meta) return undefined
  const relPath = mdBodyPaths.get(id)?.[nodeId]
  if (!relPath) return undefined
  try {
    if (meta.folderPath && h.readFile) {
      const res = await h.readFile(`${meta.folderPath}/${relPath}`)
      if (!res.success || res.content === undefined) return undefined
      return extractNodeBody(res.content)
    }
    if (!h.readFile && webFolderSupported()) {
      const handle = await loadHandle(id)
      if (!handle) return undefined
      const content = await readOneFileFromHandle(handle, relPath)
      return extractNodeBody(content)
    }
  } catch { return undefined }
  return undefined
}

/** For an md-folder save: return `data.nodes`, with any not-yet-hydrated
 *  node's `description` filled in by a transient re-read of its file. Never
 *  mutates `data` or caches into the live store — purely for serialization,
 *  so a node the user never opened can't have its saved content clobbered
 *  with an empty description. */
async function nodesForMdSave(id: string, data: DiagramData): Promise<C4Node[]> {
  const pending = mdBodyPaths.get(id)
  if (!pending || Object.keys(pending).length === 0) return data.nodes
  let patched: C4Node[] | null = null
  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i]
    if (node.description !== undefined || !(node.id in pending)) continue
    const body = await fetchNodeBody(id, node.id)
    if (body === undefined) continue
    if (!patched) patched = data.nodes.slice()
    patched[i] = { ...node, description: body }
  }
  return patched ?? data.nodes
}

/** After an md-folder write, point each still-unhydrated node at the file it
 *  now lives in — a rename or re-parent moves the file and the prune deletes
 *  the old one — and forget nodes that no longer exist. The bodies moved with
 *  their nodes: `nodesForMdSave` put them into this write. */
function retargetBodyPaths(id: string, nodePaths: Record<string, string>): void {
  const pending = mdBodyPaths.get(id)
  if (!pending) return
  const next: Record<string, string> = {}
  for (const nodeId of Object.keys(pending)) {
    if (nodePaths[nodeId]) next[nodeId] = nodePaths[nodeId]
  }
  mdBodyPaths.set(id, next)
}

/** Resolves once every write queued for `id` so far has finished. */
async function saveSettled(id: string): Promise<void> {
  await saveChains.get(id)?.catch(() => {})
}

function enqueueSave(id: string, data: DiagramData): Promise<void> {
  queuedSaves.set(id, data)
  const run = async (): Promise<void> => {
    const next = queuedSaves.get(id)
    if (!next) return // an earlier run already wrote the newest payload
    queuedSaves.delete(id)
    await writeDocument(id, next)
  }
  const chain = (saveChains.get(id) ?? Promise.resolve()).then(run, run)
  saveChains.set(id, chain)
  const cleanup = (): void => { if (saveChains.get(id) === chain) saveChains.delete(id) }
  chain.then(cleanup, cleanup)
  return chain
}

/** Whether "Save as folder" may write into a folder that already holds these
 *  files: always for an empty folder or an existing Radical model, otherwise
 *  only when the user confirms. */
async function mayWriteInto(
  files: FolderFiles,
  folderName: string,
  confirmForeign?: (folderName: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  if (Object.keys(files).length === 0 || isMdFolder(files)) return true
  return confirmForeign ? await confirmForeign(folderName) : false
}

/** Write a disk-backed (fs / md) document. Called only through `enqueueSave`. */
async function writeDocument(id: string, data: DiagramData): Promise<void> {
  const h = host()
  const idx = readIndex()
  const meta = idx.docs.find(d => d.id === id)
  if (!meta) return
  if (meta.source === 'fs' && meta.filePath && h.writeFile) {
    const json = JSON.stringify(data, null, 2)
    const res = await h.writeFile(meta.filePath, json)
    if (!res.success) {
      console.warn('[documentStore] FS write failed for', meta.filePath, res.error)
      return
    }
  } else if (meta.source === 'md' && meta.folderPath && h.writeFolder) {
    const nodes = await nodesForMdSave(id, data)
    const { files, nodePaths } = serializeToMdFolderWithPaths({ ...data, nodes }, meta.name)
    const res = await h.writeFolder(meta.folderPath, files)
    if (!res.success) {
      if (res.conflict) {
        // The folder changed outside Studio; the host reports it and the
        // document is reloaded from disk — the outside edit wins.
        console.warn('[documentStore] folder changed on disk, not overwriting:', res.conflict)
      } else {
        console.warn('[documentStore] folder write failed for', meta.folderPath, res.error)
      }
      return
    }
    retargetBodyPaths(id, nodePaths)
  } else if (meta.source === 'md' && !h.writeFolder && webFolderSupported()) {
    // Never write until the handle's permission is verified this session,
    // so a reload with a permission-pending handle can't overwrite files.
    if (!connectedWebFolders.has(id)) {
      const handle = await loadHandle(id)
      if (!handle || !(await verifyPermission(handle, 'readwrite', false))) return
      connectedWebFolders.add(id)
    }
    const handle = await loadHandle(id)
    if (!handle) return
    try {
      const nodes = await nodesForMdSave(id, data)
      const { files, nodePaths } = serializeToMdFolderWithPaths({ ...data, nodes }, meta.name)
      const res = await webSession(id, handle).write(files)
      if (!res.ok) {
        console.warn('[documentStore] folder changed on disk, not overwriting:', res.conflict)
        return
      }
      retargetBodyPaths(id, nodePaths)
    } catch (e) {
      console.warn('[documentStore] web folder write failed:', e)
      return
    }
  } else {
    return
  }
  meta.lastModified = Date.now()
  writeIndex(idx)
  notify()
}

/** Browser-only file picker used when running outside Electron. Resolves with
 *  `{ name, content }` for the chosen file, or `null` if the user cancels.
 *  Implemented via a transient <input type="file"> that we click(). */
function defaultWebFilePicker(): Promise<{ name: string; content: string } | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.radical,.json,application/json'
    input.style.display = 'none'
    let settled = false
    const finish = (v: { name: string; content: string } | null): void => {
      if (settled) return
      settled = true
      try { document.body.removeChild(input) } catch { /* already gone */ }
      resolve(v)
    }
    input.addEventListener('change', () => {
      const f = input.files?.[0]
      if (!f) { finish(null); return }
      const reader = new FileReader()
      reader.onload = () => finish({ name: f.name, content: String(reader.result ?? '') })
      reader.onerror = () => finish(null)
      reader.readAsText(f)
    })
    // Most browsers fire neither change nor cancel when the dialog is
    //  dismissed, so we also listen for window focus as a best-effort
    //  cancel signal (only resolves null if no file ended up selected).
    const onFocus = (): void => {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => { if (!input.files || input.files.length === 0) finish(null) }, 300)
    }
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input)
    input.click()
  })
}

/** Browser-only downloader used when running outside Electron. Triggers a
 *  download of `json` as `suggestedName` and resolves with the filename used
 *  (or null if the environment cannot download). The browser does not tell
 *  us whether the user picked a different name in their Save dialog, so we
 *  return the suggested name and the meta display name reflects that. */
function defaultWebDownloader(suggestedName: string, json: string): Promise<string | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    return Promise.resolve(null)
  }
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Defer cleanup so Safari/Firefox have time to consume the blob URL.
    setTimeout(() => {
      try { document.body.removeChild(a) } catch { /* already gone */ }
      URL.revokeObjectURL(url)
    }, 1000)
    return Promise.resolve(suggestedName)
  } catch (e) {
    console.warn('[documentStore] saveAsFile web download failed:', e)
    return Promise.resolve(null)
  }
}

/** One-shot migration: if the user has data under the legacy single-slot key
 *  but the new index is empty, import it as the first LS document. */
function migrateLegacyIfNeeded(index: DocumentsIndex): DocumentsIndex {
  if (typeof localStorage === 'undefined') return index
  if (index.docs.length > 0) return index
  let raw: string | null = null
  try { raw = localStorage.getItem(LS_LEGACY_KEY) } catch { return index }
  if (!raw) return index
  try {
    const parsed = JSON.parse(raw) as DiagramData
    if (!parsed || !Array.isArray(parsed.nodes)) return index
    const id = uid()
    const meta: DocumentMeta = {
      id,
      name: 'Imported (legacy)',
      source: 'ls',
      lastModified: Date.now(),
    }
    writeLSPayload(id, parsed)
    const next: DocumentsIndex = { docs: [meta], activeId: id }
    writeIndex(next)
    try { localStorage.removeItem(LS_LEGACY_KEY) } catch { /* noop */ }
    console.debug('[documentStore] migrated legacy single-slot diagram into doc', id)
    return next
  } catch {
    return index
  }
}

// ─── Public API (pure functions) ─────────────────────────────────────────────

export interface DocumentsAPI {
  listDocuments(): DocumentMeta[]
  getActiveId(): string | null
  setActiveId(id: string | null): void

  createLSDocument(name: string, seed?: DiagramData): DocumentMeta

  /** Register an FS-backed document without a native dialog.
   *  Used when a file path is supplied programmatically (e.g. via the
   *  `--file` CLI flag). De-dupes by path: returns the existing meta if
   *  this path is already tracked. The document content is NOT loaded here;
   *  the caller must call `loadDocument` / `setActiveId` afterwards. */
  createFSDocument(filePath: string): DocumentMeta

  /** Register an md-folder-backed document for an already-chosen folder path.
   *  De-dupes by path. Content is NOT loaded here. */
  createMdDocument(folderPath: string): DocumentMeta

  /** Read the payload for a document. Async because FS reads cross IPC.
   *  For md-folder docs, node bodies (descriptions) are loaded lazily — see
   *  `getPendingBodyNodeIds` / `hydrateNodeBody`. */
  loadDocument(id: string): Promise<DiagramData | null>

  /** Node ids whose body (.md file) was not read into `loadDocument`'s
   *  result — empty for non-md docs or once nothing is pending. */
  getPendingBodyNodeIds(id: string): string[]

  /** The md-folder files as `loadDocument` last read them, bodies included. */
  loadedFolderFiles(id: string): Record<string, string> | undefined

  /** Fetch one node's body on demand (md-folder docs only). Pure fetch —
   *  does not cache or mutate any store; the caller merges the result. */
  hydrateNodeBody(id: string, nodeId: string): Promise<string | undefined>

  /** Persist new payload under an existing document. For md-folder docs,
   *  any node whose body was never hydrated is re-read from disk just for
   *  serialization (never cached into the live model) so an unopened
   *  node's saved content is never clobbered with an empty description.
   *  localStorage docs are written synchronously (before this returns), so a
   *  page-hide flush lands; disk writes run one at a time per document. */
  saveDocument(id: string, data: DiagramData): Promise<void>

  /** Update the display name. (Does NOT rename files on disk.) */
  renameDocument(id: string, newName: string): void

  /** Remove the doc from the index. Optionally delete its LS payload. */
  deleteDocument(id: string, opts?: { wipePayload?: boolean }): void

  /** Open dialog (Electron) or HTML file picker (web) -> register as a doc.
   *  Electron path adds an FS-backed doc bound to the chosen path.
   *  Web path adds an LS-backed doc seeded with the parsed JSON content.
   *  Returns the new (or re-activated) meta, or null if the user cancelled
   *  / the file was unparsable. The optional `pickerOverride` is an injection
   *  seam for tests — production callers pass nothing. */
  importFromFile(
    pickerOverride?: () => Promise<{ name: string; content: string } | null>,
  ): Promise<DocumentMeta | null>

  /** Save the doc's payload to disk.
   *  Electron path: native Save dialog -> writes via preload IPC and turns
   *  the doc into FS-backed, bound to the chosen path.
   *  Web path: triggers a browser download of the JSON; the doc stays
   *  LS-backed (the browser has no writable absolute path) but its display
   *  name is updated to match the chosen filename. The optional
   *  `downloadOverride` is an injection seam for tests.
   *  Returns the (possibly mutated) meta, or null on cancel / failure. */
  saveAsFile(
    id: string,
    data: DiagramData,
    downloadOverride?: (filename: string, json: string) => Promise<string | null>,
  ): Promise<DocumentMeta | null>

  /** Open a folder (Electron only) containing a Radical md-folder model and
   *  register it as an md-backed document. Returns the meta, or null on
   *  cancel / unavailable environment. */
  importFromFolder(): Promise<DocumentMeta | null>

  /** Pick a destination folder (Electron or web), write the current payload as
   *  a Markdown folder, and convert the doc to md-backed. A folder that already
   *  holds `.md` / `.json` files but is not a Radical model is written into
   *  only if `confirmForeignFolder` returns true. Returns the mutated meta, or
   *  null on cancel / failure. */
  saveAsFolder(
    id: string,
    data: DiagramData,
    confirmForeignFolder?: (folderName: string) => boolean | Promise<boolean>,
  ): Promise<DocumentMeta | null>

  /** Re-request read/write permission for a web md-folder document's handle
   *  (must be called from a user gesture). Returns true on success. */
  reconnectFolder(id: string): Promise<boolean>

  /** True when a web md-folder document has verified permission this session. */
  isFolderConnected(id: string): boolean

  /** True for a browser folder document still waiting for Reconnect: until
   *  the user grants access again, it loads as an empty model. */
  awaitsReconnect(id: string): boolean

  /** Call `onExternalChange` when a document's storage is edited outside
   *  Studio (another editor, git) — md-folder docs only: Electron's main
   *  process polls the folder, the web build polls the directory handle.
   *  Also called when a save was refused because of such an edit. Returns a
   *  function that stops watching. */
  watchDocument(id: string, onExternalChange: () => void): () => void

  /** Write the canvas selection file (`serializeSelection`) into an md-folder
   *  document's folder, for AI clients working on the same folder. No-op for
   *  other documents and for a web folder not yet connected. */
  publishSelection(id: string, content: string): Promise<void>

  /** Convenience: ensure there's at least one document; create an empty LS
   *  doc if the index is empty. Returns the active doc. */
  ensureActive(seedIfEmpty: () => DiagramData): { meta: DocumentMeta; seeded: boolean }

  /** True for the document ensureActive() seeded on this boot (first visit). */
  isBootSeeded(id: string): boolean
}

export const documents: DocumentsAPI = {
  listDocuments() {
    return readIndex().docs.slice().sort((a, b) => b.lastModified - a.lastModified)
  },

  getActiveId() {
    return readIndex().activeId
  },

  setActiveId(id) {
    const idx = readIndex()
    idx.activeId = id
    writeIndex(idx)
    notify()
  },

  createLSDocument(name, seed) {
    const idx = readIndex()
    const meta: DocumentMeta = {
      id: uid(),
      name: name.trim() || 'Untitled',
      source: 'ls',
      lastModified: Date.now(),
    }
    if (seed) writeLSPayload(meta.id, seed)
    idx.docs.push(meta)
    idx.activeId = meta.id
    writeIndex(idx)
    notify()
    return meta
  },

  createFSDocument(filePath) {
    const idx = readIndex()
    // De-dupe: if this path is already tracked, return the existing entry.
    const existing = idx.docs.find((d) => d.source === 'fs' && d.filePath === filePath)
    if (existing) return existing
    const meta: DocumentMeta = {
      id: uid(),
      name: defaultNameFromPath(filePath),
      source: 'fs',
      filePath,
      lastModified: Date.now(),
    }
    idx.docs.push(meta)
    idx.activeId = meta.id
    writeIndex(idx)
    notify()
    return meta
  },

  createMdDocument(folderPath) {
    const idx = readIndex()
    const existing = idx.docs.find((d) => d.source === 'md' && d.folderPath === folderPath)
    if (existing) return existing
    const meta: DocumentMeta = {
      id: uid(),
      name: defaultNameFromFolder(folderPath),
      source: 'md',
      folderPath,
      lastModified: Date.now(),
    }
    idx.docs.push(meta)
    idx.activeId = meta.id
    writeIndex(idx)
    notify()
    return meta
  },

  async loadDocument(id) {
    const h = host()
    const meta = readIndex().docs.find(d => d.id === id)
    if (!meta) return null
    if (meta.source === 'ls') return readLSPayload(id)
    // Don't read a folder (or file) while our own write to it is half done.
    await saveSettled(id)
    if (meta.source === 'fs' && meta.filePath && h.readFile) {
      const res = await h.readFile(meta.filePath)
      if (!res.success || !res.content) return null
      try { return JSON.parse(res.content) as DiagramData } catch { return null }
    }
    if (meta.source === 'md' && meta.folderPath && h.readFolder) {
      const res = await h.readFolder(meta.folderPath)
      if (!res.success || !res.files) return null
      if (Object.keys(res.files).length === 0) return null // empty/new folder
      try {
        const { data, bodyPaths } = deserializeFromMdFolder(res.files, { lazy: true })
        mdBodyPaths.set(id, bodyPaths ?? {})
        mdLoadedFiles.set(id, res.files)
        return data
      } catch { return null }
    }
    if (meta.source === 'md' && !h.readFolder && webFolderSupported()) {
      const handle = await loadHandle(id)
      if (!handle) return null
      if (!(await verifyPermission(handle, 'readwrite', false))) return null // needs reconnect
      connectedWebFolders.add(id)
      try {
        const files = await webSession(id, handle).readAll()
        if (Object.keys(files).length === 0) return null // empty/new folder
        const { data, bodyPaths } = deserializeFromMdFolder(files, { lazy: true })
        mdBodyPaths.set(id, bodyPaths ?? {})
        mdLoadedFiles.set(id, files)
        return data
      } catch { return null }
    }
    return null
  },

  getPendingBodyNodeIds(id) {
    return Object.keys(mdBodyPaths.get(id) ?? {})
  },

  loadedFolderFiles(id) {
    return mdLoadedFiles.get(id)
  },

  async hydrateNodeBody(id, nodeId) {
    // A write in flight may be moving this node's file; read once it landed.
    await saveSettled(id)
    return fetchNodeBody(id, nodeId)
  },

  async saveDocument(id, data) {
    const idx = readIndex()
    const meta = idx.docs.find(d => d.id === id)
    if (!meta) return
    if (meta.source !== 'ls') return enqueueSave(id, data)
    writeLSPayload(id, data)
    meta.lastModified = Date.now()
    writeIndex(idx)
    notify()
  },

  renameDocument(id, newName) {
    const idx = readIndex()
    const meta = idx.docs.find(d => d.id === id)
    if (!meta) return
    meta.name = newName.trim() || meta.name
    writeIndex(idx)
    notify()
  },

  deleteDocument(id, opts) {
    const idx = readIndex()
    const before = idx.docs.length
    const removed = idx.docs.find(d => d.id === id)
    idx.docs = idx.docs.filter(d => d.id !== id)
    if (idx.docs.length === before) return
    if (opts?.wipePayload !== false) deleteLSPayload(id)
    if (removed?.source === 'md') {
      connectedWebFolders.delete(id)
      mdBodyPaths.delete(id)
      webSessions.delete(id)
      void removeHandle(id)
    }
    if (idx.activeId === id) idx.activeId = idx.docs[0]?.id ?? null
    writeIndex(idx)
    notify()
  },

  async importFromFile(pickerOverride) {
    const h = host()
    // ── Electron path: native open dialog returns an absolute filePath we
    //    can read/write through preload IPC. We register an FS-backed doc.
    if (h.openDiagram) {
      const res = await h.openDiagram()
      if (!res.success || !res.filePath) return null
      const idx = readIndex()
      // De-dupe by path: if we already track this file, just activate it.
      const existing = idx.docs.find(d => d.source === 'fs' && d.filePath === res.filePath)
      if (existing) {
        existing.lastModified = Date.now()
        idx.activeId = existing.id
        writeIndex(idx)
        notify()
        return existing
      }
      const meta: DocumentMeta = {
        id: uid(),
        name: defaultNameFromPath(res.filePath),
        source: 'fs',
        filePath: res.filePath,
        lastModified: Date.now(),
      }
      idx.docs.push(meta)
      idx.activeId = meta.id
      writeIndex(idx)
      notify()
      return meta
    }

    // ── Web fallback: there is no filesystem path the browser can write
    //    back to, so we read the picked file's JSON and create an LS doc
    //    seeded with it. Without this branch the "Open file…" button is a
    //    silent no-op in the deployed web build.
    const picker = pickerOverride ?? defaultWebFilePicker
    const picked = await picker()
    if (!picked) return null
    let parsed: DiagramData | null = null
    try {
      parsed = JSON.parse(picked.content) as DiagramData
    } catch (e) {
      console.warn('[documentStore] importFromFile: invalid JSON', e)
      return null
    }
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.relations)) {
      console.warn('[documentStore] importFromFile: not a DiagramData payload')
      return null
    }
    return this.createLSDocument(stripModelExtension(picked.name), parsed)
  },

  async saveAsFile(id, data, downloadOverride) {
    const h = host()
    const json = JSON.stringify(data, null, 2)

    // ── Electron path: native Save dialog returns an absolute path; we
    //    convert the doc into FS-backed and drop any LS payload.
    if (h.saveDiagram) {
      const res = await h.saveDiagram(json)
      if (!res.success || !res.filePath) return null
      const idx = readIndex()
      const meta = idx.docs.find(d => d.id === id)
      if (!meta) return null
      if (meta.source === 'ls') deleteLSPayload(id)
      meta.source = 'fs'
      meta.filePath = res.filePath
      meta.name = defaultNameFromPath(res.filePath)
      meta.lastModified = Date.now()
      writeIndex(idx)
      notify()
      return meta
    }

    // ── Web fallback: there is no FS to bind to, so we trigger a browser
    //    download of the JSON. The doc stays LS-backed but adopts the
    //    chosen filename as its display name. Without this branch the
    //    "Save as file…" action was a silent no-op in the deployed web
    //    build.
    const idx = readIndex()
    const meta = idx.docs.find(d => d.id === id)
    if (!meta) return null
    const suggested = (meta.name || 'model').replace(/[\\/]/g, '_') + '.c4.json'
    const downloader = downloadOverride ?? defaultWebDownloader
    const usedName = await downloader(suggested, json)
    if (!usedName) return null
    // Mirror Electron-path behaviour: persist the new payload + name.
    writeLSPayload(id, data)
    meta.name = defaultNameFromPath(usedName)
    meta.lastModified = Date.now()
    writeIndex(idx)
    notify()
    return meta
  },

  async importFromFolder() {
    const h = host()
    // ── Electron: native directory dialog → read via IPC. ──
    if (h.openFolder) {
      const res = await h.openFolder()
      if (!res.success || !res.folderPath) return null
      const idx = readIndex()
      const existing = idx.docs.find((d) => d.source === 'md' && d.folderPath === res.folderPath)
      if (existing) {
        existing.lastModified = Date.now()
        idx.activeId = existing.id
        writeIndex(idx)
        notify()
        return existing
      }
      const meta: DocumentMeta = {
        id: uid(),
        name: defaultNameFromFolder(res.folderPath),
        source: 'md',
        folderPath: res.folderPath,
        lastModified: Date.now(),
      }
      idx.docs.push(meta)
      idx.activeId = meta.id
      writeIndex(idx)
      notify()
      return meta
    }

    // ── Web: File System Access API directory picker → handle in IndexedDB. ──
    if (webFolderSupported()) {
      const handle = await pickWebDirectory()
      if (!handle) return null
      const idx = readIndex()
      const meta: DocumentMeta = {
        id: uid(),
        name: handle.name || 'model',
        source: 'md',
        lastModified: Date.now(),
      }
      await saveHandle(meta.id, handle)
      connectedWebFolders.add(meta.id)
      webSessions.delete(meta.id)
      idx.docs.push(meta)
      idx.activeId = meta.id
      writeIndex(idx)
      notify()
      return meta
    }
    return null
  },

  async saveAsFolder(id, data, confirmForeignFolder) {
    const h = host()
    // ── Electron: pick a destination folder, write via IPC. ──
    if (h.pickFolder && h.writeFolder) {
      const idx = readIndex()
      const meta = idx.docs.find((d) => d.id === id)
      if (!meta) return null
      const picked = await h.pickFolder()
      if (!picked.success || !picked.folderPath) return null
      const name = defaultNameFromFolder(picked.folderPath)
      const present = h.readFolder ? await h.readFolder(picked.folderPath) : null
      if (present?.success && present.files && !(await mayWriteInto(present.files, name, confirmForeignFolder))) {
        return null
      }
      const files = serializeToMdFolder(data, name)
      const res = await h.writeFolder(picked.folderPath, files)
      if (!res.success) {
        console.warn('[documentStore] saveAsFolder write failed:', res.error)
        return null
      }
      if (meta.source === 'ls') deleteLSPayload(id)
      meta.source = 'md'
      meta.folderPath = picked.folderPath
      meta.filePath = undefined
      meta.name = name
      meta.lastModified = Date.now()
      writeIndex(idx)
      notify()
      return meta
    }

    // ── Web: pick a directory handle, write, convert doc to md-backed. ──
    if (webFolderSupported()) {
      const idx = readIndex()
      const meta = idx.docs.find((d) => d.id === id)
      if (!meta) return null
      const handle = await pickWebDirectory()
      if (!handle) return null
      const name = handle.name || meta.name
      const session = new MdFolderSession(handleFolderStorage(handle))
      try {
        if (!(await mayWriteInto(await session.readAll(), name, confirmForeignFolder))) return null
        const res = await session.write(serializeToMdFolder(data, name))
        if (!res.ok) return null // changed while we were writing; nothing written
      } catch (e) {
        console.warn('[documentStore] web saveAsFolder write failed:', e)
        return null
      }
      await saveHandle(meta.id, handle)
      connectedWebFolders.add(meta.id)
      session.onExternalChange = () => notifyExternalChange(meta.id)
      webSessions.set(meta.id, session)
      if (meta.source === 'ls') deleteLSPayload(id)
      meta.source = 'md'
      meta.folderPath = undefined
      meta.filePath = undefined
      meta.name = name
      meta.lastModified = Date.now()
      writeIndex(idx)
      notify()
      return meta
    }
    return null
  },

  async reconnectFolder(id) {
    if (!webFolderSupported()) return false
    const handle = await loadHandle(id)
    if (!handle) return false
    const ok = await verifyPermission(handle, 'readwrite', true)
    if (!ok) return false
    connectedWebFolders.add(id)
    return true
  },

  isFolderConnected(id) {
    return connectedWebFolders.has(id)
  },

  awaitsReconnect(id) {
    const meta = readIndex().docs.find((d) => d.id === id)
    return meta?.source === 'md' && !host().readFolder && !connectedWebFolders.has(id)
  },

  async publishSelection(id, content) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') return
    const h = host()
    if (meta.folderPath && h.writeSelection) {
      const res = await h.writeSelection(meta.folderPath, content)
      if (!res.success) console.warn('[documentStore] selection write failed:', res.error)
      return
    }
    if (h.readFolder || !connectedWebFolders.has(id)) return
    const handle = await loadHandle(id)
    if (!handle) return
    try { await writeSelectionToHandle(handle, content) }
    catch (e) { console.warn('[documentStore] selection write failed:', e) }
  },

  watchDocument(id, onExternalChange) {
    const meta = readIndex().docs.find(d => d.id === id)
    if (meta?.source !== 'md') return () => {}
    const h = host()
    externalChangeListeners.set(id, onExternalChange)
    const stopListening = (): void => {
      if (externalChangeListeners.get(id) === onExternalChange) externalChangeListeners.delete(id)
    }

    if (meta.folderPath && h.watchFolder && h.onFolderChanged) {
      if (!routedHosts.has(h.onFolderChanged)) {
        routedHosts.add(h.onFolderChanged)
        h.onFolderChanged(({ folderPath }) => {
          for (const d of readIndex().docs) {
            if (d.source === 'md' && d.folderPath === folderPath) notifyExternalChange(d.id)
          }
        })
      }
      const folderPath = meta.folderPath
      void h.watchFolder(folderPath)
      return () => {
        stopListening()
        void h.watchFolder?.(null)
      }
    }

    if (!h.writeFolder && webFolderSupported()) {
      const timer = setInterval(() => {
        if (!connectedWebFolders.has(id)) return
        webSessions.get(id)?.poll().catch((e) => console.warn('[documentStore] folder poll failed:', e))
      }, WEB_FOLDER_POLL_MS)
      return () => {
        stopListening()
        clearInterval(timer)
      }
    }
    return stopListening
  },

  ensureActive(seedIfEmpty) {
    let idx = migrateLegacyIfNeeded(readIndex())
    if (idx.docs.length === 0) {
      const seed = seedIfEmpty()
      const meta = this.createLSDocument('Untitled', seed)
      bootSeededId = meta.id
      return { meta, seeded: true }
    }
    if (!idx.activeId || !idx.docs.some(d => d.id === idx.activeId)) {
      idx.activeId = idx.docs[0].id
      writeIndex(idx)
      notify()
    }
    const meta = idx.docs.find(d => d.id === idx.activeId)!
    return { meta, seeded: false }
  },

  isBootSeeded(id) {
    return id === bootSeededId
  },
}

// ─── Reactive view for React components ──────────────────────────────────────
// Components subscribe to this to re-render the document list / active label.

interface DocumentsView {
  docs: DocumentMeta[]
  activeId: string | null
  /** Bumped on every mutation so subscribers re-read via selectors. */
  rev: number
}

export const useDocumentsStore = create<DocumentsView>(() => {
  const idx = readIndex()
  return { docs: idx.docs, activeId: idx.activeId, rev: 0 }
})

function notify(): void {
  const idx = readIndex()
  useDocumentsStore.setState((s) => ({
    docs: idx.docs,
    activeId: idx.activeId,
    rev: s.rev + 1,
  }))
}
