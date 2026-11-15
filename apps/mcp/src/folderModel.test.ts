import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { basename, join, dirname, relative } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { writeEditorStateFile, writeSelectionFile } from '@radical/node-files/selectionFile'
import { FEDERATION_FILE, serializeFederationFile } from '@radical/common/federation'
import { serializeSelection } from '@radical/common/formats/canvasSelection'
import { parseModelBase } from '@radical/common/formats/modelBase'
import { AGENT_ACTIVE_MS, AGENT_ACTIVITY_FILE, parseAgentActivity } from '@radical/common/formats/agentActivity'
import { FolderModel } from './folderModel'
import { drawnSize, placeUnplaced } from '@radical/layout/geometry'
import { CANVAS_MAX_ELEMENTS, COLLAPSED_HEIGHT, COLLAPSED_WIDTH, type C4Node } from '@radical/common/c4'
import { documentMetamodel } from '@radical/common/model'
import { serializeTestResults } from '@radical/common/check'
import { TIDY_BUDGET, costRows, formatPart, runTidyLayout } from '@radical/layout/tidy'
import { computeViewNodeSet, viewLayoutInput } from '@radical/layout/viewInput'

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
      // By default an agent models as it works; Forge only when the user asks (Agent told to model as it works).
      expect(client.getInstructions()).toContain('Keep the model current as you work')
      expect(client.getInstructions()).toContain('and the model before the code')
      expect(client.getInstructions()).toContain('Run Radical Forge only when the user asks for it')
      expect(client.getInstructions()).toContain('forge_skip_stage')
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
        { tempId: 'erp', type: 'system', label: 'ERP' },
        { tempId: 'shop', type: 'domain', label: 'Shop' },
        { tempId: 'orders', type: 'system', label: 'Orders', parentId: 'shop' },
        { tempId: 'billing', type: 'system', label: 'Billing', parentId: 'shop' },
        { tempId: 'crm', type: 'system', label: 'CRM' },
        { tempId: 'bank', type: 'system', label: 'Bank' },
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

      // ERP lies left of Shop: moved in, it keeps no place outside Shop's
      // frame (x < 0) but is placed inside it, beside the others, and Shop
      // grows for it.
      const erpMoved = await client.callTool({ name: 'move_node', arguments: { id: 'erp', parentId: 'shop' } })
      expect(erpMoved.isError, JSON.stringify(erpMoved.content)).not.toBe(true)
      data = await read()
      const [erp, shopNow] = [byLabel('ERP'), byLabel('Shop')]
      expect(erp.parentId).toBe(shop.id)
      expect(erp.x).toBeGreaterThanOrEqual(0)
      expect(erp.y).toBeGreaterThanOrEqual(0)
      expect(erp.x + erp.width).toBeLessThanOrEqual(shopNow.width)
      expect(erp.y + erp.height).toBeLessThanOrEqual(shopNow.height)
      expect(data.defaultPositions?.[erp.id]).toEqual({ x: erp.x, y: erp.y, width: erp.width, height: erp.height })
      // Nothing lies on anything else at any level, as drawn (a system
      // holding nothing is drawn small): where Shop grew, the root elements
      // beside it made room.
      const overlapping = (): string[] => {
        const out: string[] = []
        const parents = new Set(data.nodes.map((n) => n.parentId))
        const drawn = (n: C4Node) => ({ x: n.x, y: n.y, ...drawnSize(n, parents.has(n.id)) })
        for (const a of data.nodes.map((n) => ({ ...n, ...drawn(n) }))) {
          for (const b of data.nodes.map((n) => ({ ...n, ...drawn(n) }))) {
            if (a.id < b.id && a.parentId === b.parentId && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) out.push(`${a.label} ~ ${b.label}`)
          }
        }
        return out
      }
      expect(overlapping()).toEqual([])

      // Billing moved out of Shop: not left on Shop, beside the root elements.
      const out = await client.callTool({ name: 'move_node', arguments: { id: billing.id, parentId: null } })
      expect(out.isError, JSON.stringify(out.content)).not.toBe(true)
      data = await read()
      expect(byLabel('Billing').parentId).toBeUndefined()
      expect(overlapping()).toEqual([])
      for (const node of data.nodes) {
        expect(data.defaultPositions?.[node.id]).toEqual({ x: node.x, y: node.y, width: node.width, height: node.height })
      }

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

  it('merges an edit made in the folder since the call started', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    const shop = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data.nodes.find((n) => n.label === 'Shop')!
    // Studio saves a new system while the call runs: after it read the folder, before it writes.
    const write = MdFolderSession.prototype.write
    let bankPath = ''
    const spy = vi.spyOn(MdFolderSession.prototype, 'write').mockImplementationOnce(async function (this: MdFolderSession, files, merge) {
      const studio = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      studio.nodes.push({ id: 'bank', type: 'system', label: 'Bank', x: 400, y: 0, width: 200, height: 100, collapsed: false } as never)
      const saved = serializeToMdFolder(studio)
      bankPath = Object.keys(saved).find((path) => saved[path].includes('label: "Bank"'))!
      await mkdir(dirname(join(folder, bankPath)), { recursive: true })
      await writeFile(join(folder, bankPath), saved[bankPath])
      return write.call(this, files, merge)
    })
    const result = await model.call('update_node', { id: shop.id, description: 'Sells books' })
    spy.mockRestore()
    expect(result.ok).toBe(true)
    expect(result.text).toContain(`Merged with edits made in the folder while the call ran (${bankPath})`)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(after.nodes.map((n) => [n.label, n.description ?? '']).sort()).toEqual([['Bank', ''], ['Shop', 'Sells books']])
  })

  it('adds an element named as one already there without moving the other\'s file', async () => {
    // A second import of a concern pack moved the first import's files to
    // -2: slugs went by id order, and the new ids sorted first.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [{ id: 'zzzz', type: 'person', label: 'Session owner', x: 0, y: 0, width: 200, height: 100, collapsed: false }] as never
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const first = await readFile(join(folder, 'nodes/session-owner.md'), 'utf8')
    const model = await FolderModel.open(folder)
    const added = await model.call('add_node', { tempId: 't1', type: 'person', label: 'Session owner' })
    expect(added.ok).toBe(true)
    expect(added.text).toMatch(/Changed: .*nodes\/session-owner-2\.md/)
    expect(added.text).not.toContain('nodes/session-owner.md')
    expect(await readFile(join(folder, 'nodes/session-owner.md'), 'utf8')).toBe(first)
    expect(await readFile(join(folder, 'nodes/session-owner-2.md'), 'utf8')).toContain('Session owner')
  })

  it('marks the folder as written by an agent after each write', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    model.clientName = () => 'claude-code'
    await expect(readFile(join(folder, AGENT_ACTIVITY_FILE), 'utf8')).rejects.toThrow()
    await model.call('get_model_summary', {})
    await expect(readFile(join(folder, AGENT_ACTIVITY_FILE), 'utf8')).rejects.toThrow() // reading is no write

    const start = Date.now()
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    const activity = parseAgentActivity(await readFile(join(folder, AGENT_ACTIVITY_FILE), 'utf8'))
    expect(activity?.client).toBe('claude-code')
    expect(activity!.until).toBeGreaterThanOrEqual(start + AGENT_ACTIVE_MS)
    expect(activity!.until).toBeLessThanOrEqual(Date.now() + AGENT_ACTIVE_MS)
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

describe('continuous layout', () => {
  it('create_view and update_view set it on a view, saved in the folder and told in the summary', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const saved = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data.views ?? []
    expect((await model.call('create_view', { tempId: 'v', name: 'Growing', continuousLayout: true })).ok).toBe(true)
    expect((await model.call('create_view', { tempId: 'w', name: 'Drawn by hand' })).ok).toBe(true)
    expect((await saved()).map((v) => [v.name, v.continuousLayout])).toEqual([['Growing', true], ['Drawn by hand', undefined]])
    const summary = JSON.parse((await model.call('get_model_summary', {})).text.split('\n')[0])
    expect(summary.views.find((v: { name: string }) => v.name === 'Growing').continuousLayout).toBe(true)
    const id = (await saved()).find((v) => v.name === 'Growing')!.id
    expect((await model.call('update_view', { id, continuousLayout: false })).ok).toBe(true)
    expect((await saved()).find((v) => v.id === id)!.continuousLayout).toBeUndefined()
    expect((await model.call('update_view', { id, continuousLayout: 'yes' })).text).toContain('continuousLayout must be true or false')
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
    expect(await readFile(join(folder, '.state/.gitignore'), 'utf8')).toBe('*\n')
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

describe('a hand-edited folder', () => {
  it('reads an element whose file has an empty label, as Studio and radical check do', async () => {
    // Every call that named no file was refused ("Malformed node … label"),
    // while radical check found nothing wrong.
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await model.call('add_node', { tempId: 'bob', type: 'person', label: 'Bob' })
    const path = join(folder, 'nodes/bob.md')
    await writeFile(path, (await readFile(path, 'utf8')).replace(/^label: .*$/m, 'label: '))
    const summary = await model.call('get_model_summary', {})
    expect(summary.ok, summary.text).toBe(true)
    const added = await model.call('add_node', { tempId: 'carol', type: 'person', label: 'Carol' })
    expect(added.ok, added.text).toBe(true)
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(data.nodes.map((n) => n.label).sort()).toEqual(['', 'Carol'])
  })
})

describe('get_selection with an odd selection file', () => {
  it('names a view that is gone, not All elements', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await writeSelectionFile(folder, serializeSelection({ viewId: 'view-gone', nodeIds: [], relationIds: [] }))
    const text = (await model.call('get_selection', {})).text
    expect(text).not.toContain('All elements')
    expect(JSON.parse(text.replace(/^[^{]*/, '')).view).toEqual({ id: 'view-gone', name: null, deleted: true })
  })

  it('says a broken file or one of a newer Studio is that, not a folder Studio never opened', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await writeSelectionFile(folder, '{"version": 1, "updatedAt": ')
    expect((await model.call('get_selection', {})).text).toMatch(/^No selection: .state\/selection.json cannot be read/)
    await writeSelectionFile(folder, JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), viewId: null, nodeIds: ['a'], relationIds: [] }))
    expect((await model.call('get_selection', {})).text).toMatch(/^No selection: .state\/selection.json was written by a newer Studio \(version 2\)/)
  })
})

describe('milestones', () => {
  it('saves a milestone into the folder, lists it in the summary and compares without writing', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    expect(model.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['list_milestones', 'create_milestone', 'compare_milestones']))
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    const saved = await model.call('create_milestone', { name: 'As-is' })
    expect(saved.text).toMatch(/^Saved milestone "As-is"/)
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(data.snapshots).toEqual([expect.objectContaining({ name: 'As-is', nodes: { [data.nodes[0].id]: expect.objectContaining({ label: 'Shop' }) } })])
    expect(JSON.parse((await model.call('get_model_summary', {})).text.split('\n\n')[0]).milestones).toEqual([{ id: data.snapshots![0].id, name: 'As-is' }])

    await model.call('add_node', { tempId: 'pay', type: 'system', label: 'Payments' })
    const before = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    const compared = await model.call('compare_milestones', { from: data.snapshots![0].id })
    expect(compared.text).toContain('Elements added:\n- Payments (system, ')
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(before)
  })
})

describe('get_changes', () => {
  const exec = promisify(execFile)
  const git = (cwd: string, ...args: string[]) =>
    exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })

  it('lists the model changes since git without the layout, and writes nothing', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    expect((await model.call('get_changes', {})).text).toContain('is not in a git repository')
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await git(folder, 'init', '-q', '-b', 'main')
    await git(folder, 'add', '.')
    await git(folder, 'commit', '-q', '-m', 'model')

    await model.call('add_node', { tempId: 'pay', type: 'system', label: 'Payments' })
    await model.call('update_node', { id: 'shop', description: 'Sells books.' })
    await model.call('smart_layout', {})
    const before = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    const changes = await model.call('get_changes', {})
    expect(changes.ok).toBe(true)
    expect(changes.text).toMatch(/^Model changes since merge base with main \([0-9a-f]{7}\)/)
    expect(changes.text).toContain('Elements: 1 added, 1 changed, 0 removed.')
    expect(changes.text).toContain('Elements added (1):\n- system "Payments"')
    expect(changes.text).toMatch(/Elements changed \(1\):\n- system "Shop" \([^)]+\)\n {4}description: \(none\) → Sells books\.$/)
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(before)
    // Without since it saves the base Studio shows: the model as committed.
    const base = parseModelBase(await readFile(join(folder, '.state/base.json'), 'utf8'))
    expect(base).toMatchObject({ described: 'merge base with main', branch: 'main' })
    expect(base!.nodes.map((n) => n.label)).toEqual(['Shop'])
    expect(await readFile(join(folder, '.state/.gitignore'), 'utf8')).toBe('*\n')
    expect((await model.call('get_changes', { since: 'nope' })).text).toContain('Unknown git ref "nope"')
    expect(model.tools.find((tool) => tool.name === 'get_changes')?.inputSchema).toMatchObject({ properties: { since: { type: 'string' } } })
  })
})

describe('move_node into a folded container', () => {
  it('places what lies outside it inside, beside what it holds (item 238)', async () => {
    // S1 lies left of S2, which the model folds: its place, rebased onto
    // S2, is outside S2's frame. Not drawn while S2 is folded, it kept it,
    // and S2's expand drew it there, outside its parent.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 's1', type: 'system', label: 'S1', x: 0, y: 400, width: 300, height: 180, collapsed: false },
      { id: 's2', type: 'system', label: 'S2', x: 400, y: 0, width: 600, height: 330, collapsed: true },
      { id: 'q0', type: 'container', label: 'Q0', parentId: 's2', x: 30, y: 120, width: 240, height: 150, collapsed: false },
      { id: 'q1', type: 'container', label: 'Q1', parentId: 's2', x: 330, y: 120, width: 240, height: 150, collapsed: false },
    ] as never
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    expect((await model.call('move_node', { id: 's1', parentId: 's2' })).ok).toBe(true)
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const [s1, s2, q0, q1] = ['s1', 's2', 'q0', 'q1'].map((id) => saved.nodes.find((n) => n.id === id)!)
    expect(s1.parentId).toBe('s2')
    expect(s1.x).toBeGreaterThanOrEqual(0)
    expect(s1.y).toBeGreaterThanOrEqual(0)
    const overlap = (a: C4Node, b: C4Node) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    expect(overlap(s1, q0) || overlap(s1, q1)).toBe(false)
    // Folded, S2 keeps its place and its size; its expand fits it.
    expect(s2).toMatchObject({ x: 400, y: 0, collapsed: true })
  })

  it('holds a row the moved element stays in, as Studio draws it (item 239)', async () => {
    // A row [S1, S3] on All elements: S1 moved into S2 stays in it (S3 is
    // none of its ancestors). Not held in the file, Studio held it on
    // opening the model and moved six elements, the file unchanged.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 's1', type: 'system', label: 'S1', x: 0, y: 400, width: 300, height: 180, collapsed: false },
      { id: 's2', type: 'system', label: 'S2', x: 400, y: 0, width: 600, height: 330, collapsed: false },
      { id: 'q0', type: 'container', label: 'Q0', parentId: 's2', x: 30, y: 120, width: 240, height: 150, collapsed: false },
      { id: 'q1', type: 'container', label: 'Q1', parentId: 's2', x: 330, y: 120, width: 240, height: 150, collapsed: false },
      { id: 's3', type: 'system', label: 'S3', x: 1100, y: 400, width: 300, height: 180, collapsed: false },
    ] as never
    data.defaultLayoutConstraints = [{ id: 'row', type: 'align', axis: 'horizontal', nodeIds: ['s1', 's3'] }]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    expect((await model.call('move_node', { id: 's1', parentId: 's2' })).ok).toBe(true)
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const at = Object.fromEntries(saved.nodes.map((n) => [n.id, n]))
    expect(at.s1.parentId).toBe('s2')
    expect(saved.defaultLayoutConstraints).toEqual([expect.objectContaining({ nodeIds: ['s1', 's3'] })])
    expect(at.s2.y + at.s1.y + at.s1.height / 2).toBeCloseTo(at.s3.y + at.s3.height / 2, 0)
  })
})

describe('warnier', () => {
  it('an agent writes a process with its steps and a Warnier view of it', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const calls: Array<[string, Record<string, unknown>]> = [
      ['add_node', { tempId: 'checkout', type: 'process', label: 'Checkout' }],
      ['add_node', { tempId: 'take', type: 'step', label: 'Take the order', parentId: 'checkout', properties: { order: 1 } }],
      ['add_node', { tempId: 'reserve', type: 'step', label: 'Reserve stock', parentId: 'checkout', properties: { order: 2, repeat: '1..n', condition: 'for each order line' } }],
      ['add_node', { tempId: 'pay', type: 'step', label: 'Pay', parentId: 'checkout', properties: { order: 3, children: 'choice' } }],
      ['add_node', { tempId: 'card', type: 'step', label: 'By card', parentId: 'pay' }],
      ['add_node', { tempId: 'invoice', type: 'step', label: 'By invoice', parentId: 'pay' }],
      ['add_node', { tempId: 'payments', type: 'system', label: 'Payments' }],
      ['add_relation', { sourceId: 'card', targetId: 'payments', relationType: 'performed-by' }],
      ['create_view', { tempId: 'v', name: 'Checkout', viewpoint: 'Process (Warnier)' }],
    ]
    for (const [name, args] of calls) {
      const result = await model.call(name, args)
      expect(result.ok, `${name}: ${result.text}`).toBe(true)
    }
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(saved.nodes.find((n) => n.label === 'Reserve stock')).toMatchObject({ type: 'step', order: 2, repeat: '1..n', condition: 'for each order line' })
    expect(saved.nodes.find((n) => n.label === 'Pay')).toMatchObject({ children: 'choice' })
    expect(saved.nodes.find((n) => n.label === 'By card')).toMatchObject({ repeat: '1', children: 'sequence' })
    expect(saved.views?.find((v) => v.name === 'Checkout')).toMatchObject({ kind: 'warnier', viewpoint: 'process-warnier' })
    expect((await model.call('get_issues', {})).text).toMatch(/^No issues: the model follows its metamodel\./)
    const summary = (await model.call('get_model_summary', {})).text
    expect(summary).toContain('Process (Warnier)')
    expect(model.tools.find((tool) => tool.name === 'update_view')?.inputSchema).toMatchObject({ properties: { kind: { enum: expect.arrayContaining(['warnier']) } } })
  })
})

describe('federation', () => {
  /** Payments' model folder, with Orders (its API, its DB and a relation
   *  between them) fetched from the model orders into .state/federation.json. */
  async function fetched(): Promise<string> {
    const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-federation-'))
    folders.push(folder)
    const origin = 'orders@abc1234'
    const at = (id: string, type: string, label: string, extra: Record<string, unknown> = {}) =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as never
    const files = serializeToMdFolder({
      metamodel: builtInGovernanceMetamodel(),
      nodes: [at('pay', 'system', 'Payments')],
      relations: [],
    }, 'payments')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    await writeFile(join(folder, 'deps.json'), JSON.stringify({ name: 'payments', dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main' }] }))
    await writeEditorStateFile(folder, FEDERATION_FILE, serializeFederationFile({
      version: 2, name: 'payments', fetchedAt: '2026-11-01T10:00:00Z', notes: [],
      dependencies: [{ name: 'orders', repo: '../orders', path: 'architecture', ref: 'main', commit: 'abc1234def5678' }],
      nodes: [
        at('ord', 'system', 'Orders', { origin }),
        at('api', 'container', 'Orders API', { parentId: 'ord', origin }),
        at('db', 'container', 'Orders DB', { parentId: 'ord', origin }),
      ],
      relations: [{ id: 'r-ext', sourceId: 'api', targetId: 'db', origin }],
      views: [{ id: 'v-ord', name: 'Containers', nodeIds: ['api', 'db'], positions: {}, origin }],
    }))
    return folder
  }

  it('refuses edits to another model\'s elements and relations, naming the model, and allows relations to them', async () => {
    const folder = await fetched()
    const model = await FolderModel.open(folder)
    const before = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    const refusals = [
      await model.call('update_node', { id: 'ord', description: 'Takes orders.' }),
      await model.call('update_node', { id: 'ord', label: 'Orders 2' }),
      await model.call('move_node', { id: 'api', parentId: null }),
      await model.call('delete_node', { id: 'db' }),
      await model.call('add_node', { tempId: 'billing', type: 'container', label: 'Billing', parentId: 'ord' }),
      await model.call('update_relation', { id: 'r-ext', label: 'reads' }),
      await model.call('delete_relation', { id: 'r-ext' }),
    ]
    for (const result of refusals) {
      expect(result.ok, result.text).toBe(false)
      expect(result.text).toMatch(/the model orders \(orders@abc1234\)/)
    }
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(before)
  })

  it('reads the other models from .state/federation.json and writes only its own', async () => {
    const folder = await fetched()
    const git = (...args: string[]) => promisify(execFile)('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: folder })
    await git('init', '-q', '-b', 'main')
    await git('add', '.')
    await git('commit', '-q', '-m', 'payments')
    const model = await FolderModel.open(folder)
    expect((await model.call('search_model', { query: 'GET NODE ord' })).text).toContain('"origin":"orders@abc1234"')

    const relation = await model.call('add_relation', { sourceId: 'pay', targetId: 'ord', label: 'reads orders' })
    expect(relation.ok, relation.text).toBe(true)
    expect((await model.call('update_node', { id: 'pay', label: 'Payments 2' })).ok).toBe(true)
    expect((await model.call('smart_layout', {})).ok).toBe(true)
    const files = await new MdFolderSession(diskFolderStorage(folder)).readAll()
    // The folder holds the model's own: no file of Orders, its relation not in relations.json.
    expect(Object.keys(files).filter((path) => path.startsWith('nodes/'))).toEqual(['nodes/payments-2/_index.md'])
    const saved = deserializeFromMdFolder(files).data
    expect(saved.relations).toEqual([expect.objectContaining({ sourceId: 'pay', targetId: 'ord', label: 'reads orders' })])
    expect(saved.relations[0].origin).toBeUndefined()
    // The model's changes are its own: Orders is no element added.
    const changes = (await model.call('get_changes', { since: 'HEAD' })).text
    expect(changes).toContain('Elements: 0 added, 1 changed, 0 removed. Relations: 1 added')
    expect(changes).not.toContain('Orders API')
    expect((await model.call('get_issues', {})).text).toMatch(/^No issues/)
  })

  it("lists another model's view and refuses changes to it", async () => {
    const folder = await fetched()
    const model = await FolderModel.open(folder)
    const summary = (await model.call('get_model_summary', {})).text
    expect(summary).toContain('{"id":"v-ord","name":"Containers","kind":"static","folder":"orders"}')
    const refusals = [
      await model.call('update_view', { id: 'v-ord', name: 'Mine' }),
      await model.call('set_view_nodes', { viewId: 'v-ord', nodeIds: ['pay'] }),
      await model.call('smart_layout', { viewId: 'v-ord' }),
      await model.call('delete_view', { id: 'v-ord' }),
    ]
    for (const result of refusals) {
      expect(result.ok, result.text).toBe(false)
      expect(result.text).toContain('The view "Containers" belongs to the model orders (orders@abc1234)')
    }
    // Writing the model's own leaves it out of views.json.
    expect((await model.call('create_view', { tempId: 'v', name: 'Containers' })).ok).toBe(true)
    const views = JSON.parse(await readFile(join(folder, 'views.json'), 'utf8')) as Array<{ id: string; name: string }>
    expect(views.map((v) => v.name)).toEqual(['Containers'])
    expect(views.some((v) => v.id === 'v-ord')).toBe(false)
  })

  it("refuses a view of the model's own in another model's folder", async () => {
    const folder = await fetched()
    const model = await FolderModel.open(folder)
    const made = await model.call('create_view', { tempId: 'v', name: 'Mine', folder: 'orders/Logical' })
    expect(made.ok).toBe(false)
    expect(made.text).toContain('The folder "orders/Logical" holds the views of the model orders (orders@abc1234), read-only')
    expect((await model.call('create_view', { tempId: 'v', name: 'Mine', folder: 'Payments' })).ok).toBe(true)
    const mine = JSON.parse(await readFile(join(folder, 'views.json'), 'utf8')).find((v: { name: string }) => v.name === 'Mine').id as string
    const moved = await model.call('update_view', { id: mine, folder: 'orders' })
    expect(moved.ok).toBe(false)
    expect(moved.text).toContain('holds the views of the model orders')
    expect((await model.call('update_view', { id: mine, folder: 'Payments/C4' })).ok).toBe(true)
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

  it('starts over when the folder is emptied or deleted while the server runs', async () => {
    const dir = await tempDir()
    const model = await FolderModel.open(dir, { metamodel: 'c4' })
    expect((await model.call('add_node', { tempId: 'a', type: 'system', label: 'A' })).ok).toBe(true)
    for (const name of await readdir(dir)) await rm(join(dir, name), { recursive: true })
    await mkdir(join(dir, '.state'))
    expect(await summaryOf(model)).toMatchObject({ metamodel: { id: 'c4-builtin' }, nodes: 0 })
    await rm(dir, { recursive: true })
    expect((await model.call('add_node', { tempId: 'b', type: 'system', label: 'B' })).ok).toBe(true)
    expect(await readFile(join(dir, 'radical.md'), 'utf8')).toMatch(/radicalFormat: "md-folder"/)
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
    expect(steps.map((s) => s.message)).toContain('Smart Layout: tidying')
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

  it('tidies around the given elements only', async () => {
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 'a', type: 'system', label: 'A', x: 0, y: 0, width: 240, height: 160, collapsed: false },
      { id: 'b', type: 'system', label: 'B', x: 0, y: 400, width: 240, height: 160, collapsed: false },
      { id: 'c', type: 'system', label: 'C', x: 2000, y: 0, width: 240, height: 160, collapsed: false },
      { id: 'd', type: 'system', label: 'D', x: 2010, y: 10, width: 240, height: 160, collapsed: false },
    ]
    data.relations = [{ id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'interacts' }, { id: 'cd', sourceId: 'c', targetId: 'd', relationType: 'interacts' }]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { around: ['c'] })
    expect(outcome.ok, outcome.text).toBe(true)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const at = (id: string) => { const n = after.nodes.find((x) => x.id === id)!; return [n.x, n.y] }
    expect(at('a')).toEqual([0, 0])
    expect(at('b')).toEqual([0, 400])
    const c = after.nodes.find((x) => x.id === 'c')!, d = after.nodes.find((x) => x.id === 'd')!
    expect(c.x >= d.x + d.width || d.x >= c.x + c.width || c.y >= d.y + d.height || d.y >= c.y + c.height).toBe(true)
    expect((await model.call('smart_layout', { around: ['nope'] })).ok).toBe(false)
  }, 60_000)

  it('round a selection, leaves a pinned frame and a frame it does not reach at their place and size (F-0138)', async () => {
    // Frames holding their children 58 px below their top, as the sample's do; Access pinned.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const box = (id: string, type: string, parentId: string | undefined, x: number, y: number, width = 240, height = 160): C4Node =>
      ({ id, type, label: id, ...(parentId ? { parentId } : {}), x, y, width, height, collapsed: false }) as C4Node
    data.nodes = [
      box('core', 'group', undefined, 0, 0, 1700, 1400),
      box('pay', 'system', 'core', 30, 58, 900, 568), box('val', 'container', 'pay', 57, 58), box('ledger', 'container', 'pay', 67, 68), box('notify', 'container', 'pay', 57, 338),
      box('acc', 'system', 'core', 1100, 58, 520, 568), box('auth', 'container', 'acc', 57, 58), box('gw', 'container', 'acc', 57, 338),
      box('risk', 'system', 'core', 30, 800, 658, 498), box('db', 'container', 'risk', 57, 58), box('dw', 'container', 'risk', 357, 58),
    ]
    data.relations = [
      { id: 'r1', sourceId: 'val', targetId: 'ledger', relationType: 'interacts' }, { id: 'r2', sourceId: 'gw', targetId: 'auth', relationType: 'interacts' },
      { id: 'r3', sourceId: 'db', targetId: 'dw', relationType: 'interacts' },
    ]
    data.defaultLayoutConstraints = [{ id: 'p', type: 'pin', nodeIds: ['acc'] }]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { around: ['val'] })
    expect(outcome.ok, outcome.text).toBe(true)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    // On the canvas: the group round them is refitted round what moved, and their places in it change with it.
    const geometry = (nodes: C4Node[], id: string) => {
      const n = nodes.find((x) => x.id === id)!
      let x = n.x, y = n.y
      for (let p = n.parentId; p; p = nodes.find((q) => q.id === p)!.parentId) { const q = nodes.find((r) => r.id === p)!; x += q.x; y += q.y }
      return [x, y, n.width, n.height]
    }
    for (const id of ['acc', 'auth', 'gw', 'risk', 'db', 'dw']) expect(geometry(after.nodes, id), id).toEqual(geometry(data.nodes, id))
  }, 60_000)

  it('a row, column or grid an agent set and a Tidy round something else leave no siblings on each other (F-0175)', async () => {
    const box = (id: string, type: string, parentId: string | undefined, x: number, y: number, width = 240, height = 160): C4Node =>
      ({ id, type, label: id, ...(parentId ? { parentId } : {}), x, y, width, height, collapsed: false }) as C4Node
    const keeps: Array<[string, Record<string, unknown>]> = [
      ['align_nodes', { axis: 'horizontal', nodeIds: ['fx', 'val'] }],
      ['align_nodes', { axis: 'vertical', nodeIds: ['fx', 'val'] }],
      ['grid_nodes', { nodeIds: ['fx', 'val'], columns: 2 }],
    ]
    for (const [tool, args] of keeps) {
      const folder = await fixture()
      const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      // fx and val one above the other in pay (side by side for a column); fraud and ledger far off, related to each other only.
      const column = args.axis === 'vertical'
      data.nodes = [
        box('pay', 'container', undefined, 0, 0, 300, 396), box('fx', 'component', 'pay', 20, 120, 200, 120), box('val', 'component', 'pay', column ? 240 : 20, column ? 120 : 256, 200, 120),
        box('fraud', 'container', undefined, 1200, 0), box('ledger', 'container', undefined, 1200, 600),
      ]
      data.relations = [{ id: 'r1', sourceId: 'fraud', targetId: 'ledger', relationType: 'interacts' }]
      for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
        await mkdir(dirname(join(folder, path)), { recursive: true })
        await writeFile(join(folder, path), content)
      }
      const model = await FolderModel.open(folder)
      expect((await model.call(tool, args)).ok, tool).toBe(true)
      const outcome = await model.call('smart_layout', { around: ['fraud'] })
      expect(outcome.ok, outcome.text).toBe(true)
      const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      const fx = after.nodes.find((n) => n.id === 'fx')!, val = after.nodes.find((n) => n.id === 'val')!
      expect(fx.x >= val.x + val.width || val.x >= fx.x + fx.width || fx.y >= val.y + val.height || val.y >= fx.y + fx.height, `${tool} ${JSON.stringify(args)}: fx clear of val`).toBe(true)
    }
  }, 60_000)

  it('unpins the view it lays out whole; round a selection the pinned elements stay, pinned', async () => {
    // Two elements pinned in Studio, a third on top of them.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 'a', type: 'system', label: 'A', x: 0, y: 0, width: 240, height: 160, collapsed: false },
      { id: 'b', type: 'system', label: 'B', x: 400, y: 0, width: 240, height: 160, collapsed: false },
      { id: 'c', type: 'system', label: 'C', x: 20, y: 20, width: 240, height: 160, collapsed: false },
    ]
    data.relations = [{ id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'interacts' }, { id: 'bc', sourceId: 'b', targetId: 'c', relationType: 'interacts' }]
    data.defaultLayoutConstraints = [{ id: 'p', type: 'pin', nodeIds: ['a', 'b'] }]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    // Round C: A and B stay where they are, pinned.
    const around = await model.call('smart_layout', { around: ['c'] })
    expect(around.ok, around.text).toBe(true)
    expect(around.text).not.toContain('Unpinned')
    let after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(after.defaultLayoutConstraints).toEqual([{ id: 'p', type: 'pin', nodeIds: ['a', 'b'] }])
    const at = (id: string) => { const n = after.nodes.find((x) => x.id === id)!; return [n.x, n.y] }
    expect(at('a')).toEqual([0, 0])
    expect(at('b')).toEqual([400, 0])
    expect(at('c')).not.toEqual([20, 20])
    // The whole model: laid out and unpinned.
    const whole = await model.call('smart_layout', {})
    expect(whole.ok, whole.text).toBe(true)
    expect(whole.text).toContain('Unpinned 2 elements')
    after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(after.defaultLayoutConstraints ?? []).toEqual([])
  }, 60_000)

  it('gives a large view the layout Studio gives it, within Studio\'s budget (F-0080)', async () => {
    // 200 systems on a grid, linked across it: Tidy needs more than one
    // run's budget. It ran with no budget (minutes on the sample's whole
    // model) and handed over another layout than Studio's.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const count = 200
    data.nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, type: 'system', label: `N${i}`, x: (i % 10) * 400, y: Math.floor(i / 10) * 300, width: 240, height: 160, collapsed: false }))
    data.relations = Array.from({ length: count - 1 }, (_, k) => ({ id: `r${k + 1}`, sourceId: `n${((k + 1) * 7) % count}`, targetId: `n${k + 1}`, relationType: 'interacts' }))
    data.views = [{ id: 'v', name: 'Whole', nodeIds: [], positions: Object.fromEntries(data.nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }])) } as never]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    // What Studio's Smart Layout hands over on the same canvas.
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const view = saved.views!.find((v) => v.id === 'v')!
    const nodes = Object.fromEntries(saved.nodes.map((n) => [n.id, { ...n, ...view.positions[n.id] }]))
    const input = viewLayoutInput(view, nodes, Object.fromEntries(saved.relations.map((r) => [r.id, r])), view.layoutConstraints)
    const studio = runTidyLayout(input.nodes, input.relations, {
      alignments: input.alignments, edgeStyle: 'curved', metamodel: documentMetamodel(saved.metamodel, saved.nodes), pinned: [], budget: TIDY_BUDGET, frames: [...input.frames],
    })
    expect(studio.tidy.budgetOut).toBe(true)

    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { viewId: 'v' })
    expect(outcome.ok, outcome.text).toBe(true)
    expect(outcome.text).toContain('run it again for more')
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const positions = after.views!.find((v) => v.id === 'v')!.positions
    const apart = Object.keys(positions).filter((id) => Math.hypot(positions[id].x - studio.winner.positions[id].x, positions[id].y - studio.winner.positions[id].y) > 1)
    expect(apart).toEqual([])
  }, 180_000)

  it('lays a view never laid out out from the canvas Studio opens it on (F-0140)', async () => {
    // B lies far outside its system in All elements' places (added on
    // another canvas): Studio opens the view with B placed in the system,
    // beside its siblings, and lays it out from there.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 'sys', type: 'system', label: 'Sys', x: 0, y: 0, width: 900, height: 420, collapsed: false },
      { id: 'a', type: 'container', label: 'A', parentId: 'sys', x: 40, y: 120, width: 240, height: 160, collapsed: false },
      { id: 'c', type: 'container', label: 'C', parentId: 'sys', x: 600, y: 120, width: 240, height: 160, collapsed: false },
      { id: 'b', type: 'container', label: 'B', parentId: 'sys', x: 4000, y: 2600, width: 240, height: 160, collapsed: false },
      { id: 'x', type: 'system', label: 'X', x: 0, y: 700, width: 240, height: 160, collapsed: false },
    ]
    data.relations = [
      { id: 'ab', sourceId: 'a', targetId: 'b', relationType: 'interacts' }, { id: 'bc', sourceId: 'b', targetId: 'c', relationType: 'interacts' },
      { id: 'xa', sourceId: 'x', targetId: 'a', relationType: 'interacts' },
    ]
    data.views = [{ id: 'v', name: 'Sys', kind: 'static', nodeIds: ['sys', 'a', 'b', 'c', 'x'], expandedNodeIds: ['sys'], positions: {} } as never]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    // The canvas Studio opens the view on (showCanvasPositions), and its Smart Layout from there.
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const view = saved.views!.find((v) => v.id === 'v')!
    const relations = Object.fromEntries(saved.relations.map((r) => [r.id, r]))
    const nodes = Object.fromEntries(saved.nodes.map((n) => [n.id, { ...n }]))
    const all = Object.fromEntries(saved.nodes.map((n) => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]))
    expect(placeUnplaced(nodes, all, computeViewNodeSet(view, nodes, relations))).toContain('b')
    const input = viewLayoutInput(view, nodes, relations, view.layoutConstraints)
    const studio = runTidyLayout(input.nodes, input.relations, {
      alignments: input.alignments, edgeStyle: 'curved', metamodel: documentMetamodel(saved.metamodel, saved.nodes), pinned: [], budget: TIDY_BUDGET, frames: [...input.frames],
    })

    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { viewId: 'v' })
    expect(outcome.ok, outcome.text).toBe(true)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const positions = after.views!.find((v) => v.id === 'v')!.positions
    const apart = Object.keys(studio.winner.positions).filter((id) => Math.hypot(positions[id].x - studio.winner.positions[id].x, positions[id].y - studio.winner.positions[id].y) > 1)
    expect(apart).toEqual([])
  }, 60_000)

  it('tells the agent the numbers Studio shows for the same layout (F-0082)', async () => {
    // Four in a row above four below, the top row in reverse order. It
    // reported other counts of the same layout ('crossings 76 -> 75' where
    // Studio said 'crossings 44 → 21'): Studio reports Tidy's cost parts.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      ...[0, 1, 2, 3].map((i) => ({ id: `t${i}`, type: 'system', label: `T${i}`, x: i * 400, y: 0, width: 240, height: 160, collapsed: false })),
      ...[0, 1, 2, 3].map((i) => ({ id: `b${i}`, type: 'system', label: `B${i}`, x: i * 400, y: 500, width: 240, height: 160, collapsed: false })),
    ] as never
    data.relations = [0, 1, 2, 3].map((i) => ({ id: `r${i}`, sourceId: `t${3 - i}`, targetId: `b${i}`, relationType: 'interacts' }))
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const input = viewLayoutInput(undefined, Object.fromEntries(saved.nodes.map((n) => [n.id, n])), Object.fromEntries(saved.relations.map((r) => [r.id, r])), saved.defaultLayoutConstraints)
    const { tidy } = runTidyLayout(input.nodes, input.relations, { alignments: input.alignments, edgeStyle: 'curved', metamodel: documentMetamodel(saved.metamodel, saved.nodes), pinned: [], frames: [...input.frames] })
    const crossings = costRows(tidy.before, tidy.after).find((p) => p.key === 'crossings')!
    expect(crossings.before).toBeGreaterThan(crossings.after)

    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', {})
    expect(outcome.ok, outcome.text).toBe(true)
    expect(outcome.text).toContain(`${tidy.steps.length} move${tidy.steps.length === 1 ? '' : 's'}`)
    expect(outcome.text).toContain(`crossings ${formatPart(crossings.before)}\u2009→\u2009${formatPart(crossings.after)}`)
  }, 60_000)

  it('opens and folds a container on a view round its middle, making room as Studio does (item 172)', async () => {
    // Bookstore folded in Studio, Payment Provider beside the folded box.
    // update_view expand drew it at the box's corner at full size, over
    // Payment Provider.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const open = { width: 860, height: 310 }
    const fold = { x: (open.width - COLLAPSED_WIDTH.system) / 2, y: (open.height - COLLAPSED_HEIGHT.system) / 2 }
    const pay = { x: fold.x + COLLAPSED_WIDTH.system + 100, y: fold.y, width: 300, height: 180 }
    data.nodes = [
      { id: 'shop', type: 'system', label: 'Bookstore', x: 0, y: 0, ...open, collapsed: false },
      { id: 'web', type: 'container', label: 'Web', parentId: 'shop', x: 30, y: 120, width: 240, height: 160, collapsed: false },
      { id: 'api', type: 'container', label: 'API', parentId: 'shop', x: 330, y: 120, width: 240, height: 160, collapsed: false },
      { id: 'db', type: 'container', label: 'DB', parentId: 'shop', x: 600, y: 120, width: 230, height: 160, collapsed: false },
      { id: 'pay', type: 'system', label: 'Payment Provider', ...pay, collapsed: false },
    ] as never
    const at = (n: { x: number; y: number; width: number; height: number }) => ({ x: n.x, y: n.y, width: n.width, height: n.height })
    data.views = [{
      id: 'v', name: 'Context', nodeIds: [], collapsedNodeIds: ['shop'],
      positions: { shop: { ...fold, ...open }, web: at(data.nodes[1]), api: at(data.nodes[2]), db: at(data.nodes[3]), pay },
    } as never]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const view = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data.views!.find((v) => v.id === 'v')!

    expect((await model.call('update_view', { id: 'v', expand: ['shop'] })).ok).toBe(true)
    const opened = (await view()).positions
    // Round the folded box's middle, clear of Payment Provider.
    expect(opened.shop.x + opened.shop.width / 2).toBeCloseTo(fold.x + COLLAPSED_WIDTH.system / 2, 0)
    expect(opened.shop.y + opened.shop.height / 2).toBeCloseTo(fold.y + COLLAPSED_HEIGHT.system / 2, 0)
    const overlap = (a: typeof pay, b: typeof pay) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    expect(overlap(opened.shop, opened.pay)).toBe(false)

    // Folded again: to the middle of the frame, where Studio folds it.
    expect((await model.call('update_view', { id: 'v', collapse: ['shop'] })).ok).toBe(true)
    const folded = (await view()).positions
    expect(folded.shop.x + COLLAPSED_WIDTH.system / 2).toBeCloseTo(opened.shop.x + opened.shop.width / 2, 0)
    expect(folded.shop.y + COLLAPSED_HEIGHT.system / 2).toBeCloseTo(opened.shop.y + opened.shop.height / 2, 0)
  }, 60_000)

  it('lays out a view set to "Hierarchical nested tree" as a tree, as Studio does', async () => {
    // It always ran Smart Layout: the agent and Studio's Tree Layout put the
    // same view in two different places.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = [
      { id: 'shop', type: 'system', label: 'Shop', x: 0, y: 0, width: 800, height: 400, collapsed: false },
      ...['web', 'api', 'db'].map((id, i) => ({ id, type: 'container', label: id, parentId: 'shop', x: 40 + i * 5, y: 120, width: 240, height: 160, collapsed: false })),
    ] as never
    data.relations = [{ id: 'r1', sourceId: 'web', targetId: 'api' }, { id: 'r2', sourceId: 'api', targetId: 'db' }]
    data.views = [{ id: 'v', name: 'Tree', nodeIds: [], positions: {}, layoutMode: 'tree' } as never]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { viewId: 'v' })
    expect(outcome.text).toMatch(/^Tree Layout \(Tree\)/)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const pos = after.views!.find((v) => v.id === 'v')!.positions
    // A tree: each container below the one it calls.
    expect(pos.api.y).toBeGreaterThan(pos.web.y)
    expect(pos.db.y).toBeGreaterThan(pos.api.y)
  }, 60_000)

  it('lays out no flow (dynamic) view: Studio draws no canvas there', async () => {
    // It reported "crossings 0 -> 0, overdraws 1 -> 0. No files changed."
    // on every call: a flow view keeps no positions.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    data.nodes = ['a', 'b'].map((id, i) => ({ id, type: 'system', label: id.toUpperCase(), x: i * 10, y: 0, width: 240, height: 160, collapsed: false }))
    data.relations = [{ id: 'r1', sourceId: 'a', targetId: 'b' }]
    data.sequences = [{ id: 's', name: 'Flow', relationIds: ['r1'] } as never]
    data.views = [{ id: 'v', name: 'Place Order Flow', nodeIds: ['a', 'b'], positions: {}, kind: 'dynamic', sequenceId: 's' } as never]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const outcome = await model.call('smart_layout', { viewId: 'v' })
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('"Place Order Flow" is a dynamic view; only static views have a canvas layout')
    expect((await model.call('align_nodes', { nodeIds: ['a', 'b'], axis: 'vertical', viewId: 'v' })).ok).toBe(false)
    const after = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    expect(after.views!.find((v) => v.id === 'v')!.layoutConstraints ?? []).toEqual([])
  }, 60_000)

  it('lays out no view with more elements than a canvas draws, as Studio neither draws nor lays it out', async () => {
    // smart_layout took 11 s on 1,001 elements and wrote a place for each,
    // answering "the view keeps its places"; grid_nodes was accepted.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const requirements = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, type: 'requirement', label: `Requirement ${i}`, x: (i % 40) * 260, y: Math.floor(i / 40) * 160, width: 240, height: 140, collapsed: false }))
    data.nodes = requirements(CANVAS_MAX_ELEMENTS + 1) as never
    data.views = [
      { id: 'v', name: 'Every requirement', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } } as never,
      { id: 'w', name: 'Some', nodeIds: requirements(CANVAS_MAX_ELEMENTS).map((n) => n.id), positions: {} } as never,
    ]
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const views = await readFile(join(folder, 'views.json'), 'utf8')
    for (const [tool, args] of [
      ['smart_layout', { viewId: 'v' }],
      ['align_nodes', { viewId: 'v', nodeIds: ['r0', 'r1'], axis: 'horizontal' }],
      ['grid_nodes', { viewId: 'v', nodeIds: ['r0', 'r1', 'r2', 'r3'], columns: 2 }],
    ] as const) {
      const outcome = await model.call(tool, args)
      expect(outcome.ok, outcome.text).toBe(false)
      expect(outcome.text).toContain(`${tool}: "Every requirement" shows 1,001 elements; a canvas draws up to 1,000`)
    }
    expect(await readFile(join(folder, 'views.json'), 'utf8')).toBe(views)
    // A view of 1,000 is a canvas.
    expect((await model.call('grid_nodes', { viewId: 'w', nodeIds: ['r0', 'r1', 'r2', 'r3'], columns: 2 })).ok).toBe(true)
  }, 60_000)

  it('says which new views per element it laid out, and advises for one too large what the server accepts', async () => {
    // create_view said "Smart Layout arranged the 2 new views per element"
    // when it had refused API, and the refusal advised update_view kind
    // table, which update_view refuses for a view per element.
    const folder = await fixture()
    const data = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    const node = (id: string, type: string, parentId?: string, i = 0) => ({ id, type, label: id === 'api' ? 'API' : id === 'small' ? 'Small' : id, ...(parentId ? { parentId } : {}), x: 20 + (i % 40) * 260, y: 60 + Math.floor(i / 40) * 160, width: 240, height: 140, collapsed: false })
    data.nodes = [
      node('shop', 'system'), node('api', 'container', 'shop'), node('small', 'container', 'shop'),
      ...Array.from({ length: CANVAS_MAX_ELEMENTS }, (_, i) => node(`c${i}`, 'component', 'api', i)),
      node('s0', 'component', 'small'), node('s1', 'component', 'small', 1),
    ] as never
    for (const [path, content] of Object.entries(serializeToMdFolder(data))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const made = await model.call('create_view', { tempId: 'g', name: 'Components', viewpoint: 'container-components' })
    expect(made.ok, made.text).toBe(true)
    const stored = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data.views!
    const api = (await stored()).find((v) => v.name === 'API')!
    expect(made.text).toContain('Smart Layout arranged the new view Small.')
    expect(made.text).toContain('Not laid out: "API" shows 1,001 elements')
    expect(made.text).not.toContain('2 new views')
    expect(Object.keys(api.positions ?? {})).toEqual([])
    // Each advice the refusals give is a call the server takes.
    for (const refused of [made.text, (await model.call('smart_layout', { viewId: api.id })).text]) {
      expect(refused).not.toContain('update_view')
      expect(refused).toContain('upsert_viewpoint with id "container-components" and kind "table"')
    }
    // update_view, which a view per element refuses, points there too.
    expect((await model.call('update_view', { id: api.id, kind: 'table' })).text).toContain('change the viewpoint "container-components" with upsert_viewpoint')
    const advised = await model.call('upsert_viewpoint', { id: 'container-components', kind: 'table' })
    expect(advised.ok, advised.text).toBe(true)
    expect((await stored()).find((v) => v.id === api.id)!.kind).toBe('table')
  }, 120_000)

  it('takes a type that another writer added to the metamodel since its last call', async () => {
    // The client checks a call against the tool schema, whose list of types
    // is the metamodel the server saw last: a type added by Studio, another
    // server or a hand edit was refused until some other call refreshed it.
    const folder = await fixture()
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder] }))
    try {
      await client.callTool({ name: 'get_model_summary', arguments: {} })
      const metamodel = builtInGovernanceMetamodel()
      metamodel.id = 'radical-custom'
      metamodel.nodeTypes.service = { ...metamodel.nodeTypes.system, id: 'service', label: 'Service', builtin: false }
      metamodel.relationTypes.calls = { id: 'calls', label: 'Calls', allowedPairs: [{ from: 'service', to: 'service' }], builtin: false } as never
      await writeFile(join(folder, 'metamodel.json'), JSON.stringify(metamodel, null, 2))
      const added = await client.callTool({ name: 'add_node', arguments: { tempId: 'a', type: 'service', label: 'A' } })
      expect(added.isError, JSON.stringify(added.content)).not.toBe(true)
      await client.callTool({ name: 'add_node', arguments: { tempId: 'b', type: 'service', label: 'B' } })
      const related = await client.callTool({ name: 'add_relation', arguments: { sourceId: 'a', targetId: 'b', relationType: 'calls' } })
      expect(related.isError, JSON.stringify(related.content)).not.toBe(true)
    } finally {
      await client.close()
    }
  }, 30_000)

  it('exits when the client closes its end', async () => {
    const folder = await fixture()
    const server = spawn(process.execPath, [join(import.meta.dirname, '../dist/index.js'), '--folder', folder], { stdio: ['pipe', 'ignore', 'ignore'] })
    const exited = new Promise<number | null>((done) => server.once('exit', done))
    server.stdin.end()
    expect(await exited).toBe(0)
  }, 15_000)
})

describe('state machines over MCP', () => {
  it('are offered, explained, built with event references, checked and laid out', async () => {
    const folder = await fixture()
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder],
    }))
    const text = (result: Awaited<ReturnType<typeof client.callTool>>): string =>
      (result.content as { text: string }[]).map((c) => c.text).join('\n')
    const call = async (name: string, args: Record<string, unknown>): Promise<string> => {
      const result = await client.callTool({ name, arguments: args })
      expect(result.isError, `${name}: ${text(result)}`).not.toBe(true)
      return text(result)
    }
    try {
      // The schemas offer the types; the instructions and summary say how to use them.
      const tools = (await client.listTools()).tools
      const schema = (name: string) => tools.find((t) => t.name === name)!.inputSchema as { properties: Record<string, { enum?: string[] }> }
      expect(schema('add_node').properties.type.enum).toEqual(expect.arrayContaining(['state-machine', 'state', 'pseudostate', 'event']))
      expect(schema('add_relation').properties.relationType.enum).toEqual(expect.arrayContaining(['transition', 'emits', 'lifecycle-of']))
      expect(tools.find((t) => t.name === 'get_issues')?.annotations?.readOnlyHint).toBe(true)
      expect(client.getInstructions()).toContain('State machines')
      const summary = await call('get_model_summary', {})
      expect(summary).toContain('Modelling rules:')
      expect(summary).toContain('A `state-machine` models the lifecycle of one entity')
      // The transition's trigger points at an event node, in brief and in full.
      expect(summary).toMatch(/- transition \(Transition\):.*event \(→ event\)/)
      expect(await call('get_model_summary', { types: ['transition'] })).toContain('"refType":"event"')

      await call('add_node', { tempId: 'order', type: 'entity', label: 'Order', properties: { kind: 'aggregate-root' } })
      await call('add_node', { tempId: 'm', type: 'state-machine', label: 'Order lifecycle' })
      expect(await call('add_relation', { sourceId: 'm', targetId: 'order', relationType: 'lifecycle-of' })).not.toContain('New warnings')
      for (const [tempId, label] of [['pay', 'PaymentReceived'], ['ship', 'Shipped'], ['paid', 'OrderPaid']]) {
        await call('add_node', { tempId, type: 'event', label, parentId: 'm' })
      }
      // A compound state without its initial pseudostate: written, but warned.
      await call('add_node', { tempId: 'pending', type: 'state', label: 'Pending', parentId: 'm' })
      const warned = await call('add_node', { tempId: 'awaiting', type: 'state', label: 'Awaiting card', parentId: 'pending' })
      expect(warned).toContain('New warnings')
      expect(warned).toContain('Compound state "Pending" has child states but no initial pseudostate')

      await call('add_node', { tempId: 'pi', type: 'pseudostate', label: 'Start', parentId: 'pending', properties: { kind: 'initial' } })
      await call('add_node', { tempId: 'i', type: 'pseudostate', label: 'Start', parentId: 'm', properties: { kind: 'initial' } })
      await call('add_node', { tempId: 'fulfil', type: 'state', label: 'Fulfilment', parentId: 'm', properties: { kind: 'parallel' } })
      for (const [region, inner] of [['packing', 'Picking'], ['invoicing', 'Drafting']]) {
        await call('add_node', { tempId: region, type: 'state', label: region, parentId: 'fulfil' })
        await call('add_node', { tempId: `${region}-start`, type: 'pseudostate', label: 'Start', parentId: region, properties: { kind: 'initial' } })
        await call('add_node', { tempId: `${region}-inner`, type: 'state', label: inner, parentId: region })
        await call('add_relation', { sourceId: `${region}-start`, targetId: `${region}-inner`, relationType: 'transition' })
      }
      await call('add_node', { tempId: 'done', type: 'state', label: 'Shipped', parentId: 'm', properties: { kind: 'final' } })
      await call('add_relation', { sourceId: 'i', targetId: 'pending', relationType: 'transition' })
      await call('add_relation', { sourceId: 'pi', targetId: 'awaiting', relationType: 'transition' })
      await call('add_relation', { sourceId: 'pending', targetId: 'fulfil', relationType: 'transition', properties: { event: 'pay', guard: 'amount ok', raises: ['paid'] } })
      // A trigger that is not an event is refused, not stored.
      const wrong = await call('add_relation', { sourceId: 'fulfil', targetId: 'done', relationType: 'transition', properties: { event: 'pending' } })
      expect(wrong).toContain('"Pending" is of type state, not event')

      const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      const id = (label: string, type: string) => saved.nodes.find((n) => n.label === label && n.type === type)!.id
      const pay = saved.relations.find((r) => (r as unknown as Record<string, unknown>).guard === 'amount ok') as unknown as Record<string, unknown>
      expect(pay.event).toBe(id('PaymentReceived', 'event'))
      expect(pay.raises).toEqual([id('OrderPaid', 'event')])
      const toDone = saved.relations.find((r) => r.targetId === id('Shipped', 'state'))!
      await call('update_relation', { id: toDone.id, properties: { event: 'ship' } })
      expect(await call('search_model', { query: `LIST RELATIONS WHERE raises = "${id('OrderPaid', 'event')}"` })).toContain('amount ok')

      // A component implements the machine; a requirement holds while in a state.
      await call('add_node', { tempId: 'sys', type: 'system', label: 'Shop' })
      await call('add_node', { tempId: 'ctr', type: 'container', label: 'Orders', parentId: 'sys' })
      await call('add_relation', { sourceId: 'ctr', targetId: 'm', relationType: 'implements' })
      await call('add_relation', { sourceId: 'ctr', targetId: 'order', relationType: 'realises' })
      await call('add_node', { tempId: 'hold', type: 'requirement', label: 'Hold stock', properties: { ears_type: 'state-driven', action: 'hold the stock', precondition_state: 'pending' } })
      const req = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data.nodes.find((n) => n.label === 'Hold stock') as unknown as Record<string, unknown>
      expect(req.precondition_state).toBe(id('Pending', 'state'))

      expect((await call('get_issues', {})).split('\n')[0]).toBe('No issues: the model follows its metamodel.')

      // Smart Layout keeps every state inside its parent, four levels deep.
      await call('smart_layout', {})
      const laid = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      const nodes = Object.fromEntries(laid.nodes.map((n) => [n.id, n]))
      for (const n of laid.nodes) {
        const parent = n.parentId ? nodes[n.parentId] : undefined
        if (!parent) continue
        expect(n.x, n.label).toBeGreaterThanOrEqual(0)
        expect(n.y, n.label).toBeGreaterThanOrEqual(0)
        expect(n.x + n.width, n.label).toBeLessThanOrEqual(parent.width + 1e-6)
        expect(n.y + n.height, n.label).toBeLessThanOrEqual(parent.height + 1e-6)
      }
      // Machines and compound states are folders, like systems and containers.
      const paths = Object.keys(await new MdFolderSession(diskFolderStorage(folder)).readAll())
      expect(paths).toEqual(expect.arrayContaining([
        'nodes/order-lifecycle/_index.md',
        'nodes/order-lifecycle/fulfilment/_index.md',
        'nodes/order-lifecycle/fulfilment/packing/picking/_index.md',
      ]))
    } finally {
      await client.close()
    }
  })
})

describe('metamodel changes over MCP', () => {
  // Item 210: properties sent as get_model_summary lists them were refused
  // (visibleWhen was an additional property); sent without it, the rules
  // were gone and a ubiquitous requirement's card showed While in state.
  it('keep a property\'s visibleWhen, sent or left out', async () => {
    const folder = await fixture()
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder] }))
    try {
      const requirement = builtInGovernanceMetamodel().nodeTypes.requirement
      const ruled = requirement.properties!.filter((p) => p.visibleWhen)
      expect(ruled.length).toBeGreaterThan(0)
      const sent = await client.callTool({ name: 'upsert_node_type', arguments: { id: 'requirement', properties: requirement.properties } })
      expect(sent.isError, JSON.stringify(sent.content)).not.toBe(true)
      const stripped = requirement.properties!.map(({ visibleWhen: _v, ...p }) => (p.key === 'action' ? { ...p, label: 'What shall be done' } : p))
      const left = await client.callTool({ name: 'upsert_node_type', arguments: { id: 'requirement', properties: stripped } })
      expect(left.isError, JSON.stringify(left.content)).not.toBe(true)
      const saved = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
      const props = saved.metamodel!.nodeTypes.requirement.properties!
      for (const p of ruled) expect(props.find((q) => q.key === p.key)?.visibleWhen, p.key).toEqual(p.visibleWhen)
      expect(props.find((q) => q.key === 'action')?.label).toBe('What shall be done')
    } finally {
      await client.close()
    }
  })

  // D3: narrowing the metamodel below what the model holds is done, and
  // the agent is told what it breaks (it was accepted without a word).
  it('narrowed below what the model holds is written, with what it breaks', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await model.call('add_node', { tempId: 'api', type: 'container', label: 'API', parentId: 'shop' })
    const narrowed = await model.call('upsert_node_type', { id: 'container', allowedParents: ['group'] })
    expect(narrowed.ok, narrowed.text).toBe(true)
    expect(narrowed.text).toContain('Warning: the metamodel change brings in 1 issue')
    expect(narrowed.text).toContain('Container "API" cannot be inside Software System. Allowed parents: group.')
    const limited = await model.call('upsert_node_type', { id: 'system', maxCount: 1 })
    expect(limited.text).not.toContain('Warning')
  })

  // F-0032: a type left with no place at all is a warning of its own, also
  // while no element of it exists; the agent hears of it with the result,
  // and get_issues lists it.
  it('leaving a type no place is written, with the warning that nothing can be placed as it', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const placeless = await model.call('upsert_node_type', { id: 'queue', allowedParents: [], allowedAtRoot: false })
    expect(placeless.ok, placeless.text).toBe(true)
    expect(placeless.text).toContain('Warning: the metamodel change brings in 1 issue')
    expect(placeless.text).toContain('Queue has no place in the metamodel: no allowed parent, and not at the root, so nothing can be placed as a Queue.')
    expect((await model.call('get_issues', {})).text).toContain('Queue has no place in the metamodel')
    const refused = await model.call('add_node', { type: 'queue', label: 'Orders' })
    expect(refused.ok).toBe(false)
    expect(refused.text).not.toContain('Allowed parents: the canvas root')
  })
})

describe('get_issues', () => {
  it('lists unaddressed concerns after the metamodel issues', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const ids = new Map<string, string>()
    const add = async (name: string, args: Record<string, unknown>) => {
      const result = await model.call(name, args)
      expect(result.ok, `${name}: ${result.text}`).toBe(true)
      const id = /Created node ([\w-]+)/.exec(result.text)?.[1]
      if (id && typeof args.tempId === 'string') ids.set(args.tempId, id)
      return result.text
    }
    await add('add_node', { tempId: 'user', type: 'person', label: 'Customer' })
    await add('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await add('add_node', { tempId: 'web', type: 'webapp', label: 'Storefront', parentId: 'shop' })
    await add('add_relation', { sourceId: 'user', targetId: 'web', relationType: 'interacts' })

    const before = (await model.call('get_issues', {})).text
    expect(before.split('\n')[0]).toBe('No issues: the model follows its metamodel.')
    expect(before).toContain('Unaddressed concerns')
    expect(before).toContain('- Authentication (conceptId concern-authentication)')
    expect(before).toContain(`Elements: Storefront (${ids.get('web')})`)
    expect(before).toContain(`Suggested bindTo: Storefront (${ids.get('web')}), which settles all of them`)
    expect(before).toMatch(/- IDENTITY: How do people sign in\? \[idp = .*none = nobody signs in\]/)

    // A large model's concerns run long: brief lists each in a line, concept one in full, none leaves them out.
    const brief = (await model.call('get_issues', { concerns: 'brief' })).text
    expect(brief).toContain('- Authentication (conceptId concern-authentication): 1 element')
    expect(brief).not.toContain('IDENTITY')
    expect(brief.length).toBeLessThan(before.length / 3)
    const one = (await model.call('get_issues', { concept: 'concern-authentication' })).text
    expect(one).toContain('- IDENTITY: How do people sign in?')
    expect(one.match(/\(conceptId /g)).toHaveLength(1)
    expect((await model.call('get_issues', { concerns: 'none' })).text).toBe('No issues: the model follows its metamodel.')
    expect(await model.call('get_issues', { concerns: 'some' })).toEqual({ ok: false, text: 'get_issues: concerns must be full, brief or none' })

    await add('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'none', MACHINE: 'none' }, bindTo: ids.get('web') })
    const after = (await model.call('get_issues', {})).text
    expect(after.split('\n')[0]).toBe('No issues: the model follows its metamodel.')
    expect(after).not.toContain('- Authentication (conceptId concern-authentication)')
  })

  // F-0005: a pack imported unbound was listed as open with "import it",
  // and the agent imported a second copy; radical check names its ADR.
  it('names a concern pack imported unbound and where to bind it, not to import it again', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const ids = new Map<string, string>()
    const add = async (name: string, args: Record<string, unknown>) => {
      const result = await model.call(name, args)
      expect(result.ok, `${name}: ${result.text}`).toBe(true)
      const id = /Created node ([\w-]+)/.exec(result.text)?.[1]
      if (id && typeof args.tempId === 'string') ids.set(args.tempId, id)
      return result.text
    }
    await add('add_node', { tempId: 'user', type: 'person', label: 'Customer' })
    await add('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    await add('add_node', { tempId: 'web', type: 'webapp', label: 'Web', parentId: 'shop' })
    await add('add_relation', { sourceId: 'user', targetId: 'web', relationType: 'interacts' })
    await add('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: {} })
    // The default answers bring two decisions: sign-in through a provider and the second factor.
    const adrs = JSON.parse((await model.call('search_model', { query: 'LIST NODES WHERE type = "adr"' })).text).rows as Array<{ id: string; label: string }>
    expect(adrs.map((a) => a.label).sort()).toEqual(['A second factor for risky operations', 'Users sign in through an identity provider'])
    const adr = adrs.filter((a) => a.label === 'Users sign in through an identity provider')

    const issues = (await model.call('get_issues', {})).text
    expect(issues).toContain('Unbound decisions (warnings of radical check\'s concern-unbound)')
    expect(issues).toContain(`- ADR "${adr[0].label}" (${adr[0].id}) settles the concern "authentication" but constrains no element. Bind it to Web (${ids.get('web')})`)
    const block = issues.split('\n- ').find((b) => b.startsWith('Authentication (conceptId')) ?? ''
    expect(block).toContain('Already imported, not bound: ')
    expect(block).toContain(`ADR "${adr[0].label}" (${adr[0].id})`)
    expect(block).toContain('bind it instead of importing the pack again')
    expect(block).not.toContain('Questions:')

    for (const a of adrs) await add('add_relation', { sourceId: a.id, targetId: ids.get('web'), relationType: 'constrains' })
    const bound = (await model.call('get_issues', {})).text
    expect(bound).not.toContain('Unbound decisions')
    expect(bound).not.toContain('- Authentication (conceptId concern-authentication)')
  })
})

describe('repository mapping', () => {
  it('says where elements are built and maps them in .radical/radical.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-mapping-'))
    folders.push(root)
    await promisify(execFile)('git', ['init', '-q'], { cwd: root })
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), relations: [], nodes: [
      node('shop', 'system', 'Shop'), node('orders', 'container', 'Orders API', { parentId: 'shop' }),
      node('billing', 'container', 'Billing API', { parentId: 'shop' }), node('checkout', 'component', 'Checkout', { parentId: 'orders' }),
    ] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    await mkdir(join(root, 'services', 'orders'), { recursive: true })
    const model = await FolderModel.open(folder)

    // Nothing mapped yet: every C4 element is built nowhere.
    const before = JSON.parse((await model.call('get_implementation', {})).text)
    expect(before.implements).toEqual([])
    expect(before.builtNowhere.map((n: { id: string }) => n.id).sort()).toEqual(['billing', 'checkout', 'orders', 'shop'])

    expect((await model.call('set_implementation', { id: 'shop', paths: ['.'] })).text).toBe('system "Shop" (shop) is built in . (.radical/radical.json).')
    expect((await model.call('set_implementation', { id: 'orders', paths: ['services/orders', 'services/shared/'] })).text)
      .toBe('container "Orders API" (orders) is built in services/orders, services/shared (.radical/radical.json). Not in the repository yet: services/shared; radical check warns until they are.')
    expect(JSON.parse(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).implements).toEqual([
      { element: 'shop', name: 'Shop', paths: ['.'] },
      { element: 'orders', name: 'Orders API', paths: ['services/orders', 'services/shared'] },
    ])
    // A component without an entry is built where its container is.
    expect((await model.call('get_implementation', { id: 'checkout' })).text)
      .toBe('component "Checkout" (checkout) is built in services/orders, services/shared, as container "Orders API" (orders) is.')
    expect(JSON.parse((await model.call('get_implementation', {})).text).builtNowhere).toEqual([])

    expect((await model.call('set_implementation', { id: 'orders', remove: true })).text).toBe('Took container "Orders API" (orders) out of .radical/radical.json.')
    expect((await model.call('get_implementation', { id: 'orders' })).text).toBe('container "Orders API" (orders) is built in ., as system "Shop" (shop) is.')
    // Refused: an element the model lacks, a path outside the repository.
    expect(await model.call('set_implementation', { id: 'gone', paths: ['x'] })).toMatchObject({ ok: false, text: 'set_implementation: no element gone in the model' })
    expect(await model.call('set_implementation', { id: 'billing', paths: ['../elsewhere'] })).toMatchObject({ ok: false, text: 'set_implementation: ../elsewhere is outside the repository' })
    // No model file changed.
    expect(await new MdFolderSession(diskFolderStorage(folder)).readAll()).toEqual(expect.objectContaining({ 'radical.md': expect.any(String) }))
  })
})

describe('test bindings', () => {
  it('lists the scenarios the repository verifies, binds their tests, and get_changes names them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-verify-'))
    folders.push(root)
    const git = (...args: string[]) => promisify(execFile)('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root })
    await git('init', '-q')
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [
      node('shop', 'system', 'Shop'), node('api', 'container', 'Orders API', { parentId: 'shop' }),
      node('pay', 'requirement', 'Pay', { ears_type: 'ubiquitous', action: 'The API shall take payments' }),
      node('s-pay', 'scenario', 'Pays', { given: 'a cart', when: 'paying', then: 'paid' }),
    ], relations: [
      { id: 'sat', relationType: 'satisfies', sourceId: 'api', targetId: 'pay' },
      { id: 'ver', relationType: 'verifies', sourceId: 's-pay', targetId: 'pay' },
    ] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    await writeFile(join(root, '.radical', 'radical.json'), JSON.stringify({ implements: [{ element: 'api', name: 'Orders API', paths: ['services/orders'] }] }))
    await git('add', '-A')
    await git('commit', '-q', '-m', 'model')
    const model = await FolderModel.open(folder)

    expect(JSON.parse((await model.call('get_verification', {})).text).toVerify).toEqual([{ id: 's-pay', label: 'Pays' }])
    expect((await model.call('get_verification', { id: 's-pay' })).text).toBe('.radical/radical.json binds no test to scenario "Pays" (s-pay): bind its tests with set_verification.')
    expect((await model.call('set_verification', { id: 's-pay', tests: ['tests/pay.test.ts › pays', 'tests/pay.test.ts > pays', 'tests/pay.test.ts › declines'] })).text)
      .toBe('scenario "Pays" (s-pay) is checked by 2 test(s) (.radical/radical.json).')
    expect(JSON.parse((await model.call('get_verification', {})).text).toVerify).toEqual([])
    // The mapping of elements is kept beside the tests.
    expect(JSON.parse(await readFile(join(root, '.radical', 'radical.json'), 'utf8'))).toEqual({
      implements: [{ element: 'api', name: 'Orders API', paths: ['services/orders'] }],
      verifies: [{ element: 's-pay', name: 'Pays', tests: ['tests/pay.test.ts › pays', 'tests/pay.test.ts › declines'] }],
    })
    // Only a scenario or fitness function is checked by tests.
    expect(await model.call('set_verification', { id: 'api', tests: ['x'] })).toMatchObject({ ok: false, text: 'set_verification: container "Orders API" (api) is no scenario or fitness function; only those are checked by tests' })

    // A changed scenario comes with its tests.
    expect((await model.call('update_node', { id: 's-pay', properties: { then: 'paid and receipted' } })).ok).toBe(true)
    expect((await model.call('get_changes', { since: 'HEAD' })).text).toContain('    tests (.radical/radical.json): \n      tests/pay.test.ts › pays\n      tests/pay.test.ts › declines')
    expect((await model.call('set_verification', { id: 's-pay', remove: true })).text).toBe('Took scenario "Pays" (s-pay) out of .radical/radical.json.')
  })

  it('binds each test it is given beside those bound, as radical verify --test does, and drops one (F-0111)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-verify-'))
    folders.push(root)
    await promisify(execFile)('git', ['init', '-q'], { cwd: root })
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), relations: [], nodes: [node('s-pay', 'scenario', 'Pays', { given: 'a cart', when: 'paying', then: 'paid' })] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const bound = async () => (JSON.parse(await readFile(join(root, '.radical', 'radical.json'), 'utf8')).verifies ?? []).map((v: { tests: string[] }) => v.tests)

    expect((await model.call('set_verification', { id: 's-pay', tests: ['tests/pay.test.ts › pays by card'] })).text).toBe('scenario "Pays" (s-pay) is checked by 1 test(s) (.radical/radical.json).')
    expect((await model.call('set_verification', { id: 's-pay', tests: ['tests/pay.test.ts › declines an expired card', 'tests/pay.test.ts › pays by card'] })).text).toBe('scenario "Pays" (s-pay) is checked by 2 test(s) (.radical/radical.json).')
    expect(await bound()).toEqual([['tests/pay.test.ts › pays by card', 'tests/pay.test.ts › declines an expired card']])
    // drop takes one off; tests and drop together replace one test by another.
    expect((await model.call('set_verification', { id: 's-pay', drop: ['tests/pay.test.ts › pays by card'], tests: ['tests/pay.test.ts › pays by card twice'] })).ok).toBe(true)
    expect(await bound()).toEqual([['tests/pay.test.ts › declines an expired card', 'tests/pay.test.ts › pays by card twice']])
    // Dropping the last test takes the entry out.
    expect((await model.call('set_verification', { id: 's-pay', drop: ['tests/pay.test.ts › declines an expired card', 'tests/pay.test.ts › pays by card twice'] })).text).toBe('scenario "Pays" (s-pay) is checked by no test (.radical/radical.json).')
    expect(await bound()).toEqual([])
    expect(await model.call('set_verification', { id: 's-pay', tests: [] })).toMatchObject({ ok: false })
    expect(await model.call('set_verification', { id: 's-pay', tests: ['x'], remove: true })).toMatchObject({ ok: false })
  })

  it('binds a test once when the file has it written another way, as radical verify does (F-0157)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-verify-'))
    folders.push(root)
    await promisify(execFile)('git', ['init', '-q'], { cwd: root })
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), relations: [], nodes: [node('s-pay', 'scenario', 'Pays', { given: 'a cart', when: 'paying', then: 'paid' })] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const file = join(root, '.radical', 'radical.json')
    const model = await FolderModel.open(folder)
    for (const [boundAs, given] of [
      ['tests/pay.test.ts > checkout > pays by card', 'tests/pay.test.ts › checkout › pays by card'],
      ['tests/pay.spec.ts › checkout › pays by card', '[chromium] › tests/pay.spec.ts:2:3 › checkout › pays by card'],
    ]) {
      await writeFile(file, JSON.stringify({ implements: [], verifies: [{ element: 's-pay', name: 'Pays', tests: [boundAs] }] }))
      expect((await model.call('set_verification', { id: 's-pay', tests: [given] })).text, given).toBe('scenario "Pays" (s-pay) is checked by 1 test(s) (.radical/radical.json).')
      expect(JSON.parse(await readFile(file, 'utf8')).verifies[0].tests, given).toEqual([boundAs])
    }
  })
})

describe('entries of deleted elements', () => {
  it('delete_node takes them out of .radical/radical.json, and remove: true takes out one whose element is gone (F-0110)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-orphans-'))
    folders.push(root)
    await promisify(execFile)('git', ['init', '-q'], { cwd: root })
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), relations: [], nodes: [
      node('shop', 'system', 'Shop'), node('api', 'container', 'API', { parentId: 'shop' }), node('core', 'component', 'Core', { parentId: 'api' }),
      node('web', 'container', 'Web', { parentId: 'shop' }), node('s-pay', 'scenario', 'Pays', { given: 'a cart', when: 'paying', then: 'paid' }),
    ] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const file = join(root, '.radical', 'radical.json')
    await writeFile(file, JSON.stringify({
      owner: 'team-shop',
      implements: [{ element: 'api', name: 'API', paths: ['apps/api'] }, { element: 'core', name: 'Core', paths: ['apps/api/core'] }, { element: 'web', name: 'Web', paths: ['apps/web'], owner: 'team-web' }, { element: 'old', name: 'Old', paths: ['apps/old'] }],
      verifies: [{ element: 's-pay', name: 'Pays', tests: ['apps/api/pay.test.ts › pays'] }, { element: 's-old', name: 'Old', tests: ['old.test.ts'] }],
    }))
    const model = await FolderModel.open(folder)
    const read = async () => JSON.parse(await readFile(file, 'utf8'))

    // Deleting a container takes its entry and its component's out.
    const deleted = await model.call('delete_node', { id: 'api' })
    expect(deleted.ok).toBe(true)
    expect(deleted.text).toContain('Took the entries of container "API" (api), component "Core" (core) out of .radical/radical.json')
    expect((await model.call('delete_node', { id: 's-pay' })).text).toContain('Took the entry of scenario "Pays" (s-pay) out of .radical/radical.json')
    expect(await read()).toEqual({ owner: 'team-shop', implements: [{ element: 'web', name: 'Web', paths: ['apps/web'], owner: 'team-web' }, { element: 'old', name: 'Old', paths: ['apps/old'] }], verifies: [{ element: 's-old', name: 'Old', tests: ['old.test.ts'] }] })

    // An entry left by an element deleted elsewhere: remove: true takes it out.
    expect(await model.call('set_implementation', { id: 'old', remove: true })).toMatchObject({ ok: true, text: 'Took "Old" (old), no element of the model, out of .radical/radical.json.' })
    expect(await model.call('set_verification', { id: 's-old', remove: true })).toMatchObject({ ok: true, text: 'Took "Old" (s-old), no element of the model, out of .radical/radical.json.' })
    expect(await read()).toEqual({ owner: 'team-shop', implements: [{ element: 'web', name: 'Web', paths: ['apps/web'], owner: 'team-web' }] })
    // Still refused: mapping or binding an element the model lacks.
    expect(await model.call('set_implementation', { id: 'old', paths: ['apps/old'] })).toMatchObject({ ok: false, text: 'set_implementation: no element old in the model' })
    expect(await model.call('set_implementation', { id: 'never', remove: true })).toMatchObject({ ok: false, text: 'set_implementation: no element never in the model' })
    expect(await model.call('set_verification', { id: 'never', remove: true })).toMatchObject({ ok: false, text: 'set_verification: no element never in the model' })
  })
})

describe('verification path', () => {
  it('get_trace goes from a requirement to its need and to every test, with why a test failed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'radical-mcp-trace-'))
    folders.push(root)
    const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
      ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
    const folder = join(root, '.radical', 'model')
    const files = serializeToMdFolder({ metamodel: builtInGovernanceMetamodel(), nodes: [
      node('need', 'need', 'Brief'),
      node('pay', 'requirement', 'Pay', { ears_type: 'ubiquitous', action: 'The API shall take payments' }),
      node('s-red', 'scenario', 'Refunds', { given: 'g', when: 'w', then: 't' }),
      node('s-green', 'scenario', 'Pays', { given: 'g', when: 'w', then: 't' }),
    ], relations: [
      { id: 'd', relationType: 'derives', sourceId: 'pay', targetId: 'need' },
      { id: 'v1', relationType: 'verifies', sourceId: 's-red', targetId: 'pay' },
      { id: 'v2', relationType: 'verifies', sourceId: 's-green', targetId: 'pay' },
    ] }, 'shop')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    await writeFile(join(root, '.radical', 'radical.json'), JSON.stringify({ verifies: [
      { element: 's-red', name: 'Refunds', tests: ['tests/pay.test.ts › refunds'] },
      { element: 's-green', name: 'Pays', tests: ['tests/pay.test.ts › pays'] },
    ] }))
    const model = await FolderModel.open(folder)
    // Without results: the path, and how to get them.
    const bare = (await model.call('get_trace', { id: 'pay' })).text
    expect(bare).toMatch(/^No test results beside the model: run radical check/)
    expect(bare).toContain('  ▶ Requirement: Pay [pay] — no results')

    await writeEditorStateFile(folder, '.state/test-results.json', serializeTestResults([
      { file: `${root}/tests/pay.test.ts`, title: ['pays'], status: 'passed', durationMs: 3 },
      { file: `${root}/tests/pay.test.ts`, title: ['refunds'], status: 'failed', message: 'AssertionError: expected 0 to be 10', durationMs: 7, line: 12 },
    ], ['r.json']))
    const text = (await model.call('get_trace', { id: 'pay' })).text
    expect(text).toMatch(/^Test results read .* ago \(2 test cases\)\./)
    expect(text.split('\n').slice(1).join('\n')).toBe([
      'Verification path of Pay [pay]',
      '- Need: Brief [need] — broken',
      '  ▶ Requirement: Pay [pay] — broken',
      '    - Scenario: Refunds [s-red] — failed',
      '        · tests/pay.test.ts › refunds — failed',
      '            AssertionError: expected 0 to be 10',
      '    - Scenario: Pays [s-green] — passed',
      '        · tests/pay.test.ts › pays — passed',
    ].join('\n'))
    expect(await model.call('get_trace', { id: 'gone' })).toMatchObject({ ok: false, text: 'get_trace: no element gone in the model' })
  })
})

describe('brief answers for agents', () => {
  it('lists requirements in brief, gives them whole with FULL, and each neighbour once (Requirements listed in brief)', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const long = 'take the payment through the one gateway of the provider the shop is set to, record the attempt with its outcome and the provider\'s reference, and tell the customer what happened in words a person reads'
    await model.call('add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
    for (let i = 0; i < 40; i++) {
      const added = await model.call('add_node', { tempId: `r${i}`, type: 'requirement', label: `Pay ${i}`, parentId: 'shop', properties: { ears_type: 'event-driven', trigger: 'the customer pays', action: long, rationale: 'A long rationale nobody needs in a list. '.repeat(10) } })
      expect(added.ok, added.text).toBe(true)
    }
    await model.call('add_relation', { sourceId: 'shop', targetId: 'r0', relationType: 'satisfies' })
    const brief = JSON.parse((await model.call('search_model', { query: 'LIST NODES WHERE type = "requirement"' })).text)
    expect(brief.total).toBe(40)
    const row = brief.rows[0]
    expect(Object.keys(row).sort()).toEqual(['ears_type', 'id', 'label', 'parentId', 'text', 'type'])
    expect(row.text.length).toBe(160)
    expect(row.text.startsWith('When the customer pays, the system shall take the payment')).toBe(true)
    expect(row.text.endsWith('…')).toBe(true)
    expect(brief.note).toContain('GET NODE')

    const full = JSON.parse((await model.call('search_model', { query: 'LIST NODES WHERE type = "requirement" FULL' })).text)
    expect(full.rows[0]).toMatchObject({ action: long, ears_type: 'event-driven' })
    expect(full.rows[0].rationale).toContain('A long rationale')

    const around = JSON.parse((await model.call('search_model', { query: `GET NEIGHBORS OF ${row.id}` })).text)
    expect(around.rows).toBeUndefined()
    expect(around.neighbors.every((n: Record<string, unknown>) => !('rationale' in n) && typeof n.depth === 'number')).toBe(true)
    expect(new Set(around.relations.map((r: { id: string }) => r.id)).size).toBe(around.relations.length)
    expect(brief.rows.length * 600).toBeGreaterThan(JSON.stringify(brief).length)
    expect(JSON.stringify(full).length).toBeGreaterThan(2.5 * JSON.stringify(brief).length)
  })

  it('gives the metamodel in brief, and named types in full (Summary names types in brief)', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const summary = await model.call('get_model_summary', {})
    expect(summary.ok).toBe(true)
    expect(summary.text.length).toBeLessThan(15000)
    const line = summary.text.split('\n').find((l) => l.startsWith('- requirement '))!
    expect(line).toContain('ears_type (ubiquitous|event-driven|state-driven|unwanted-behaviour|optional|complex)')
    expect(line).toContain('precondition_state (→ state)')
    expect(summary.text).toContain('- constrains (Constrains, governance): adr, fitness-fn, requirement → person, system, domain, container, component, database, webapp, queue')
    expect(summary.text).toContain('get_model_summary with `types`')

    const detail = await model.call('get_model_summary', { types: ['requirement', 'constrains', 'unknown-type'] })
    expect(detail.ok).toBe(true)
    const json = JSON.parse(detail.text.slice(detail.text.indexOf('```json') + 7, detail.text.lastIndexOf('```')))
    expect(json.nodeTypes.map((t: { id: string }) => t.id)).toEqual(['requirement'])
    expect(json.relationTypes.map((t: { id: string }) => t.id)).toEqual(['constrains'])
    expect(json.nodeTypes[0].properties.find((p: { key: string }) => p.key === 'trigger').visibleWhen).toBeTruthy()
    expect(detail.text).toContain('Not in the metamodel "Radical": unknown-type.')
    expect(detail.text).not.toContain('radicalVersion')
    expect((await model.call('get_model_summary', { types: 'requirement' })).ok).toBe(false)
  })
})

describe('requirements reviewed against their needs', () => {
  const exec = promisify(execFile)
  const git = (cwd: string, ...args: string[]) =>
    exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd })

  it('lists each changed requirement next to the words of its needs (Requirement read against the client\'s words)', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const words = 'From Tomek: I need to know what our goods cost us.\n\nQ: What does a product never received at a cost show?\nA: No average (null, not zero), and its stock is worth 0.'
    await model.call('add_node', { tempId: 'cost', type: 'need', label: 'Cost of goods', description: words })
    await model.call('add_node', { tempId: 'old', type: 'requirement', label: 'Average cost', properties: { ears_type: 'ubiquitous', action: 'keep one weighted average cost per product' } })
    await model.call('add_relation', { sourceId: 'old', targetId: 'cost', relationType: 'derives' })
    await model.call('add_node', { tempId: 'other', type: 'need', label: 'Shipping', description: 'From Kasia: send paid orders out.' })
    await model.call('add_node', { tempId: 'ship', type: 'requirement', label: 'Ship paid orders', properties: { ears_type: 'ubiquitous', action: 'ship only paid orders' } })
    await model.call('add_relation', { sourceId: 'ship', targetId: 'other', relationType: 'derives' })
    await git(folder, 'init', '-q', '-b', 'main')
    await git(folder, 'add', '.')
    await git(folder, 'commit', '-q', '-m', 'model')

    // On the branch: a requirement from the need, one through another requirement, one from no need.
    await model.call('add_node', { tempId: 'value', type: 'requirement', label: 'Show stock value', properties: { ears_type: 'ubiquitous', action: 'show the stock value of each product, null when it has no average' } })
    await model.call('add_relation', { sourceId: 'value', targetId: 'old', relationType: 'derives' })
    await model.call('add_node', { tempId: 'orphan', type: 'requirement', label: 'List products', properties: { ears_type: 'ubiquitous', action: 'list the products' } })
    const review = await model.call('review_requirements', {})
    expect(review.ok, review.text).toBe(true)
    expect(review.text).toContain('Review 2 requirements')
    expect(review.text).toContain('## Requirement "Show stock value"')
    expect(review.text).toContain('The system shall show the stock value of each product, null when it has no average')
    expect(review.text).toContain('### Need "Cost of goods"')
    expect(review.text).toContain('A: No average (null, not zero), and its stock is worth 0.')
    expect(review.text).toContain('Derive from no need: "List products"')
    expect(review.text).not.toContain('Ship paid orders')
    expect(review.text).not.toContain('## Requirement "Average cost"')

    // A derives relation that quotes the need shows those words instead of the whole need.
    await model.call('add_node', { tempId: 'zero', type: 'requirement', label: 'Worth of unknown stock', properties: { ears_type: 'ubiquitous', action: 'value stock without an average at 0' } })
    await model.call('add_relation', { sourceId: 'zero', targetId: 'cost', relationType: 'derives', properties: { quote: 'its stock is worth 0.' } })
    const quoted = await model.call('review_requirements', { ids: ['zero'] })
    expect(quoted.text).toContain('### Rests on need "Cost of goods"')
    expect(quoted.text).toContain('quoting:\nits stock is worth 0.')
    expect(quoted.text).not.toContain('From Tomek: I need to know')
    // What the values alone show is listed with the requirement.
    await model.call('add_node', { tempId: 'nullv', type: 'requirement', label: 'Stock value without cost', properties: { ears_type: 'ubiquitous', action: 'show the stock value as null without an average' } })
    await model.call('add_relation', { sourceId: 'nullv', targetId: 'cost', relationType: 'derives', properties: { quote: 'its stock is worth 0.' } })
    const gaps = await model.call('review_requirements', { ids: ['nullv'] })
    expect(gaps.text).toContain('Values its quotes say and it does not: "0".')
    expect(gaps.text).toContain('Values it says and no quote says: "null".')

    // A need changed on the branch leads to the requirements that derive from it.
    await model.call('update_node', { id: 'other', description: 'From Kasia: send paid orders out.\n\nQ: Partly? A: Whole orders only.' })
    expect((await model.call('review_requirements', {})).text).toContain('## Requirement "Ship paid orders"')

    // Named, only those; a need without a question is pointed out.
    const named = await model.call('review_requirements', { ids: ['orphan'] })
    expect(named.text).toContain('Review 1 requirement (the requirements named)')
    expect(named.text).not.toContain('Show stock value')
    expect((await model.call('review_requirements', { ids: ['cost'] })).text).toContain('not requirements of this model')
    await model.call('add_relation', { sourceId: 'orphan', targetId: 'other', relationType: 'derives' })
    await model.call('update_node', { id: 'other', description: 'From Kasia: send paid orders out.' })
    expect((await model.call('review_requirements', { ids: ['orphan'] })).text).toContain('holds no question asked of a person')
  })

  it('reviews a requirement whose derives relation changed: a new quote, or a need it newly derives from (Requirement read against the client\'s words)', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    await model.call('add_node', { tempId: 'brief', type: 'need', label: 'Brief', description: 'Q: How big is a basket?\nA: A basket holds at most 20 items.\n\nQ: How long is it kept?\nA: An idle basket is kept for 30 days.' })
    await model.call('add_node', { tempId: 'limit', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 20 items in a basket' } })
    const quoted = await model.call('add_relation', { sourceId: 'limit', targetId: 'brief', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })
    const quoteId = /Relation ID: (\S+)\./.exec(quoted.text)![1]
    await model.call('add_node', { tempId: 'idle', type: 'requirement', label: 'Idle baskets', properties: { ears_type: 'ubiquitous', action: 'delete a basket idle for 7 days' } })
    await model.call('add_node', { tempId: 'other', type: 'requirement', label: 'Untouched', properties: { ears_type: 'ubiquitous', action: 'show the basket' } })
    await model.call('add_relation', { sourceId: 'other', targetId: 'brief', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })
    await git(folder, 'init', '-q', '-b', 'main')
    await git(folder, 'add', '.')
    await git(folder, 'commit', '-q', '-m', 'model')
    expect((await model.call('review_requirements', {})).text).toMatch(/^Nothing to review/)

    const requoted = await model.call('update_relation', { id: quoteId, properties: { quote: 'An idle basket is kept for 30 days.' } })
    expect(requoted.ok, requoted.text).toBe(true)
    await model.call('add_relation', { sourceId: 'idle', targetId: 'brief', relationType: 'derives', properties: { quote: 'An idle basket is kept for 30 days.' } })
    const review = await model.call('review_requirements', {})
    expect(review.text).toContain('Review 2 requirements')
    expect(review.text).toContain('## Requirement "Basket limit"')
    expect(review.text).toContain('## Requirement "Idle baskets"')
    expect(review.text).not.toContain('## Requirement "Untouched"')
  })

  it("tells an agent writing the model what it brings in of the person's words (Write tells of a lost value)", async () => {
    const write = async (folder: string) => {
      const model = await FolderModel.open(folder)
      await model.call('add_node', { tempId: 'cost', type: 'need', label: 'Cost of goods', description: 'Q: What is stock without a cost worth?\nA: The stock is worth 0.' })
      await model.call('add_node', { tempId: 'value', type: 'requirement', label: 'Stock value', properties: { ears_type: 'ubiquitous', action: 'show the stock value as null without an average' } })
      return await model.call('add_relation', { sourceId: 'value', targetId: 'cost', relationType: 'derives', properties: { quote: 'The stock is worth 0' } })
    }
    const told = await write(await fixture())
    expect(told.ok, told.text).toBe(true)
    expect(told.text).toContain('Changed: relations.json')
    expect(told.text).toContain("The person's words, as radical check reads them, after this change")
    expect(told.text).toContain('Requirement "Stock value" does not say "0", which the words it quotes from "Cost of goods" say.')
    // A rule check.json turns off is not named.
    const quiet = await fixture()
    await writeFile(join(quiet, 'check.json'), JSON.stringify({ rules: { 'quote-value-missing': 'off', 'requirement-value-unquoted': 'off' } }))
    const silent = await write(quiet)
    expect(silent.ok, silent.text).toBe(true)
    expect(silent.text).not.toContain('does not say "0"')
  })

  it("tells nothing of the person's words after a rename: it brings in no finding (Write tells of a lost value)", async () => {
    const model = await FolderModel.open(await fixture())
    await model.call('add_node', { tempId: 'brief', type: 'need', label: 'Brief', description: 'Q: How big is a basket?\nA: A basket holds at most 20 items.\n\nQ: How long is it kept?\nA: An idle basket is kept for 30 days.' })
    await model.call('add_node', { tempId: 'limit', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 25 items in a basket' } })
    const told = await model.call('add_relation', { sourceId: 'limit', targetId: 'brief', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })
    expect(told.text).toContain("The person's words, as radical check reads them, after this change")
    for (const [id, label] of [['limit', 'Basket size'], ['brief', 'Shop brief']]) {
      const renamed = await model.call('update_node', { id, label })
      expect(renamed.ok, renamed.text).toBe(true)
      expect(renamed.text).not.toContain("The person's words")
    }
    // A change that does bring one in is still told, with the new names.
    const lost = await model.call('update_node', { id: 'limit', properties: { action: 'keep at most 25 items in a basket for 7 days' } })
    expect(lost.text).toContain('Requirement "Basket size" says "25", "7"')
  })

  it("tells nothing of the person's words after a write that only takes findings away: a value corrected, a part quoted, a scenario added (Write tells of a lost value)", async () => {
    const model = await FolderModel.open(await fixture())
    const words = "The person's words"
    await model.call('add_node', { tempId: 'need', type: 'need', label: 'Basket brief', description: 'Q: What are the limits?\nA: A basket holds at most 20 items and is kept for 30 days.\n\nQ: What else?\nA: Members pay no delivery fee.\n\nA guest pays 5 € for delivery.' })
    await model.call('add_node', { tempId: 'req', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 25 items in a basket for 7 days' } })
    const told = await model.call('add_relation', { sourceId: 'req', targetId: 'need', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items and is kept for 30 days.' } })
    expect(told.text).toContain('does not say "20", "30"')
    const quiet = async (what: string, name: string, args: Record<string, unknown>) => {
      const result = await model.call(name, args)
      expect(result.ok, result.text).toBe(true)
      expect(result.text, what).not.toContain(words)
    }
    await quiet('one of two wrong values corrected', 'update_node', { id: 'req', properties: { action: 'keep at most 20 items in a basket for 7 days' } })
    // A wrong value in place of another is brought in, and told with the one left.
    const other = await model.call('update_node', { id: 'req', properties: { action: 'keep at most 20 items in a basket for 8 days' } })
    expect(other.text).toContain('Requirement "Basket limit" says "8"')
    await quiet('the other corrected', 'update_node', { id: 'req', properties: { action: 'keep at most 20 items in a basket for 30 days' } })
    await model.call('add_node', { tempId: 'req2', type: 'requirement', label: 'Member delivery', properties: { ears_type: 'ubiquitous', action: 'charge members no delivery fee' } })
    await quiet('one of two parts of an answer quoted', 'add_relation', { sourceId: 'req2', targetId: 'need', relationType: 'derives', properties: { quote: 'Members pay no delivery fee.' } })
    await model.call('add_node', { tempId: 'sc', type: 'scenario', label: 'Full basket', properties: { given: 'a basket', when: 'adding an item', then: 'it is refused' } })
    expect((await model.call('add_relation', { sourceId: 'sc', targetId: 'req', relationType: 'verifies' })).text).toContain('takes "20", "30"')
    await quiet('the scenario names one of two values', 'update_node', { id: 'sc', properties: { given: 'a basket with 20 items' } })
    await model.call('add_node', { tempId: 'sc2', type: 'scenario', label: 'Old basket', properties: { given: 'a basket', when: 'time passes', then: 'it is gone' } })
    await quiet('a second scenario that names neither', 'add_relation', { sourceId: 'sc2', targetId: 'req', relationType: 'verifies' })
  })

  it('asks agents for the person\'s words in the need and a review before the code (Agent told to keep answers and review)', async () => {
    const folder = await fixture()
    const model = await FolderModel.open(folder)
    const summary = (await model.call('get_model_summary', {})).text
    expect(summary).toContain('add your question and their answer to the need\'s description word for word')
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder] }))
    try {
      expect(client.getInstructions()).toContain('call review_requirements and correct each requirement that does not say what the person said')
      expect((await client.listTools()).tools.map((t) => t.name)).toContain('review_requirements')
    } finally {
      await client.close()
    }
  })
})
