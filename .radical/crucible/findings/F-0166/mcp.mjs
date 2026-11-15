// A stdio MCP client against the repository's built server, on a folder in this run's folder.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REPO } from './lib.mjs'
const { Client } = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs')).href)
const { StdioClientTransport } = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs')).href)
export async function connect(folder) {
  const client = new Client({ name: 'run211', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', folder], stderr: 'ignore' }))
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 })
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    return { error: !!r.isError, text }
  }
  return { client, call, close: () => client.close() }
}
