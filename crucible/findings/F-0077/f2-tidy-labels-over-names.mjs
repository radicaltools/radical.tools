// Sample, System Context, Smart Layout (Tidy): it sets KYC / AML Provider (and, with orthogonal lines,
// Retail Customer) so close to the element they relate to that the relation's label lies over both names.
// Args: [port=4587] [style=orthogonal|curved]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4587), style = process.argv[3] ?? 'orthogonal'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
let line = ''
page.on('console', (m) => { if (m.text().startsWith('[smartLayout]')) line = m.text() })
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-ctx'); await L.focusOff(page)
  await L.setLines(page, 'System Context', style); await L.wait(page, 1000)
  const par = await L.parents(page, id)
  const report = async (label) => {
    const fr = await L.frames(page), labels = await L.labelBoxes(page)
    const gap = (a, b) => (fr[b].x - (fr[a].x + fr[a].w)).toFixed(0)
    const lab = (t) => { const l = labels.find((x) => x.text.startsWith(t)); return l ? `${l.w}x${l.h} at (${l.x.toFixed(0)},${l.y.toFixed(0)})` : 'none' }
    const p = L.labelProblems(labels, fr, par)
    console.log(`${label}: gap Core Banking Platform -> KYC / AML Provider ${gap('sys-core', 'sys-kyc')} px, label "Identity & AML screening" ${lab('Identity')}; gap Retail Customer -> Digital Channels ${gap('p-customer', 'sys-channels')} px, label "Views accounts" ${lab('Views accounts')}`)
    console.log(`   labels over elements: ${p.length} ${JSON.stringify(p)}`)
  }
  await report('before')
  console.log('Smart Layout:', JSON.stringify(await L.smartLayout(page)), line.match(/lbl=[\d.]+/)?.[0])
  await report('after')
  await L.shot(page, `f2-${style}`)
  console.log('again:', JSON.stringify(await L.smartLayout(page)))
} finally { console.log('problems', problems); await browser.close() }
