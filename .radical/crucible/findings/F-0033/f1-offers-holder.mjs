// Studio offers an element's own holder to link to, then refuses the link (the holder rule):
//  A. Bookstore wiki, API's page, Add or link… → "uses……" lists Bookstore (API's system).
//  B. Bookstore table chain System ← container (uses): + under Bookstore lists API as Existing;
//     picking it is refused and then a warning says "API was linked".
//  C. New model: an ADR dropped onto a Software System; its wizard's Affected elements lists only
//     that system; ticking it, Create is refused and nothing is added.
// Each part on a fresh page.  Args: [port=4577]
import { launch, stored, settle, wait, out, shot, node, recordToasts, toasts, REPO } from './lib.mjs'
import { newModel, openCard, dropType } from './nm.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const port = +(process.argv[2] || 4577)
const result = {}
async function seeded(view) {
  const s = await launch({ port }); await recordToasts(s.context)
  const doc = JSON.parse(readFileSync(join(REPO, 'apps/e2e/fixtures/bookstore.radical'), 'utf8'))
  doc.views.push(view)
  const id = 'run177-f1'
  await s.context.addInitScript(([id, data]) => {
    if (localStorage.getItem('radical-docs-index')) return
    localStorage.setItem('radical-docs-index', JSON.stringify({ docs: [{ id, name: 'E2E', source: 'ls', lastModified: 0 }], activeId: id }))
    localStorage.setItem(`radical-doc:${id}`, data)
  }, [id, JSON.stringify(doc)])
  return { ...s, id }
}
// A
{
  const { browser, page, problems, id } = await seeded({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} })
  await page.goto(`/#/d/${encodeURIComponent('ls:' + id)}/m/designer/v/v-wiki/f/api`)
  await page.locator('.app-layout').waitFor(); await wait(page, 1500)
  await page.getByRole('button', { name: 'Edit API' }).click()
  await page.getByRole('menuitem', { name: 'Add or link…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add under API' })
  const select = dialog.getByRole('combobox', { name: 'What to add or link' })
  const ways = await select.locator('option').allInnerTexts()
  const uses = ways.find((w) => /^uses/.test(w))
  await select.selectOption(await select.locator('option', { hasText: uses }).first().getAttribute('value'))
  await wait(page, 300)
  const listed = (await dialog.locator('.add-picker-row').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '))
  await shot(page, 'f1a-wiki-offers-bookstore')
  const before = (await stored(page, id)).relations.length
  await dialog.locator('.add-picker-row', { hasText: 'Bookstore' }).first().click(); await wait(page, 2000)
  result.A = { ways, listedUnderUses: listed, relationsBefore: before, relationsAfter: (await stored(page, id)).relations.length, toasts: await toasts(page), problems }
  await browser.close()
}
// B
{
  const { browser, page, problems, id } = await seeded({ id: 'v-users', name: 'Users of systems', kind: 'table', nodeIds: [], positions: {}, pipeline: { levels: [
    { ways: [{ types: ['system'] }] },
    { ways: [{ via: { relationType: 'interacts', direction: 'in' }, types: ['container'] }] },
  ] } })
  await page.goto(`/#/d/${encodeURIComponent('ls:' + id)}/m/designer/v/v-users`)
  await page.locator('.app-layout').waitFor(); await wait(page, 1500)
  await page.getByRole('button', { name: 'Add under Bookstore' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add under Bookstore' })
  await dialog.waitFor()
  const sentence = (await dialog.locator('.add-picker-sentence').innerText()).replace(/\s+/g, ' ')
  const listed = (await dialog.locator('.add-picker-row').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '))
  await shot(page, 'f1b-table-offers-api')
  const before = (await stored(page, id)).relations.length
  await dialog.locator('.add-picker-row', { hasText: /^API/ }).first().click(); await wait(page, 2000)
  result.B = { sentence, listed, relationsBefore: before, relationsAfter: (await stored(page, id)).relations.length, toasts: await toasts(page), problems }
  await browser.close()
}
// C
{
  const { browser, context, page, problems } = await launch({ port }); await recordToasts(context)
  const id = await newModel(page)
  await openCard(page, 1)
  await dropType(page, 'Software System', 600, 300)
  const sys = (await stored(page, id)).nodes[0]
  await toasts(page)
  const bs = await node(page, sys.id).boundingBox(), pane = await page.locator('.react-flow__pane').boundingBox()
  await page.locator('.palette-item', { hasText: /^ADR$/ }).first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: bs.x - pane.x + bs.width / 2, y: bs.y - pane.y + bs.height - 40 }, force: true })
  const wizard = page.getByRole('dialog', { name: /wizard/ })
  await wizard.waitFor()
  await wizard.getByRole('button', { name: /Affected elements/ }).click(); await wait(page, 300)
  const listed = (await wizard.locator('label:has(.nw-check)').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim())
  await wizard.locator('label:has(.nw-check)', { hasText: 'System' }).first().locator('.nw-check').check()
  await wizard.getByRole('button', { name: 'Create', exact: true }).click()
  await settle(page); await wait(page, 2000)
  await shot(page, 'f1c-adr-wizard-refused')
  const after = await stored(page, id)
  result.C = { affectedElementsListed: listed, adrsAdded: after.nodes.filter((n) => n.type === 'adr').length, wizardStillOpen: (await wizard.count()) > 0, toasts: await toasts(page), problems }
  await browser.close()
}
out(result)
