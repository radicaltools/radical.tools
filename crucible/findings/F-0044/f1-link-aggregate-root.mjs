// Sample model, Designer: + New view → Blank view (a table), Filter: + Start with Entity, + Level under
// "Made up of → Entity". Under Payment (an aggregate root) the + row opens Add or link; its Existing list
// offers every other entity, aggregate roots and parts of other aggregates among them. Pick one
// (default Account, a root): the relation is added without a word and Validation then flags it.
// Args: [port=4581] [entity to pick=Account]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4581)
const pick = process.argv[3] ?? 'Account'
const { browser, page, problems } = await L.launch({ port })
try {
  const id = await L.openSample(page)
  await L.tab(page, 'Views')
  await page.getByRole('button', { name: 'New view' }).click()
  await page.getByRole('menuitem', { name: /Blank view/ }).click()
  await L.wait(page, 800)
  await page.getByRole('button', { name: '+ Start with' }).click()
  await page.locator('.rp-step-menu .rp-step-option', { hasText: /^Entity/ }).first().click()
  await L.wait(page, 300)
  await page.getByRole('button', { name: '+ Level under' }).click()
  await page.locator('.rp-step-menu .rp-step-option', { hasText: /^Made up of → Entity/ }).first().click()
  await L.wait(page, 800)
  const doc0 = await L.stored(page, id)
  const kind = Object.fromEntries(doc0.nodes.filter((n) => n.type === 'entity').map((n) => [n.label, n.kind]))
  const partOf = doc0.relations.filter((r) => r.relationType === 'part-of').map((r) => `${doc0.nodes.find((n) => n.id === r.sourceId)?.label} part of ${doc0.nodes.find((n) => n.id === r.targetId)?.label}`)
  console.log('entities and their kind:', JSON.stringify(kind))
  console.log('part-of relations:', partOf.join('; '))
  const v0 = await L.validation(page)
  await page.getByRole('button', { name: 'Add under Payment', exact: true }).first().click()
  const picker = page.getByRole('dialog', { name: 'Add under Payment' })
  await picker.waitFor()
  const offered = await picker.locator('.add-picker-row:not(.new) .add-picker-row-label').allInnerTexts()
  console.log('picker sentence:', await picker.locator('.add-picker-sentence').innerText())
  console.log('Existing offered under Payment:', offered.map((l) => `${l} (${kind[l]})`).join(', '))
  await L.shot(page, 'f1-picker')
  await picker.getByRole('option', { name: pick, exact: true }).click()
  await L.wait(page, 1000)
  const notes = await L.notices(page)
  const doc1 = await L.stored(page, id)
  const added = doc1.relations.filter((r) => !doc0.relations.some((q) => q.id === r.id))
    .map((r) => `${doc1.nodes.find((n) => n.id === r.sourceId)?.label} ${r.relationType} ${doc1.nodes.find((n) => n.id === r.targetId)?.label}`)
  const v1 = await L.validation(page)
  L.out({
    validationBefore: v0.count, validationAfter: v1.count,
    newIssues: v1.messages.filter((m) => !v0.messages.includes(m)),
    relationsAdded: added, notices: notes,
    offeredThatBreakAggregates: offered.filter((l) => kind[l] === 'aggregate-root' || partOf.some((p) => p.startsWith(`${l} part of`))).length + ' of ' + offered.length,
  })
  await L.shot(page, 'f1-after-link')
} finally { console.log('problems', problems); await browser.close() }
