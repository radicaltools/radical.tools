import { randomUUID } from 'node:crypto'
import { lstat, open, readFile, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { applyDiscussionAction, DISCUSSIONS_FILE, DiscussionConflict, parseDiscussions, type DiscussionAction, type Discussions } from '@radical/common/discussions'

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

/** A separate lock and atomic replacement: model saves never participate. */
export class DiskDiscussions {
  private seen = false
  private readonly file: string
  private readonly lock: string

  constructor(folder: string, private readonly lockWaitMs = 5000) {
    const base = resolve(folder)
    this.file = join(base, DISCUSSIONS_FILE)
    this.lock = join(base, '.discussions.lock')
  }

  private async text(): Promise<string | null> {
    try {
      if (!(await lstat(this.file)).isFile()) throw new Error('discussions.json must be a regular file, not a symbolic link.')
      this.seen = true
      return await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      if (this.seen) throw new Error('discussions.json disappeared. Restore the file before posting; existing discussions will not be replaced.')
      return null
    }
  }

  async load(): Promise<Discussions> {
    const text = await this.text()
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
        return () => rm(this.lock, { force: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        // Never expire or steal a live writer's lock, including a slow one.
        if (Date.now() >= deadline) throw new Error('Another writer holds .discussions.lock. Wait and refresh. If a writer crashed, remove its lock only after it has stopped.')
        await pause(20)
      }
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
