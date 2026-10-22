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
import { writeSelectionFile } from '@radical/node-files/selectionFile'
import { serializeSelection } from '@radical/common/formats/canvasSelection'
import { parseModelBase } from '@radical/common/formats/modelBase'
import { AGENT_ACTIVE_MS, AGENT_ACTIVITY_FILE, parseAgentActivity } from '@radical/common/formats/agentActivity'
import { FolderModel } from './folderModel'
import { drawnSize } from '@radical/layout/geometry'
import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, type C4Node } from '@radical/common/c4'

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
    expect((await model.call('get_selection', {})).text).toMatch(/^No selection: .radical\/selection.json cannot be read/)
    await writeSelectionFile(folder, JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), viewId: null, nodeIds: ['a'], relationIds: [] }))
    expect((await model.call('get_selection', {})).text).toMatch(/^No selection: .radical\/selection.json was written by a newer Studio \(version 2\)/)
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
    const base = parseModelBase(await readFile(join(folder, '.radical/base.json'), 'utf8'))
    expect(base).toMatchObject({ described: 'merge base with main', branch: 'main' })
    expect(base!.nodes.map((n) => n.label)).toEqual(['Shop'])
    expect(await readFile(join(folder, '.radical/.gitignore'), 'utf8')).toBe('*\n')
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
    await mkdir(join(dir, '.radical'))
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
    expect(steps.map((s) => s.message)).toContain('Smart Layout: candidates 1/12')
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
      expect(summary).toContain('"refType":"event"')

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
    expect(narrowed.text).toContain('Warning: the metamodel now flags what the model holds (1 issue')
    expect(narrowed.text).toContain('Container "API" cannot be inside Software System. Allowed parents: group.')
    const limited = await model.call('upsert_node_type', { id: 'system', maxCount: 1 })
    expect(limited.text).not.toContain('Warning')
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
    const adr = JSON.parse((await model.call('search_model', { query: 'LIST NODES WHERE type = "adr"' })).text).rows as Array<{ id: string; label: string }>
    expect(adr).toHaveLength(1)

    const issues = (await model.call('get_issues', {})).text
    expect(issues).toContain('Unbound decisions (warnings of radical check\'s concern-unbound)')
    expect(issues).toContain(`- ADR "${adr[0].label}" (${adr[0].id}) settles the concern "authentication" but constrains no element. Bind it to Web (${ids.get('web')})`)
    const block = issues.split('\n- ').find((b) => b.startsWith('Authentication (conceptId')) ?? ''
    expect(block).toContain(`Already imported, not bound: ADR "${adr[0].label}" (${adr[0].id}): bind it instead of importing the pack again`)
    expect(block).not.toContain('Questions:')

    await add('add_relation', { sourceId: adr[0].id, targetId: ids.get('web'), relationType: 'constrains' })
    const bound = (await model.call('get_issues', {})).text
    expect(bound).not.toContain('Unbound decisions')
    expect(bound).not.toContain('- Authentication (conceptId concern-authentication)')
  })
})
