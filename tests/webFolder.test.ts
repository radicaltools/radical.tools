import { describe, it, expect } from 'vitest'
import {
  readFolderFromHandle,
  writeFolderToHandle,
  type FsDirHandle,
  type FsFileHandle,
} from '../src/renderer/src/persist/webFolder'

// ─── In-memory fake implementing the File System Access API surface used ─────

class FakeFile implements FsFileHandle {
  kind = 'file' as const
  constructor(public data: string) {}
  getFile(): Promise<{ text(): Promise<string> }> {
    return Promise.resolve({ text: () => Promise.resolve(this.data) })
  }
  createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> {
    return Promise.resolve({
      write: (d: string) => { this.data = d; return Promise.resolve() },
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

describe('webFolder read/write', () => {
  it('writes a nested file map and reads it back', async () => {
    const root = new FakeDir('model')
    const files = {
      'radical.md': '---\nradicalFormat: "md-folder"\n---\n',
      'nodes/system-a/_index.md': '---\nid: "a"\n---\n',
      'nodes/system-a/db.md': '---\nid: "b"\n---\n',
      'relations.json': '[]',
    }
    await writeFolderToHandle(root, files)
    const back = await readFolderFromHandle(root)
    expect(back).toEqual(files)
  })

  it('prunes managed files that disappear, keeps unrelated files', async () => {
    const root = new FakeDir('model')
    await writeFolderToHandle(root, {
      'radical.md': 'x',
      'nodes/a.md': 'A',
      'nodes/b.md': 'B',
      'notes.txt': 'keep me', // unmanaged extension — never touched
    })
    // notes.txt is unmanaged; simulate it existing by writing directly.
    ;(root.children.get('notes.txt') as FakeFile) // ensured by write above

    // Second write drops nodes/b.md.
    await writeFolderToHandle(root, {
      'radical.md': 'x',
      'nodes/a.md': 'A',
    })
    const back = await readFolderFromHandle(root)
    expect(back['nodes/a.md']).toBe('A')
    expect('nodes/b.md' in back).toBe(false)
    // The unmanaged file survives (readFolder only returns .md/.json, but the
    // node still exists in the tree).
    expect(root.children.has('notes.txt')).toBe(true)
  })
})
