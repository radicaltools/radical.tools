// On a requirement's page of a Specification wiki (needs → requirements →
// scenarios and mockups), the writing line offers "Requirements", which the
// chain does not show under a requirement, and no Scenarios or Mockups,
// which it does. Usage: node f1-wiki-page-offers.mjs [port]
import { launch, seedDoc, open, stored, shot, out, wait, SPEC_CHAIN, node0, METAMODEL } from './lib.mjs'
const port = +(process.argv[2] ?? 4580)
const { browser, context, page, problems } = await launch({ port })
const id = await seedDoc(context, {
  nodes: [node0('n-pay', 'need', 'Pay by card', { kind: 'brief' }), node0('r-why', 'requirement', 'Tell the customer why', { ears_type: 'ubiquitous', action: 'tell the customer why' })],
  relations: [{ id: 'd1', sourceId: 'r-why', targetId: 'n-pay', relationType: 'derives' }],
  views: [
    { id: 'v-spec', kind: 'wiki', name: 'Specification', nodeIds: [], positions: {}, pipeline: SPEC_CHAIN },
    { id: 'v-trace', kind: 'table', name: 'Traceability', nodeIds: [], positions: {}, pipeline: SPEC_CHAIN },
  ],
  metamodel: METAMODEL,
})
await open(page, id, 'v-spec/f/r-why')
const offered = (await page.locator('.wiki-write-start').innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
// Add or link… on the same page: what it offers to add under the requirement.
await page.getByRole('button', { name: 'Edit Tell the customer why' }).click()
await page.getByRole('menuitem', { name: 'Add or link…' }).click()
const dialog = page.getByRole('dialog', { name: 'Add under Tell the customer why' })
const picker = await dialog.getByRole('combobox', { name: 'What to add or link' }).locator('option').allInnerTexts()
await page.keyboard.press('Escape')
await wait(page, 300)
// Write a requirement in the line the page offers.
await page.locator('.wiki-write-start').getByRole('button', { name: 'Requirements', exact: true }).click()
await page.keyboard.type('Log every failed payment')
await page.keyboard.press('Enter')
await wait(page, 800)
const notice = await page.locator('.notification, [role="status"], .toast').allInnerTexts().catch(() => [])
await shot(page, 'f1')
const doc = await stored(page, id)
const added = doc.nodes.find((n) => n.label === 'Log every failed payment')
const shownOnPage = await page.locator('.wiki-page').getByText('Log every failed payment').count()
out({ writingLineOffers: offered, addOrLinkOffers: picker, added: added && { type: added.type, rel: doc.relations.filter((r) => r.sourceId === added.id).map((r) => `${r.relationType} -> ${r.targetId}`) }, shownOnPage, notice, problems })
const bug = /Requirements/.test(offered) && !/Scenarios/.test(offered)
console.log(bug ? 'BUG: the page offers Requirements, the chain shows Scenarios and Mockups there' : 'OK')
await browser.close()
process.exit(bug ? 1 : 0)
