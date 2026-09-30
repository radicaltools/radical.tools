// The Electron main process's md-folder storage, against a real directory.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '../src/main/diskFolderStorage'

const node = (id: string, body = ''): string => `---\nid: "${id}"\ntype: "system"\n---\n${body}`

describe('diskFolderStorage', () => {
  let root: string
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'radical-md-')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('round-trips a model and ignores everything that is not one', async () => {
    const files = { 'radical.md': 'm', 'nodes/a/_index.md': node('a'), 'nodes/a/b.md': node('b'), 'views.json': '[]' }
    await new MdFolderSession(diskFolderStorage(root)).write(files)
    await writeFile(join(root, 'package.json'), '{}')
    await mkdir(join(root, 'node_modules/x'), { recursive: true })
    await writeFile(join(root, 'node_modules/x/README.md'), 'x')
    await mkdir(join(root, 'nodes/.git'), { recursive: true })
    await writeFile(join(root, 'nodes/.git/HEAD.md'), 'x')

    expect(await new MdFolderSession(diskFolderStorage(root)).readAll()).toEqual(files)
  })

  it('detects an outside edit and will not overwrite it', async () => {
    const session = new MdFolderSession(diskFolderStorage(root))
    await session.write({ 'radical.md': 'm', 'nodes/a.md': node('a') })
    expect(await session.poll()).toEqual([])

    await writeFile(join(root, 'nodes/a.md'), node('a', 'edited in another editor'))
    expect(await session.poll()).toEqual(['nodes/a.md'])
    expect(await session.write({ 'radical.md': 'm', 'nodes/a.md': node('a', 'app') }))
      .toEqual({ ok: false, conflict: ['nodes/a.md'] })
    expect(await readFile(join(root, 'nodes/a.md'), 'utf-8')).toBe(node('a', 'edited in another editor'))
  })

  it('prunes a renamed node\'s old file but keeps hand-written notes', async () => {
    const session = new MdFolderSession(diskFolderStorage(root))
    await session.write({ 'radical.md': 'm', 'nodes/old.md': node('a') })
    await writeFile(join(root, 'nodes/README.md'), '# notes')
    await session.readAll()
    await session.write({ 'radical.md': 'm', 'nodes/new.md': node('a') })
    expect(existsSync(join(root, 'nodes/old.md'))).toBe(false)
    expect(existsSync(join(root, 'nodes/new.md'))).toBe(true)
    expect(existsSync(join(root, 'nodes/README.md'))).toBe(true)
  })

  it('refuses paths that escape the folder', async () => {
    const storage = diskFolderStorage(join(root, 'model'))
    await expect(storage.write('../escape.md', 'x')).rejects.toThrow(/outside the model folder/)
    expect(existsSync(join(root, 'escape.md'))).toBe(false)
  })
})
