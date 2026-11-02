// Bookstore moved to a browser folder. Discuss Customer, write a comment, Post comment.
// The Post button turns disabled (empty draft) and the focus falls to <body>: Escape no longer
// closes the panel (its ✕ says "Close (Esc)"), and Tab starts again at the top of the page.
// Before the post, Escape from the comment field closes it.
// Args: [port=4588]
import * as L from './lib.mjs'
const port = Number(process.argv[2] ?? 4588)
const { context, page, problems, close } = await L.launch({ port })
page.setDefaultTimeout(8000)
const dialog = () => page.getByRole('dialog', { name: 'Customer', exact: true })
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.closest('.discussion-panel') ? ' (in the panel)' : ''}` : 'none' })
try {
  const id = await L.seedFixture(context)
  await L.openLs(page, id, 'v-context')
  await L.moveToFolder(page)
  // Before a post: Escape from the comment field closes the panel.
  let panel = await L.discuss(page, 'customer', 'Customer')
  await page.keyboard.type('draft')
  await page.keyboard.press('Escape'); await L.wait(page, 300)
  console.log(`before a post: Escape from ${'the comment field'} closes the panel: ${(await dialog().count()) === 0}`)
  // After a post.
  panel = await L.discuss(page, 'customer', 'Customer')
  await panel.getByLabel('Comment (Markdown supported)').fill('')
  await L.post(panel, 'Is the customer a person or a company?', page)
  console.log(`after Post comment the focus is on: ${await active()}`)
  await page.keyboard.press('Escape'); await L.wait(page, 400)
  console.log(`after a post: Escape closes the panel: ${(await dialog().count()) === 0} (panel still open: ${await dialog().count()})`)
  await L.shot(page, 'f3-esc-after-post')
} finally { console.log('problems', problems); await close() }
