import { mkdirSync, writeFileSync } from 'node:fs'
import { expect } from '../../support/fixtures'
import { ModelFolder, test } from '../../support/folder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

// How long a view of a real model takes to open. Not part of the suite: it
// runs only with BENCH_MODEL set to a Markdown model folder (see README).
//   BENCH_VIEW  the view to open (default: Structure view, the whole model)
//   BENCH_FROM  the view to start each run from (default: the first view)
//   BENCH_RUNS  runs (default 5)
//   BENCH_OUT   a folder for the samples and a CPU profile of the last run

const MODEL = process.env.BENCH_MODEL
const VIEW = process.env.BENCH_VIEW ?? 'Structure view'
const RUNS = Number(process.env.BENCH_RUNS ?? 5)
const OUT = process.env.BENCH_OUT

interface Sample { openMs: number; quietMs: number; longTasks: number; longTaskMs: number; maxTaskMs: number; nodes: number }

test.skip(!MODEL, 'set BENCH_MODEL to a model folder to run the benchmark')

test('bench: opening a view', async ({ page, studio }) => {
  test.setTimeout(30 * 60_000)
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(await new MdFolderSession(diskFolderStorage(MODEL!)).readAll())) await folder.write(path, content)
  await page.goto('/')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await page.setViewportSize({ width: 1440, height: 900 })
  const card = (name: string) => page.locator('.lp-view-card').filter({ has: page.locator('.lp-card-title', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
  const from = process.env.BENCH_FROM ? card(process.env.BENCH_FROM) : page.locator('.lp-view-card').nth(1)

  const cdp = OUT ? await page.context().newCDPSession(page) : undefined
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }) }
  const samples: Sample[] = []
  for (let run = 0; run < RUNS; run++) {
    await from.click()
    await page.waitForTimeout(2500)
    const last = run === RUNS - 1
    if (cdp && last) await cdp.send('Profiler.start')
    // From the click until the view is drawn and the main thread has been
    // free of long tasks (> 50 ms) for 1.5 s.
    const sample = await page.evaluate((name) => new Promise<Sample>((resolve) => {
      const tasks: { start: number; dur: number }[] = []
      const observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push({ start: e.startTime, dur: e.duration }) })
      observer.observe({ type: 'longtask', buffered: false })
      const target = [...document.querySelectorAll('.lp-view-card')].find((el) => el.querySelector('.lp-card-title')?.textContent === name) as HTMLElement
      const t0 = performance.now()
      let drawn = -1
      target.click()
      const poll = () => {
        const now = performance.now()
        const nodes = document.querySelectorAll('.react-flow__node, .tv-table tr, .wiki-article').length
        if (drawn < 0 && nodes > 0) drawn = now - t0
        const lastEnd = tasks.reduce((m, t) => Math.max(m, t.start + t.dur), t0)
        if ((drawn >= 0 && now - lastEnd > 1500) || now - t0 > 300_000) {
          observer.disconnect()
          resolve({ openMs: Math.round(drawn), quietMs: Math.round(lastEnd - t0), longTasks: tasks.length,
            longTaskMs: Math.round(tasks.reduce((s, t) => s + t.dur, 0)), maxTaskMs: Math.round(tasks.reduce((m, t) => Math.max(m, t.dur), 0)), nodes })
        } else setTimeout(poll, 50)
      }
      setTimeout(poll, 0)
    }), VIEW)
    if (cdp && last) {
      const { profile } = await cdp.send('Profiler.stop')
      mkdirSync(OUT!, { recursive: true })
      writeFileSync(`${OUT}/open-view.cpuprofile`, JSON.stringify(profile))
    }
    console.log(`run ${run + 1}: ${JSON.stringify(sample)}`)
    samples.push(sample)
  }
  const median = (k: keyof Sample) => [...samples].map((s) => s[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)]
  console.log(`${VIEW}: median ${median('quietMs')} ms until quiet, ${median('openMs')} ms until drawn, longest task ${median('maxTaskMs')} ms`)
  if (OUT) writeFileSync(`${OUT}/samples.json`, JSON.stringify({ model: MODEL, view: VIEW, samples }, null, 1))
})
