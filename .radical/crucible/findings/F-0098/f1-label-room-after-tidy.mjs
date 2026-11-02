// Sample, System Context, Smart Layout: Tidy sets Core Banking Platform and KYC / AML Provider 124 px apart,
// while their relation's label "Identity & AML screening [REST / JSON]" is drawn 156 px wide on one row:
// the label lies over both elements (F-0077 still holds). Tidy and the label placement size it by an estimate
// (relationLabelSize) that wraps the name onto two rows, 108 px wide.
// Args: [port=4596] [style=curved|orthogonal]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4596), style = process.argv[3] ?? 'curved'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
let line = ''
page.on('console', (m) => { if (m.text().startsWith('[smartLayout]')) line = m.text() })
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx'); await L.focusOff(page)
  if (style !== 'curved') { await L.setLines(page, 'System Context', style); await L.wait(page, 1000) }
  const par = await L.parents(page, id)
  const report = async (label) => {
    const fr = await L.frames(page), labels = await L.labelBoxes(page)
    const l = labels.find((x) => x.text.startsWith('Identity'))
    const rows = await page.locator('.relation-label', { hasText: 'Identity & AML' }).locator('.relation-label-name').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)))
    const p = L.labelProblems(labels, fr, par)
    console.log(`${label}: gap Core Banking Platform -> KYC / AML Provider ${(fr['sys-kyc'].x - (fr['sys-core'].x + fr['sys-core'].w)).toFixed(0)} px; label "Identity & AML screening" drawn ${l.w}x${l.h} (${rows} row name) at (${l.x.toFixed(0)},${l.y.toFixed(0)})`)
    console.log(`   labels over elements: ${p.length} ${JSON.stringify(p)}`)
    return p.length
  }
  const before = await report('before')
  const r = await L.smartLayout(page)
  console.log('Smart Layout:', JSON.stringify(r), line.match(/lbl=[\d.]+/)?.[0] ?? '')
  const after = await report('after')
  const b = await page.locator('.relation-label', { hasText: 'Identity & AML' }).boundingBox()
  await page.screenshot({ path: `${L.DIR}/shots/f1-${style}.png`, clip: { x: b.x - 220, y: b.y - 120, width: b.width + 440, height: b.height + 240 } })
  console.log('again:', JSON.stringify(await L.smartLayout(page)))
  console.log(after > before ? 'REPRODUCED: Smart Layout left a relation label over the elements it joins' : 'not reproduced')
} finally { console.log('problems', problems); await browser.close() }
