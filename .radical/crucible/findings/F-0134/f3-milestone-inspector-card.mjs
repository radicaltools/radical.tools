// With a milestone shown in Designer, the Inspector (which checks the current model) and the card
// (which reads the milestone) disagree:
//  1. Inspector › Needs attention › Open on "Pay in instalments", added after the milestone: the
//     card is empty, only Show on canvas and Open wiki page.
//  2. The card of "Take wallet payments", which the milestone holds and the current model deleted:
//     Path is enabled, and opens the Inspector's Overview with no path, the address ending /tr/<id>.
// Usage (Studio served on the port): node f3-milestone-inspector-card.mjs [--port 4501]
import { railTab, startBrowser, openRepoFolder, sleep, designer, shot, milestone, card, tracePanel } from './lib.mjs'
import { buildShop } from './shop.mjs'
const { repo } = await buildShop({ extra: async (a, ids) => {
  await a.call('create_view', { tempId: 'v-pay', name: 'Payments', nodeIds: Object.values(ids) })
  await a.call('create_milestone', { name: 'v1 Cards' })
  await a.call('add_node', { tempId: 'r-inst', type: 'requirement', label: 'Pay in instalments', properties: { ears_type: 'ubiquitous', action: 'let customers pay in instalments' } })
  await a.call('add_relation', { sourceId: 'r-inst', targetId: 'n-pay', relationType: 'derives' })
  await a.call('add_relation', { sourceId: 'api', targetId: 'r-inst', relationType: 'satisfies' })
  await a.call('delete_node', { id: ids['r-wallet'] })
} })
const { page, errors, close } = await startBrowser()
const persp = (name) => page.locator('.toolbar-mode-btn', { hasText: name }).click()
const mode = async () => (await page.locator('.toolbar-mode-btn.active').innerText()).split('\n')[0]
try {
  await openRepoFolder(page, repo)
  await designer(page); await sleep(1000)
  await railTab(page, 'Views'); await page.locator('.lp-view-card', { hasText: 'Payments' }).first().click(); await sleep(1500)
  await milestone(page, 'v1 Cards')

  // 1. Open, from the Inspector, an element only the current model has.
  await persp('Inspector'); await sleep(1500)
  const g = page.locator('details[data-rule="requirement-without-scenario"]')
  await g.locator('summary').click()
  await g.locator('.insp-finding', { hasText: 'Pay in instalments' }).getByRole('button', { name: 'Open Pay in instalments' }).click(); await sleep(800)
  console.log('1. Inspector card of "Pay in instalments":', JSON.stringify((await card(page).innerText()).replace(/\s+/g, ' ').trim()), '· title:', await card(page).locator('.pp-title').count())
  await shot(page, 'f3-open-empty-card.png')

  // 2. Path in the card of an element only the milestone has.
  await persp('Designer'); await sleep(1200)
  await page.locator('.react-flow__node', { hasText: 'Take wallet payments' }).first().dblclick(); await sleep(800)
  const path = card(page).getByRole('button', { name: 'Path', exact: true })
  console.log('2. card:', await card(page).getByRole('textbox', { name: 'Name' }).inputValue().catch(() => '?'), '· Path enabled:', await path.isEnabled())
  await path.click(); await sleep(1500)
  console.log('   after Path:', await mode(), '· path panel shown:', await tracePanel(page).isVisible(), '· Overview tab shown:', await page.getByRole('tab', { name: /^Overview/ }).isVisible(), '· address:', page.url().replace(/^.*\/m\//, '/m/'))
  await shot(page, 'f3-path-nothing.png')
  console.log('errors', errors)
} finally { await close() }
