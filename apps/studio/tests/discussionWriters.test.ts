import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskDiscussions } from '@radical/node-files/discussions'
import { DISCUSSIONS_FILE, type DiscussionAction, type DiscussionThread } from '@radical/common/discussions'
import { WebDiscussions } from '../src/renderer/src/discussions/webStorage'
import type { FsDirHandle, FsFileHandle, FsWritable } from '../src/renderer/src/persist/webFolder'

let folder: string | undefined
afterEach(async () => { if (folder) await rm(folder, { recursive: true, force: true }); folder = undefined })

/** FSA's buffered write/close/abort contract over real files, so the browser
 * and desktop adapters see each other's actual marker files and replacements. */
function directory(root: string, onDiscussionWrite?: () => Promise<void>): FsDirHandle {
  const writing = new Set<string>()
  const file = (name: string): FsFileHandle => {
    const path = join(root, name)
    return {
      kind: 'file', name,
      async getFile() {
        const text = await readFile(path, 'utf8')
        const info = await stat(path)
        return { text: async () => text, lastModified: info.mtimeMs, size: info.size }
      },
      async createWritable(): Promise<FsWritable> {
        if (writing.has(path)) throw new Error('Exclusive stream already open')
        writing.add(path)
        let buffer = ''
        return {
          write: async (text) => { buffer = text; if (name === DISCUSSIONS_FILE) await onDiscussionWrite?.() },
          async close() {
            const temporary = `${path}.${randomUUID()}.webtmp`
            try { await writeFile(temporary, buffer, { flag: 'wx' }); await rename(temporary, path) }
            finally { writing.delete(path); await rm(temporary, { force: true }) }
          },
          abort: async () => { writing.delete(path) },
        }
      },
    }
  }
  return {
    kind: 'directory', name: 'model',
    async *entries() { for (const name of await readdir(root)) yield [name, file(name)] },
    getDirectoryHandle: async () => { throw new Error('No subdirectories in this fixture') },
    async getFileHandle(name, options) {
      try {
        if (options?.create) { const handle = await open(join(root, name), 'a'); await handle.close() }
        else await stat(join(root, name))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw Object.assign(new Error('Not found'), { name: 'NotFoundError' })
        throw error
      }
      return file(name)
    },
    removeEntry: async (name) => { await rm(join(root, name)) },
  }
}

describe('browser and desktop discussion writers', () => {
  it('does not treat the empty entry of a failed first browser post as a disappeared discussion store', async () => {
    folder = await mkdtemp(join(tmpdir(), 'radical-discussion-first-'))
    let started!: () => void
    let finish!: () => void
    const writing = new Promise<void>((done) => { started = done })
    const gate = new Promise<void>((done) => { finish = done })
    const browser = new WebDiscussions(directory(folder, async () => { started(); await gate; throw new Error('Write failed') }), async (work) => work())
    const desktop = new DiskDiscussions(folder)
    const t: DiscussionThread = { id: randomUUID(), nodeId: 'payments', nodeLabelAtCreation: 'Payments', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'Root', createdAt: new Date().toISOString() }] }
    const post = expect(browser.act({ kind: 'createThread', thread: t })).rejects.toThrow('Write failed')
    await writing
    const read = expect(desktop.load()).resolves.toEqual({ threads: [] })
    finish()
    await Promise.all([read, post])
    expect((await desktop.act({ kind: 'createThread', thread: t })).threads).toHaveLength(1)
  })
  it('keep all replies when writing the same folder at once and leave no marker files', async () => {
    folder = await mkdtemp(join(tmpdir(), 'radical-discussion-hosts-'))
    const desktop = new DiskDiscussions(folder)
    let queued: Promise<unknown> = Promise.resolve()
    const browser = new WebDiscussions(directory(folder), <T>(work: () => Promise<T>) => {
      const result = queued.then(work, work)
      queued = result.catch(() => {})
      return result
    })
    const t: DiscussionThread = { id: randomUUID(), nodeId: 'payments', nodeLabelAtCreation: 'Payments', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'Root', createdAt: new Date().toISOString() }] }
    await desktop.act({ kind: 'createThread', thread: t })
    const submitted: string[] = []
    for (let round = 0; round < 3; round++) {
      await Promise.all(Array.from({ length: 8 }, (_, i) => {
        const id = randomUUID()
        submitted.push(id)
        const action: DiscussionAction = { kind: 'addReply', threadId: t.id, nodeId: t.nodeId, parent: t.comments[0], comment: { id, parentCommentId: t.comments[0].id, body: `${round}:${i}`, createdAt: new Date().toISOString() } }
        return (i % 2 ? browser : desktop).act(action)
      }))
    }
    const loaded = await desktop.load()
    expect(loaded.threads[0].comments).toHaveLength(25)
    expect(loaded.threads[0].comments.map((comment) => comment.id)).toEqual(expect.arrayContaining(submitted))
    expect(await browser.load()).toEqual(loaded)
    expect(await readdir(folder)).toEqual([DISCUSSIONS_FILE])
  })
})
