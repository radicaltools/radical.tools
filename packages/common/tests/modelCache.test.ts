import { describe, expect, it } from 'vitest'
import { MdFolderSession, type MdFolderStorage } from '../src/formats/mdFolderSync'
import { MODEL_CACHE_VERSION, readModelCache, writeModelCache } from '../src/formats/modelCache'

// A folder's cache in .radical/cache/model.json (ADR Model cache beside the
// model): a folder opens from it, reads only the files whose stamp moved,
// and writes it again when it is missing, broken or well out of date.

/** A folder in memory that counts what is read, and keeps a cache. */
function folder(count = 300) {
  const files: Record<string, string> = { 'radical.md': '---\nradicalFormat: md-folder\nversion: 1\n---\n' }
  const stamps: Record<string, string> = { 'radical.md': '1' }
  for (let i = 0; i < count; i++) {
    files[`nodes/n${i}.md`] = `---\nid: n${i}\ntype: component\nlabel: N${i}\n---\n`
    stamps[`nodes/n${i}.md`] = '1'
  }
  const state = { cache: null as string | null, reads: [] as string[], cacheWrites: 0 }
  const storage: MdFolderStorage = {
    list: async () => ({ ...stamps }),
    read: async (path) => { state.reads.push(path); return files[path] },
    write: async (path, content) => { files[path] = content; stamps[path] = String(Number(stamps[path] ?? 0) + 1); return stamps[path] },
    remove: async (path) => { delete files[path]; delete stamps[path] },
    readCache: async () => state.cache,
    writeCache: async (content) => { state.cache = content; state.cacheWrites++ },
  }
  /** As another program edits a file: new content, new stamp. */
  const edit = (path: string, content: string) => { files[path] = content; stamps[path] = String(Number(stamps[path] ?? 0) + 1) }
  const open = async () => {
    state.reads = []
    const session = new MdFolderSession(storage)
    const read = await session.readAll()
    await session.cacheWritten()
    return read
  }
  return { files, stamps, state, edit, open }
}

describe('a model folder\'s cache', () => {
  it('is written when a folder is first read, and the next read takes every file from it', async () => {
    const f = folder()
    expect(await f.open()).toEqual(f.files)
    expect(f.state.reads.length).toBe(301)
    expect(f.state.cacheWrites).toBe(1)
    expect(Object.keys(readModelCache(f.state.cache)!).length).toBe(301)

    expect(await f.open()).toEqual(f.files)
    expect(f.state.reads).toEqual([])
    expect(f.state.cacheWrites).toBe(1)
  })

  it('reads only the files changed since, and leaves a cache a few files out of date as it is', async () => {
    const f = folder()
    await f.open()
    f.edit('nodes/n3.md', '---\nid: n3\ntype: component\nlabel: Changed\n---\n')
    f.edit('nodes/new.md', '---\nid: new\ntype: component\nlabel: New\n---\n')
    delete f.files['nodes/n7.md']
    delete f.stamps['nodes/n7.md']
    const read = await f.open()
    expect(read).toEqual(f.files)
    expect(read['nodes/n7.md']).toBeUndefined()
    expect(f.state.reads.sort()).toEqual(['nodes/n3.md', 'nodes/new.md'])
    expect(f.state.cacheWrites).toBe(1)
  })

  it('is written again once more files than it can stand are out of date', async () => {
    const f = folder()
    await f.open()
    for (let i = 0; i < 60; i++) f.edit(`nodes/n${i}.md`, `---\nid: n${i}\ntype: component\nlabel: M${i}\n---\n`)
    expect(await f.open()).toEqual(f.files)
    expect(f.state.reads.length).toBe(60)
    expect(f.state.cacheWrites).toBe(2)
    await f.open()
    expect(f.state.reads).toEqual([])
  })

  it('is rebuilt when it is broken or of another version, and the folder is read whole', async () => {
    for (const bad of ['{"format":"radical-model-cache","vers', JSON.stringify({ format: 'radical-model-cache', version: MODEL_CACHE_VERSION + 1, files: {} }), 'null']) {
      const f = folder(20)
      f.state.cache = bad
      expect(await f.open()).toEqual(f.files)
      expect(f.state.reads.length).toBe(21)
      expect(readModelCache(f.state.cache)).not.toBeNull()
    }
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
  it('opens as the cache has it, without looking at the files, and the next poll reports what changed since', async () => {
    const f = folder(20)
    await f.open()
    f.edit('nodes/n3.md', '---\nid: n3\ntype: component\nlabel: Pulled\n---\n')
    let lists = 0
    const storage = {
      list: async () => { lists++; return { ...f.stamps } },
      read: async (path: string) => { f.state.reads.push(path); return f.files[path] },
      write: async () => '1', remove: async () => {},
      readCache: async () => f.state.cache,
    }
    const session = new MdFolderSession(storage, { openFromCache: true })
    const changes: string[][] = []
    session.onExternalChange = (paths) => changes.push(paths)
    f.state.reads = []
    const first = await session.readAll()
    expect(lists).toBe(0)
    expect(f.state.reads).toEqual([])
    expect(first['nodes/n3.md']).toContain('label: N3')
    // The poll finds the file changed since the cache, as an outside edit.
    expect(await session.poll()).toEqual(['nodes/n3.md'])
    expect(changes).toEqual([['nodes/n3.md']])
    // Read again (the reload that follows): the files as they are.
    expect((await session.readAll())['nodes/n3.md']).toContain('label: Pulled')
  })
})

describe('the cache file', () => {
  it('is written in ASCII and reads back every character as it was', () => {
    const files = { 'nodes/a.md': { stamp: '1:2', content: 'Źródło — płatności → 😀\n' } }
    const text = writeModelCache(files)
    expect(/^[\x00-\x7e]*$/.test(text)).toBe(true)
    expect(readModelCache(text)).toEqual(files)
  })
})
