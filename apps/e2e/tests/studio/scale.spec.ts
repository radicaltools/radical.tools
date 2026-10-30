import { mkdirSync, writeFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { repeatModel } from '../../support/repeatModel'

// How Studio copes with a large model: opening the folder, switching views,
// zooming, selecting, renaming, searching. Not part of the suite: it runs only
// with SCALE_MODEL set to a Markdown model folder.
//   SCALE_COPIES  the model repeated this many times (14: radical.tools' own
//                 model becomes 21,000 elements)
//   SCALE_VIEWS   views to open, comma-separated (default: a mix of kinds)
//   SCALE_CANVAS  the canvas view for zoom, select and rename
//   SCALE_REOPEN  open the folder again from the cache Studio wrote
//                 (SCALE_NO_CACHE=1: with the cache deleted first)
//   SCALE_HEAP    the heap after each view; SCALE_ONLY_OPEN stops after opening
//   SCALE_OUT     a folder for the results: results.json, metrics.json (what the
//                 nightly workflow senses) and CPU profiles with SCALE_PROFILE=1

const MODEL = process.env.SCALE_MODEL
const VIEWS = (process.env.SCALE_VIEWS ?? 'All elements,Domain model,Components,System context,Traceability,Specification,Container dependencies,Decisions,CLI').split(',')
const CANVAS = process.env.SCALE_CANVAS ?? 'Components'
const OUT = process.env.SCALE_OUT

interface Stats { ms: number; longTasks: number; longTaskMs: number; maxTaskMs: number; frames: number; p95FrameMs: number; maxFrameMs: number; seen?: boolean; inputMaxMs?: number; inputs?: string; shown?: number }

test.skip(!MODEL, 'set SCALE_MODEL to a model folder to run the benchmark')

/** Records long tasks and frame gaps from `start` until the main thread has
 *  been free of long tasks for 1 s (or `until` holds and it is quiet). */
async function arm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __perf?: unknown }
    const tasks: { start: number; dur: number }[] = []
    const frames: number[] = []
    const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push({ start: e.startTime, dur: e.duration }) })
    observer.observe({ type: 'longtask', buffered: false })
    // Input to the next paint, per keystroke and click (what INP measures).
    const events: { name: string; dur: number }[] = []
    const inputs = new PerformanceObserver((list) => { for (const e of list.getEntries()) events.push({ name: e.name, dur: e.duration }) })
    inputs.observe({ type: 'event', durationThreshold: 16, buffered: false } as PerformanceObserverInit)
    const t0 = performance.now()
    let last = t0
    let on = true
    const tick = (t: number) => { frames.push(t - last); last = t; if (on) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    w.__perf = { t0, tasks, frames, events, stop: () => { on = false; observer.disconnect(); inputs.disconnect() } }
  })
}

async function settle(page: Page, selector?: string): Promise<Stats> {
  return page.evaluate((sel) => new Promise<Stats>((resolve) => {
    const p = (window as unknown as { __perf: { t0: number; tasks: { start: number; dur: number }[]; frames: number[]; events: { name: string; dur: number }[]; stop: () => void } }).__perf
    const poll = () => {
      const now = performance.now()
      const lastEnd = p.tasks.reduce((m, t) => Math.max(m, t.start + t.dur), p.t0)
      const ok = !sel || document.querySelector(sel)
      if ((ok && now - lastEnd > 1000) || (!ok && now - lastEnd > 15_000) || now - p.t0 > 60_000) {
        p.stop()
        const f = [...p.frames].sort((a, b) => a - b)
        resolve({
          ms: Math.round(lastEnd - p.t0), longTasks: p.tasks.length,
          longTaskMs: Math.round(p.tasks.reduce((s, t) => s + t.dur, 0)), maxTaskMs: Math.round(p.tasks.reduce((m, t) => Math.max(m, t.dur), 0)),
          frames: f.length, p95FrameMs: Math.round(f[Math.floor(f.length * 0.95)] ?? 0), maxFrameMs: Math.round(f[f.length - 1] ?? 0),
          inputMaxMs: Math.round(p.events.reduce((m, e) => Math.max(m, e.dur), 0)),
          inputs: Object.entries(p.events.reduce((acc, e) => { (acc[e.name] ??= []).push(Math.round(e.dur)); return acc }, {} as Record<string, number[]>)).map(([k, v]) => `${k}:${v.join('/')}`).join(' '),
          seen: !!ok, shown: document.querySelectorAll('.react-flow__node, .tv-table tbody tr, .wiki-title, .mx-table th').length,
        })
      } else setTimeout(poll, 50)
    }
    setTimeout(poll, 0)
  }), selector)
}

test('scale: a large model in Studio', async ({ page, studio }) => {
  test.setTimeout(60 * 60_000)
  const results: Record<string, unknown> = { model: MODEL }
  let step = 'start'
  const log = (name: string, value: unknown) => { results[name] = value; step = `after ${name}`; console.log(`${name}: ${JSON.stringify(value)}`) }
  page.on('console', (msg) => { if (msg.type() === 'error') console.log(`console error (${step}): ${msg.text().slice(0, process.env.SCALE_STACK ? 3000 : 300)}`) })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    const { metrics } = await cdp.send('Performance.getMetrics')
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]))
    return { heapMB: Math.round(m.JSHeapUsedSize / 1e6), domNodes: m.Nodes }
  }
  const profiled = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    if (!process.env.SCALE_PROFILE || !OUT) return run()
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
    await cdp.send('Profiler.start')
    const out = await run()
    const { profile } = await cdp.send('Profiler.stop')
    mkdirSync(OUT, { recursive: true })
    writeFileSync(`${OUT}/${name.replace(/\W+/g, '-')}.cpuprofile`, JSON.stringify(profile))
    return out
  }

  // Errors logged with their stack, to say where they come from.
  await page.addInitScript(() => {
    const error = console.error.bind(console)
    console.error = (...args: unknown[]) => error(...args.map((a) => (a instanceof Error ? a.stack : a)))
  })
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  const files = repeatModel(await new MdFolderSession(diskFolderStorage(MODEL!), { writeCache: false }).readAll(), Number(process.env.SCALE_COPIES ?? 1))
  const entries = Object.entries(files)
  for (let i = 0; i < entries.length; i += 500) {
    await page.evaluate(async ([name, chunk]) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
      const dirs = new Map<string, FileSystemDirectoryHandle>()
      for (const [rel, text] of chunk) {
        const parts = rel.split('/')
        let dir = root
        for (let j = 0; j < parts.length - 1; j++) {
          const key = parts.slice(0, j + 1).join('/')
          dir = dirs.get(key) ?? await dir.getDirectoryHandle(parts[j], { create: true })
          dirs.set(key, dir)
        }
        const writable = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable()
        await writable.write(text)
        await writable.close()
      }
    }, [folder.name, entries.slice(i, i + 500)] as const)
  }
  log('files', entries.length)
  await page.goto('/')
  await page.setViewportSize({ width: 1440, height: 900 })
  log('heap: empty app', await heap())

  // Open the folder.
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await arm(page)
  log('open folder', await profiled('open folder', async () => {
    await page.getByRole('button', { name: 'Folder…' }).click()
    await expect(page.locator('.app-layout')).toBeVisible({ timeout: 600_000 })
    // Loaded when the model's views are listed (and the main thread is quiet).
    await expect.poll(() => page.locator('.lp-view-card').count(), { timeout: 600_000, intervals: [50] }).toBeGreaterThan(10)
    const stats = await settle(page)
    return { ...stats, wallMs: Math.round(await page.evaluate(() => performance.now() - (window as unknown as { __perf: { t0: number } }).__perf.t0)) - 1000 }
  }))
  log('heap: model open', await heap())
  if (process.env.SCALE_REOPEN) {
    // Opened again once Studio has written the folder's cache.
    // Its files and its view index.
    for (const file of ['model.json', 'views.json']) {
      await expect.poll(() => page.evaluate(async ([name, file]) => {
        try {
          const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
          const handle = await (await (await root.getDirectoryHandle('.radical')).getDirectoryHandle('cache')).getFileHandle(file)
          return (await handle.getFile()).size
        } catch { return 0 }
      }, [folder.name, file] as const), { timeout: 600_000, intervals: [500] }).toBeGreaterThan(100)
    }
    if (process.env.SCALE_NO_CACHE) await page.evaluate(async (name) => {
      const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
      await (await root.getDirectoryHandle('.radical')).removeEntry('cache', { recursive: true })
    }, folder.name)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    await arm(page)
    log('open folder from its cache', await profiled('open cached', async () => {
      await page.getByRole('button', { name: 'Folder…' }).click()
      await expect(page.locator('.app-layout')).toBeVisible({ timeout: 600_000 })
      await expect.poll(() => page.locator('.lp-view-card').count(), { timeout: 600_000, intervals: [50] }).toBeGreaterThan(10)
      const stats = await settle(page)
      return { ...stats, wallMs: Math.round(await page.evaluate(() => performance.now() - (window as unknown as { __perf: { t0: number } }).__perf.t0)) - 1000 }
    }))
    log('heap: model open from its cache', await heap())
  }
  if (process.env.SCALE_ONLY_OPEN) return
  await studio.designer()

  const card = (name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
  for (const view of VIEWS) {
    if (!(await card(view).count())) { log(`view ${view}`, 'missing'); continue }
    await arm(page)
    log(`view ${view}`, await profiled(`view ${view}`, async () => { await card(view).click(); return settle(page) }))
    if (process.env.SCALE_HEAP) log(`heap: ${view}`, await heap())
  }

  // Zoom and pan the canvas.
  await card(CANVAS).click()
  await settle(page)
  await studio.settle()
  const box = (await studio.canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await arm(page)
  log(`zoom in ${CANVAS}`, await profiled('zoom', async () => {
    for (let i = 0; i < 15; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30) }
    return settle(page)
  }))
  await arm(page)
  log(`pan ${CANVAS}`, await profiled('pan', async () => {
    await page.mouse.down()
    for (let i = 0; i < 30; i++) await page.mouse.move(box.x + box.width / 2 - i * 15, box.y + box.height / 2 - i * 8)
    await page.mouse.up()
    return settle(page)
  }))
  await arm(page)
  log(`zoom out ${CANVAS}`, await profiled('zoom out', async () => {
    for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(30) }
    return settle(page)
  }))
  await studio.settle()

  // Select an element, open its card, rename it.
  const shot = async (name: string) => { if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` }) }
  await shot('canvas')

  // Quick Search: each keystroke, then the results for the whole query.
  const search = page.locator('.quick-search-bar').getByPlaceholder(/^Search/)
  const query = process.env.SCALE_QUERY ?? 'Smart Layout'
  await search.click()
  await arm(page)
  log('search typing', await profiled('search', async () => {
    await page.keyboard.type(query, { delay: 150 })
    return settle(page, '.quick-search-item')
  }))
  log('search results', await page.locator('.quick-search-item').count())
  await shot('search')
  // A pick selects the element where it is and opens its card.
  await arm(page)
  log('search pick', await profiled('search pick', async () => { await page.locator('.quick-search-item').first().click(); return settle(page, '.right-panel.open') }))
  await shot('picked')

  // Rename it in the card.
  const name = studio.attribute('Name')
  if (await name.count()) {
    const before = await name.inputValue()
    await name.click()
    await arm(page)
    log('rename typing', await profiled('rename typing', async () => { await page.keyboard.type(' x', { delay: 150 }); return settle(page) }))
    await arm(page)
    log('rename commit', await profiled('rename', async () => { await name.press('Tab'); return settle(page) }))
    log('renamed', `${before} -> ${await name.inputValue()}`)
  } else log('rename', 'no Name field')
  await page.keyboard.press('Escape')

  // Click an element on the canvas, then drag it.
  await card(CANVAS).click()
  await settle(page)
  await studio.settle()
  const leaf = await page.evaluate(() => {
    const area = document.querySelector('.canvas-area')?.getBoundingClientRect()
    if (!area) return null
    for (const el of document.querySelectorAll('.react-flow__node')) {
      if (el.querySelector('.react-flow__node')) continue
      const r = el.getBoundingClientRect()
      const x = r.x + Math.min(30, r.width / 2), y = r.y + Math.min(14, r.height / 2)
      if (r.width < 40 || x < area.x + 60 || x > area.right - 420 || y < area.y + 80 || y > area.bottom - 140) continue
      if (!el.contains(document.elementFromPoint(x, y))) continue
      return { id: el.getAttribute('data-id'), x, y }
    }
    return null
  })
  log('leaf', leaf)
  if (leaf) {
    await arm(page)
    log('click element', await profiled('click', async () => { await page.mouse.click(leaf.x, leaf.y); return settle(page, `.react-flow__node.selected[data-id="${leaf.id}"]`) }))
    await shot('clicked')
    await arm(page)
    log('drag element', await profiled('drag', async () => {
      await page.mouse.move(leaf.x, leaf.y)
      await page.mouse.down()
      for (let i = 1; i <= 30; i++) { await page.mouse.move(leaf.x + i * 5, leaf.y + i * 3); await page.waitForTimeout(16) }
      await page.mouse.up()
      return settle(page)
    }))
    await shot('dragged')
  }
  log('heap: end', await heap())
  if (OUT) {
    mkdirSync(OUT, { recursive: true })
    writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
    // What the fitness function Large model stays responsive reads, through
    // radical sense json (the nightly workflow): what a user waits for.
    const step = (name: string) => results[name] as Partial<Stats & { wallMs: number }> | undefined
    const views = Object.entries(results).filter(([k, v]) => k.startsWith('view ') && typeof v === 'object').map(([, v]) => (v as Stats).ms)
    const metrics = {
      open_ms: step('open folder')?.wallMs,
      open_cached_ms: step('open folder from its cache')?.wallMs,
      view_switch_ms: views.length ? Math.max(...views) : undefined,
      search_key_ms: step('search typing')?.inputMaxMs,
      card_key_ms: step('rename typing')?.inputMaxMs,
    }
    writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1))
  }
})
