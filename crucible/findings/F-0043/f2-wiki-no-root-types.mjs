// A wiki whose chain's first level has a filter a new element does not meet
// before it is named or linked offers nothing at its top, and its Add element
// says "No root types in metamodel"; the same chain as a table offers
// "+ Need · the filter won't show it". Two chains: the needs whose name has
// "Pay" (a need named "Payment refunds" would pass), and the built-in
// Responsibilities viewpoint's (building blocks that satisfy a requirement).
// Usage: node f2-wiki-no-root-types.mjs [port]
import { launch, seedDoc, open, shot, out, wait, node0, METAMODEL } from './lib.mjs'
const port = +(process.argv[2] ?? 4580)
const { browser, context, page, problems } = await launch({ port })
const PAY = { levels: [{ ways: [{ types: ['need'] }], filters: [{ kind: 'text', text: 'Pay' }] }, { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] }] }
const RESP = { levels: [
  { ways: [{ types: ['system', 'container', 'webapp', 'component', 'database', 'queue'] }], filters: [{ kind: 'relation', relationType: 'satisfies', direction: 'out', has: true }] },
  { ways: [{ via: { relationType: 'satisfies', direction: 'out' }, types: ['requirement'] }] },
  { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
] }
const id = await seedDoc(context, {
  nodes: [node0('n-pay', 'need', 'Pay by card', { kind: 'brief' }), node0('n-aud', 'need', 'Audit', { kind: 'brief' })], relations: [],
  views: [
    { id: 'v-pay', kind: 'wiki', name: 'Payment needs', nodeIds: [], positions: {}, pipeline: PAY },
    { id: 'v-pay-t', kind: 'table', name: 'Payment needs (table)', nodeIds: [], positions: {}, pipeline: PAY },
    { id: 'v-resp', kind: 'wiki', name: 'Responsibilities', nodeIds: [], positions: {}, pipeline: RESP },
  ], metamodel: METAMODEL,
})
const wikiTop = async (view, shotName) => {
  await open(page, id, view)
  const lines = await page.locator('.wiki-view input[type=text], .wiki-view textarea').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await page.getByRole('button', { name: 'Add element' }).click()
  await wait(page, 300)
  const items = await page.locator('.wiki-add-item').allInnerTexts()
  const says = (await page.locator('.wiki-view').innerText()).match(/No root types in metamodel/)?.[0] ?? null
  await shot(page, shotName)
  await page.getByRole('button', { name: 'Add element' }).click() // closes the menu (Escape does not)
  return { writingLines: lines, addElementItems: items, says }
}
const pay = await wikiTop('v-pay', 'f2')
const resp = await wikiTop('v-resp', 'f2-responsibilities')
await open(page, id, 'v-pay-t')
const table = ((await page.locator('.app-layout').innerText()).match(/\+?\s*Need[^\n]*\n?[^\n]*won't show it/)?.[0] ?? '').replace(/\s+/g, ' ') || null
out({ payNeedsWiki: pay, responsibilitiesWiki: resp, payNeedsTableOffers: table, problems })
const bug = [pay, resp].every((w) => w.addElementItems.length === 0 && w.says)
console.log(bug ? 'BUG: the wiki offers nothing at its top and says the metamodel has no root types' : 'OK')
await browser.close()
process.exit(bug ? 1 : 0)
