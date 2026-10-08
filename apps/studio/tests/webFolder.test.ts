import { describe, it, expect } from 'vitest'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import {
  handleFolderStorage,
  writeSelectionToHandle,
  type FsDirHandle,
  type FsFileHandle,
} from '../src/renderer/src/persist/webFolder'

// ─── In-memory fake implementing the File System Access API surface used ─────

let clock = 0

class FakeFile implements FsFileHandle {
  kind = 'file' as const
  lastModified = ++clock
  constructor(public data: string) {}
  getFile(): Promise<{ text(): Promise<string>; lastModified: number; size: number }> {
    return Promise.resolve({
      text: () => Promise.resolve(this.data),
      lastModified: this.lastModified,
      size: this.data.length,
    })
  }
  createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> {
    return Promise.resolve({
      write: (d: string) => { this.data = d; this.lastModified = ++clock; return Promise.resolve() },
      close: () => Promise.resolve(),
    })
  }
}

class FakeDir implements FsDirHandle {
  kind = 'directory' as const
  children = new Map<string, FakeDir | FakeFile>()
  constructor(public name: string) {}
  async *entries(): AsyncIterableIterator<[string, FsDirHandle | FsFileHandle]> {
    for (const [k, v] of this.children) yield [k, v]
  }
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle> {
    let child = this.children.get(name)
    if (!child) {
      if (!opts?.create) return Promise.reject(new Error('NotFound'))
      child = new FakeDir(name)
      this.children.set(name, child)
    }
    if (!(child instanceof FakeDir)) return Promise.reject(new Error('TypeMismatch'))
    return Promise.resolve(child)
  }
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle> {
    let child = this.children.get(name)
    if (!child) {
      if (!opts?.create) return Promise.reject(new Error('NotFound'))
      child = new FakeFile('')
      this.children.set(name, child)
    }
    if (!(child instanceof FakeFile)) return Promise.reject(new Error('TypeMismatch'))
    return Promise.resolve(child)
  }
  removeEntry(name: string): Promise<void> {
    this.children.delete(name)
    return Promise.resolve()
  }
}

const session = (root: FakeDir): MdFolderSession => new MdFolderSession(handleFolderStorage(root))

describe('webFolder read/write', () => {
  it('writes a nested file map and reads it back', async () => {
    const root = new FakeDir('model')
    const files = {
      'radical.md': '---\nradicalFormat: "md-folder"\n---\n',
      'nodes/system-a/_index.md': '---\nid: "a"\n---\n',
      'nodes/system-a/db.md': '---\nid: "b"\n---\n',
      'relations.json': '[]',
    }
    await session(root).write(files)
    expect(await session(root).readAll()).toEqual(files)
  })

  it('prunes node files and sidecars that disappear, keeps files it does not own', async () => {
    const root = new FakeDir('model')
    const a = '---\nid: "a"\ntype: "system"\n---\n'
    const b = '---\nid: "b"\ntype: "system"\n---\n'
    const s = session(root)
    await s.write({ 'radical.md': 'x', 'nodes/a.md': a, 'nodes/b.md': b, 'views.json': '[]' })
    // Files that aren't the model's own, placed by the user.
    root.children.set('notes.txt', new FakeFile('keep me'))
    root.children.set('package.json', new FakeFile('{}'))
    ;(root.children.get('nodes') as FakeDir).children.set('README.md', new FakeFile('# Notes\n'))
    await s.readAll()

    // Second write drops nodes/b.md and views.json.
    await s.write({ 'radical.md': 'x', 'nodes/a.md': a })
    const back = await session(root).readAll()
    expect(back).toEqual({ 'radical.md': 'x', 'nodes/a.md': a, 'nodes/README.md': '# Notes\n' })
    expect(root.children.has('views.json')).toBe(false)
    expect(root.children.has('package.json')).toBe(true)
    expect(root.children.has('notes.txt')).toBe(true)
  })

  it('reads only model files, never walking other directories', async () => {
    const root = new FakeDir('repo')
    await session(root).write({ 'radical.md': 'x', 'nodes/a.md': 'A' })
    const deps = new FakeDir('node_modules')
    deps.children.set('lib.md', new FakeFile('not ours'))
    root.children.set('node_modules', deps)
    root.children.set('README.md', new FakeFile('# repo'))
    expect(await session(root).readAll()).toEqual({ 'radical.md': 'x', 'nodes/a.md': 'A' })
  })

  it('notices a file edited outside the app and refuses to overwrite it', async () => {
    const root = new FakeDir('model')
    const s = session(root)
    await s.write({ 'radical.md': 'x', 'nodes/a.md': 'A' })
    const file = (root.children.get('nodes') as FakeDir).children.get('a.md') as FakeFile
    file.data = 'edited elsewhere'
    file.lastModified = ++clock

    expect(await s.poll()).toEqual(['nodes/a.md'])
    expect(await s.write({ 'radical.md': 'x', 'nodes/a.md': 'app edit' })).toEqual({ ok: false, conflict: ['nodes/a.md'] })
    expect(file.data).toBe('edited elsewhere')
  })

  it('writes the canvas selection under .radical, gitignored, without it counting as a model change', async () => {
    const root = new FakeDir('model')
    const s = session(root)
    await s.write({ 'radical.md': 'x' })
    await writeSelectionToHandle(root, '{"nodeIds":["a"]}')
    await writeSelectionToHandle(root, '{"nodeIds":["b"]}')
    const dir = root.children.get('.radical') as FakeDir
    expect((dir.children.get('selection.json') as FakeFile).data).toBe('{"nodeIds":["b"]}')
    expect((dir.children.get('.gitignore') as FakeFile).data).toBe('*\n')
    expect(await s.poll()).toEqual([])
  })
})
