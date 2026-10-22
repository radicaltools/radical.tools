// A view opened from the card's Views while the rail shows Milestones is not scrolled into sight
// in the list of views when the Views section is opened again.
// arg: "views" keeps the Views section open (control: passes), "milestones" (default) opens Milestones first.
import { launch, seed, open, fixture, tab } from './lib.mjs'
const mode = process.argv[2] ?? 'milestones'
const doc = JSON.parse(fixture('bookstore'))
doc.views.push(...Array.from({ length: 30 }, (_, i) => ({ id: `v-more-${i}`, kind: 'static', name: `More ${String(i).padStart(2, '0')}`, nodeIds: ['customer'], positions: {} })))
const { browser, page, errors } = await launch({ width: 1280, height: 720 })
await seed(page, JSON.stringify(doc))
await open(page, 'v-context', 'designer')
if (mode === 'milestones') { await tab(page, 'Milestones').click(); await page.waitForTimeout(300) }
await page.locator('.react-flow__node[data-id="customer"]').click()
const views = page.locator('.right-panel.open').getByRole('region', { name: 'Views' })
await views.getByRole('button', { name: /^More 29/ }).click()
await page.waitForURL(/\/v\/v-more-29/)
await page.waitForTimeout(500)
if (mode === 'milestones') await tab(page, 'Views').click()
await page.waitForTimeout(600)
const r = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.lp-view-card.active')].find((c) => c.offsetParent)
  if (!card) return { error: 'no visible active card' }
  const list = card.closest('.lp-section-body, .lp-section')?.querySelector(':scope') ?? card.parentElement
  let sc = card.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
  const c = card.getBoundingClientRect(), s = sc.getBoundingClientRect()
  return { card: card.textContent.slice(0, 7), cardTop: Math.round(c.top), cardBottom: Math.round(c.bottom), listTop: Math.round(s.top), listBottom: Math.round(s.bottom), scrollTop: Math.round(sc.scrollTop), inSight: c.top >= s.top - 1 && c.bottom <= s.bottom + 1 }
})
await page.screenshot({ path: `shots/f2-${mode}.png` })
console.log(mode, JSON.stringify(r))
console.log(r.inSight ? 'PASS' : 'FAIL: the active view "More 29" is out of sight in the list of views')
if (errors.length) console.log('errors', errors)
await browser.close()
process.exit(r.inSight ? 0 : 1)
