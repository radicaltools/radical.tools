// Helpers for run 210. The repository is found by walking up to .radical/crucible/crucible.json.
import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
export const DIR = dirname(fileURLToPath(import.meta.url))
export function repoRoot() {
  let d = DIR
  while (!existsSync(join(d, '.radical/crucible/crucible.json'))) { const p = dirname(d); if (p === d) throw new Error('crucible.json not found above ' + DIR); d = p }
  return d
}
export const REPO = repoRoot()
const clientMod = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs')).href)
const stdioMod = await import(pathToFileURL(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs')).href)
/** A fresh model folder work/<name>/model; an empty .git in work/<name> makes that its repository,
 *  so radical check reads no .radical/radical.json of the repository around the run. */
export function freshFolder(name) {
  const root = join(DIR, 'work', name)
  rmSync(root, { recursive: true, force: true }); mkdirSync(join(root, '.git'), { recursive: true })
  const f = join(root, 'model'); mkdirSync(f, { recursive: true })
  return f
}
export async function mcp(folder) {
  const client = new clientMod.Client({ name: 'claude-code', version: '1.0.0' })
  await client.connect(new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', folder], stderr: 'pipe' }))
  return {
    call: async (name, args = {}) => {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 600_000 })
      return { ok: !res.isError, text: res.content.map((c) => c.text).join('\n') }
    },
    close: () => client.close(),
  }
}
/** radical <args> from the CLI built in the repository; returns { code, out }. */
export function cli(args, cwd = DIR) {
  try { return { code: 0, out: execFileSync(process.execPath, [join(REPO, 'apps/cli/dist/index.js'), ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? '') } }
}
export async function chromium() {
  return (await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)).chromium
}
export async function launch({ port = 4519, width = 1280, height = 720 } = {}) {
  const browser = await (await chromium()).launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  return { browser, context, page, problems }
}
export const out = (o) => console.log(JSON.stringify(o, null, 1))
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
/** Every file of a folder on disk: relative path -> text. */
export function readTree(dir, prefix = '') {
  const out = {}
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); const rel = prefix ? `${prefix}/${n}` : n
    if (statSync(p).isDirectory()) Object.assign(out, readTree(p, rel)); else out[rel] = readFileSync(p, 'utf8')
  }
  return out
}
/** A persistent profile whose directory picker hands out OPFS folder `name`. */
export async function launchFolder({ port = 4519, width = 1280, height = 720, name = 'model' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run219-'))
  const context = await (await chromium()).launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = context.pages()[0] ?? await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await page.addInitScript(() => { try { if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true })) } catch {} })
  await page.addInitScript((name) => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }) }, name)
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { context, page, problems, close }
}
export async function opfsWrite(page, path, content, name = 'model') {
  await page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, path, content])
}
export async function opfsFiles(page, name = 'model') {
  return page.evaluate(async (name) => {
    const out = {}
    const walk = async (dir, prefix) => { for await (const [n, e] of dir) { const rel = prefix ? `${prefix}/${n}` : n; try { if (e.kind === 'directory') await walk(e, rel); else out[rel] = await (await e.getFile()).text() } catch {} } }
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true }), '')
    return out
  }, name)
}
/** Open the OPFS folder through Open → Folder… */
export async function openFolder(page) {
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await page.locator('.app-layout').waitFor()
  await page.waitForTimeout(1500)
}
