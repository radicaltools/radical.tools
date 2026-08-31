// ─── Web folder backend (File System Access API) ─────────────────────────────
//
// Lets the browser build operate on a real directory of Markdown files, the
// same md-folder format the Electron build uses. Directory handles obtained
// from `showDirectoryPicker()` are persisted in IndexedDB (they are
// structured-cloneable), keyed by document id, so a folder-backed document
// survives reloads — though the browser re-prompts for permission on the next
// session (a `verifyPermission` call within a user gesture re-grants it).
//
// The read/write helpers are handle-driven and side-effect-isolated so they can
// be unit-tested against an in-memory fake directory handle.

import type { FolderFiles } from './mdFolder'

// Minimal structural typings for the File System Access API (avoids depending
// on lib.dom variants that may not ship these definitions).
export interface FsFileHandle {
  kind: 'file'
  getFile(): Promise<{ text(): Promise<string> }>
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

function isManagedPath(rel: string): boolean {
  return rel.startsWith('nodes/') || /^[^/]+\.json$/.test(rel) || rel === 'radical.md'
}

async function readInto(dir: FsDirHandle, prefix: string, out: FolderFiles): Promise<void> {
  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.')) continue
    const rel = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'directory') {
      await readInto(entry as FsDirHandle, rel, out)
    } else if (/\.(md|json)$/i.test(name)) {
      const file = await (entry as FsFileHandle).getFile()
      out[rel] = await file.text()
    }
  }
}

/** Recursively read the `.md` / `.json` files under a directory handle. */
export async function readFolderFromHandle(handle: FsDirHandle): Promise<FolderFiles> {
  const out: FolderFiles = {}
  await readInto(handle, '', out)
  return out
}

/** Write a file map into a directory handle, then prune our own stale managed
 *  files (`.md` under `nodes/` and known sidecars) that are no longer present. */
export async function writeFolderToHandle(handle: FsDirHandle, files: FolderFiles): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const parts = rel.split('/')
    let dir = handle
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true })
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  const existing: FolderFiles = {}
  await readInto(handle, '', existing)
  for (const rel of Object.keys(existing)) {
    if (rel in files) continue
    if (!isManagedPath(rel)) continue
    const parts = rel.split('/')
    let dir = handle
    let reachable = true
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        dir = await dir.getDirectoryHandle(parts[i], { create: false })
      } catch {
        reachable = false
        break
      }
    }
    if (reachable) {
      try {
        await dir.removeEntry(parts[parts.length - 1])
      } catch {
        /* best-effort prune */
      }
    }
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
