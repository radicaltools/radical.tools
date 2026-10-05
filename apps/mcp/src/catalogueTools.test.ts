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
