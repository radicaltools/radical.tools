import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { AGENT_ACTIVITY_FILE, parseAgentActivity } from '@radical/common/formats/agentActivity'
import { version } from '../package.json'

const SERVER = join(import.meta.dirname, '../dist/index.js')
/** The version a build shows: bare on the release tag, with the commit otherwise. */
const SHOWN = new RegExp(`^${version.replace(/\./g, '\\.')}(\\+[0-9a-f]{7,})?$`)

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

describe('radical-mcp version', () => {
  it('says its version in get_model_summary, the handshake and --version, and records it with each write', async () => {
    const printed = execFileSync(process.execPath, [SERVER, '--version'], { encoding: 'utf8' }).trim()
    expect(printed).toMatch(SHOWN)

    const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-version-'))
    folders.push(folder)
    for (const [path, content] of Object.entries(serializeToMdFolder({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, 'Version'))) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const client = new Client({ name: 'radical-test', version: '1.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER, '--folder', folder] }))
    try {
      expect(client.getServerVersion()?.version).toBe(printed)

      const summary = await client.callTool({ name: 'get_model_summary', arguments: {} })
      const text = (summary.content as Array<{ text: string }>).map((c) => c.text).join('')
      expect(JSON.parse(text.split('\n\n')[0])).toMatchObject({ radicalVersion: printed, modelFormat: 1 })

      await client.callTool({ name: 'add_node', arguments: { tempId: 'shop', type: 'system', label: 'Shop' } })
      const activity = parseAgentActivity(await readFile(join(folder, AGENT_ACTIVITY_FILE), 'utf8'))
      expect(activity).toMatchObject({ client: 'radical-test', radical: printed })
    } finally {
      await client.close()
    }
  }, 60_000)
})
