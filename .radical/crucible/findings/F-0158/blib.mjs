// Browser helpers for run 217: Studio's web build on a folder in the page's
// OPFS (as apps/e2e/support/folder.ts), in a persistent profile.
import { mkdtempSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REPO } from './lib.mjs'
const { chromium } = await import(pathToFileURL(join(REPO, 'node_modules/playwright/index.mjs')).href)
export async function launchFolder({ port, width = 1280, height = 720, name = 'repo' } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'run217-'))
  const context = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, baseURL: `http://localhost:${port}` })
  const page = context.pages()[0] ?? await context.newPage()
  page.setDefaultTimeout(10000)
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED/.test(m.text())) problems.push(`console.error: ${m.text()}`) })
  await page.route(/^https?:\/\/(?!localhost[:/])/, (r) => r.abort())
  await page.addInitScript((n) => {
    if (!localStorage.getItem('radical-studio-settings')) localStorage.setItem('radical-studio-settings', JSON.stringify({ setupDone: true }))
    window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
  }, name)
  const close = async () => { await context.close(); rmSync(profile, { recursive: true, force: true }) }
  return { close, context, page, problems }
}
export async function writeOpfs(page, rel, text, name = 'repo') {
  await page.evaluate(async ([n, rel, text]) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n, { create: true })
    const parts = rel.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
    const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
    await w.write(text); await w.close()
  }, [name, rel, text])
}
export async function readOpfs(page, rel, name = 'repo') {
  return page.evaluate(async ([n, rel]) => {
    try {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(n)
      const parts = rel.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
      return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text()
    } catch { return null }
  }, [name, rel])
}
/** Copies a folder on disk into OPFS at `prefix` (skipping .state). */
export async function copyToOpfs(page, src, prefix, name = 'repo') {
  const walk = (d, pre) => readdirSync(d).flatMap((e) => {
    const p = join(d, e), r = pre ? `${pre}/${e}` : e
    if (e === '.state') return []
    return statSync(p).isDirectory() ? walk(p, r) : [[r, readFileSync(p, 'utf8')]]
  })
  for (const [r, text] of walk(src, '')) await writeOpfs(page, `${prefix}/${r}`, text, name)
}
