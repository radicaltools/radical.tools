import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DiskDiscussions } from '../src/discussions'
import { diskFolderStorage } from '../src/diskFolderStorage'
import { MdFolderSession, mergeMdFolderFiles } from '@radical/common/formats/mdFolderSync'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { DISCUSSIONS_WEB_LOCK_FILE, threadState, type DiscussionAction, type DiscussionThread } from '@radical/common/discussions'

const fault = vi.hoisted(() => ({ replace: false }))
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, rename: async (...args: Parameters<typeof fs.rename>) => {
    if (fault.replace) throw Object.assign(new Error('Replacement denied'), { code: 'EACCES' })
    return fs.rename(...args)
  } }
})

const dirs: string[] = []
async function folder(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), 'radical-discussions-')); dirs.push(dir); return dir }
afterEach(async () => { fault.replace = false; for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
const thread = (): DiscussionThread => ({ id: randomUUID(), nodeId: 'payment-service', nodeLabelAtCreation: 'Payments', resolved: false, comments: [{ id: randomUUID(), parentCommentId: null, body: 'Question', createdAt: new Date().toISOString() }] })
const create = (t: DiscussionThread): DiscussionAction => ({ kind: 'createThread', thread: t })
const reply = (t: DiscussionThread): Extract<DiscussionAction, { kind: 'addReply' }> => ({ kind: 'addReply', threadId: t.id, nodeId: t.nodeId, parent: t.comments[0], comment: { id: randomUUID(), parentCommentId: t.comments[0].id, body: randomUUID(), createdAt: new Date().toISOString() } })

describe('desktop discussion storage', () => {
  it('yields to browser intent without taking its marker or touching the discussion file', async () => {
    const dir = await folder()
    const adapter = new DiskDiscussions(dir, 30)
    const marker = join(dir, DISCUSSIONS_WEB_LOCK_FILE)
    await writeFile(marker, '')
    await expect(adapter.act(create(thread()))).rejects.toThrow('Another writer')
    expect(await readdir(dir)).toEqual([DISCUSSIONS_WEB_LOCK_FILE])
    await rm(marker)
    expect((await adapter.act(create(thread()))).threads).toHaveLength(1)
  })
  it('keeps the live file and removes temporary files when atomic replacement fails', async () => {
    const dir = await folder()
    const adapter = new DiskDiscussions(dir)
    const t = thread()
    await adapter.act(create(t))
    const original = await readFile(join(dir, 'discussions.json'), 'utf8')
    fault.replace = true
    await expect(adapter.act(reply(t))).rejects.toThrow('Replacement denied')
    expect(await readFile(join(dir, 'discussions.json'), 'utf8')).toBe(original)
    expect(await readdir(dir)).toEqual(['discussions.json'])
    fault.replace = false
    expect((await adapter.act(reply(t))).threads[0].comments).toHaveLength(2)
  })
  it('creates only on the first post, reopens nested replies and preserves discussions across model save and pruning', async () => {
    const dir = await folder()
    const adapter = new DiskDiscussions(dir)
    expect(await adapter.load()).toEqual({ threads: [] })
    expect(await readdir(dir)).toEqual([])
    const model = new MdFolderSession(diskFolderStorage(dir))
    await model.write(serializeToMdFolder({ nodes: [], relations: [], snapshots: [] }, 'model'))
    const before = await model.readAll()
    const t = thread()
    await adapter.act(create(t))
    const first = reply(t)
    await adapter.act(first)
    if (first.kind !== 'addReply') throw new Error('reply expected')
    await adapter.act({ ...reply(t), parent: first.comment, comment: { ...first.comment, id: randomUUID(), parentCommentId: first.comment.id, body: 'Nested reply' } })
    expect(await model.readAll()).toEqual(before)
    const text = await readFile(join(dir, 'discussions.json'), 'utf8')
    await model.write(serializeToMdFolder({ nodes: [], relations: [], snapshots: [] }, 'renamed'), mergeMdFolderFiles)
    expect(await readFile(join(dir, 'discussions.json'), 'utf8')).toBe(text)
    const loaded = await new DiskDiscussions(dir).load()
    expect(loaded.threads[0].comments).toHaveLength(3)
    expect(loaded.threads[0].comments[2].parentCommentId).toBe(first.comment.id)
    expect(Object.keys(await diskFolderStorage(dir).list())).not.toContain('discussions.json')
    expect((await readdir(dir)).some((p) => p.endsWith('.tmp') || p === '.discussions.lock')).toBe(false)
  })

  it('serializes participating writers and checks the latest thread state', async () => {
    const dir = await folder()
    const a = new DiskDiscussions(dir)
    const b = new DiskDiscussions(dir)
    const t = thread()
    await a.act(create(t))
    await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? a : b).act(reply(t))))
    const loaded = await a.load()
    expect(loaded.threads[0].comments).toHaveLength(9)
    await b.act({ kind: 'setResolved', threadId: t.id, expected: threadState(loaded.threads[0]), resolved: true })
    await expect(a.act(reply(t))).rejects.toThrow('resolved')
    await expect(a.act({ kind: 'setResolved', threadId: t.id, expected: threadState(t), resolved: true })).rejects.toThrow('Thread changed')
    expect((await a.load()).threads[0].comments).toHaveLength(9)
  })

  it('does not overwrite invalid, conflicted or previously loaded missing files', async () => {
    const dir = await folder()
    const adapter = new DiskDiscussions(dir)
    await adapter.act(create(thread()))
    for (const content of ['not json', '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> other', '{"threads": [], "unknown": true}']) {
      await writeFile(join(dir, 'discussions.json'), content)
      await expect(adapter.load()).rejects.toThrow()
      await expect(adapter.act(create(thread()))).rejects.toThrow()
      expect(await readFile(join(dir, 'discussions.json'), 'utf8')).toBe(content)
    }
    await rm(join(dir, 'discussions.json'))
    await expect(adapter.load()).rejects.toThrow('disappeared')
    await expect(adapter.act(create(thread()))).rejects.toThrow('disappeared')
    expect(await readdir(dir)).toEqual([])
  })

  it('does not take over an old lock and leaves the live file intact on replacement failure', async () => {
    const dir = await folder()
    const adapter = new DiskDiscussions(dir, 30)
    const t = thread()
    await adapter.act(create(t))
    const original = await readFile(join(dir, 'discussions.json'), 'utf8')
    const lock = join(dir, '.discussions.lock')
    await writeFile(lock, `${process.pid} live-writer\n`)
    await utimes(lock, new Date(0), new Date(0))
    await expect(adapter.act(reply(t))).rejects.toThrow('Another writer')
    expect(await readFile(lock, 'utf8')).toContain('live-writer')
    expect(await readFile(join(dir, 'discussions.json'), 'utf8')).toBe(original)
    await rm(lock)
    // A non-file target is a real filesystem failure, without platform-specific chmod assumptions.
    await rm(join(dir, 'discussions.json'))
    await mkdir(join(dir, 'discussions.json'))
    await expect(adapter.act(reply(t))).rejects.toThrow('regular file')
    expect((await readdir(dir)).filter((p) => p.endsWith('.tmp'))).toEqual([])
  })
})
