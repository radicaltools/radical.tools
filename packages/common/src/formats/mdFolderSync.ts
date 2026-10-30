// ─── Md-folder sync session ──────────────────────────────────────────────────
//
// One md-folder model on some storage — Node's fs in Electron's main process,
// a File System Access directory handle in the browser. The session keeps a
// baseline: each model file's content and stamp as the app last read or wrote
// it. From that:
//
//   • `write` touches only files whose content changed, prunes the stale files
//     the format owns, and never overwrites an edit made on disk since the app
//     last read it (in another editor, by git, by an agent): given a merge
//     (mergeMdFolderFiles) it writes its change merged with that edit and
//     tells the app to reload; without one, or when the merge cannot read the
//     folder, it refuses to run at all;
//   • `poll` reports such outside edits so the app can reload promptly.
//
// The check for outside edits and the write that follows hold the storage's
// lock, when it has one: two processes writing one folder within a few
// milliseconds both found it unchanged, and the second write took the
// first one's change out while both reported success.
//
// Stamps are cheap change markers (mtime + size, whatever the storage offers):
// only files whose stamp moved are read, and a file counts as changed only when
// its content differs. Operations run one at a time; a poll that would have to
// wait is skipped rather than queued.

import { MD_MANIFEST_FILE, deserializeFromMdFolder, isMdFolderModelPath, isOwnedMdFolderFile, isValidMdFolderManifest, keepMdFolderPaths, serializeToMdFolder, staleMdFolderFiles, type FolderFiles } from './mdFolder'
import { mergeModels, type MergeDrop } from '../modelMerge'
import { readModelCache, writeModelCache, type ModelCacheFiles } from './modelCache'

/** Where a session's files live. Paths are POSIX, relative to the folder. */
export interface MdFolderStorage {
  /** Stamp of every model file present (see `isMdFolderModelPath`). */
  list(): Promise<Record<string, string>>
  read(path: string): Promise<string>
  /** Write a file, creating directories as needed; resolves with its new stamp. */
  write(path: string, content: string): Promise<string>
  remove(path: string): Promise<void>
  /** Wait for the folder's write turn against other processes writing it
   *  (a second MCP server, Studio's desktop app); resolves with the call
   *  that gives it back. A storage that cannot (a browser folder) has none.
   *  `forRead`: only to read the folder whole, which leaves no trace in a
   *  folder nobody writes. */
  lock?(forRead?: boolean): Promise<() => Promise<void>>
  /** The folder's cache (MODEL_CACHE_FILE), or null when there is none. A
   *  storage without these keeps no cache. */
  readCache?(): Promise<string | null>
  writeCache?(content: string): Promise<void>
}

export type MdFolderWriteResult =
  /** Written; `merged` when it was merged with these files changed on disk,
   *  `conflicts` naming the values both changed, where the disk's was kept. */
  | { ok: true; merged?: { changed: string[]; conflicts: string[]; dropped?: MergeDrop[]; restored?: string[] } }
  /** Nothing was written: these files changed on disk since the last read. */
  | { ok: false; conflict: string[] }

/** The files to write in place of `ours` when the folder changed from `base`
 *  (as read) to `theirs` (on disk now), and the values both changed; null
 *  when they cannot be merged (a file that does not read as a model). */
export type MdFolderMerge = (base: FolderFiles, ours: FolderFiles, theirs: FolderFiles) => { files: FolderFiles; conflicts: string[]; dropped?: MergeDrop[]; restored?: string[] } | null

/** The three-way merge of a md-folder model (mergeModels): `ours` merged
 *  with `theirs` element by element and field by field. A file the merge
 *  leaves as theirs keeps its text as it is on disk, and the manifest's
 *  prose comes from the side that changed it (theirs when both did). A
 *  folder that does not read as a model is not merged. */
export const mergeMdFolderFiles: MdFolderMerge = (base, ours, theirs) => {
  // A node file that is there but no longer reads as one (an editor caught
  // half way through a save) would merge as the element deleted.
  for (const [path, content] of Object.entries(theirs)) {
    if (base[path] !== undefined && isOwnedMdFolderFile(path, base[path]) && !isOwnedMdFolderFile(path, content)) return null
  }
  try {
    const t = deserializeFromMdFolder(theirs).data
    const { merged, conflicts, dropped, restored } = mergeModels(deserializeFromMdFolder(base).data, deserializeFromMdFolder(ours).data, t)
    // Each element's file where the folder has it now.
    const files = keepMdFolderPaths(theirs, serializeToMdFolder(merged))
    const theirsAgain = keepMdFolderPaths(theirs, serializeToMdFolder(t))
    for (const [path, content] of Object.entries(files)) {
      if (theirs[path] !== undefined && theirsAgain[path] === content) files[path] = theirs[path]
    }
    const manifest = 'radical.md'
    const pick = ours[manifest] === base[manifest] ? theirs[manifest] : theirs[manifest] === base[manifest] ? ours[manifest] : theirs[manifest]
    if (pick !== undefined) files[manifest] = pick
    return { files, conflicts, dropped, restored }
  } catch {
    return null
  }
}

interface BaselineEntry {
  content: string
  stamp: string
}

/** Files read at once. One after another, a folder of 21,000 files took
 *  Studio about 11 s and the MCP server 4 s of waiting on each in turn. */
const READ_AT_ONCE = 32

/** `read` of each of `paths`, READ_AT_ONCE at a time; the results in order. */
export async function readEach<T>(paths: readonly string[], read: (path: string) => Promise<T>): Promise<T[]> {
  const out = new Array<T>(paths.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < paths.length) {
      const i = next++
      out[i] = await read(paths[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(READ_AT_ONCE, paths.length) }, worker))
  return out
}

/** How many files may be out of date in a folder's cache before it is
 *  written again: CACHE_STALE_MAX, or this share of the folder if more. */
const CACHE_STALE_MAX = 50
const CACHE_STALE_SHARE = 0.01

export class MdFolderSession {
  /** Called with the changed paths whenever `poll` or a refused `write`
   *  finds edits made outside the app. */
  onExternalChange: ((paths: string[]) => void) | null = null

  private baseline = new Map<string, BaselineEntry>()
  private loaded = false
  /** Stamps as of the last look at the folder, so one outside edit is
   *  reported once rather than on every poll until the app reloads. */
  private observed: Record<string, string> = {}
  private tail: Promise<unknown> = Promise.resolve()
  private running = 0

  /** `writeCache: false`: read the folder's cache when there is one, never
   *  write it (the CLI, which exits as soon as it is done; Studio and the
   *  MCP server keep it). `openFromCache`: the session's first read takes
   *  the folder as its cache has it, without looking at the files first;
   *  the next poll finds what changed since and reports it as an outside
   *  edit (Studio, which polls; not the MCP server, which reads once per
   *  call and must see the files as they are). */
  constructor(private readonly storage: MdFolderStorage, private readonly options: { writeCache?: boolean; openFromCache?: boolean } = {}) {}

  /** Read every model file and make that the baseline. */
  readAll(): Promise<FolderFiles> {
    return this.exclusive(async () => {
      // Not half way through another process's write.
      const release = await this.storage.lock?.(true)
      try {
        await this.loadBaseline()
      } finally {
        await release?.()
      }
      const files: FolderFiles = {}
      for (const [path, entry] of this.baseline) files[path] = entry.content
      return files
    })
  }

  /** Make the folder hold exactly the model `files` (plus whatever the
   *  format doesn't own). When it changed on disk since the last read,
   *  `merge` merges `files` with it and the app is told to reload; without
   *  a merge, or when it cannot, nothing is written. */
  write(files: FolderFiles, merge?: MdFolderMerge): Promise<MdFolderWriteResult> {
    return this.exclusive(async () => {
      const release = await this.storage.lock?.()
      try {
        return await this.writeLocked(files, merge)
      } finally {
        await release?.()
      }
    })
  }

  private async writeLocked(files: FolderFiles, merge?: MdFolderMerge): Promise<MdFolderWriteResult> {
    // A folder never read in this session (a fresh "save as folder", a
    // restarted main process): what is on disk now is the baseline.
    if (!this.loaded) await this.loadBaseline(false)
    // An element keeps its file unless it is renamed or moved itself.
    files = keepMdFolderPaths(this.baselineFiles(), files)
    const stamps = await this.storage.list()
    const conflict = await this.changedSince(stamps)
    let merged: { changed: string[]; conflicts: string[]; dropped?: MergeDrop[]; restored?: string[] } | undefined
    if (conflict.length > 0) {
      const theirs = merge ? await this.readFiles(stamps) : {}
      const result = merge ? merge(this.baselineFiles(), files, theirs) : null
      if (!result) {
        this.observed = stamps
        this.onExternalChange?.(conflict)
        return { ok: false, conflict }
      }
      // The folder as the merge read it is what the merged files replace.
      this.baseline = new Map(Object.entries(theirs).map(([path, content]) => [path, { content, stamp: stamps[path] }]))
      files = keepMdFolderPaths(theirs, result.files)
      merged = { changed: conflict, conflicts: result.conflicts, ...(result.dropped?.length ? { dropped: result.dropped } : {}), ...(result.restored?.length ? { restored: result.restored } : {}) }
    }

    for (const [path, content] of Object.entries(files)) {
      if (this.baseline.get(path)?.content === content) continue
      const stamp = await this.storage.write(path, content)
      this.baseline.set(path, { content, stamp })
    }
    const current: FolderFiles = {}
    for (const [path, entry] of this.baseline) current[path] = entry.content
    for (const path of staleMdFolderFiles(current, files)) {
      await this.storage.remove(path)
      this.baseline.delete(path)
    }
    this.observed = this.baselineStamps()
    // What came from the other writer is not on the app's screen yet.
    if (merged) this.onExternalChange?.(merged.changed)
    return merged ? { ok: true, merged } : { ok: true }
  }

  /** Look for edits made outside the app since the folder was last read,
   *  written or polled. Resolves with the changed paths (empty when none, or
   *  when another operation is running — the next poll will see it). */
  poll(): Promise<string[]> {
    if (this.running > 0 || !this.loaded) return Promise.resolve([])
    return this.exclusive(async () => {
      const stamps = await this.storage.list()
      if (sameStamps(stamps, this.observed)) return []
      this.observed = stamps
      const changed = await this.changedSince(stamps)
      if (changed.length > 0) this.onExternalChange?.(changed)
      return changed
    })
  }

  /** `rebuildCache`: write the cache again when it is out of date (not
   *  for a write, which changes the folder at once). */
  private async loadBaseline(rebuildCache = true): Promise<void> {
    const cached = this.storage.readCache ? readModelCache(await this.storage.readCache().catch(() => null)) : null
    // Opened as the cache has it; the stamps it has are the ones last seen,
    // so the next poll reads what changed since and reports it.
    if (cached && this.options.openFromCache && !this.loaded && rebuildCache) {
      this.baseline = new Map(Object.entries(cached).map(([path, { content, stamp }]) => [path, { content, stamp }]))
      this.observed = Object.fromEntries(Object.entries(cached).map(([path, { stamp }]) => [path, stamp]))
      this.loaded = true
      return
    }
    const stamps = await this.storage.list()
    const paths = Object.keys(stamps)
    // Each file whose stamp the cache has comes from it; only the others
    // are read (ADR Model cache beside the model).
    const toRead = cached ? paths.filter((path) => cached[path]?.stamp !== stamps[path]) : paths
    const contents = await readEach(toRead, (path) => this.storage.read(path))
    const read = new Map(toRead.map((path, i) => [path, contents[i]]))
    const baseline = new Map<string, BaselineEntry>()
    for (const path of paths) baseline.set(path, { content: read.get(path) ?? cached![path].content, stamp: stamps[path] })
    this.baseline = baseline
    this.observed = stamps
    this.loaded = true
    // Missing, unreadable or well out of date: written again once the
    // folder is read, after this operation, so the reader does not wait.
    // A few files out of date are read each time instead: an agent's call
    // changes some, and rewriting a cache of 21,000 files after each was
    // most of the call.
    const gone = cached ? Object.keys(cached).filter((path) => !(path in stamps)).length : 0
    const stale = !cached || toRead.length + gone > Math.max(CACHE_STALE_MAX, paths.length * CACHE_STALE_SHARE)
    // Only a model's folder gets one: a folder of other files is left alone.
    const model = isValidMdFolderManifest(baseline.get(MD_MANIFEST_FILE)?.content)
    if (stale && rebuildCache && model && this.options.writeCache !== false && this.storage.writeCache) this.cacheWrite = this.writeCacheLater()
  }

  /** Resolves once the cache a read found out of date is written again. */
  cacheWritten(): Promise<void> {
    return this.cacheWrite
  }

  private cacheWrite: Promise<void> = Promise.resolve()

  private writeCacheLater(): Promise<void> {
    const run = this.tail.then(async () => {
      this.running++
      try {
        const files: ModelCacheFiles = {}
        for (const [path, entry] of this.baseline) files[path] = { stamp: entry.stamp, content: entry.content }
        await this.storage.writeCache!(writeModelCache(files))
      } catch {
        // A folder we may not write (read-only): it opens without a cache.
      } finally {
        this.running--
      }
    })
    this.tail = run
    return run
  }

  /** Paths whose content on disk differs from the baseline: added, removed,
   *  or rewritten with different content. A file whose stamp moved but whose
   *  content didn't (touched, saved unchanged) just gets its stamp updated. */
  private async changedSince(stamps: Record<string, string>): Promise<string[]> {
    const changed: string[] = []
    const moved = Object.keys(stamps).filter((path) => {
      const known = this.baseline.get(path)
      if (!known) changed.push(path)
      return !!known && known.stamp !== stamps[path]
    })
    // Undefined: vanished between list and read.
    const contents = await readEach(moved, (path) => this.storage.read(path).catch(() => undefined))
    moved.forEach((path, i) => {
      const known = this.baseline.get(path)!
      if (contents[i] === known.content) known.stamp = stamps[path]
      else changed.push(path)
    })
    for (const path of this.baseline.keys()) {
      if (!(path in stamps)) changed.push(path)
    }
    return changed.sort()
  }

  /** The model files as last read or written. */
  private baselineFiles(): FolderFiles {
    const files: FolderFiles = {}
    for (const [path, entry] of this.baseline) files[path] = entry.content
    return files
  }

  /** The model files as they are on disk now. */
  private async readFiles(stamps: Record<string, string>): Promise<FolderFiles> {
    const files: FolderFiles = {}
    const paths = Object.keys(stamps)
    const contents = await readEach(paths, (path) => this.storage.read(path).catch(() => undefined))
    paths.forEach((path, i) => { if (contents[i] !== undefined) files[path] = contents[i] }) // else vanished between list and read
    return files
  }

  private baselineStamps(): Record<string, string> {
    const stamps: Record<string, string> = {}
    for (const [path, entry] of this.baseline) stamps[path] = entry.stamp
    return stamps
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    this.running++
    const run = this.tail.then(fn, fn)
    this.tail = run.catch(() => {})
    const done = (): void => { this.running-- }
    run.then(done, done)
    return run
  }
}

function sameStamps(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => b[key] === a[key])
}
