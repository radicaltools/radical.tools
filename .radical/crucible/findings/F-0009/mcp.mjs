// A stdio client of the repository's MCP server on a folder in this run's folder.
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

export async function connect(folder) {
  const client = new Client({ name: 'r172', version: '1.0.0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ['/Volumes/data/Dev/rd-cli/apps/mcp/dist/index.js', '--folder', folder],
    stderr: 'ignore',
  }))
  return client
}

export async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 })
  const text = result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  return { error: !!result.isError, text }
}
