// Sample, Core Banking, Lines set to Orthogonal in the view's properties: the relation
// API Gateway -> Accounts Service is drawn straight over FX Engine and Payment Validator,
// though there is room to route it around Payments Service.
// Args: [port=4587] [style=orthogonal]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4587), style = process.argv[3] ?? 'orthogonal'
const { browser, page, problems } = await L.launch({ port, width: 1600, height: 1000 })
try {
  const id = await L.openSample(page)
  await L.open(page, id, 'view-core'); await L.focusOff(page)
  await L.setLines(page, 'Core Banking', style)
  await L.wait(page, 1500); await L.settle(page)
  const par = await L.parents(page, id)
  const fr = await L.frames(page), es = await L.edgeEnds(page)
  const e = es.find((x) => x.id === 'r-apigw-acc')
  console.log('API Gateway -> Accounts Service:', L.pathPoints(e.d).map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' '))
  for (const k of ['ctn-payments', 'comp-fx', 'comp-validator']) console.log(k, JSON.stringify(fr[k]))
  const over = L.lineProblems(es, fr, par).filter((x) => x.includes('runs over'))
  console.log(`lines over elements they do not join: ${over.length}`); for (const x of over) console.log('   ', x)
  await L.shot(page, 'f1-ortho-line-over-elements')
} finally { console.log('problems', problems); await browser.close() }
