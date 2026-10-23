// The special key offers "inside" where the card's Parent field does not (parentCandidates):
//  external: Bookstore fixture, Containers view. API's card lists Parent: — / Bookstore (no external
//            Payment Provider). Select API, hold Alt: Payment Provider reads "uses · inside"; a drop
//            on "inside" nests API in the external system.
//  group:    Bookstore + a root group "Zone" and a group "Front" in Bookstore holding Web App. Select
//            Front, hold Alt: Zone reads "inside"; the drop on it is refused ("Action blocked").
// Args: [port=4578] [external|group]
import * as L from './lib.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = Number(process.argv[2] ?? 4578), kind = process.argv[3] ?? 'external'
const { browser, context, page, problems } = await L.launch({ port })
try {
  const doc = JSON.parse(readFileSync(join(L.REPO, 'apps/e2e/fixtures/bookstore.radical'), 'utf8'))
  let src = 'api', target = 'payments'
  if (kind === 'group') {
    doc.nodes.push({ id: 'zone', type: 'group', label: 'Zone', x: 960, y: -60, width: 320, height: 220, collapsed: false })
    doc.nodes.push({ id: 'front', type: 'group', label: 'Front', parentId: 'bookstore', x: 10, y: 60, width: 250, height: 230, collapsed: false })
    const web = doc.nodes.find((n) => n.id === 'web'); web.parentId = 'front'; web.x = 20; web.y = 60
    doc.views.find((v) => v.id === 'v-containers').nodeIds.push('zone', 'front')
    src = 'front'; target = 'zone'
  }
  const id = 'run178-doc'
  await context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, JSON.stringify(doc)])
  await L.open(page, id, 'v-containers'); await L.wait(page, 2000)
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  if ((await focus.getAttribute('aria-pressed')) !== 'false') await focus.click()
  await page.getByRole('button', { name: 'Fit All', exact: true }).click(); await L.wait(page, 1000)
  // The card's Parent field: where the card lets it go.
  const sb0 = await L.node(page, src).boundingBox()
  const sb = { x: sb0.x, y: kind === 'group' ? sb0.y + sb0.height - 24 : sb0.y }
  await page.mouse.dblclick(sb.x + 30, sb.y + 12); await L.wait(page, 800)
  const options = await page.locator('.right-panel.open').getByLabel('Parent', { exact: true }).locator('option').allTextContents()
  console.log(`card's Parent options for ${src}:`, options)
  await page.keyboard.press('Escape'); await L.wait(page, 300)
  await page.mouse.click(sb.x + 30, sb.y + 12); await L.wait(page, 600)
  await page.keyboard.down('Alt'); await L.wait(page, 400)
  const pills = await page.locator('.connect-pills').evaluateAll((e) => e.map((x) => `${x.dataset.connectOver}: ${[...x.children].map((c) => c.textContent).join(' · ')}`))
  console.log('special key pills:', pills)
  await L.shot(page, `f3-${kind}-pills`)
  const b = sb, t = await L.node(page, target).boundingBox()
  await page.mouse.move(b.x + 30, b.y + 12); await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 }); await L.wait(page, 300)
  const pill = page.locator(`.connect-pill[data-connect-target="${target}"][data-connect-type="@inside"]`)
  const pb = await pill.boundingBox()
  if (pb) await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 4 })
  await page.mouse.up(); await page.keyboard.up('Alt'); await L.wait(page, 2500)
  await L.shot(page, `f3-${kind}-after`)
  const notes = await page.locator('[class*=notif], [class*=toast]').allInnerTexts()
  console.log('notices:', [...new Set(notes.map((n) => n.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 3))
  const d = await L.stored(page, id)
  console.log(`${src} is now in:`, d.nodes.find((n) => n.id === src).parentId)
} finally { console.log('problems', problems); await browser.close() }
