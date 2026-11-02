// Sample model + a view of entities with a level under 'Made up of → Entity' (as F-0044's steps build it:
// Blank view, Filter: Start with Entity, Level under Made up of → Entity). The + row "Entity · made up of"
// under the aggregate root Payment is offered, yet adding a new entity there is refused: a new entity is
// an aggregate root by default, and a root is part of no other. The wiki's writing line under Payment the same.
// parts: a table of entities filtered 'Kind is not Aggregate root' (+ at the top): the new entity is stored
// with Kind "" (its card says —) and the Domain model canvas draws it as an AGGREGATE ROOT.
// any / anywiki: the same with the chain of the viewpoint "A system's containers" (systems, then any relation),
// as a table or a wiki: a new container under Core Banking Platform must go inside it, and its relation to
// what holds it is refused.
// Args: [port=4500] [table|wiki|parts|any|anywiki]
// The sample is opened first in a context of its own (Open → Sample model) and read back as Studio saves it.
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4500), kind = process.argv[3] ?? 'table'
const { browser, context, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const doc = await L.sample(browser)
const PAYMENT = doc.nodes.find((n) => n.type === 'entity' && n.label === 'Payment').id
if (kind === 'any' || kind === 'anywiki') doc.views.push({ id: 'v-aggr', kind: kind === 'any' ? 'table' : 'wiki', name: 'Systems', nodeIds: [], positions: {}, pipeline: { levels: [
  { ways: [{ types: ['system', 'container', 'webapp', 'database', 'queue'] }] },
  { ways: [{ via: { anyRelation: true }, types: ['person', 'system', 'container', 'webapp', 'database', 'queue'] }] },
] } })
else if (kind === 'parts') doc.views.push({ id: 'v-aggr', kind: 'table', name: 'Parts', nodeIds: [], positions: {}, pipeline: { levels: [
  { ways: [{ types: ['entity'] }], filters: [{ kind: 'property', key: 'kind', op: 'is-not', values: ['aggregate-root'] }] },
] } })
else doc.views.push({ id: 'v-aggr', kind, name: 'Aggregates', nodeIds: [], positions: {}, pipeline: { levels: [
  { ways: [{ types: ['entity'] }] },
  { ways: [{ via: { relationType: 'part-of', direction: 'in' }, types: ['entity'] }] },
] } })
const id = await L.seedDoc(context, doc)
const out = {}
try {
  const before = await (async () => { await L.open(page, id, 'v-aggr'); await L.wait(page, 1000); return L.stored(page, id) })()
  if (kind === 'table') {
    out.offered = await page.locator('.tv-add-btn').evaluateAll((b) => b.map((x) => `${x.getAttribute('aria-label')}: ${x.innerText.replace(/\s+/g, ' ').trim()}`))
    await page.getByRole('button', { name: 'Add under Payment', exact: true }).click(); await L.wait(page, 600)
    const dlg = page.getByRole('dialog', { name: 'Add under Payment' })
    if (await dlg.count()) { await dlg.getByRole('textbox').pressSequentially('Payment Fee'); await page.keyboard.press('Enter') }
  } else if (kind === 'any') {
    await page.getByRole('button', { name: 'Add under Core Banking Platform', exact: true }).click(); await L.wait(page, 600)
    const dlg = page.getByRole('dialog', { name: 'Add under Core Banking Platform' })
    out.offered = await dlg.getByRole('combobox', { name: 'What to add or link' }).locator('option').allInnerTexts()
    const sel = dlg.getByRole('combobox', { name: 'What to add or link' })
    await sel.selectOption(await sel.locator('option', { hasText: 'a container' }).first().getAttribute('value'))
    await dlg.getByRole('textbox').pressSequentially('Statements Service'); await page.keyboard.press('Enter')
  } else if (kind === 'anywiki') {
    await L.open(page, id, 'v-aggr/f/sys-core'); await L.wait(page, 800)
    out.offered = await page.locator('.wiki-write-start').allInnerTexts()
    out.lines = await page.locator('.wiki-write-input').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')))
    const start = page.locator('.wiki-write-start').getByRole('button', { name: 'Containers', exact: true })
    if (await start.count()) await start.click()
    const line = page.getByRole('textbox', { name: 'Write a container' }).first()
    await line.click(); await page.keyboard.type('Statements Service'); await page.keyboard.press('Enter')
  } else if (kind === 'parts') {
    out.offered = await page.locator('.tv-add-btn').evaluateAll((b) => b.map((x) => `${x.getAttribute('aria-label')}: ${x.innerText.replace(/\s+/g, ' ').trim()}`))
    await page.getByRole('button', { name: 'Add at the top', exact: true }).click(); await L.wait(page, 600)
    await page.keyboard.type('Payment Fee'); await page.keyboard.press('Enter')
  } else {
    await L.open(page, id, `v-aggr/f/${PAYMENT}`); await L.wait(page, 800)
    out.offered = await page.locator('.wiki-write-start').allInnerTexts()
    const start = page.locator('.wiki-write-start').getByRole('button', { name: 'Entities', exact: true })
    if (await start.count()) await start.click()
    const line = page.getByRole('textbox', { name: /^Write an? entity$/ }).first()
    await line.click(); await page.keyboard.type('Payment Fee'); await page.keyboard.press('Enter')
  }
  await L.passWizard(page); await L.wait(page, 2500)
  const after = await L.stored(page, id)
  out.elements = `${before.nodes.length} -> ${after.nodes.length}`
  out.relations = `${before.relations.length} -> ${after.relations.length}`
  const n = after.nodes.find((x) => !before.nodes.some((b) => b.id === x.id))
  out.added = n ? { label: n.label, type: n.type, parent: after.nodes.find((x) => x.id === n.parentId)?.label ?? null, kind: n.kind, partOf: after.relations.filter((r) => r.sourceId === n.id).map((r) => `${r.relationType} -> ${after.nodes.find((x) => x.id === r.targetId)?.label}`) } : null
  out.notices = await page.locator('.toast-message').allInnerTexts()
  await L.shot(page, `f1-${kind}`)
  if (kind === 'parts' && n) {
    out.tableRows = (await page.locator('tr.tv-row').allInnerTexts()).map((t) => t.split('\n')[1])
    await L.open(page, id, 'view-domain-model'); await L.wait(page, 2000)
    out.domainModelDraws = (await L.node(page, n.id).innerText().catch(() => 'not drawn')).replace(/\n/g, ' / ')
    await L.shot(page, 'f1-parts-domain-model')
  }
  out.problems = problems
  L.out(out)
} finally { await browser.close() }
