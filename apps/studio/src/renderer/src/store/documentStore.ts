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
import type { DiagramData } from '@radical/common/c4'
import { host } from '../platform/host'
import { forgetViewCameras } from '@radical/ui/store/viewCameras'
import { DiscussionConflict, type DiscussionAction } from '@radical/common/discussions'
import type { DiscussionResult } from '@radical/host-bridge'
import { WebDiscussions } from '../discussions/webStorage'
import {
  serializeToMdFolder,
  deserializeFromMdFolder,
  MalformedFolderFileError,
  isMdFolder,
  stripBom,
  type FolderFiles,
} from '@radical/common/formats/mdFolder'
import { MdFolderSession, mergeMdFolderFiles } from '@radical/common/formats/mdFolderSync'
import type { MergeDrop } from '@radical/common/modelMerge'
import { agentWritingUntil, parseAgentActivity, type AgentActivity } from '@radical/common/formats/agentActivity'
import {
  webFolderSupported,
  webFileSupported,
  pickWebDirectory,
  pickWebFileToOpen,
  pickWebFileToSave,
  readFileHandle,
  writeFileHandle,
  type FsFileHandle,
  handleFolderStorage,
  type FsDirHandle,
  verifyPermission,
  saveHandle,
  loadHandle,
  removeHandle,
  writeSelectionToHandle,
  readForgeRunFromHandle,
  readAgentActivityFromHandle,
  readModelBaseFromHandle,
  writeModelBaseToHandle,
  readCheckFilesFromHandle,
  writeCheckConfigToHandle,
} from '../persist/webFolder'

const LS_INDEX_KEY = 'radical-docs-index'
const LS_DOC_PREFIX = 'radical-doc:'
/** Legacy single-slot key from the previous persistence iteration. */
const LS_LEGACY_KEY = 'radical-diagram-v1'

/** Web documents kept on disk through the File System Access API (md folders
 *  and single files, see `isWebDiskDoc`) whose handle has verified read/write
 *  permission this session. Writes are skipped until a handle is "connected"
 *  so a permission-pending handle can never clobber the user's files with an
 *  empty/stale model after a reload. */
const connectedWebHandles = new Set<string>()

/** Id of the document ensureActive() seeded on this boot because the index was
 *  empty, i.e. a first visit. The welcome screen hides it from "recent" so a
 *  newcomer is not greeted by a model they never made. */
let bootSeededId: string | null = null

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
const webDiscussionStores = new Map<string, WebDiscussions>()

async function webDiscussionsFor(id: string): Promise<WebDiscussions> {
  if (host().kind !== 'web' || !connectedWebHandles.has(id)) throw new Error('The model folder is not connected. Reconnect it in Models before posting discussions.')
  let adapter = webDiscussionStores.get(id)
  if (!adapter) {
    const handle = await loadHandle(id)
    if (!handle || handle.kind !== 'directory') throw new Error('The model folder is unavailable. Reconnect it in Models.')
    const existing = webDiscussionStores.get(id)
    if (existing) return existing
    adapter = new WebDiscussions(handle)
    webDiscussionStores.set(id, adapter)
  }
  return adapter
}
/** How often a web md-folder doc's directory is checked for outside edits. */
const WEB_FOLDER_POLL_MS = 2000

/** Per md doc, who to tell when its folder changes outside Studio — set by
 *  `watchDocument`. */
const externalChangeListeners = new Map<string, () => void>()
/** Hosts whose folder-change events are already routed to the listeners. */
const routedHosts = new WeakSet<object>()

/** Who to tell when a save was merged with an edit made outside Studio. */
const mergedSaveListeners = new Set<(id: string, merged: SaveMerge) => void>()

/** What a save merged with an edit made outside Studio did (mergeModels). */
export interface SaveMerge {
  conflicts: string[]
  dropped?: MergeDrop[]
  restored?: string[]
}

function notifyMergedSave(id: string, merged: SaveMerge | undefined): void {
  if (!merged) return
  for (const listener of [...mergedSaveListeners]) listener(id, merged)
}

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

/**
 * The document this tab has open. The index in localStorage is shared by
 * every tab, and its `activeId` is only the last one opened (where a new tab
 * starts): read as "this tab's document", a tab saved its edits into the
 * model another tab had opened since, and took that tab's address.
 * Undefined until the tab has read the index once.
 */
let tabActiveId: string | null | undefined

function readStoredIndex(): DocumentsIndex {
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

function readIndex(): DocumentsIndex {
  const idx = readStoredIndex()
  if (tabActiveId === undefined) tabActiveId = idx.activeId
  return { ...idx, activeId: tabActiveId }
}

/** Writes the index. False when the browser refused it (storage full). */
function writeIndex(idx: DocumentsIndex): boolean {
  tabActiveId = idx.activeId
  if (typeof localStorage === 'undefined') return true
  try {
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(idx))
    return true
  } catch (e) {
    console.warn('[documentStore] writeIndex failed:', e)
    return false
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

/** A folder model with a file Studio cannot parse, or a model file (a
 *  `.radical`) that does not parse or is not there. Its model is not loaded
 *  and, until a read succeeds, nothing is saved to the folder or the file:
 *  a save would write the model without what the file holds, remove the
 *  file, or write an empty model over it or where it had been deleted. */
export class DocumentUnreadableError extends Error {
  constructor(readonly file: string, readonly reason = 'malformed JSON', readonly inFolder = true) {
    super(inFolder
      ? `${file} in this model's folder cannot be read (${reason}). ` +
        'Nothing is saved to the folder until the file is fixed; the model is read again when it changes.'
      : `${file} cannot be read (${reason}). ` +
        'Nothing is saved to it until it can be read again: fix or restore it, then open the model again.')
    this.name = 'DocumentUnreadableError'
  }
}

/** Disk documents whose last read failed on a file (id → the file). */
const unreadable = new Map<string, { file: string; reason: string; inFolder: boolean }>()

/** Why a model file's text is no model, or null when it is one. */
function fileProblem(content: string): string | null {
  let parsed: unknown
  try { parsed = JSON.parse(stripBom(content)) } catch { return 'malformed JSON' }
  const data = parsed as Partial<DiagramData> | null
  return data && typeof data === 'object' && Array.isArray(data.nodes) && Array.isArray(data.relations) ? null : 'no Radical model'
}

/** Said of a model file that is gone. */
const NOT_THERE = 'it is not there: moved, renamed or deleted outside Studio'

/** The model in file `file` of document `id` (`content` as read), or null
 *  for an empty file, a new one. Anything else that is no model is a
 *  DocumentUnreadableError, remembered until a read succeeds. */
function readFileModel(id: string, file: string, content: string): DiagramData | null {
  if (!content.trim()) {
    unreadable.delete(id)
    return null
  }
  const problem = fileProblem(content)
  if (problem) return fileUnreadable(id, file, problem)
  unreadable.delete(id)
  return JSON.parse(stripBom(content)) as DiagramData
}

function fileUnreadable(id: string, file: string, reason: string): never {
  unreadable.set(id, { file, reason, inFolder: false })
  throw new DocumentUnreadableError(file, reason, false)
}

/** The model in a folder's files, remembered as what document `id` was
 *  loaded from. Null when the files hold no model that can be read; a file
 *  that is there but does not parse is a DocumentUnreadableError. */
/** Folder models renamed in Studio whose radical.md has the old name until
 *  the write of the new one: a read meanwhile keeps the new name. */
const renamedFolders = new Set<string>()

function readFolderModel(id: string, files: FolderFiles): DiagramData | null {
  try {
    const { data, name } = deserializeFromMdFolder(files)
    unreadable.delete(id)
    // The model is named as its radical.md says: named after the folder,
    // the next save rewrote radical.md's name (opening a view did).
    const idx = readIndex()
    const meta = idx.docs.find((d) => d.id === id)
    if (name && meta && meta.name !== name && !renamedFolders.has(id)) {
      meta.name = name
      if (writeIndex(idx)) notify()
    }
    return data
  } catch (e) {
    if (!(e instanceof MalformedFolderFileError)) return null
    unreadable.set(id, { file: e.path, reason: e.reason, inFolder: true })
    throw new DocumentUnreadableError(e.path, e.reason)
  }
}

/** Browser storage refused a model's content, almost always because its
 *  quota (a few MB per site) is used up. */
export class StorageFullError extends Error {
  constructor() {
    super(
      'Browser storage is full, so the model could not be saved. ' +
      'Delete models you no longer need (Models…), or save this one as a file or folder.',
    )
    this.name = 'StorageFullError'
  }
}

/** False when storage refused the write (quota exceeded). */
function writeLSPayload(id: string, data: DiagramData): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    localStorage.setItem(lsKeyFor(id), JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('[documentStore] writeLSPayload failed:', e)
    return false
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

/** A web document kept in a single file through a stored file handle (an
 *  Electron file document has a `filePath` instead). */
function isWebFileDoc(meta: DocumentMeta | undefined): boolean {
  return meta?.source === 'fs' && !meta.filePath && !host().readFile && webFileSupported()
}

/** A web document whose storage is a handle needing permission each session:
 *  a Markdown folder or a single file. */
function isWebDiskDoc(meta: DocumentMeta | undefined): boolean {
  return (meta?.source === 'md' && !host().readFolder && webFolderSupported()) || isWebFileDoc(meta)
}

/** Pretty JSON, as every model file is written. */
function modelJson(data: DiagramData): string {
  return JSON.stringify(data, null, 2)
}

/** A suggested file name for a model. */
function modelFileName(name: string): string {
  return (name || 'model').replace(/[\\/]/g, '_') + '.radical'
}

/** Only an object with node and relation arrays is a model. */
function parseModel(content: string): DiagramData | null {
  try {
    const parsed = JSON.parse(content) as DiagramData
    return parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.relations) ? parsed : null
  } catch {
    return null
  }
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

/** Asks before a model is written into a folder that holds files: `model`
 *  names the Radical model the folder holds, which the write replaces. */
export type ConfirmFolder = (folderName: string, model?: string) => boolean | Promise<boolean>

/** Whether "Move to a folder…" or New model may write into a folder that
 *  already holds these files: always for an empty folder, otherwise only when
 *  the user confirms, also for a Radical model, which the write replaces.
 *  Another model's folder was replaced without a question (item 235). */
async function mayWriteInto(
  files: FolderFiles,
  folderName: string,
  confirmForeign?: ConfirmFolder,
): Promise<boolean> {
  if (Object.keys(files).length === 0) return true
  if (!confirmForeign) return false
  if (!isMdFolder(files)) return await confirmForeign(folderName)
  let model = folderName
  try {
    model = deserializeFromMdFolder(files).name || folderName
  } catch {
    // A model that does not read is still a model: it is named after its folder.
  }
  return await confirmForeign(folderName, model)
}

/** The other entries of the list kept in the folder just `written` (a model
 *  it replaced): they would open the model written there, so they go. */
async function forgetReplaced(written: WrittenFolder, keepId: string): Promise<void> {
  const ids: string[] = []
  for (const doc of readIndex().docs) {
    if (doc.id === keepId || doc.source !== 'md') continue
    if ('folderPath' in written) {
      if (doc.folderPath === written.folderPath) ids.push(doc.id)
      continue
    }
    if (doc.folderPath) continue
    const handle = await loadHandle(doc.id).catch(() => null)
    const same = handle && (written.handle as FsDirHandle & { isSameEntry?: (h: FsDirHandle) => Promise<boolean> }).isSameEntry
    if (handle && same && (await same.call(written.handle, handle).catch(() => false))) ids.push(doc.id)
  }
  for (const id of ids) documents.deleteDocument(id)
}

/** A folder `pickAndWriteFolder` wrote: a path on disk (Electron), or a
 *  browser directory handle with its live session (web). */
type WrittenFolder =
  | { name: string; folderPath: string }
  | { name: string; handle: FsDirHandle; session: MdFolderSession }

/** Pick a folder (Electron or web) and write `data` into it as a Markdown
 *  model named `modelName`, else after the folder (`fallbackName` when the browser gives no
 *  name). A folder that already holds `.md` / `.json` files but is not a
 *  Radical model is written into only if `confirmForeign` returns true.
 *  Returns null on cancel, refusal or a failed write. */
async function pickAndWriteFolder(
  data: DiagramData,
  fallbackName: string,
  confirmForeign?: ConfirmFolder,
  modelName?: string,
): Promise<WrittenFolder | null> {
  const h = host()
  // ── Electron: pick a destination folder, write via IPC. ──
  if (h.pickFolder && h.writeFolder) {
    const picked = await h.pickFolder()
    if (!picked.success || !picked.folderPath) return null
    const folderName = defaultNameFromFolder(picked.folderPath)
    const name = modelName ?? folderName
    const present = h.readFolder ? await h.readFolder(picked.folderPath) : null
    if (present?.success && present.files && !(await mayWriteInto(present.files, folderName, confirmForeign))) {
      return null
    }
    const res = await h.writeFolder(picked.folderPath, serializeToMdFolder(data, name))
    if (!res.success) {
      console.warn('[documentStore] folder write failed:', res.error)
      return null
    }
    return { name, folderPath: picked.folderPath }
  }

  // ── Web: pick a directory handle and write through a session. ──
  if (webFolderSupported()) {
    const handle = await pickWebDirectory()
    if (!handle) return null
    const folderName = handle.name || fallbackName
    const name = modelName ?? folderName
    const session = new MdFolderSession(handleFolderStorage(handle))
    try {
      if (!(await mayWriteInto(await session.readAll(), folderName, confirmForeign))) return null
      const res = await session.write(serializeToMdFolder(data, name))
      if (!res.ok) return null // changed while we were writing; nothing written
    } catch (e) {
      console.warn('[documentStore] web folder write failed:', e)
      return null
    }
    return { name, handle, session }
  }
  return null
}

/** Turn `meta` into the md-backed document of a folder just written. */
async function bindFolder(meta: DocumentMeta, written: WrittenFolder): Promise<void> {
  webDiscussionStores.delete(meta.id)
  if ('folderPath' in written) {
    meta.folderPath = written.folderPath
  } else {
    await saveHandle(meta.id, written.handle)
    connectedWebHandles.add(meta.id)
    written.session.onExternalChange = () => notifyExternalChange(meta.id)
    webSessions.set(meta.id, written.session)
    meta.folderPath = undefined
  }
  meta.source = 'md'
  meta.filePath = undefined
  meta.name = written.name
  meta.lastModified = Date.now()
}

/** Turn `meta` into the file-backed document of a file handle just written. */
async function bindWebFile(meta: DocumentMeta, handle: FsFileHandle): Promise<void> {
  webDiscussionStores.delete(meta.id)
  await saveHandle(meta.id, handle)
  connectedWebHandles.add(meta.id)
  if (meta.source === 'ls') deleteLSPayload(meta.id)
  meta.source = 'fs'
  meta.filePath = undefined
  meta.folderPath = undefined
  meta.name = stripModelExtension(handle.name) || meta.name
  meta.lastModified = Date.now()
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
  } else if (isWebFileDoc(meta)) {
    // As for folders: never write before access is verified this session.
    const handle = await loadHandle<FsFileHandle>(id)
    if (!handle) return
    if (!connectedWebHandles.has(id)) {
      if (!(await verifyPermission(handle, 'readwrite', false))) return
      connectedWebHandles.add(id)
    }
    try {
      await writeFileHandle(handle, modelJson(data))
    } catch (e) {
      console.warn('[documentStore] web file write failed:', e)
      return
    }
  } else if (meta.source === 'md' && meta.folderPath && h.writeFolder) {
    const files = serializeToMdFolder(data, meta.name)
    // An edit made outside Studio since the last read is merged with this
    // one (the host then reports the change, and the document reloads).
    const res = await h.writeFolder(meta.folderPath, files)
    if (!res.success) {
      if (res.conflict) {
        // The folder changed outside Studio and does not read as a model; the
        // host reports it and the reload says which file is broken.
        console.warn('[documentStore] folder changed on disk, not overwriting:', res.conflict)
      } else {
        console.warn('[documentStore] folder write failed for', meta.folderPath, res.error)
      }
      return
    }
    notifyMergedSave(id, res.merged)
  } else if (meta.source === 'md' && !h.writeFolder && webFolderSupported()) {
    // Never write until the handle's permission is verified this session,
    // so a reload with a permission-pending handle can't overwrite files.
    if (!connectedWebHandles.has(id)) {
      const handle = await loadHandle(id)
      if (!handle || !(await verifyPermission(handle, 'readwrite', false))) return
      connectedWebHandles.add(id)
    }
    const handle = await loadHandle(id)
    if (!handle) return
    try {
      const res = await webSession(id, handle).write(serializeToMdFolder(data, meta.name), mergeMdFolderFiles)
      if (!res.ok) {
        console.warn('[documentStore] folder changed on disk, not overwriting:', res.conflict)
        return
      }
      notifyMergedSave(id, res.merged)
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
  /** Companion-file operations; never enter model saves or model watchers. */
  loadDiscussions(id: string): Promise<DiscussionResult>
  actOnDiscussion(id: string, action: DiscussionAction): Promise<DiscussionResult>
  listDocuments(): DocumentMeta[]
  getActiveId(): string | null
  setActiveId(id: string | null): void

  /** Adds a browser-storage document and makes it active. Throws
   *  StorageFullError, adding nothing, when `seed` cannot be stored. */
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

  /** Read the payload for a document, an md folder's element descriptions
   *  included. Async because FS reads cross IPC. A folder file or a model
   *  file that cannot be read rejects with DocumentUnreadableError. */
  loadDocument(id: string): Promise<DiagramData | null>

  /** The document's last read failed on a file (DocumentUnreadableError):
   *  nothing is saved to it until a read succeeds. */
  isUnreadable(id: string): boolean

  /** Persist new payload under an existing document.
   *  localStorage docs are written synchronously (before this returns), so a
   *  page-hide flush lands; disk writes run one at a time per document.
   *  Rejects with StorageFullError when browser storage refuses the write. */
  saveDocument(id: string, data: DiagramData): Promise<void>

  /** Update the display name. (Does NOT rename files on disk.) */
  renameDocument(id: string, newName: string): void

  /** Remove the doc from the index. Optionally delete its LS payload. */
  deleteDocument(id: string, opts?: { wipePayload?: boolean }): void

  /** Open dialog (Electron) or file picker (web) -> register as a doc.
   *  Electron path adds an FS-backed doc bound to the chosen path; so does a
   *  browser that can write files back (Chromium), through the file handle.
   *  Other browsers add an LS-backed doc seeded with the parsed JSON content.
   *  Returns the new (or re-activated) meta, or null if the user cancelled
   *  / the file was unparsable. The optional `pickerOverride` is an injection
   *  seam for tests — production callers pass nothing. */
  importFromFile(
    pickerOverride?: () => Promise<{ name: string; content: string } | null>,
  ): Promise<DocumentMeta | null>

  /** Save the doc's payload to disk.
   *  Electron path: native Save dialog -> writes via preload IPC and turns
   *  the doc into FS-backed, bound to the chosen path.
   *  Web path: a browser that can write files back (Chromium) saves through
   *  the file picker and turns the doc FS-backed on the file handle. Other
   *  browsers download the JSON; the doc stays LS-backed but its display
   *  name is updated to match the chosen filename. The optional
   *  `downloadOverride` is an injection seam for tests.
   *  Returns the (possibly mutated) meta, or null on cancel / failure. */
  saveAsFile(
    id: string,
    data: DiagramData,
    downloadOverride?: (filename: string, json: string) => Promise<string | null>,
  ): Promise<DocumentMeta | null>

  /** Keep a file or folder model in this browser again: `data` (the model
   *  on screen) is stored here and the document stops writing the file or
   *  folder, which stays on disk as it is. Null for a model already in the
   *  browser; throws StorageFullError when the browser refuses it. */
  moveToBrowser(id: string, data: DiagramData): DocumentMeta | null

  /** Open a folder (Electron only) containing a Radical md-folder model and
   *  register it as an md-backed document. Returns the meta, or null on
   *  cancel / unavailable environment. */
  importFromFolder(): Promise<DocumentMeta | null>

  /** Pick a destination folder (Electron or web), write the current payload as
   *  a Markdown folder, and convert the doc to md-backed. A folder that already
   *  holds files, another Radical model among them, is written into only if
   *  `confirmForeignFolder` returns true; the entries of a model it replaces
   *  leave the list. Returns the mutated meta, or null on cancel / failure. */
  saveAsFolder(
    id: string,
    data: DiagramData,
    confirmForeignFolder?: ConfirmFolder,
  ): Promise<DocumentMeta | null>

  /** Pick a file to save into (Electron Save dialog, or the browser's file
   *  picker), write `data` there as a new model named after the file, and make
   *  it the active document. Returns null on cancel / failure or when this
   *  browser cannot keep a model in a file. */
  createFileDocument(data: DiagramData, name: string): Promise<DocumentMeta | null>

  /** Pick a folder (Electron or web), write `data` into it as a new Markdown
   *  model named after the folder, and make it the active document. Same
   *  foreign-folder rule as `saveAsFolder`. Returns null on cancel / failure. */
  createFolderDocument(
    data: DiagramData,
    confirmForeignFolder?: ConfirmFolder,
  ): Promise<DocumentMeta | null>

  /** Re-request read/write permission for a web folder or file document's
   *  handle (must be called from a user gesture). Returns true on success. */
  reconnect(id: string): Promise<boolean>

  /** True when a web folder or file document has verified permission this
   *  session. */
  isConnected(id: string): boolean

  /** True for a browser folder or file document still waiting for Reconnect:
   *  until the user grants access again, it loads as an empty model. */
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

  /** Calls `listener` each time a save of an md-folder document was merged
   *  with an edit made outside Studio since the last read, with the values
   *  both changed, where the folder's was kept, and the deletes that won
   *  over an edit. Returns the unsubscribe. */
  onSaveMerged(listener: (id: string, merged: SaveMerge) => void): () => void

  /** Until when (ms since the epoch) an agent writes an md-folder document's
   *  folder over MCP (agentActivity); 0 when none does, or for other
   *  documents. */
  agentWritingUntil(id: string): Promise<number>
  /** The activity file an agent's MCP server last wrote into an md-folder
   *  document's folder (which client, which product version), or null when
   *  there is none, it does not read, or the document is no folder. */
  readAgentActivity(id: string): Promise<AgentActivity | null>

  /** The agent Forge run status file of an md-folder document (written by
   *  the MCP server), or null when there is none or it cannot be read. */
  readForgeRun(id: string): Promise<string | null>
  /** The base file of an md-folder document (the model at the git base,
   *  written by the CLI or the MCP server), or null when there is none, the
   *  document is no folder, or it cannot be read. */
  readModelBase(id: string): Promise<string | null>
  /** Writes the model's base beside a folder model; false when it is no
   *  folder model or the write failed. */
  writeModelBase(id: string, content: string): Promise<boolean>
  /** What `radical check` keeps beside an md-folder model (test results,
   *  check.json), each null when it is not there; both null for a document
   *  that is no folder. Null when the folder cannot be read yet (a browser
   *  folder before its access is back). */
  readCheckFiles(id: string): Promise<{ results: string | null; config: string | null } | null>
  /** Writes check.json beside an md-folder model; throws when the document
   *  is no folder or its folder cannot be written. */
  writeCheckConfig(id: string, content: string): Promise<void>

  /** Convenience: ensure there's at least one document; create an empty LS
   *  doc if the index is empty. Returns the active doc. */
  ensureActive(seedIfEmpty: () => DiagramData): { meta: DocumentMeta; seeded: boolean }

  /** True for the document ensureActive() seeded on this boot (first visit). */
  isBootSeeded(id: string): boolean
}

/** The text of an md-folder document's agent activity file (agentActivity),
 *  or null when there is none, it cannot be read, or the document is no
 *  folder (or a browser folder not yet connected). */
/** Each document's agent mark as last read, and when it was first read. */
const agentMarksSeen = new Map<string, { text: string; at: number }>()

async function readAgentActivityText(id: string): Promise<string | null> {
  const meta = readIndex().docs.find((d) => d.id === id)
  if (meta?.source !== 'md') return null
  const h = host()
  if (meta.folderPath && h.readAgentActivity) {
    const res = await h.readAgentActivity(meta.folderPath).catch(() => null)
    return res?.success ? res.content ?? null : null
  }
  if (h.readFolder || !connectedWebHandles.has(id)) return null
  const handle = await loadHandle(id)
  return handle ? readAgentActivityFromHandle(handle) : null
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
    // A document whose content never landed would open as whatever model
    // the store still holds: refuse it before it joins the list.
    if (seed && !writeLSPayload(meta.id, seed)) throw new StorageFullError()
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
    // A file that does not parse, or is not there, used to read as a new
    // empty file: the model opened empty, and the next save wrote that
    // over the file, or made it again where it had been deleted.
    if (meta.source === 'fs' && meta.filePath && h.readFile) {
      const res = await h.readFile(meta.filePath)
      if (!res.success) return fileUnreadable(id, meta.filePath, /ENOENT|not found/i.test(res.error ?? '') ? NOT_THERE : res.error || 'it cannot be opened')
      return readFileModel(id, meta.filePath, res.content ?? '')
    }
    if (isWebFileDoc(meta)) {
      const handle = await loadHandle<FsFileHandle>(id)
      if (!handle) return null
      if (!(await verifyPermission(handle, 'readwrite', false))) return null // needs reconnect
      connectedWebHandles.add(id)
      let content: string
      try {
        content = await readFileHandle(handle)
      } catch (e) {
        return fileUnreadable(id, handle.name, (e as Error).name === 'NotFoundError' ? NOT_THERE : (e as Error).message)
      }
      return readFileModel(id, handle.name, content)
    }
    if (meta.source === 'md' && meta.folderPath && h.readFolder) {
      const res = await h.readFolder(meta.folderPath)
      if (!res.success || !res.files) return null
      if (Object.keys(res.files).length === 0) return null // empty/new folder
      return readFolderModel(id, res.files)
    }
    if (meta.source === 'md' && !h.readFolder && webFolderSupported()) {
      const handle = await loadHandle(id)
      if (!handle) return null
      if (!(await verifyPermission(handle, 'readwrite', false))) return null // needs reconnect
      connectedWebHandles.add(id)
      let files: FolderFiles
      try {
        files = await webSession(id, handle).readAll()
      } catch { return null }
      if (Object.keys(files).length === 0) return null // empty/new folder
      return readFolderModel(id, files)
    }
    return null
  },

  isUnreadable(id) {
    return unreadable.has(id)
  },

  async saveDocument(id, data) {
    const idx = readIndex()
    const meta = idx.docs.find(d => d.id === id)
    if (!meta) return
    const bad = meta.source !== 'ls' ? unreadable.get(id) : undefined
    if (bad) throw new DocumentUnreadableError(bad.file, bad.reason, bad.inFolder)
    if (meta.source !== 'ls') return enqueueSave(id, data)
    if (!writeLSPayload(id, data)) throw new StorageFullError()
    meta.lastModified = Date.now()
    writeIndex(idx)
    notify()
  },

  renameDocument(id, newName) {
    const idx = readIndex()
    const meta = idx.docs.find(d => d.id === id)
    if (!meta) return
    meta.name = newName.trim() || meta.name
    // Refused by full storage, the rename did nothing and said nothing.
    if (!writeIndex(idx)) throw new StorageFullError()
    notify()
    // A folder model's name is in its radical.md: written now, not at the
    // next save. The model is written as the folder has it, with the name.
    if (meta.source === 'md') {
      renamedFolders.add(id)
      void this.loadDocument(id).then((data) => { if (data) return enqueueSave(id, data) }).catch((e) => {
        console.warn('[documentStore] could not write the new name into radical.md:', e)
      }).finally(() => renamedFolders.delete(id))
    }
  },

  deleteDocument(id, opts) {
    const idx = readIndex()
    const before = idx.docs.length
    const removed = idx.docs.find(d => d.id === id)
    idx.docs = idx.docs.filter(d => d.id !== id)
    if (idx.docs.length === before) return
    if (opts?.wipePayload !== false) deleteLSPayload(id)
    forgetViewCameras(id)
    unreadable.delete(id)
    if (removed?.source === 'md') {
      connectedWebHandles.delete(id)
      webSessions.delete(id)
      webDiscussionStores.delete(id)
      void removeHandle(id)
    } else if (removed?.source === 'fs' && !removed.filePath) {
      connectedWebHandles.delete(id)
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

    // ── Web, File System Access: keep the model in the picked file.
    if (!pickerOverride && webFileSupported()) {
      const handle = await pickWebFileToOpen()
      if (!handle) return null
      const parsed = parseModel(await readFileHandle(handle))
      if (!parsed) {
        console.warn('[documentStore] importFromFile: not a DiagramData payload')
        return null
      }
      // Writing back needs its own grant; ask while the pick still counts as
      // the user's gesture. Refused, the model waits for Reconnect.
      const writable = await verifyPermission(handle, 'readwrite', true)
      const idx = readIndex()
      const meta: DocumentMeta = {
        id: uid(),
        name: stripModelExtension(handle.name),
        source: 'fs',
        lastModified: Date.now(),
      }
      await saveHandle(meta.id, handle)
      if (writable) connectedWebHandles.add(meta.id)
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

    // ── Web, File System Access: bind the doc to the picked file.
    if (!downloadOverride && webFileSupported()) {
      const current = readIndex().docs.find(d => d.id === id)
      if (!current) return null
      const handle = await pickWebFileToSave(modelFileName(current.name))
      if (!handle) return null
      try {
        await writeFileHandle(handle, json)
      } catch (e) {
        console.warn('[documentStore] saveAsFile write failed:', e)
        return null
      }
      const idx = readIndex()
      const meta = idx.docs.find(d => d.id === id)
      if (!meta) return null
      await bindWebFile(meta, handle)
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
      connectedWebHandles.add(meta.id)
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
    const current = readIndex().docs.find((d) => d.id === id)
    if (!current) return null
    // A model moved keeps its name; it was renamed after the folder.
    const written = await pickAndWriteFolder(data, current.name, confirmForeignFolder, current.name)
    if (!written) return null
    await forgetReplaced(written, id)
    const idx = readIndex()
    const meta = idx.docs.find((d) => d.id === id)
    if (!meta) return null
    if (meta.source === 'ls') deleteLSPayload(id)
    await bindFolder(meta, written)
    writeIndex(idx)
    notify()
    return meta
  },

  moveToBrowser(id, data) {
    const idx = readIndex()
    const meta = idx.docs.find((d) => d.id === id)
    if (!meta || meta.source === 'ls') return null
    if (!writeLSPayload(id, data)) throw new StorageFullError()
    const was = { ...meta }
    meta.source = 'ls'
    meta.filePath = undefined
    meta.folderPath = undefined
    meta.lastModified = Date.now()
    if (!writeIndex(idx)) {
      Object.assign(meta, was)
      deleteLSPayload(id)
      throw new StorageFullError()
    }
    unreadable.delete(id)
    connectedWebHandles.delete(id)
    webSessions.delete(id)
    webDiscussionStores.delete(id)
    void removeHandle(id)
    notify()
    return meta
  },

  async createFileDocument(data, name) {
    const h = host()
    const json = modelJson(data)
    // ── Electron: native Save dialog → FS-backed doc on that path. ──
    if (h.saveDiagram) {
      const res = await h.saveDiagram(json)
      if (!res.success || !res.filePath) return null
      const meta = this.createFSDocument(res.filePath)
      this.setActiveId(meta.id) // an entry already tracking this path
      return meta
    }
    // ── Web: file picker → FS-backed doc on the file handle. ──
    if (!webFileSupported()) return null
    const handle = await pickWebFileToSave(modelFileName(name))
    if (!handle) return null
    try {
      await writeFileHandle(handle, json)
    } catch (e) {
      console.warn('[documentStore] new file write failed:', e)
      return null
    }
    const idx = readIndex()
    const meta: DocumentMeta = { id: uid(), name, source: 'fs', lastModified: Date.now() }
    await bindWebFile(meta, handle)
    idx.docs.push(meta)
    idx.activeId = meta.id
    writeIndex(idx)
    notify()
    return meta
  },

  async createFolderDocument(data, confirmForeignFolder) {
    const written = await pickAndWriteFolder(data, 'model', confirmForeignFolder)
    if (!written) return null
    // This folder was in the list before: keep one entry for it.
    await forgetReplaced(written, '')
    const idx = readIndex()
    const meta: DocumentMeta = { id: uid(), name: written.name, source: 'md', lastModified: Date.now() }
    await bindFolder(meta, written)
    idx.docs.push(meta)
    idx.activeId = meta.id
    writeIndex(idx)
    notify()
    return meta
  },

  async reconnect(id) {
    if (!isWebDiskDoc(readIndex().docs.find((d) => d.id === id))) return false
    const handle = await loadHandle<FsDirHandle | FsFileHandle>(id)
    if (!handle) return false
    const ok = await verifyPermission(handle, 'readwrite', true)
    if (!ok) return false
    connectedWebHandles.add(id)
    return true
  },

  isConnected(id) {
    return connectedWebHandles.has(id)
  },

  awaitsReconnect(id) {
    return isWebDiskDoc(readIndex().docs.find((d) => d.id === id)) && !connectedWebHandles.has(id)
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
    if (h.readFolder || !connectedWebHandles.has(id)) return
    const handle = await loadHandle(id)
    if (!handle) return
    try { await writeSelectionToHandle(handle, content) }
    catch (e) { console.warn('[documentStore] selection write failed:', e) }
  },

  onSaveMerged(listener) {
    mergedSaveListeners.add(listener)
    return () => { mergedSaveListeners.delete(listener) }
  },

  async agentWritingUntil(id) {
    const text = await readAgentActivityText(id)
    // A mark is cut to one period from when it was first seen, not from each check.
    const seen = agentMarksSeen.get(id)
    const now = Date.now()
    if (!text || seen?.text !== text) agentMarksSeen.set(id, { text: text ?? '', at: now })
    return agentWritingUntil(text, now, agentMarksSeen.get(id)!.at)
  },

  async readAgentActivity(id) {
    return parseAgentActivity(await readAgentActivityText(id))
  },

  async readForgeRun(id) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') return null
    const h = host()
    if (meta.folderPath && h.readForgeRun) {
      const res = await h.readForgeRun(meta.folderPath)
      return res.success ? res.content ?? null : null
    }
    if (h.readFolder || !connectedWebHandles.has(id)) return null
    const handle = await loadHandle(id)
    return handle ? readForgeRunFromHandle(handle) : null
  },

  async readModelBase(id) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') return null
    const h = host()
    if (meta.folderPath && h.readModelBase) {
      const res = await h.readModelBase(meta.folderPath)
      return res.success ? res.content ?? null : null
    }
    if (h.readFolder || !connectedWebHandles.has(id)) return null
    const handle = await loadHandle(id)
    return handle ? readModelBaseFromHandle(handle) : null
  },

  async writeModelBase(id, content) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') return false
    const h = host()
    if (meta.folderPath && h.writeModelBase) {
      const res = await h.writeModelBase(meta.folderPath, content)
      if (!res.success) console.warn('[documentStore] base write failed:', res.error)
      return res.success
    }
    if (h.readFolder || !connectedWebHandles.has(id)) return false
    const handle = await loadHandle(id)
    if (!handle) return false
    try { await writeModelBaseToHandle(handle, content); return true }
    catch (e) { console.warn('[documentStore] base write failed:', e); return false }
  },

  async readCheckFiles(id) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') return { results: null, config: null }
    const h = host()
    if (meta.folderPath && h.readCheckFiles) {
      const res = await h.readCheckFiles(meta.folderPath)
      return res.success ? { results: res.results ?? null, config: res.config ?? null } : null
    }
    if (h.readFolder || !connectedWebHandles.has(id)) return null
    const handle = await loadHandle(id)
    return handle ? readCheckFilesFromHandle(handle) : null
  },

  async writeCheckConfig(id, content) {
    const meta = readIndex().docs.find((d) => d.id === id)
    if (meta?.source !== 'md') throw new Error('Only a model kept in a folder has a check.json.')
    const h = host()
    if (meta.folderPath && h.writeCheckConfig) {
      const res = await h.writeCheckConfig(meta.folderPath, content)
      if (!res.success) throw new Error(res.error ?? 'check.json could not be written.')
      return
    }
    const handle = !h.readFolder && connectedWebHandles.has(id) ? await loadHandle(id) : null
    if (!handle) throw new Error('The folder is not connected; open it again to save.')
    await writeCheckConfigToHandle(handle, content)
  },

  async loadDiscussions(id) {
    try {
      const meta = readIndex().docs.find((d) => d.id === id)
      if (meta?.source !== 'md') throw new Error('Discussions require a model kept in a folder.')
      const h = host()
      if (h.kind === 'electron' && meta.folderPath && h.loadDiscussions) return await h.loadDiscussions(meta.folderPath)
      return { success: true, discussions: await (await webDiscussionsFor(id)).load() }
    } catch (error) { return { success: false, error: (error as Error).message } }
  },

  async actOnDiscussion(id, action) {
    try {
      const meta = readIndex().docs.find((d) => d.id === id)
      if (meta?.source !== 'md') throw new Error('Discussions require a model kept in a folder.')
      const h = host()
      if (h.kind === 'electron' && meta.folderPath && h.actOnDiscussion) return await h.actOnDiscussion(meta.folderPath, action)
      return { success: true, discussions: await (await webDiscussionsFor(id)).act(action) }
    } catch (error) { return { success: false, conflict: error instanceof DiscussionConflict, error: (error as Error).message } }
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
        if (!connectedWebHandles.has(id)) return
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
      let meta: DocumentMeta
      try {
        meta = this.createLSDocument('Untitled', seed)
      } catch {
        meta = this.createLSDocument('Untitled')
      }
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
