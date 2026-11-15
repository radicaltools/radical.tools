// A stdio client of the repository's built MCP server on a folder.
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { repoRoot } from './flib.mjs'

export async function mcp(folder, cwd) {
  const client = new Client({ name: 'run-218', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(repoRoot(), 'apps/mcp/dist/index.js'), '--folder', folder], ...(cwd ? { cwd } : {}), stderr: 'ignore' }))
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args }, { timeout: 600_000 })
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    return { ok: !r.isError, text }
  }
  return { client, call, close: () => client.close() }
}
