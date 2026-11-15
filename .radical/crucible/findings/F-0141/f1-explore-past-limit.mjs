// A view too large for a canvas (the notice: "A canvas draws up to 1,000"),
// switched to the view type Explore, is drawn on a canvas with every element.
//   node f1-explore-past-limit.mjs <app port> [elements=3000]
import { launch, seed, openFolder, shot, wait } from './lib.mjs'
import { flatModel } from './flat.mjs'
const port = Number(process.argv[2] ?? 4503)
const n = Number(process.argv[3] ?? 3000)
const { page, problems, close } = await launch({ port })
await page.goto('/')
await seed(page, flatModel(n))
await openFolder(page, { least: 2 })
await page.goto(page.url().replace(/\/m\/viewer\/v\/.*/, '/m/designer/v/v-reqs'))
await page.locator('.app-layout').waitFor()
const notice = page.getByRole('main', { name: 'View too large for a canvas' })
await notice.waitFor()
console.log('notice:', (await notice.innerText()).replace(/\s+/g, ' '))
await notice.getByRole('button', { name: 'Edit the filter' }).click()
const t = Date.now()
await page.locator('button.view-kind-btn', { hasText: /^\s*Explore\s*$/ }).click()
// Until the canvas has stopped adding elements.
let last = -1
for (let i = 0; i < 400; i++) {
  const c = await page.locator('.react-flow__node').count()
  if (c > 0 && c === last) break
  last = c
  await wait(page, 500)
}
const drawn = await page.locator('.react-flow__node').count()
console.log(`Explore: ${drawn} elements drawn on the canvas, ${Math.round((Date.now() - t) / 1000)} s; notice shown: ${await notice.count()}`)
await shot(page, 'f1-explore.png')
console.log(drawn > 1000 ? 'BUG: a canvas draws more than 1,000 elements' : 'ok')
console.log('problems', problems)
await close()
