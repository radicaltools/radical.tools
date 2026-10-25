import { applyDiscussionAction, DISCUSSIONS_FILE, DISCUSSIONS_LOCK_FILE, DISCUSSIONS_WEB_LOCK_FILE, DiscussionConflict, parseDiscussions, type DiscussionAction, type Discussions } from '@radical/common/discussions'
import type { FsDirHandle, FsWritable } from '../persist/webFolder'

type WriteTurn = <T>(work: () => Promise<T>) => Promise<T>
const missing = (error: unknown): boolean => (error as { name?: string })?.name === 'NotFoundError'
const pause = (): Promise<void> => new Promise((done) => setTimeout(done, 20 + Math.random() * 30))

/** One origin-wide turn also covers aliases of the same directory handle. */
async function browserWriteTurn<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('This browser cannot coordinate discussion writes. Open this folder in a current Chrome or Edge browser.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    return await navigator.locks.request('radical-discussions:write', { signal: controller.signal }, () => {
      clearTimeout(timer)
      return work()
    })
  } finally { clearTimeout(timer) }
}

/** Independent File System Access storage; close commits the browser's swap file.
 * Web Locks serialize same-origin tabs, including different document IDs for
 * one folder. Intent files coordinate with current desktop writers. */
export class WebDiscussions {
  private seen = false
  constructor(private readonly root: FsDirHandle, private readonly turn: WriteTurn = browserWriteTurn, private readonly lockWaitMs = 5000) {}

  private async raw(): Promise<string | null> {
    try { return await (await (await this.root.getFileHandle(DISCUSSIONS_FILE)).getFile()).text() }
    catch (error) { if (missing(error)) return null; throw error }
  }
  private async text(waitForFirstCommit = false): Promise<string | null> {
    const deadline = Date.now() + this.lockWaitMs
    let text = await this.raw()
    while (waitForFirstCommit && text === '' && Date.now() < deadline && await this.exists(DISCUSSIONS_WEB_LOCK_FILE)) {
      await pause()
      text = await this.raw()
    }
    if (text === null && this.seen) throw new Error('discussions.json disappeared. Restore the file before posting; existing discussions will not be replaced.')
    if (text !== null) this.seen = true
    return text
  }
  async load(): Promise<Discussions> {
    const text = await this.text(true)
    return text === null ? { threads: [] } : parseDiscussions(text)
  }

  private async exists(name: string): Promise<boolean> {
    try { await this.root.getFileHandle(name); return true }
    catch (error) { if (missing(error)) return false; throw error }
  }
  private async takeLock(): Promise<() => Promise<void>> {
    const deadline = Date.now() + this.lockWaitMs
    for (;;) {
      if (!await this.exists(DISCUSSIONS_WEB_LOCK_FILE) && !await this.exists(DISCUSSIONS_LOCK_FILE)) {
        const handle = await this.root.getFileHandle(DISCUSSIONS_WEB_LOCK_FILE, { create: true })
        // Keep an exclusive stream open until release. Never replace another
        // browser's marker if it won the race to create this entry.
        const stream = await handle.createWritable({ mode: 'exclusive' })
        const release = async (): Promise<void> => {
          if (!stream.abort) throw new Error('This browser cannot safely release the discussion lock.')
          await stream.abort()
          await this.root.removeEntry(DISCUSSIONS_WEB_LOCK_FILE)
        }
        if (!stream.abort) throw new Error('This browser cannot safely write discussions. Update Chrome or Edge and reopen the folder.')
        let desktopWriting: boolean
        try { desktopWriting = await this.exists(DISCUSSIONS_LOCK_FILE) }
        catch (error) { await release(); throw error }
        if (!desktopWriting) return release
        await release()
      }
      if (Date.now() >= deadline) throw new Error('Another writer holds a discussion lock. Wait and refresh. If an app or tab crashed, remove its .discussions.lock or .discussions.web.lock only after that writer has stopped.')
      await pause()
    }
  }

  async act(action: DiscussionAction): Promise<Discussions> {
    return this.turn(async () => {
      const release = await this.takeLock()
      let stream: FsWritable | undefined
      let created = false
      try {
        const original = await this.text()
        const next = applyDiscussionAction(original === null ? { threads: [] } : parseDiscussions(original), action)
        const file = await this.root.getFileHandle(DISCUSSIONS_FILE, { create: original === null })
        created = original === null
        stream = await file.createWritable({ mode: 'exclusive' })
        if (!stream.abort) throw new Error('This browser cannot safely cancel discussion writes. Update Chrome or Edge.')
        await stream.write(JSON.stringify(next, null, 2) + '\n')
        // Nothing in the live file has changed yet. Git and external editors
        // do not honor our locks: reject an observed change before committing.
        if (await this.raw() !== (original ?? '')) throw new DiscussionConflict('Discussion file changed outside the app. Refresh and review; nothing was written.')
        await stream.close()
        stream = undefined
        this.seen = true
        return next
      } catch (error) {
        let cancelled = !stream
        if (stream?.abort) cancelled = await stream.abort().then(() => true, () => false)
        // getFileHandle(create) exposes an empty entry before the first commit.
        // Roll it back on failure only while it is still empty; never delete
        // a committed or externally edited file after an uncertain close.
        if (created && cancelled && await this.raw() === '') await this.root.removeEntry(DISCUSSIONS_FILE)
        throw error
      } finally { await release() }
    })
  }
}
