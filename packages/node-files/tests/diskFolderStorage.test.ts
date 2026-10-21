import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises'
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
    expect(await readdir(join(dir, '.radical'))).toEqual(['.gitignore'])
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
})
