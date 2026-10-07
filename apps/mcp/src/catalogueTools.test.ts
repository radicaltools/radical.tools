import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { drawnSize } from '@radical/layout/geometry'

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

async function connect(): Promise<{ client: Client; folder: string; read: () => Promise<ReturnType<typeof deserializeFromMdFolder>['data']> }> {
  const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-doc-'))
  folders.push(folder)
  const files = serializeToMdFolder({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, 'MCP docs')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true })
    await writeFile(join(folder, path), content)
  }
  const client = new Client({ name: 'radical-test', version: '1.0.0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder],
  }))
  const read = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
  return { client, folder, read }
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const result = await client.callTool({ name, arguments: args })
  const text = JSON.stringify(result.content)
  expect(result.isError, `${name}: ${text}`).not.toBe(true)
  return text
}

describe('MCP document tools', () => {
  it('lays out one view into its own positions and builds a presentation over it', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'add_node', { tempId: 'user', type: 'person', label: 'Buyer' })
      await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
      await call(client, 'add_node', { tempId: 'bank', type: 'system', label: 'Bank' })
      await call(client, 'add_relation', { sourceId: 'user', targetId: 'shop', relationType: 'interacts', label: 'Orders' })
      await call(client, 'add_relation', { sourceId: 'shop', targetId: 'bank', relationType: 'interacts', label: 'Charges' })
      await call(client, 'create_view', { tempId: 'ctx', name: 'Context', nodeIds: ['user', 'shop', 'bank'] })
      const before = await read()
      const view = before.views![0]

      const laidOut = await call(client, 'smart_layout', { viewId: view.id })
      expect(laidOut).toContain('Smart Layout (Context)')
      const after = await read()
      // The model's own (All elements) positions are untouched; the view got its own.
      expect(after.nodes.map((n) => [n.x, n.y])).toEqual(before.nodes.map((n) => [n.x, n.y]))
      const positions = after.views![0].positions
      expect(Object.keys(positions).sort()).toEqual(after.nodes.map((n) => n.id).sort())

      await call(client, 'create_presentation', { name: 'Pitch', slides: [{ name: 'Overview' }, { name: 'Context', viewId: view.id }] })
      const presented = await read()
      const pitch = presented.presentations!.find((p) => p.name === 'Pitch')!
      expect(pitch.slides).toEqual([
        expect.objectContaining({ name: 'Overview', viewId: null, viewport: { x: 0, y: 0, zoom: 0 } }),
        expect.objectContaining({ name: 'Context', viewId: view.id }),
      ])
      await call(client, 'update_presentation', { id: pitch.id, slides: [{ id: pitch.slides[1].id, name: 'Context only', viewId: view.id }] })
      expect((await read()).presentations!.find((p) => p.id === pitch.id)!.slides).toEqual([expect.objectContaining({ id: pitch.slides[1].id, name: 'Context only' })])

      const summary = await call(client, 'get_model_summary', {})
      expect(summary).toContain('Pitch')
      const bad = await client.callTool({ name: 'smart_layout', arguments: { viewId: 'nope' } })
      expect(bad.isError).toBe(true)
    } finally {
      await client.close()
    }
  }, 60_000)

  it('keeps alignments through Smart Layout, per canvas, and removes them', async () => {
    const { client, read } = await connect()
    try {
      for (const [tempId, type, label] of [['user', 'person', 'Buyer'], ['shop', 'system', 'Shop'], ['bank', 'system', 'Bank'], ['mail', 'system', 'Mail']]) {
        await call(client, 'add_node', { tempId, type, label })
      }
      await call(client, 'add_relation', { sourceId: 'user', targetId: 'shop', relationType: 'interacts' })
      await call(client, 'add_relation', { sourceId: 'shop', targetId: 'bank', relationType: 'interacts' })
      await call(client, 'add_relation', { sourceId: 'shop', targetId: 'mail', relationType: 'interacts' })
      await call(client, 'create_view', { tempId: 'ctx', name: 'Context' })
      expect(await call(client, 'align_nodes', { nodeIds: ['user', 'bank', 'mail'], axis: 'horizontal' })).toContain('Alignment ID')
      await call(client, 'align_nodes', { nodeIds: ['user', 'shop'], axis: 'vertical', viewId: 'ctx' })
      const refused = await client.callTool({ name: 'align_nodes', arguments: { nodeIds: ['user', 'bank'], axis: 'horizontal' } })
      expect(JSON.stringify(refused.content)).toContain('already in one row')

      await call(client, 'smart_layout', {})
      await call(client, 'smart_layout', { viewId: 'ctx' })
      const data = await read()
      expect(data.defaultLayoutConstraints).toEqual([expect.objectContaining({ axis: 'horizontal', nodeIds: expect.any(Array) })])
      const byLabel = Object.fromEntries(data.nodes.map((n) => [n.label, n]))
      // Centres as the canvas draws them: a system without children is drawn smaller.
      const centreY = (label: string) => byLabel[label].y + drawnSize(byLabel[label], false).height / 2
      expect(Math.abs(centreY('Buyer') - centreY('Bank'))).toBeLessThanOrEqual(0.5)
      expect(Math.abs(centreY('Buyer') - centreY('Mail'))).toBeLessThanOrEqual(0.5)
      const view = data.views![0]
      expect(view.layoutConstraints).toEqual([expect.objectContaining({ axis: 'vertical' })])
      const centreX = (label: string) => view.positions[byLabel[label].id].x + drawnSize(byLabel[label], false).width / 2
      expect(Math.abs(centreX('Buyer') - centreX('Shop'))).toBeLessThanOrEqual(0.5)
      expect(await call(client, 'get_model_summary', {})).toContain('allElementsAlignments')

      await call(client, 'remove_alignment', { nodeIds: ['user', 'shop'], viewId: view.id })
      await call(client, 'delete_node', { id: byLabel.Mail.id })
      const after = await read()
      expect(after.views![0].layoutConstraints).toEqual([])
      expect(after.defaultLayoutConstraints![0].nodeIds.sort()).toEqual([byLabel.Buyer.id, byLabel.Bank.id].sort())
    } finally {
      await client.close()
    }
  }, 90_000)

  it('keeps an ordered row in the order given through Smart Layout', async () => {
    const { client, read } = await connect()
    try {
      for (const [tempId, label] of [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma'], ['hub', 'Hub']]) {
        await call(client, 'add_node', { tempId, type: 'system', label })
      }
      // The relations would rather put Gamma first.
      await call(client, 'add_relation', { sourceId: 'c', targetId: 'hub', relationType: 'interacts' })
      await call(client, 'add_relation', { sourceId: 'hub', targetId: 'a', relationType: 'interacts' })
      expect(await call(client, 'align_nodes', { nodeIds: ['a', 'b', 'c'], axis: 'horizontal', keepOrder: true })).toContain('in the order given')
      const refused = await client.callTool({ name: 'align_nodes', arguments: { nodeIds: ['c', 'a'], axis: 'horizontal', keepOrder: true } })
      expect(JSON.stringify(refused.content)).toContain('contradicts')
      await call(client, 'smart_layout', {})
      const data = await read()
      expect(data.defaultLayoutConstraints).toEqual([expect.objectContaining({ ordered: true })])
      const byLabel = Object.fromEntries(data.nodes.map((n) => [n.label, n]))
      const centreX = (label: string) => byLabel[label].x + drawnSize(byLabel[label], false).width / 2
      expect(centreX('Alpha')).toBeLessThan(centreX('Beta'))
      expect(centreX('Beta')).toBeLessThan(centreX('Gamma'))
    } finally {
      await client.close()
    }
  }, 90_000)

  it('keeps a grid through Smart Layout', async () => {
    const { client, read } = await connect()
    try {
      const names = ['One', 'Two', 'Three', 'Four', 'Five']
      for (const label of names) await call(client, 'add_node', { tempId: label, type: 'system', label })
      await call(client, 'add_relation', { sourceId: 'Five', targetId: 'One', relationType: 'interacts' })
      await call(client, 'add_relation', { sourceId: 'Four', targetId: 'Two', relationType: 'interacts' })
      expect(await call(client, 'grid_nodes', { nodeIds: names })).toContain('grid of 3 columns')
      await call(client, 'smart_layout', {})
      const data = await read()
      expect(data.defaultLayoutConstraints).toEqual([expect.objectContaining({ type: 'grid', columns: 3 })])
      const byLabel = Object.fromEntries(data.nodes.map((n) => [n.label, n]))
      const c = (label: string) => {
        const n = byLabel[label]
        const size = drawnSize(n, false)
        return { x: n.x + size.width / 2, y: n.y + size.height / 2 }
      }
      // One Two Three / Four Five
      expect(Math.abs(c('One').y - c('Three').y)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(c('One').x - c('Four').x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(c('Two').x - c('Five').x)).toBeLessThanOrEqual(0.5)
      expect(c('One').x).toBeLessThan(c('Two').x)
      expect(c('Two').x).toBeLessThan(c('Three').x)
      expect(c('One').y).toBeLessThan(c('Four').y)
      await call(client, 'remove_alignment', { nodeIds: names })
      expect((await read()).defaultLayoutConstraints).toBeUndefined()
    } finally {
      await client.close()
    }
  }, 90_000)

  it('copies a built-in metamodel on the first edit, persists it and refreshes tool schemas', async () => {
    const { client, read } = await connect()
    try {
      const enumOf = async () => {
        const tools = await client.listTools()
        const addNode = tools.tools.find((t) => t.name === 'add_node')!
        return (addNode.inputSchema as unknown as { properties: { type: { enum: string[] } } }).properties.type.enum
      }
      expect(await enumOf()).not.toContain('risk')
      const added = await call(client, 'upsert_node_type', {
        id: 'risk', label: 'Risk', baseType: 'adr', tableTab: true, allowedParents: ['system'], allowedAtRoot: true,
        properties: [{ key: 'severity', label: 'Severity', type: 'enum', options: ['low', 'high'] }],
      })
      expect(added).toContain('copied to the custom metamodel')
      expect(await enumOf()).toContain('risk')

      await call(client, 'upsert_relation_type', { id: 'mitigates', label: 'Mitigates', allowedPairs: [{ from: 'adr', to: 'risk' }] })
      await call(client, 'add_node', { tempId: 'r', type: 'risk', label: 'Data loss', properties: { severity: 'high' } })
      await call(client, 'add_node', { tempId: 'a', type: 'adr', label: 'Backups' })
      await call(client, 'add_relation', { sourceId: 'a', targetId: 'r', relationType: 'mitigates' })

      const data = await read()
      expect(data.metamodel).toMatchObject({ id: 'c4-ddd-governance-custom' })
      // Reloading keeps the custom metamodel (a built-in id would be swapped for the preset).
      expect(createModelFacade(data).getMetamodel!()!.nodeTypes.risk).toMatchObject({ label: 'Risk', tableTab: true })
      expect(data.nodes.find((n) => n.label === 'Data loss')).toMatchObject({ type: 'risk', severity: 'high' })

      const inUse = await client.callTool({ name: 'delete_node_type', arguments: { id: 'risk' } })
      expect(inUse.isError).toBe(true)
      const builtin = await client.callTool({ name: 'delete_relation_type', arguments: { id: 'interacts' } })
      expect(builtin.isError).toBe(true)
    } finally {
      await client.close()
    }
  }, 60_000)
})
