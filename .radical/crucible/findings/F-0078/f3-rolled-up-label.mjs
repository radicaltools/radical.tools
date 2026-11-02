// Sample, System Context: Digital Channels -> Core Banking Platform stands for three relations of their
// containers ("Admin API calls", "API calls", "API calls"). The line's label is meant to list them all;
// it reads as one run-on name and shows the technology of the first only.
// Args: [port=4587]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4587)
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx'); await L.focusOff(page)
  const doc = await L.stored(page, id)
  const by = Object.fromEntries(doc.nodes.map((n) => [n.id, n]))
  const top = (i) => { while (by[i]?.parentId) i = by[i].parentId; return i }
  const rolled = doc.relations.filter((r) => top(r.sourceId) === 'sys-channels' && top(r.targetId) === 'sys-core')
  console.log('relations it stands for:', rolled.map((r) => `${by[r.sourceId].label} -> ${by[r.targetId].label}: "${r.label}" [${r.technology}]`).join('; '))
  const lab = page.locator('.relation-label', { hasText: 'Admin API calls' })
  const name = lab.locator('.relation-label-name')
  console.log('label as drawn (innerText):', JSON.stringify(await name.innerText()), '| technology:', JSON.stringify(await lab.locator('.relation-label-tech').innerText()))
  console.log('label text in the document (textContent):', JSON.stringify(await name.textContent()))
  console.log('white-space:', await name.evaluate((e) => getComputedStyle(e).whiteSpace), '| lines drawn:', await name.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight))))
  const b = await lab.boundingBox()
  await page.screenshot({ path: L.DIR + '/shots/f3-rolled-up-label.png', clip: { x: b.x - 120, y: b.y - 80, width: b.width + 240, height: b.height + 160 } })
  await lab.hover().catch(() => {})
  await page.locator('.react-flow__edge[aria-label="Edge from sys-channels to sys-core"]').hover({ force: true }).catch(() => {})
  await L.wait(page, 300)
  console.log('hovered (whole label):', JSON.stringify(await name.innerText()))
} finally { console.log('problems', problems); await browser.close() }
