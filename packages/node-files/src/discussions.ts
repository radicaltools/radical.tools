import { randomUUID } from 'node:crypto'
import { lstat, open, readFile, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { applyDiscussionAction, DISCUSSIONS_FILE, DISCUSSIONS_LOCK_FILE, DISCUSSIONS_WEB_LOCK_FILE, DiscussionConflict, parseDiscussions, type DiscussionAction, type Discussions } from '@radical/common/discussions'

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

/** A separate lock and atomic replacement: model saves never participate. */
export class DiskDiscussions {
  private seen = false
  private readonly file: string
  private readonly lock: string
  private readonly webLock: string

  constructor(folder: string, private readonly lockWaitMs = 5000) {
    const base = resolve(folder)
    this.file = join(base, DISCUSSIONS_FILE)
    this.lock = join(base, DISCUSSIONS_LOCK_FILE)
    this.webLock = join(base, DISCUSSIONS_WEB_LOCK_FILE)
  }

  private async browserWriting(): Promise<boolean> {
    return lstat(this.webLock).then(() => true, (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false
      throw error
    })
  }

  private async text(waitForFirstCommit = false): Promise<string | null> {
    const deadline = Date.now() + this.lockWaitMs
    for (;;) {
      try {
        if (!(await lstat(this.file)).isFile()) throw new Error('discussions.json must be a regular file, not a symbolic link.')
        const text = await readFile(this.file, 'utf8')
        // FSA exposes an empty entry until the first successful close. A
        // reader must not mistake a failed first post for a deleted store.
        if (waitForFirstCommit && text === '' && Date.now() < deadline && await this.browserWriting()) { await pause(20); continue }
        this.seen = true
        return text
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.seen = true; throw error }
        if (this.seen) throw new Error('discussions.json disappeared. Restore the file before posting; existing discussions will not be replaced.')
        return null
      }
    }
  }

  async load(): Promise<Discussions> {
    const text = await this.text(true)
    return text === null ? { threads: [] } : parseDiscussions(text)
  }

  private async takeLock(): Promise<() => Promise<void>> {
    const deadline = Date.now() + this.lockWaitMs
    for (;;) {
      try {
        const handle = await open(this.lock, 'wx', 0o600)
        try { await handle.writeFile(`${process.pid} ${randomUUID()}\n`) }
        catch (error) { await handle.close(); await rm(this.lock, { force: true }); throw error }
        await handle.close()
        const release = () => rm(this.lock, { force: true })
        // Each host publishes its own intent before checking the other's.
        // If both enter together, both yield and retry; neither steals a turn.
        let browserWriting: boolean
        try {
          browserWriting = await this.browserWriting()
        } catch (error) { await release(); throw error }
        if (!browserWriting) return release
        await release()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        // Never expire or steal a live writer's lock, including a slow one.
      }
      if (Date.now() >= deadline) throw new Error('Another writer holds a discussion lock (.discussions.lock or .discussions.web.lock). Wait and refresh. If a writer crashed, remove its lock only after it has stopped.')
      await pause(20 + Math.random() * 30)
    }
  }

  async act(action: DiscussionAction): Promise<Discussions> {
    const release = await this.takeLock()
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      const original = await this.text()
      const latest = original === null ? { threads: [] } : parseDiscussions(original)
      const next = applyDiscussionAction(latest, action)
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(JSON.stringify(next, null, 2) + '\n', 'utf8')
        await handle.sync()
      } finally { await handle.close() }
      // Editors and Git do not honor our lock. Detect changes observed before replacement.
      if (await this.text() !== original) throw new DiscussionConflict('Discussion file changed outside the app. Refresh and review; nothing was written.')
      await rename(temporary, this.file)
      this.seen = true
      return next
    } finally {
      try { await rm(temporary, { force: true }) } finally { await release() }
    }
  }
}
