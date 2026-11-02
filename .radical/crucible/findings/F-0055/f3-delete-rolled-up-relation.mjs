// Sample, Designer, System Context. The relation drawn from Core Banking Platform to KYC / AML
// Provider is rolled up from relations of what Core Banking holds (Accounts Service -> KYC). Click it,
// press Delete: the prompt asks "Delete 1 element?", lists nothing it would remove, and says no view is
// active; Remove from model then removes nothing and the line stays. Undo stays off.
// Args: [port=4584]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4584)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx', 'designer'); await L.wait(page, 1500)
  const before = await L.stored(page, id)
  const edge = page.getByTestId('rf__edge-virtual-sys-core→sys-kyc')
  const under = before.relations.filter((r) => ['sys-kyc'].includes(r.targetId)).map((r) => `${r.sourceId} -> ${r.targetId}`)
  console.log('relations into KYC / AML Provider:', under)
  const box = await edge.locator('path').first().boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await L.wait(page, 400)
  console.log('selected:', await page.locator('.react-flow__edge.selected').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))))
  await page.keyboard.press('Delete')
  const modal = page.locator('.milestone-modal')
  await modal.waitFor()
  console.log('prompt:', (await modal.innerText()).replace(/\s+/g, ' '))
  await L.shot(page, 'f3-prompt')
  await page.getByRole('button', { name: /Remove from model/ }).click()
  await L.wait(page, 2500)
  const after = await L.stored(page, id)
  console.log(`relations in the model: ${before.relations.length} -> ${after.relations.length}; line still drawn: ${await edge.count()}; Undo enabled: ${await page.getByRole('button', { name: 'Undo', exact: false }).first().isEnabled()}`)
} finally { console.log('problems', problems); await browser.close() }
