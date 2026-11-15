// A stdio MCP client on a disk folder (no browser).
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
let repo = dirname(fileURLToPath(import.meta.url))
while (!existsSync(join(repo, '.radical/crucible/crucible.json'))) repo = dirname(repo)
const clientMod = await import(join(repo, 'node_modules/@modelcontextprotocol/client/dist/index.mjs'))
const stdioMod = await import(join(repo, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs'))
export async function mcp(folder) {
  const client = new clientMod.Client({ name: 'claude-code', version: '1.0.0' })
  await client.connect(new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(repo, 'apps/mcp/dist/index.js'), '--folder', folder], stderr: 'pipe' }))
  return {
    call: async (name, args = {}) => {
      const res = await client.callTool({ name, arguments: args }, { timeout: 600_000 })
      return { ok: !res.isError, text: res.content.map((c) => c.text).join('\n') }
    },
    close: () => client.close(),
  }
}
