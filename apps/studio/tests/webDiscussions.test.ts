import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { applyDiscussionAction, DISCUSSIONS_FILE, DISCUSSIONS_LOCK_FILE, DISCUSSIONS_WEB_LOCK_FILE, threadState, type DiscussionAction, type DiscussionThread } from '@radical/common/discussions'
import { WebDiscussions } from '../src/renderer/src/discussions/webStorage'
import { handleFolderStorage, type FsDirHandle, type FsFileHandle, type FsWritable } from '../src/renderer/src/persist/webFolder'

const notFound = (): Error => Object.assign(new Error('Not found'), { name: 'NotFoundError' })
class File implements FsFileHandle {
  kind = 'file' as const
  locked = false
  failWrite = false
  failClose = false
  commitThenFail = false
  afterWrite?: () => void
  constructor(readonly name: string, public data = '') {}
  async getFile() { const text = this.data; return { text: async () => text, lastModified: 0, size: text.length } }
  async createWritable(options?: { mode?: string }): Promise<FsWritable> {
    if (this.locked && options?.mode === 'exclusive') throw new Error('Already writing')
    this.locked = true
    let buffer = ''
    return {
      write: async (text) => { if (this.failWrite) throw new Error('Write denied'); buffer = text; this.afterWrite?.() },
      close: async () => { this.locked = false; if (this.failClose) throw new Error('Commit denied'); this.data = buffer; if (this.commitThenFail) throw new Error('Acknowledgement lost') },
      abort: async () => { this.locked = false },
    }
  }
}
class Directory implements FsDirHandle {
  kind = 'directory' as const
  name = 'model'
  files = new Map<string, File>()
  failRead = false
  configure?: (file: File) => void
  onCreate?: (file: File) => void
  async *entries(): AsyncIterableIterator<[string, FsFileHandle]> { yield* this.files }
  async getDirectoryHandle(): Promise<FsDirHandle> { throw notFound() }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<File> {
    if (this.failRead && name === DISCUSSIONS_FILE) throw Object.assign(new Error('Read denied'), { name: 'NotAllowedError' })
    let file = this.files.get(name)
    if (!file) {
      if (!options?.create) throw notFound()
      file = new File(name)
      this.configure?.(file)
      this.files.set(name, file)
      this.onCreate?.(file)
    }
    return file
  }
  async removeEntry(name: string): Promise<void> { this.files.delete(name) }
}
function writeTurn() {
  let previous: Promise<unknown> = Promise.resolve()
  return <T>(work: () => Promise<T>): Promise<T> => {
    const result = previous.then(work, work)
    previous = result.catch(() => {})
    return result
  }
}
const thread = (): DiscussionThread => ({ id: randomUUID(), nodeId: 'payment-service', nodeLabelAtCreation: 'Payments', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'Question', createdAt: new Date().toISOString() }] })
const create = (t: DiscussionThread): DiscussionAction => ({ kind: 'createThread', thread: t })
const reply = (t: DiscussionThread): DiscussionAction => ({ kind: 'addReply', threadId: t.id, nodeId: t.nodeId, parent: t.comments[0], comment: { id: randomUUID(), parentCommentId: t.comments[0].id, body: 'Reply', createdAt: new Date().toISOString() } })

describe('browser discussion storage', () => {
  it('keeps a committed first post when close reports an uncertain outcome', async () => {
    const root = new Directory()
    root.configure = (file) => { if (file.name === DISCUSSIONS_FILE) file.commitThenFail = true }
    const adapter = new WebDiscussions(root, writeTurn())
    const t = thread()
    await expect(adapter.act(create(t))).rejects.toThrow('Acknowledgement lost')
    expect((await adapter.load()).threads[0]).toEqual(t)
    expect([...root.files.keys()]).toEqual([DISCUSSIONS_FILE])
  })
  it('creates on the first successful post, reopens comments and stays outside model storage and pruning', async () => {
    const root = new Directory()
    const adapter = new WebDiscussions(root, writeTurn())
    expect(await adapter.load()).toEqual({ threads: [] })
    expect(root.files.size).toBe(0)
    await handleFolderStorage(root).write('radical.md', 'model')
    const t = thread()
    await adapter.act(create(t))
    await adapter.act(reply(t))
    expect((await new WebDiscussions(root, writeTurn()).load()).threads[0].comments).toHaveLength(2)
    expect(await handleFolderStorage(root).list()).toEqual({ 'radical.md': '0:5' })
    expect([...root.files.keys()].sort()).toEqual([DISCUSSIONS_FILE, 'radical.md'].sort())
  })

  it('aborts failed writes and failed closes, retaining existing text and rolling back an empty first creation', async () => {
    for (const failure of ['failWrite', 'failClose'] as const) {
      const root = new Directory()
      root.configure = (file) => { if (file.name === DISCUSSIONS_FILE) file[failure] = true }
      const adapter = new WebDiscussions(root, writeTurn())
      await expect(adapter.act(create(thread()))).rejects.toThrow('denied')
      expect(root.files.size).toBe(0)
      expect(await adapter.load()).toEqual({ threads: [] })
      root.configure = undefined
      const t = thread()
      await adapter.act(create(t))
      const file = root.files.get(DISCUSSIONS_FILE)!
      const original = file.data
      file[failure] = true
      await expect(adapter.act(reply(t))).rejects.toThrow('denied')
      expect(file.data).toBe(original)
      expect(file.locked).toBe(false)
      expect(root.files.has(DISCUSSIONS_WEB_LOCK_FILE)).toBe(false)
    }
  })

  it('blocks invalid, unreadable and previously loaded missing files without overwriting', async () => {
    const root = new Directory()
    const adapter = new WebDiscussions(root, writeTurn())
    await adapter.act(create(thread()))
    for (const text of ['<<<<<<< HEAD\n=======\n>>>>>>> branch', '{"threads": [], "unknown": true}']) {
      root.files.get(DISCUSSIONS_FILE)!.data = text
      await expect(adapter.load()).rejects.toThrow()
      await expect(adapter.act(create(thread()))).rejects.toThrow()
      expect(root.files.get(DISCUSSIONS_FILE)!.data).toBe(text)
    }
    root.failRead = true
    await expect(adapter.load()).rejects.toThrow('Read denied')
    await expect(adapter.act(create(thread()))).rejects.toThrow('Read denied')
    root.failRead = false
    root.files.delete(DISCUSSIONS_FILE)
    await expect(adapter.load()).rejects.toThrow('disappeared')
    await expect(adapter.act(create(thread()))).rejects.toThrow('disappeared')
    expect(root.files.size).toBe(0)
  })

  it('keeps concurrent replies from distinct adapters and checks the latest resolution', async () => {
    const root = new Directory()
    const turn = writeTurn()
    const a = new WebDiscussions(root, turn)
    const b = new WebDiscussions(root, turn)
    const t = thread()
    await a.act(create(t))
    await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? a : b).act(reply(t))))
    const latest = (await a.load()).threads[0]
    expect(latest.comments).toHaveLength(9)
    await b.act({ kind: 'setResolved', threadId: t.id, expected: threadState(latest), resolved: true })
    await expect(a.act(reply(t))).rejects.toThrow('resolved')
    expect((await a.load()).threads[0].comments).toHaveLength(9)
  })

  it('rejects an external change observed while preparing the browser swap file', async () => {
    const root = new Directory()
    const adapter = new WebDiscussions(root, writeTurn())
    const t = thread()
    await adapter.act(create(t))
    const file = root.files.get(DISCUSSIONS_FILE)!
    file.afterWrite = () => { file.data = 'External conflict markers' }
    await expect(adapter.act(reply(t))).rejects.toThrow('changed outside')
    expect(file.data).toBe('External conflict markers')
    expect(file.locked).toBe(false)
  })

  it('does not steal desktop or browser markers and yields if a desktop writer enters during lock acquisition', async () => {
    for (const marker of [DISCUSSIONS_LOCK_FILE, DISCUSSIONS_WEB_LOCK_FILE]) {
      const root = new Directory()
      root.files.set(marker, new File(marker, 'live writer'))
      await expect(new WebDiscussions(root, writeTurn(), 5).act(create(thread()))).rejects.toThrow('Another writer')
      expect(root.files.get(marker)!.data).toBe('live writer')
      expect(root.files.has(DISCUSSIONS_FILE)).toBe(false)
    }
    const root = new Directory()
    const t = thread()
    let raced = false
    root.onCreate = (file) => {
      if (file.name !== DISCUSSIONS_WEB_LOCK_FILE || raced) return
      raced = true
      root.files.set(DISCUSSIONS_LOCK_FILE, new File(DISCUSSIONS_LOCK_FILE, 'desktop'))
      setTimeout(() => {
        root.files.set(DISCUSSIONS_FILE, new File(DISCUSSIONS_FILE, JSON.stringify(applyDiscussionAction({ threads: [] }, create(t)))))
        root.files.delete(DISCUSSIONS_LOCK_FILE)
      }, 30)
    }
    const result = await new WebDiscussions(root, writeTurn()).act(reply(t))
    expect(result.threads[0].comments).toHaveLength(2)
    expect([...root.files.keys()]).toEqual([DISCUSSIONS_FILE])
  })
})

it('preserves imported provenance and version 2 across browser writes and permits only the explicit resolved import path', async () => {
  const root = new Directory(), adapter = new WebDiscussions(root, writeTurn()), t = thread()
  t.comments[0].confluence = { accountId: 'remote-account', url: 'https://example.atlassian.net/wiki/pages/viewpage.action?pageId=1' }
  await adapter.act(create(t))
  let loaded = await adapter.load()
  expect(loaded.version).toBe(2)
  expect(loaded.threads[0].comments[0].confluence).toEqual(t.comments[0].confluence)
  await adapter.act({ kind: 'setResolved', threadId: t.id, expected: threadState(loaded.threads[0]), resolved: true })
  const action = reply(t)
  if (action.kind !== 'addReply') throw new Error('reply expected')
  action.comment.confluence = { ...t.comments[0].confluence!, reviewRequired: true }
  await expect(adapter.act(action)).rejects.toThrow('resolved')
  await adapter.act({ ...action, kind: 'importReply' })
  loaded = await adapter.load()
  expect(loaded.version).toBe(2)
  expect(loaded.threads[0].resolved).toBe(true)
  expect(loaded.threads[0].comments[1].confluence?.reviewRequired).toBe(true)
})
