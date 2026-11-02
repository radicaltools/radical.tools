// While Tidy runs: the toolbar button's width, and what it covers.
import { launch, seedDoc, open, wait, out, shot } from './lib.mjs'
import { bigDoc } from './mkdoc.mjs'
const port = +(process.argv[2] || 4585)
const { browser, context, page, problems } = await launch({ port })
try {
  const id = await seedDoc(context, bigDoc('packages/layout/bench/models/blueprint/bp-ecommerce-platform.radical'))
  await open(page, id, 'big')
  await wait(page, 2500)
  const ctl = async () => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /Fit All|Focus|Smart Layout|Stop/.test(b.getAttribute('aria-label') || b.innerText)).map((b) => { const r = b.getBoundingClientRect(); return { name: (b.getAttribute('aria-label') || b.innerText).slice(0, 25), x: Math.round(r.x), r: Math.round(r.right), w: Math.round(r.width), vis: r.width > 0 } }))
  out({ before: await ctl() })
  await page.getByRole('button', { name: 'Smart Layout', exact: true }).click()
  let widest = null
  for (let i = 0; i < 60; i++) {
    const c = await ctl()
    const s = c.find((b) => /^Stop/.test(b.name))
    if (!s && i > 3) break
    if (s && (!widest || s.w > widest.stop.w)) { widest = { stop: s, all: c }; await shot(page, 'x9-widest') }
    await wait(page, 40)
  }
  out({ widest, viewport: page.viewportSize() })
} finally { await browser.close() }
