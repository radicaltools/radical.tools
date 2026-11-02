// f2: An agent's write that arrives while the user holds a drag throws the element back to where the
// drag started, under the held mouse; the drop then lands short of the pointer by the part dragged before.
// Bookstore fixture as a folder, System Context view, window 1600x900.
// 1. mouse down on Customer, move 60 px left / 20 down, 2. the agent (MCP update_node) changes
// Payment Provider's description, 3. wait 4 s with the mouse held, 4. move on (150 / 60 in all), drop.
import { startBrowser, seed, open, saveAsFolder, agent, sleep, boxes, fixture, opfsFiles, shot } from './lib.mjs'

const tag = process.argv[2] ?? 'f2'
const { page, errors, close } = await startBrowser()
try {
  await seed(page, fixture('bookstore')); await open(page, 'v-context'); await saveAsFolder(page); await sleep(4000)
  const a = await agent(page)
  const b = (await boxes(page)).customer
  const sx = b.x + b.w / 2, sy = b.y + 30
  await page.mouse.move(sx, sy); await page.mouse.down()
  await page.mouse.move(sx - 60, sy + 20, { steps: 6 })
  await sleep(300)
  const mid = (await boxes(page)).customer
  await a.call('update_node', { id: 'payments', description: 'agent text' })
  await sleep(4000)
  const midAfter = (await boxes(page)).customer
  await shot(page, `${tag}-held.png`)
  console.log('start', b.x, b.y, '| held 60 px left:', mid.x, mid.y, '| still held, after the agent write:', midAfter.x, midAfter.y, midAfter.x === b.x ? '(back at the start)' : '')
  await page.mouse.move(sx - 150, sy + 60, { steps: 6 })
  await page.mouse.up()
  await sleep(1000)
  const dropped = (await boxes(page)).customer
  await shot(page, `${tag}.png`)
  console.log('dropped at', dropped.x, dropped.y, '| the pointer moved it to', b.x - 150, b.y + 60, '| short by', dropped.x - (b.x - 150), dropped.y - (b.y + 60))
  console.log('errors', errors.filter((e) => !e.startsWith('[log]')))
  await a.close()
} finally { await close() }
