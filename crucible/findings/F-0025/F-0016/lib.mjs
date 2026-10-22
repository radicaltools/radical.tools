// Harness for run 166: Studio (web build, OPFS folder) + the MCP server on a disk mirror.
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = '/Volumes/data/Dev/rd-cli'
const require = createRequire(join(REPO, 'package.json'))
const { chromium } = require('playwright')
export const RUN = dirname(fileURLToPath(import.meta.url))
export const BASE = 'http://localhost:4575'
const clientMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/index.mjs'))
const stdioMod = await import(join(REPO, 'node_modules/@modelcontextprotocol/client/dist/stdio.mjs'))

export const fixture = (name) => require('node:fs').readFileSync(join(REPO, 'apps/e2e/fixtures', `${name}.radical`), 'utf8')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function startBrowser({ width = 1600, height = 900 } = {}) {
  await mkdir(join(RUN, 'tmp'), { recursive: true })
  const profile = await mkdtemp(join(RUN, 'tmp', 'profile-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height } })
  const page = context.pages()[0] ?? await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) ; if (/smartLayout|merge/i.test(m.text())) errors.push('[log] ' + m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await page.addInitScript((name) => {
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, 'model')
  const close = async () => { await context.close(); await rm(profile, { recursive: true, force: true }) }
  return { context, page, errors, close }
}

export async function seed(page, json, id = 'e2e-doc') {
  await page.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, json])
}

export async function ready(page) {
  await page.locator('.react-flow__node, .tv-table, table').first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
}

export async function open(page, view, mode = 'designer', docId = 'e2e-doc') {
  await page.goto(`${BASE}/#/d/${encodeURIComponent(`ls:${docId}`)}/m/${mode}/v/${view}`)
  await ready(page)
}

export async function saveAsFolder(page) {
  await page.getByRole('button', { name: 'Models', exact: true }).click()
  await page.getByRole('menuitem', { name: /Manage models/ }).click()
  const models = page.getByRole('dialog', { name: 'Models' })
  await models.waitFor()
  await page.getByRole('button', { name: 'Actions for E2E' }).click()
  await page.getByRole('menuitem', { name: 'Move to a folder…' }).click()
  await models.locator('.docmgr-badge.md').waitFor()
  await models.getByRole('button', { name: 'Close' }).click()
  await waitFor(async () => Object.keys(await opfsFiles(page)).some((p) => p.startsWith('nodes/')), 15000)
}

export async function waitFor(fn, timeout = 10000, every = 250) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await fn()) return true; await sleep(every) }
  return false
}

export async function opfsFiles(page, name = 'model') {
  return page.evaluate(async (name) => {
    const out = {}
    const walk = async (dir, prefix) => {
      for await (const [n, e] of dir) {
        const rel = prefix ? `${prefix}/${n}` : n
        try {
          if (e.kind === 'directory') await walk(e, rel)
          else out[rel] = await (await e.getFile()).text()
        } catch (err) { if (err.name !== 'NotFoundError') throw err }
      }
    }
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    await walk(root, '')
    return out
  }, name)
}

export async function opfsWrite(page, path, content, name = 'model') {
  await page.evaluate(async ([name, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, path, content])
}

export async function opfsRemove(page, path, name = 'model') {
  await page.evaluate(async ([name, rel]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
    await dir.removeEntry(parts.at(-1))
  }, [name, path])
}

async function diskFiles(root) {
  const out = {}
  const walk = async (dir, prefix) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) await walk(join(dir, e.name), rel)
      else out[rel] = await readFile(join(dir, e.name), 'utf8')
    }
  }
  await walk(root, '')
  return out
}

/** An MCP "agent" on a disk mirror of the OPFS folder. Each call: copy OPFS → disk, call, copy changes back. */
export async function agent(page) {
  const disk = await mkdtemp(join(RUN, 'tmp', 'disk-'))
  let client = null
  const syncDown = async () => {
    await rm(disk, { recursive: true, force: true }); await mkdir(disk, { recursive: true })
    const files = await opfsFiles(page)
    for (const [p, c] of Object.entries(files)) { await mkdir(dirname(join(disk, p)), { recursive: true }); await writeFile(join(disk, p), c) }
    return files
  }
  const connect = async () => {
    client = new clientMod.Client({ name: 'claude-code', version: '1.0.0' })
    const transport = new stdioMod.StdioClientTransport({ command: process.execPath, args: [join(REPO, 'apps/mcp/dist/index.js'), '--folder', disk], stderr: 'pipe' })
    await client.connect(transport)
  }
  const call = async (name, args = {}) => {
    const before = await syncDown()
    await connect()
    let res
    try { res = await client.callTool({ name, arguments: args }) } finally { await client.close() }
    const after = await diskFiles(disk)
    for (const [p, c] of Object.entries(after)) if (c !== before[p]) await opfsWrite(page, p, c)
    for (const p of Object.keys(before)) if (!(p in after)) await opfsRemove(page, p).catch(() => {})
    const text = res.content.map((c) => c.text).join('\n')
    return { ok: !res.isError, text }
  }
  return { call, disk, close: async () => rm(disk, { recursive: true, force: true }) }
}

export async function shot(page, name) {
  await mkdir(join(RUN, 'shots'), { recursive: true })
  await page.screenshot({ path: join(RUN, 'shots', name) })
}

/** "N nodes · M relations" from the search bar, if shown. */
export async function counts(page) {
  return page.evaluate(() => {
    const t = document.body.innerText.match(/(\d+) nodes? · (\d+) relations?/)
    return t ? { nodes: +t[1], relations: +t[2] } : null
  })
}

export const nodeIds = (page) => page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
export async function boxes(page) {
  return page.locator('.react-flow__node').evaluateAll((els) => Object.fromEntries(els.map((e) => {
    const r = e.getBoundingClientRect(); return [e.getAttribute('data-id'), { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }]
  })))
}
export async function notices(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role=status], [role=alert], .toast, .notice, .snackbar')].map((e) => e.innerText.trim()).filter(Boolean))
}

// run 175: the activity rail replaced the accordion and the Radical menu.
export async function railTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') { await tab.click(); await page.waitForTimeout(300) }
}
