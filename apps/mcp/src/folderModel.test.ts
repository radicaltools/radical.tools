import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, dirname, relative } from 'node:path'
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
      expect(client.getInstructions()).toContain('get_model_summary')
      const summary = JSON.stringify((await client.callTool({ name: 'get_model_summary', arguments: {} })).content)
      expect(summary).toContain('ears_type')
      expect(summary).toContain('allowedPairs')
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

      const domain = await client.callTool({ name: 'add_node', arguments: { tempId: 'shop', type: 'domain', label: 'Shop' } })
      expect(domain.isError, JSON.stringify(domain.content)).not.toBe(true)
      const moved = await client.callTool({ name: 'move_node', arguments: { id: 'new-system', parentId: 'shop' } })
      expect(moved.isError, JSON.stringify(moved.content)).not.toBe(true)
      const view = await client.callTool({ name: 'create_view', arguments: { tempId: 'ctx', name: 'Context', nodeIds: ['actor', 'new-system'] } })
      expect(view.isError, JSON.stringify(view.content)).not.toBe(true)
      expect(JSON.stringify(view.content)).toContain('views.json')
      const final = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      const domainId = final.nodes.find((node) => node.label === 'Shop')?.id
      expect(final.nodes.find((node) => node.id === id)?.parentId).toBe(domainId)
      expect(final.views).toEqual([expect.objectContaining({ name: 'Context', nodeIds: expect.arrayContaining([id]) })])
    } finally {
      await client.close()
    }
  })

  it('places children inside their parent, keeps defaultPositions in step and runs Smart Layout', async () => {
    const folder = await fixture()
    const files = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    // Studio writes defaultPositions; give the fixture an (empty) map like a saved model.
    const layout = JSON.parse(files['_layout.json'] ?? '{}')
    await writeFile(join(folder, '_layout.json'), JSON.stringify({ ...layout, defaultPositions: {} }))
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder],
    })
    const read = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    try {
      await client.connect(transport)
      for (const args of [
        { tempId: 'shop', type: 'domain', label: 'Shop' },
        { tempId: 'orders', type: 'system', label: 'Orders', parentId: 'shop' },
        { tempId: 'billing', type: 'system', label: 'Billing', parentId: 'shop' },
        { tempId: 'crm', type: 'system', label: 'CRM' },
      ]) {
        const added = await client.callTool({ name: 'add_node', arguments: args })
        expect(added.isError, JSON.stringify(added.content)).not.toBe(true)
      }
      let data = await read()
      const byLabel = (label: string) => data.nodes.find((node) => node.label === label)!
      const [shop, orders, billing] = [byLabel('Shop'), byLabel('Orders'), byLabel('Billing')]
      expect(orders).toMatchObject({ x: 30, y: 120 })
      expect(billing.x).toBeGreaterThan(orders.x + orders.width)
      // The parent grew to wrap both children.
      expect(shop.width).toBeGreaterThanOrEqual(billing.x + billing.width + 30)
      expect(shop.height).toBeGreaterThanOrEqual(orders.y + orders.height + 30)

      const moved = await client.callTool({ name: 'move_node', arguments: { id: 'crm', parentId: 'shop' } })
      expect(moved.isError, JSON.stringify(moved.content)).not.toBe(true)
      data = await read()
      const crm = byLabel('CRM')
      expect(crm.parentId).toBe(shop.id)
      expect(data.defaultPositions?.[crm.id]).toEqual({ x: crm.x, y: crm.y, width: crm.width, height: crm.height })

      const user = await client.callTool({ name: 'add_node', arguments: { tempId: 'user', type: 'person', label: 'Buyer' } })
      expect(user.isError).not.toBe(true)
      await client.callTool({ name: 'add_relation', arguments: { sourceId: 'user', targetId: 'orders', relationType: 'interacts' } })
      const laidOut = await client.callTool({ name: 'smart_layout', arguments: {} })
      expect(laidOut.isError, JSON.stringify(laidOut.content)).not.toBe(true)
      expect(JSON.stringify(laidOut.content)).toMatch(/Smart Layout/)
      data = await read()
      for (const node of data.nodes) {
        expect(data.defaultPositions?.[node.id]).toEqual({ x: node.x, y: node.y, width: node.width, height: node.height })
      }
    } finally {
      await client.close()
    }
  }, 60_000)

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

describe('starting a model', () => {
  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'radical-new-'))
    folders.push(dir)
    return dir
  }
  const summaryOf = async (model: FolderModel) => JSON.parse((await model.call('get_model_summary', {})).text.split('\n')[0])

  it('turns an empty folder into a Governance model, as Studio would write it', async () => {
    const dir = await tempDir()
    await mkdir(join(dir, '.git'))
    const model = await FolderModel.open(dir)
    const manifest = await readFile(join(dir, 'radical.md'), 'utf8')
    expect(manifest).toMatch(/radicalFormat: "md-folder"/)
    expect(manifest).toContain(`name: "${basename(dir)}"`)
    const summary = await summaryOf(model)
    expect(summary.metamodel.id).toBe('c4-ddd-governance-builtin')
    expect(summary.nodeTypes).toContain('need')
  })

  it('creates a missing folder, relative to the working directory, with the chosen metamodel', async () => {
    const dir = join(await tempDir(), 'docs', 'architecture')
    const model = await FolderModel.open(relative(process.cwd(), dir), { metamodel: 'c4' })
    expect((await summaryOf(model)).metamodel.id).toBe('c4-builtin')
    expect(await readFile(join(dir, 'radical.md'), 'utf8')).toContain('name: "architecture"')
  })

  it('leaves a folder with other files alone and says how to start one', async () => {
    const dir = await tempDir()
    await writeFile(join(dir, 'README.md'), '# Not a model\n')
    await expect(FolderModel.open(dir)).rejects.toThrow(/empty or new folder/)
    expect(await readdir(dir)).toEqual(['README.md'])
  })

  it('keeps an existing model and its metamodel', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder, { metamodel: 'c4' })
    expect((await summaryOf(model)).metamodel.id).toBe('c4-ddd-governance-builtin')
  })
})
