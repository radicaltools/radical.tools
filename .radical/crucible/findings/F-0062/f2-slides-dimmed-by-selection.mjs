// Sample, System Context, Designer (Focus on, the default). Core Banking Platform is clicked, which
// dims what is not related to it. Then Presenter and F5: the first slide (System Context) plays with
// Core Banking drawn selected and the rest dimmed, though the slide captured no selection.
// Control: the same slide played with nothing selected before.
// Args: [port=4592]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4592)
const { browser, page, problems } = await L.launch({ port })
page.setDefaultTimeout(8000)
const state = async () => ({
  dimmedNodes: await page.locator('.react-flow__node.focus-dim').count(),
  selectedNodes: await page.locator('.react-flow__node.selected').evaluateAll((es) => es.map((e) => e.dataset.id)),
  nodes: await page.locator('.react-flow__node').count(),
  address: page.url().replace(/^.*#/, '#'),
})
async function play() {
  await L.perspective(page, 'Presenter')
  await page.keyboard.press('F5'); await L.wait(page, 2500)
  return state()
}
try {
  const id = await L.openSample(page)
  // Control: nothing selected.
  await L.open(page, id, 'view-ctx', 'designer')
  console.log('control, slide 1 played with nothing selected:', JSON.stringify(await play()))
  await page.keyboard.press('Escape'); await L.wait(page, 1000)
  await L.open(page, id, 'view-ctx', 'designer')
  await L.node(page, 'sys-core').click({ position: { x: 10, y: 10 } }); await L.wait(page, 1500)
  console.log('Designer, Core Banking clicked:', JSON.stringify(await state()))
  const s = await play()
  console.log('slide 1 played after that:', JSON.stringify(s))
  await L.shot(page, 'f2-slide-dimmed')
  console.log(s.dimmedNodes > 0 ? `BUG: ${s.dimmedNodes} of ${s.nodes} elements dimmed on the playing slide` : 'ok')
} finally { console.log('problems', problems); await browser.close() }
