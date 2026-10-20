import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
})
