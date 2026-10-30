import { describe, expect, it } from 'vitest'
import { MdFolderSession, type MdFolderStorage } from '../src/formats/mdFolderSync'
import { MODEL_CACHE_VERSION, readModelCache, writeModelCache, type ModelCacheName } from '../src/formats/modelCache'

// A folder's cache in .radical/cache/ (ADR Model cache beside the model): a
// folder opens from it, reads only the files whose stamp moved, keeps it up
// with what it writes and reads (changes.json), and writes model.json again
// when it is missing, broken or well out of date.

/** A folder in memory that counts what is read and written, with a cache. */
function folder(count = 300) {
  const files: Record<string, string> = { 'radical.md': '---\nradicalFormat: md-folder\nversion: 1\n---\n' }
  const stamps: Record<string, string> = { 'radical.md': '1' }
  for (let i = 0; i < count; i++) {
    files[`nodes/n${i}.md`] = `---\nid: n${i}\ntype: component\nlabel: N${i}\n---\n`
    stamps[`nodes/n${i}.md`] = '1'
  }
  const state = { cache: {} as Partial<Record<ModelCacheName, string>>, reads: [] as string[], lists: 0, cacheWrites: [] as ModelCacheName[] }
  const storage: MdFolderStorage = {
    list: async () => { state.lists++; return { ...stamps } },
    read: async (path) => { state.reads.push(path); return files[path] },
    write: async (path, content) => { files[path] = content; stamps[path] = String(Number(stamps[path] ?? 0) + 1); return stamps[path] },
    remove: async (path) => { delete files[path]; delete stamps[path] },
    readCache: async (name) => state.cache[name] ?? null,
    writeCache: async (name, content) => { state.cache[name] = content; state.cacheWrites.push(name) },
  }
  /** As another program edits a file: new content, new stamp. */
  const edit = (path: string, content: string) => { files[path] = content; stamps[path] = String(Number(stamps[path] ?? 0) + 1) }
  const session = (options?: { openFromCache?: boolean }) => new MdFolderSession(storage, options)
  const open = async (options?: { openFromCache?: boolean }) => {
    state.reads = []
    state.lists = 0
    const s = session(options)
    const read = await s.readAll()
    await s.verified()
    await s.cacheWritten()
    return { read, session: s }
  }
  return { files, stamps, state, storage, edit, open, session }
}

const node = (i: number, label: string) => `---\nid: n${i}\ntype: component\nlabel: ${label}\n---\n`

describe('a model folder\'s cache', () => {
  it('is written when a folder is first read, and the next read takes every file from it', async () => {
    const f = folder()
    expect((await f.open()).read).toEqual(f.files)
    expect(f.state.reads.length).toBe(301)
    expect(f.state.cacheWrites).toEqual(['model.json'])
    expect(Object.keys(readModelCache(f.state.cache['model.json'])!.files).length).toBe(301)

    expect((await f.open()).read).toEqual(f.files)
    expect(f.state.reads).toEqual([])
    expect(f.state.cacheWrites).toEqual(['model.json'])
  })

  it('reads only the files changed since, and names them in changes.json, so the next read reads none', async () => {
    const f = folder()
    await f.open()
    f.edit('nodes/n3.md', node(3, 'Changed'))
    f.edit('nodes/new.md', '---\nid: new\ntype: component\nlabel: New\n---\n')
    delete f.files['nodes/n7.md']
    delete f.stamps['nodes/n7.md']
    const { read } = await f.open()
    expect(read).toEqual(f.files)
    expect(read['nodes/n7.md']).toBeUndefined()
    expect(f.state.reads.sort()).toEqual(['nodes/n3.md', 'nodes/new.md'])
    expect(f.state.cacheWrites).toEqual(['model.json', 'changes.json'])

    expect((await f.open()).read).toEqual(f.files)
    expect(f.state.reads).toEqual([])
  })

  it('keeps up with what the session writes', async () => {
    const f = folder()
    const { session } = await f.open()
    await session.write({ ...f.files, 'nodes/n5.md': node(5, 'Saved') })
    await session.cacheWritten()
    expect(f.state.cacheWrites.at(-1)).toBe('changes.json')
    const { read } = await f.open()
    expect(read['nodes/n5.md']).toContain('label: Saved')
    expect(f.state.reads).toEqual([])
  })

  it('writes model.json again once more files than changes.json can stand differ from it', async () => {
    const f = folder()
    await f.open()
    for (let i = 0; i < 60; i++) f.edit(`nodes/n${i}.md`, node(i, `M${i}`))
    expect((await f.open()).read).toEqual(f.files)
    expect(f.state.reads.length).toBe(60)
    expect(f.state.cacheWrites).toEqual(['model.json', 'model.json'])
    await f.open()
    expect(f.state.reads).toEqual([])
  })

  it('is rebuilt when it is broken or of another version, and the folder is read whole', async () => {
    for (const bad of ['{"format":"radical-model-cache","vers', JSON.stringify({ format: 'radical-model-cache', version: MODEL_CACHE_VERSION + 1, id: 'x', files: {} }), 'null']) {
      const f = folder(20)
      f.state.cache['model.json'] = bad
      expect((await f.open()).read).toEqual(f.files)
      expect(f.state.reads.length).toBe(21)
      expect(readModelCache(f.state.cache['model.json'])).not.toBeNull()
    }
  })

  it('leaves out a changes.json made for another model.json', async () => {
    const f = folder(20)
    await f.open()
    f.state.cache['changes.json'] = JSON.stringify({ format: 'radical-model-cache-changes', version: MODEL_CACHE_VERSION, base: 'another', files: { 'nodes/n1.md': { stamp: '1', content: 'stale' } }, removed: [] })
    expect((await f.open()).read['nodes/n1.md']).toBe(f.files['nodes/n1.md'])
  })

  it('is not needed: a folder whose cache cannot be written still opens', async () => {
    const f = folder(20)
    const session = new MdFolderSession({
      list: async () => ({ ...f.stamps }), read: async (p) => f.files[p], write: async () => '1', remove: async () => {},
      readCache: async () => null, writeCache: async () => { throw new Error('read-only') },
    })
    expect(await session.readAll()).toEqual(f.files)
    await expect(session.cacheWritten()).resolves.toBeUndefined()
  })
})

describe('opening a folder as its cache has it', () => {
  it('lists no file to open it, then lists them and finds them as the cache has them', async () => {
    const f = folder(20)
    await f.open()
    const s = f.session({ openFromCache: true })
    f.state.lists = 0
    f.state.reads = []
    expect(await s.readAll()).toEqual(f.files)
    expect(f.state.lists).toBe(0)
    expect(f.state.reads).toEqual([])
    expect(await s.verified()).toEqual({ stale: false, changed: [] })
    expect(f.state.lists).toBe(1)
  })

  it('says which files differ when they changed since, and the next read has them as they are', async () => {
    const f = folder(20)
    await f.open()
    f.edit('nodes/n3.md', node(3, 'Pulled'))
    const s = f.session({ openFromCache: true })
    const first = await s.readAll()
    expect(first['nodes/n3.md']).toContain('label: N3')
    expect(await s.verified()).toEqual({ stale: true, changed: ['nodes/n3.md'] })
    expect((await s.readAll())['nodes/n3.md']).toContain('label: Pulled')
  })

  it('reads the files whole when there is no cache, and has nothing to say after', async () => {
    const f = folder(20)
    const s = f.session({ openFromCache: true })
    expect(await s.readAll()).toEqual(f.files)
    expect(await s.verified()).toEqual({ stale: false, changed: [] })
  })
})

describe('the cache file', () => {
  it('is written in ASCII and reads back every character as it was', () => {
    const files = { 'nodes/a.md': { stamp: '1:2', content: 'Źródło — płatności → 😀\n' } }
    const text = writeModelCache(files, 'id')
    expect(/^[\x00-\x7e]*$/.test(text)).toBe(true)
    expect(readModelCache(text)!.files).toEqual(files)
  })
})
