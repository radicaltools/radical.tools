// Inspector › Overview › Needs attention › "Add scenario": the wizard creates the scenario, the
// Inspector counts it, and then it is gone: never written to the folder, and back in Designer the
// model is as before (12 elements), the requirement again without a scenario.
// Usage (Studio served on the port): node f1-inspector-add-scenario-lost.mjs [--port 4501]
import { startBrowser, openRepoFolder, sleep, designer, shot, opfsFiles, folderNodes, card } from './lib.mjs'
import { buildShop } from './shop.mjs'
const { repo } = await buildShop()
const { page, errors, close } = await startBrowser()
const persp = (name) => page.locator('.toolbar-mode-btn', { hasText: name }).click()
const elements = async () => Number((await page.locator('.insp-meta').first().innerText()).match(/(\d+) elements/)?.[1])
const withoutScenario = () => page.locator('details[data-rule="requirement-without-scenario"] .insp-finding').count()
const inFolder = async () => Object.values(folderNodes(await opfsFiles(page))).includes('Paying with a wallet')
try {
  await openRepoFolder(page, repo)
  await designer(page); await sleep(1000)
  await persp('Inspector'); await sleep(1500)
  console.log('Inspector before:', await elements(), 'elements; requirements without scenario:', await withoutScenario())
  await page.locator('details[data-rule="requirement-without-scenario"] > summary').click()
  await page.locator('details[data-rule="requirement-without-scenario"] .insp-finding', { hasText: 'Take wallet payments' }).getByRole('button', { name: 'Add scenario' }).click()
  const wizard = page.getByRole('dialog', { name: 'New Scenario — wizard' })
  await wizard.waitFor()
  await page.keyboard.type('Paying with a wallet')
  await wizard.getByRole('button', { name: 'Create' }).first().click()
  await wizard.waitFor({ state: 'hidden' })
  await sleep(1500)
  console.log('Inspector after Create:', await elements(), 'elements; without scenario:', await withoutScenario(), '; card:', await card(page).locator('.pp-title').innerText().catch(() => '-'))
  await shot(page, 'f1-created.png')
  await sleep(10000)
  console.log('10 s later, in the folder:', await inFolder())
  await persp('Designer'); await sleep(1500)
  console.log('Designer: drawn', await page.locator('.react-flow__node', { hasText: 'Paying with a wallet' }).count(), '; Quick Search hits:', await (async () => {
    await page.locator('.quick-search-bar').getByPlaceholder(/^Search/).click(); await page.keyboard.type('Paying with a wallet'); await sleep(800)
    const n = await page.locator('.quick-search-item', { hasText: 'Paying with a wallet' }).count(); await page.keyboard.press('Escape'); return n
  })(), '; Undo enabled:', await page.getByRole('button', { name: /^Undo/ }).first().isEnabled())
  await shot(page, 'f1-designer.png')
  await persp('Inspector'); await sleep(1500)
  console.log('Inspector again:', await elements(), 'elements; without scenario:', await withoutScenario())
  await sleep(3000)
  console.log('in the folder at the end:', await inFolder())
  console.log('errors', errors)
} finally { await close() }
