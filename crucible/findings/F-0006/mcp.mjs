// A stdio MCP client against the repository's built server, on a folder.
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SERVER, CLI } from './root.mjs'
export { SERVER, CLI }
export async function connect(folder) {
  const client = new Client({ name: 'run-174', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER, '--folder', folder], stderr: 'ignore' }))
  const call = async (name, args = {}, { allowError = false } = {}) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 })
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    if (r.isError && !allowError) throw new Error(`${name}: ${text}`)
    return allowError ? { text, isError: !!r.isError } : text
  }
  return { client, call, close: () => client.close() }
}
