import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join, dirname, relative } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { writeSelectionFile } from '@radical/node-files/selectionFile'
import { serializeSelection } from '@radical/common/formats/canvasSelection'
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

describe('canvas selection', () => {
  it('returns what Studio selected, resolved against the model, and is not a model change', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    expect((await model.call('get_selection', {})).text).toMatch(/^No selection/)

    const screen = await model.call('add_node', { tempId: 'screen', type: 'mockup', label: 'Checkout screen' })
    const page = await model.call('add_node', { tempId: 'pay', type: 'requirement', label: 'Pay by card' })
    expect([screen.text, page.text]).toEqual([expect.stringMatching(/^Created node/), expect.stringMatching(/^Created node/)])
    const [mockupId, requirementId] = [screen, page].map((outcome) => /Created node ([^ .]+)\./.exec(outcome.text)![1])
    for (const [tool, args] of [
      ['add_relation', { sourceId: mockupId, targetId: requirementId, relationType: 'illustrates' }],
      ['create_view', { tempId: 'screens', name: 'Screens', nodeIds: [mockupId] }],
    ] as const) expect((await model.call(tool, args)).text).not.toMatch(/required|unknown|invalid|not allowed/i)
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const view = data.views!.find((v) => v.name === 'Screens')!
    const before = await new MdFolderSession(diskFolderStorage(folder)).readAll()

    await writeSelectionFile(folder, serializeSelection({ viewId: view.id, nodeIds: [mockupId, 'gone'], relationIds: [] }))
    expect(await readFile(join(folder, '.radical/.gitignore'), 'utf8')).toBe('*\n')
    const outcome = await model.call('get_selection', {})
    expect(outcome.ok).toBe(true)
    const result = JSON.parse(outcome.text)
    expect(result.view).toEqual({ id: view.id, name: 'Screens', kind: 'static' })
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].node).toMatchObject({ id: mockupId, type: 'mockup', label: 'Checkout screen' })
    expect(result.nodes[0].outgoing[0]).toMatchObject({ targetId: requirementId })
    expect(result.missing).toEqual(['gone'])

    await writeSelectionFile(folder, serializeSelection({ viewId: null, nodeIds: [], relationIds: [] }))
    expect((await model.call('get_selection', {})).text).toMatch(/^Nothing is selected in Studio/)
    // The selection file sits outside the model: the folder's model files are untouched.
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(before)
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

describe('long Smart Layout runs', () => {
  async function modelWithNodes(): Promise<{ folder: string; model: FolderModel }> {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    for (const args of [
      { tempId: 'a', type: 'system', label: 'A' },
      { tempId: 'b', type: 'system', label: 'B' },
      { tempId: 'u', type: 'person', label: 'User' },
    ]) expect((await model.call('add_node', args)).ok).toBe(true)
    expect((await model.call('add_relation', { sourceId: 'u', targetId: 'a', relationType: 'interacts' })).ok).toBe(true)
    return { folder, model }
  }

  it('reports each step to a client that asked for progress', async () => {
    const { model } = await modelWithNodes()
    const steps: { progress: number; message: string }[] = []
    const outcome = await model.call('smart_layout', {}, { onProgress: (p) => steps.push(p) })
    expect(outcome.ok, outcome.text).toBe(true)
    expect(steps.map((s) => s.message)).toContain('Smart Layout: candidates 1/10')
    expect(steps.map((s) => s.progress)).toEqual(steps.map((_, i) => i + 1))
  }, 60_000)

  it('stops at the next step once the client cancels, and writes nothing', async () => {
    const { folder, model } = await modelWithNodes()
    const before = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    const cancel = new AbortController()
    const outcome = await model.call('smart_layout', {}, { signal: cancel.signal, onProgress: () => cancel.abort() })
    expect(outcome).toMatchObject({ ok: false, text: expect.stringMatching(/cancelled/) })
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(before)
  }, 60_000)

  it('unpins the canvas it arranges', async () => {
    // Elements on top of each other, two of them pinned in Studio.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = ['a', 'b', 'c'].map((id, i) => ({ id, type: 'system', label: id.toUpperCase(), x: i * 10, y: i * 10, width: 240, height: 160, collapsed: false }))
    data.defaultLayoutConstraints = [{ id: 'p', type: 'pin', nodeIds: ['a', 'b'] }]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', {})
    expect(outcome.text).toContain('Unpinned 2 elements.')
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(after.defaultLayoutConstraints ?? []).toEqual([])
  }, 60_000)

  it('exits when the client closes its end', async () => {
    const folder = await fixture()
    const server = spawn(process.execPath, [join(import.meta.dirname, '../dist/index.js'), '--folder', folder], { stdio: ['pipe', 'ignore', 'ignore'] })
    const exited = new Promise<number | null>((done) => server.once('exit', done))
    server.stdin.end()
    expect(await exited).toBe(0)
  }, 15_000)
})
