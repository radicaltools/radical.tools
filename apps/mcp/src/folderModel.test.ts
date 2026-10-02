import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { FolderModel } from './folderModel'

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

async function fixture(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-'))
  folders.push(folder)
  const files = serializeToMdFolder({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, 'MCP test')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true })
    await writeFile(join(folder, path), content)
  }
  await writeFile(join(folder, 'notes.txt'), 'Keep me')
  await mkdir(join(folder, 'nodes'), { recursive: true })
  await writeFile(join(folder, 'nodes/README.md'), '# Keep these notes\n')
  return folder
}

describe('folder-backed MCP model', () => {
  it('lists and calls tools over stdio, persisting a real node ID', async () => {
    const folder = await fixture()
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder],
    })
    try {
      await client.connect(transport)
      const tools = await client.listTools()
      expect(tools.tools.map((tool) => tool.name)).toContain('add_node')
      expect(tools.tools.map((tool) => tool.name)).not.toContain('reset_diagram')
      const result = await client.callTool({ name: 'add_node', arguments: { tempId: 'new-system', type: 'system', label: 'New System' } })
      expect(result.isError).not.toBe(true)
      const message = JSON.stringify(result.content)
      expect(message).not.toContain('nodes/README.md')
      const id = /Created node ([^ .]+)\./.exec(message)?.[1]
      expect(id).toBeTruthy()
      const files = await new MdFolderSession(diskFolderStorage(folder)).readAll()
      const saved = deserializeFromMdFolder(files).data
      expect(saved.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id, label: 'New System' })]))
      expect(await readFile(join(folder, 'notes.txt'), 'utf8')).toBe('Keep me')
      expect(await readFile(join(folder, 'nodes/README.md'), 'utf8')).toBe('# Keep these notes\n')

      const actor = await client.callTool({ name: 'add_node', arguments: { tempId: 'actor', type: 'person', label: 'User' } })
      expect(actor.isError).not.toBe(true)
      const relation = await client.callTool({
        name: 'add_relation',
        arguments: { sourceId: 'actor', targetId: 'new-system', relationType: 'interacts' },
      })
      expect(relation.isError, JSON.stringify(relation.content)).not.toBe(true)
      expect(JSON.stringify(relation.content)).toMatch(/Relation ID: [^ .]+\./)
      const related = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      expect(related.relations).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: id })]))

      const update = await client.callTool({ name: 'update_node', arguments: { id: 'new-system', label: 'Renamed System' } })
      expect(update.isError, JSON.stringify(update.content)).not.toBe(true)
      const updated = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      expect(updated.nodes.find((node) => node.id === id)?.label).toBe('Renamed System')
    } finally {
      await client.close()
    }
  })

  it('rejects a changed folder before writing', async () => {
    const folder = await fixture()
    const session = new MdFolderSession(diskFolderStorage(folder))
    const files = await session.readAll()
    await writeFile(join(folder, 'radical.md'), files['radical.md'] + '\nOutside edit')
    const result = await session.write({ ...files, 'radical.md': files['radical.md'] + '\nMCP edit' })
    expect(result).toEqual({ ok: false, conflict: ['radical.md'] })
    expect(await readFile(join(folder, 'radical.md'), 'utf8')).toContain('Outside edit')
  })

  it('rejects malformed sidecars and symlink escapes', async () => {
    const folder = await fixture()
    await writeFile(join(folder, 'relations.json'), '{bad json')
    await expect(FolderModel.open(folder)).rejects.toThrow('Malformed JSON in relations.json')
    await rm(join(folder, 'relations.json'))
    const outside = await mkdtemp(join(tmpdir(), 'radical-outside-'))
    folders.push(outside)
    const { symlink } = await import('node:fs/promises')
    await rm(join(folder, 'nodes'), { recursive: true })
    await symlink(outside, join(folder, 'nodes'))
    await expect(FolderModel.open(folder)).rejects.toThrow('symlink in model path')
  })
})
