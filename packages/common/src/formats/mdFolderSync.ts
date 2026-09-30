// ─── Md-folder sync session ──────────────────────────────────────────────────
//
// One md-folder model on some storage — Node's fs in Electron's main process,
// a File System Access directory handle in the browser. The session keeps a
// baseline: each model file's content and stamp as the app last read or wrote
// it. From that:
//
//   • `write` touches only files whose content changed, prunes the stale files
//     the format owns, and refuses to run at all when the folder changed on
//     disk since the app last read it — the caller reloads instead of
//     overwriting an edit made in another editor or by git;
//   • `poll` reports such outside edits so the app can reload promptly.
//
// Stamps are cheap change markers (mtime + size, whatever the storage offers):
// only files whose stamp moved are read, and a file counts as changed only when
// its content differs. Operations run one at a time; a poll that would have to
// wait is skipped rather than queued.

import { isMdFolderModelPath, staleMdFolderFiles, type FolderFiles } from './mdFolder'

/** Where a session's files live. Paths are POSIX, relative to the folder. */
export interface MdFolderStorage {
  /** Stamp of every model file present (see `isMdFolderModelPath`). */
  list(): Promise<Record<string, string>>
  read(path: string): Promise<string>
  /** Write a file, creating directories as needed; resolves with its new stamp. */
  write(path: string, content: string): Promise<string>
  remove(path: string): Promise<void>
}

export type MdFolderWriteResult =
  | { ok: true }
  /** Nothing was written: these files changed on disk since the last read. */
  | { ok: false; conflict: string[] }

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
      await this.loadBaseline()
      const files: FolderFiles = {}
      for (const [path, entry] of this.baseline) files[path] = entry.content
      return files
    })
  }

  /** Make the folder hold exactly the model `files` (plus whatever the
   *  format doesn't own), unless it changed on disk since the last read. */
  write(files: FolderFiles): Promise<MdFolderWriteResult> {
    return this.exclusive(async () => {
      // A folder never read in this session (a fresh "save as folder", a
      // restarted main process): what is on disk now is the baseline.
      if (!this.loaded) await this.loadBaseline()
      const stamps = await this.storage.list()
      const conflict = await this.changedSince(stamps)
      if (conflict.length > 0) {
        this.observed = stamps
        this.onExternalChange?.(conflict)
        return { ok: false, conflict }
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
      return { ok: true }
    })
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
