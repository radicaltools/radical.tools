// f1: A container deleted in Studio comes back because the agent put an element into it;
// Undo of the delete then draws Web App on top of the agent's element (saved, kept by a reload).
// Bookstore fixture as a folder, Containers view (1600x900).
// 1. an agent write (Studio holds its saves), 2. Studio: Bookstore, Delete, Remove from model,
// 3. agent: add_node container "Search" into bookstore + set_view_nodes on v-containers,
// 4. Studio takes the write in ("Bookstore ... came back"), 5. Ctrl+Z.
import { startBrowser, seed, open, saveAsFolder, agent, sleep, shot, boxes, fixture, waitFor } from './lib.mjs'

const tag = process.argv[2] ?? 'f1'
const { page, errors, close } = await startBrowser()
const overlap = (a, b) => !!(a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await saveAsFolder(page)
  const before = await boxes(page)
  const a = await agent(page)
  await a.call('update_node', { id: 'payments', description: 'Cards (agent)' })
  await sleep(3000)
  await page.getByTestId('rf__node-bookstore').click({ position: { x: 20, y: 10 } })
  await page.keyboard.press('Delete')
  await page.getByRole('button', { name: /Remove from model/ }).click()
  await sleep(1000)
  let r = await a.call('add_node', { tempId: 't1', type: 'container', label: 'Search', parentId: 'bookstore' })
  const id = r.text.match(/Created node ([\w-]+)/)?.[1]
  r = await a.call('set_view_nodes', { id: 'v-containers', nodeIds: ['customer', 'bookstore', 'web', 'api', 'db', 'payments', id] })
  await waitFor(async () => (await boxes(page))[id], 15000)
  await sleep(2000)
  const notice = (await page.evaluate(() => document.body.innerText)).split('\n').find((l) => /came back/.test(l))
  console.log('notice:', notice)
  const mid = await boxes(page)
  console.log('restored Bookstore', JSON.stringify(mid.bookstore), 'Search', JSON.stringify(mid[id]), '| Web App before the delete', JSON.stringify(before.web))
  await page.locator('.react-flow__pane').click({ position: { x: 1000, y: 150 } })
  await page.keyboard.press('Control+z')
  await sleep(2500)
  const after = await boxes(page)
  await shot(page, `${tag}.png`)
  console.log('after Undo: Web App', JSON.stringify(after.web), 'Search', JSON.stringify(after[id]), 'overlap:', overlap(after.web, after[id]))
  // Let Studio save (the agent's mark runs out), then reload.
  await sleep(20000)
  await page.reload(); await sleep(3000)
  const reloaded = await boxes(page)
  await shot(page, `${tag}-reload.png`)
  console.log('after reload: Web App', JSON.stringify(reloaded.web), 'Search', JSON.stringify(reloaded[id]), 'overlap:', overlap(reloaded.web, reloaded[id]))
  console.log('errors', errors.filter((e) => !e.startsWith('[log]')))
  await a.close()
} finally { await close() }
