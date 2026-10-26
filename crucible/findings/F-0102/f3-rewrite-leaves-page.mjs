// Question. Sample + a wiki "Event-driven requirements" (filter: EARS type is event-driven), on the page of
// "Back within the limit": [rewrite] its sentence as a ubiquitous one. The page gives way to the Overview with
// no word (an add the filter leaves out is announced: "… was added, but this view's filter does not show it"),
// and Undo brings the requirement back but not its page.
// Args: [port=4500]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4500)
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(6000)
const doc = await L.sample(browser)
doc.views.push({ id: 'v-ev', kind: 'wiki', name: 'Event-driven requirements', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }], filters: [{ kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven'] }] }] } })
const id = await L.seedDoc(context, doc)
const R = '1b505a70-45d2-4e79-ae0a-e6b1085aeed5'
const look = async (tag) => console.log(tag, { url: page.url().split('/v/')[1], title: await page.locator('.wiki-title').first().innerText().catch(() => '-'), ears: (await L.stored(page, id)).nodes.find((n) => n.id === R)?.ears_type, notices: await page.locator('.toast-message').allInnerTexts(), pages: await page.locator('.wiki-nav-item, .wiki-nav a, .wiki-nav button').count() })
try {
  await L.open(page, id, `v-ev/f/${R}`); await L.wait(page, 800)
  await look('open')
  await page.locator('.ears-sentence').hover()
  await page.getByRole('button', { name: 'Rewrite the sentence' }).click()
  const s = page.getByRole('textbox', { name: 'The requirement as one sentence' })
  await s.press('ControlOrMeta+a'); await s.press('Backspace')
  await s.pressSequentially('The platform shall restore service from its copies within 30 minutes'); await s.press('Enter'); await L.wait(page, 1500)
  await look('rewritten')
  await L.shot(page, 'f3-rewritten')
  await page.keyboard.press('Control+z'); await L.wait(page, 1200)
  await look('undo')
  console.log('problems', problems)
} finally { await browser.close() }
