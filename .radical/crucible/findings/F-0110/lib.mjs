// Helpers for run 208: the repository found by walking up to .radical/crucible/crucible.json.
import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, '.radical/crucible/crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('crucible.json not found'); d = p }
  return d
}
export const REPO = repoRoot()
const clientMod = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs')).href)
const stdioMod = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs')).href)
/** A stdio MCP client of the repository's built server on `folder`. */
export async function mcp(folder, cwd = DIR) {
  const client = new clientMod.Client({ name: 'crucible-208', version: '1.0.0' })
  await client.connect(new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', folder], cwd, stderr: 'pipe' }))
  return {
    call: async (name, args = {}) => {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 600_000 })
      return { ok: !res.isError, text: res.content.map((c) => c.text).join('\n') }
    },
    tools: async () => (await client.listTools()).tools,
    close: () => client.close(),
  }
}
/** A fresh git repository at `dir` (its own .git, so nothing reaches the
 *  outer repository) holding a model folder at .radical/model. `model` is
 *  a model folder to copy, or null for none (the server makes a new one). */
export function freshRepo(dir, model = null) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  if (model) {
    mkdirSync(join(dir, '.radical'), { recursive: true })
    cpSync(model, join(dir, '.radical/model'), { recursive: true, filter: (src) => !/\/\.state(\/|$)/.test(src) })
  }
  return join(dir, '.radical/model')
}
export function commitAll(dir) {
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['-c', 'user.email=r@x', '-c', 'user.name=r', 'commit', '-qm', 'base', '--allow-empty'], { cwd: dir })
}
