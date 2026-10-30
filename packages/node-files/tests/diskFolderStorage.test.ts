import { afterEach, describe, expect, it } from 'vitest'
import { chmod, mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MdFolderSession, mergeMdFolderFiles } from '@radical/common/formats/mdFolderSync'
import { deserializeFromMdFolder, serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { DiagramData } from '@radical/common/c4'
import { diskFolderStorage } from '../src/diskFolderStorage'

let dir: string | undefined

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

describe('diskFolderStorage', () => {
  it('reads a file saved with a byte-order mark as the browser does, without it', async () => {
    // Node's fs keeps the BOM, the browser's File.text() drops it: the MCP
    // server and the CLI read another file than Studio did, and JSON.parse
    // failed on the sidecar.
    dir = await mkdtemp(join(tmpdir(), 'radical-bom-'))
    await mkdir(join(dir, 'nodes'))
    await writeFile(join(dir, 'nodes', 'customer.md'), '﻿---\nid: "customer"\n---\n')
    await writeFile(join(dir, 'relations.json'), '﻿[]\n')
    const storage = diskFolderStorage(dir)
    expect(await storage.read('nodes/customer.md')).toBe('---\nid: "customer"\n---\n')
    expect(JSON.parse(await storage.read('relations.json'))).toEqual([])
    // Writing leaves no BOM of its own.
    await storage.write('relations.json', '[]\n')
    expect(await readFile(join(dir, 'relations.json'), 'utf8')).toBe('[]\n')
  })

  it('lets two writers of one folder take turns, so neither loses the other\'s write', async () => {
    // Two MCP servers on one folder (Claude Desktop and Claude Code), each
    // in its own process with its own session: both checked the folder for
    // outside edits, found none, and wrote; the second write took the first
    // one's milestone out, while both said it was saved.
    dir = await mkdtemp(join(tmpdir(), 'radical-two-'))
    const model: DiagramData = { nodes: [], relations: [], snapshots: [] }
    await new MdFolderSession(diskFolderStorage(dir)).write(serializeToMdFolder(model, 'model'))
    for (let round = 0; round < 5; round++) {
      const writers = ['A', 'B'].map(async (name) => {
        const session = new MdFolderSession(diskFolderStorage(dir!))
        const data = deserializeFromMdFolder(await session.readAll()).data
        const snapshots = [...(data.snapshots ?? []), { id: `${name}${round}`, name: `${name} ${round}`, savedAt: 'x', nodes: [], relations: [] }]
        return session.write(serializeToMdFolder({ ...data, snapshots } as DiagramData, 'model'), mergeMdFolderFiles)
      })
      expect((await Promise.all(writers)).every((result) => result.ok)).toBe(true)
      const names = JSON.parse(await readFile(join(dir, 'snapshots.json'), 'utf8')).map((m: { name: string }) => m.name)
      expect(names).toEqual(expect.arrayContaining([`A ${round}`, `B ${round}`]))
    }
    // The turn is not kept once the writes are done.
    expect(await readdir(join(dir, '.radical'))).not.toContain('write.lock')
  })

  it('takes over a turn left by a process that is gone', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-stale-'))
    await mkdir(join(dir, '.radical'))
    // No process has this id (it is above every system's limit).
    await writeFile(join(dir, '.radical', 'write.lock'), `${2 ** 31 - 2} ${Date.now()} x\n`)
    const started = Date.now()
    expect(await new MdFolderSession(diskFolderStorage(dir)).write({ 'radical.md': 'm' })).toEqual({ ok: true })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('takes over a lock file that names no turn once it is past being written, to read or to write', async () => {
    // A garbage lock made a read wait 15 s and then say "nothing was written".
    dir = await mkdtemp(join(tmpdir(), 'radical-garbage-'))
    await new MdFolderSession(diskFolderStorage(dir)).write({ 'radical.md': 'm' })
    for (const text of ['garbage\n', '']) {
      await writeFile(join(dir, '.radical', 'write.lock'), text)
      const started = Date.now()
      expect(await new MdFolderSession(diskFolderStorage(dir)).readAll()).toEqual({ 'radical.md': 'm' })
      expect(Date.now() - started).toBeLessThan(3000)
    }
  }, 10_000)

  it('reads a folder it may not write, .radical/ and all', async () => {
    // A checkout mounted read-only, or another user's folder: radical check
    // and radical diff exited 2 with EACCES on .radical/write.lock, and the
    // MCP server did not start.
    dir = await mkdtemp(join(tmpdir(), 'radical-readonly-'))
    const model: DiagramData = { nodes: [], relations: [] }
    await new MdFolderSession(diskFolderStorage(dir)).write(serializeToMdFolder(model, 'model'))
    await chmod(join(dir, '.radical'), 0o555)
    await chmod(dir, 0o555)
    try {
      const files = await new MdFolderSession(diskFolderStorage(dir)).readAll()
      expect(files['radical.md']).toContain('model')
      // A write still says why it cannot.
      await expect(new MdFolderSession(diskFolderStorage(dir)).write({ ...files, 'radical.md': files['radical.md'] + 'x' })).rejects.toThrow(/EACCES|EPERM/)
    } finally {
      await chmod(dir, 0o755)
      await chmod(join(dir, '.radical'), 0o755)
    }
  })
  it('keeps the folder in .radical/cache/model.json, opens from it, and writes it again when it is gone', async () => {
    dir = await mkdtemp(join(tmpdir(), 'radical-cache-'))
    const data: DiagramData = { nodes: [{ id: 'a', type: 'system', label: 'Shop', x: 0, y: 0, width: 240, height: 140, collapsed: false }], relations: [] }
    const files = serializeToMdFolder(data, 'Shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(dir, path, '..'), { recursive: true })
      await writeFile(join(dir, path), content)
    }
    const open = async () => {
      const session = new MdFolderSession(diskFolderStorage(dir!))
      const read = await session.readAll()
      await session.cacheWritten()
      return read
    }
    expect(await open()).toEqual(files)
    const cacheFile = join(dir, '.radical', 'cache', 'model.json')
    const cache = JSON.parse(await readFile(cacheFile, 'utf-8'))
    expect(Object.keys(cache.files).sort()).toEqual(Object.keys(files).sort())
    expect(await readdir(join(dir, '.radical', 'cache'))).toEqual(['model.json'])

    // A file whose stamp the cache has comes from the cache, not the disk.
    const path = Object.keys(files).find((p) => p.startsWith('nodes/'))!
    cache.files[path].content = 'from the cache'
    await writeFile(cacheFile, JSON.stringify(cache))
    expect((await open())[path]).toBe('from the cache')

    // Gone: the folder is read whole, and the cache written again.
    await rm(join(dir, '.radical', 'cache'), { recursive: true })
    expect(await open()).toEqual(files)
    expect(JSON.parse(await readFile(cacheFile, 'utf-8')).files[path].content).toBe(files[path])
  })
})
