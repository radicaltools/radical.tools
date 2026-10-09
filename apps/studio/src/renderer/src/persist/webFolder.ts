// ─── Web folder backend (File System Access API) ─────────────────────────────
//
// Lets the browser build operate on a real directory of Markdown files, the
// same md-folder format the Electron build uses. Directory handles obtained
// from `showDirectoryPicker()` are persisted in IndexedDB (they are
// structured-cloneable), keyed by document id, so a folder-backed document
// survives reloads — though the browser re-prompts for permission on the next
// session (a `verifyPermission` call within a user gesture re-grants it).
//
// Reads and writes go through an `MdFolderSession` over `handleFolderStorage`,
// which is handle-driven and side-effect-isolated so it can be unit-tested
// against an in-memory fake directory handle.

import { isMdFolderModelPath } from '@radical/common/formats/mdFolder'
import { SELECTION_DIR, SELECTION_GITIGNORE_CONTENT } from '@radical/common/formats/canvasSelection'
import type { MdFolderStorage } from '@radical/common/formats/mdFolderSync'

// Minimal structural typings for the File System Access API (avoids depending
// on lib.dom variants that may not ship these definitions).
export interface FsFileHandle {
  kind: 'file'
  getFile(): Promise<{ text(): Promise<string>; lastModified: number; size: number }>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}
export interface FsDirHandle {
  kind: 'directory'
  name: string
  entries(): AsyncIterableIterator<[string, FsDirHandle | FsFileHandle]>
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

/** True when this environment can operate on a directory (Chromium browsers). */
export function webFolderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function' &&
    typeof indexedDB !== 'undefined'
  )
}

/** Prompt the user to choose a directory (read/write). Null if cancelled. */
export async function pickWebDirectory(): Promise<FsDirHandle | null> {
  const w = window as unknown as { showDirectoryPicker?: (o?: unknown) => Promise<FsDirHandle> }
  if (typeof w.showDirectoryPicker !== 'function') return null
  try {
    return await w.showDirectoryPicker({ mode: 'readwrite' })
  } catch {
    return null // user dismissed the picker
  }
}

/** Confirm (and optionally request) read/write access to a stored handle. */
export async function verifyPermission(
  handle: FsDirHandle,
  mode: 'read' | 'readwrite',
  request: boolean,
): Promise<boolean> {
  try {
    if (handle.queryPermission && (await handle.queryPermission({ mode })) === 'granted') return true
    if (request && handle.requestPermission && (await handle.requestPermission({ mode })) === 'granted') {
      return true
    }
  } catch {
    /* older/partial implementations — treat as denied */
  }
  return false
}

/** Read a single file by its relative POSIX path (e.g. a lazily-loaded node
 *  body), without walking the rest of the tree. */
export async function readOneFileFromHandle(handle: FsDirHandle, relPath: string): Promise<string> {
  const parts = relPath.split('/')
  let dir = handle
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i])
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
  const file = await fileHandle.getFile()
  return file.text()
}

/** A model folder behind a directory handle, for an `MdFolderSession`. Only
 *  the manifest, the top-level sidecars and `nodes/**` are listed; hidden
 *  entries are ignored. Stamps are the files' lastModified + size. */
export function handleFolderStorage(root: FsDirHandle): MdFolderStorage {
  const stampOf = async (file: FsFileHandle): Promise<string> => {
    const f = await file.getFile()
    return `${f.lastModified}:${f.size}`
  }
  const dirFor = async (parts: string[], create: boolean): Promise<FsDirHandle> => {
    let dir = root
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create })
    return dir
  }
  return {
    async list() {
      const stamps: Record<string, string> = {}
      const walk = async (dir: FsDirHandle, rel: string): Promise<void> => {
        for await (const [name, entry] of dir.entries()) {
          if (name.startsWith('.')) continue
          const child = rel ? `${rel}/${name}` : name
          if (entry.kind === 'directory') {
            if (rel || name === 'nodes') await walk(entry as FsDirHandle, child)
          } else if (isMdFolderModelPath(child)) {
            try { stamps[child] = await stampOf(entry as FsFileHandle) } catch { /* gone meanwhile */ }
          }
        }
      }
      await walk(root, '')
      return stamps
    },
    read: (rel) => readOneFileFromHandle(root, rel),
    async write(rel, content) {
      const parts = rel.split('/')
      const dir = await dirFor(parts.slice(0, -1), true)
      const file = await dir.getFileHandle(parts[parts.length - 1], { create: true })
      const writable = await file.createWritable()
      await writable.write(content)
      await writable.close()
      return stampOf(file)
    },
    async remove(rel) {
      const parts = rel.split('/')
      try {
        const dir = await dirFor(parts.slice(0, -1), false)
        await dir.removeEntry(parts[parts.length - 1])
      } catch {
        /* already gone */
      }
    },
  }
}

async function writeText(dir: FsDirHandle, name: string, content: string): Promise<void> {
  const writable = await (await dir.getFileHandle(name, { create: true })).createWritable()
  await writable.write(content)
  await writable.close()
}

/** Writes the canvas selection file (see canvasSelection) under the model
 *  folder's `.radical/`, with the `.gitignore` that keeps it out of git. */
export async function writeSelectionToHandle(root: FsDirHandle, content: string): Promise<void> {
  const dir = await root.getDirectoryHandle(SELECTION_DIR, { create: true })
  try { await dir.getFileHandle('.gitignore') }
  catch { await writeText(dir, '.gitignore', SELECTION_GITIGNORE_CONTENT) }
  await writeText(dir, 'selection.json', content)
}

/** The Forge run status file (see forgeRunStatus) under the model folder's
 *  `.radical/`, or null when there is none. */
export async function readForgeRunFromHandle(root: FsDirHandle): Promise<string | null> {
  try {
    const dir = await root.getDirectoryHandle(SELECTION_DIR)
    return await (await (await dir.getFileHandle('forge-run.json')).getFile()).text()
  } catch {
    return null
  }
}

// ─── IndexedDB handle persistence ────────────────────────────────────────────

const DB_NAME = 'radical-fs'
const DB_VERSION = 1
const STORE = 'handles'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveHandle(key: string, handle: FsDirHandle): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(handle, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function loadHandle(key: string): Promise<FsDirHandle | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  try {
    return await new Promise<FsDirHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as FsDirHandle) ?? null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function removeHandle(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
