// A stdio MCP client on a disk folder (no browser).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { REPO } from './lib.mjs'
const clientMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs'))
const stdioMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs'))
export async function mcp(folder) {
  const client = new clientMod.Client({ name: 'claude-code', version: '1.0.0' })
  await client.connect(new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', folder], stderr: 'pipe' }))
  return {
    call: async (name, args = {}) => {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 })
      return { ok: !res.isError, text: res.content.map((c) => c.text).join('\n') }
    },
    close: () => client.close(),
  }
}
export function writeFolder(folder, files) {
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(folder, p)), { recursive: true }); writeFileSync(join(folder, p), t) }
}
