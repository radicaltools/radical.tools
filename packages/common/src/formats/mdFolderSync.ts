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

import { deserializeFromMdFolder, isMdFolderModelPath, isOwnedMdFolderFile, serializeToMdFolder, staleMdFolderFiles, type FolderFiles } from './mdFolder'
import { mergeModels } from '../modelMerge'

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
}

export type MdFolderWriteResult =
  /** Written; `merged` when it was merged with these files changed on disk,
   *  `conflicts` naming the values both changed, where the disk's was kept. */
  | { ok: true; merged?: { changed: string[]; conflicts: string[] } }
  /** Nothing was written: these files changed on disk since the last read. */
  | { ok: false; conflict: string[] }

/** The files to write in place of `ours` when the folder changed from `base`
 *  (as read) to `theirs` (on disk now), and the values both changed; null
 *  when they cannot be merged (a file that does not read as a model). */
export type MdFolderMerge = (base: FolderFiles, ours: FolderFiles, theirs: FolderFiles) => { files: FolderFiles; conflicts: string[] } | null

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
    const { merged, conflicts } = mergeModels(deserializeFromMdFolder(base).data, deserializeFromMdFolder(ours).data, t)
    const files = serializeToMdFolder(merged)
    const theirsAgain = serializeToMdFolder(t)
    for (const [path, content] of Object.entries(files)) {
      if (theirs[path] !== undefined && theirsAgain[path] === content) files[path] = theirs[path]
    }
    const manifest = 'radical.md'
    const pick = ours[manifest] === base[manifest] ? theirs[manifest] : theirs[manifest] === base[manifest] ? ours[manifest] : theirs[manifest]
    if (pick !== undefined) files[manifest] = pick
    return { files, conflicts }
  } catch {
    return null
  }
}

interface BaselineEntry {
  content: string
  stamp: string
}

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

  constructor(private readonly storage: MdFolderStorage) {}

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
    if (!this.loaded) await this.loadBaseline()
    const stamps = await this.storage.list()
    const conflict = await this.changedSince(stamps)
    let merged: { changed: string[]; conflicts: string[] } | undefined
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
      files = result.files
      merged = { changed: conflict, conflicts: result.conflicts }
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

  private async loadBaseline(): Promise<void> {
    const stamps = await this.storage.list()
    const baseline = new Map<string, BaselineEntry>()
    for (const [path, stamp] of Object.entries(stamps)) {
      baseline.set(path, { content: await this.storage.read(path), stamp })
    }
    this.baseline = baseline
    this.observed = stamps
    this.loaded = true
  }

  /** Paths whose content on disk differs from the baseline: added, removed,
   *  or rewritten with different content. A file whose stamp moved but whose
   *  content didn't (touched, saved unchanged) just gets its stamp updated. */
  private async changedSince(stamps: Record<string, string>): Promise<string[]> {
    const changed: string[] = []
    for (const [path, stamp] of Object.entries(stamps)) {
      const known = this.baseline.get(path)
      if (!known) {
        changed.push(path)
      } else if (known.stamp !== stamp) {
        let content: string
        try {
          content = await this.storage.read(path)
        } catch {
          changed.push(path) // vanished between list and read
          continue
        }
        if (content === known.content) known.stamp = stamp
        else changed.push(path)
      }
    }
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
    for (const path of Object.keys(stamps)) {
      try { files[path] = await this.storage.read(path) } catch { /* vanished between list and read */ }
    }
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
