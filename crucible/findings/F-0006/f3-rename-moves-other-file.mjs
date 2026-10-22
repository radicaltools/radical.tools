// Folder model (bookstore fixture moved to a folder): rename the container
// API to "Orders DB", the label of its sibling database. Only API's file
// should change; Studio also moves the untouched Orders DB from
// nodes/bookstore/orders-db.md to orders-db-2.md, because suffixes go by id
// order (api < db). Usage: node f3-rename-moves-other-file.mjs (server on 4574)
import { launch, seed, fixture, open, moveToFolder, files, wait, shot, node } from './lib.mjs'
const { page, problems, close } = await launch()
let bug = false
try {
  await seed(page, fixture('bookstore'))
  await open(page, 'v-containers')
  await moveToFolder(page)
  await wait(page, 2500)
  const before = await files(page)
  console.log('before: Orders DB (id db) is in', Object.keys(before).find((k) => /^id: "db"$/m.test(before[k])))
  await node(page, 'api').click()
  const name = page.locator('.right-panel.open').getByLabel('Name', { exact: true })
  await name.fill(''); await name.pressSequentially('Orders DB'); await name.press('Tab')
  await wait(page, 4000)
  const after = await files(page)
  const dbBefore = Object.keys(before).find((k) => /^id: "db"$/m.test(before[k]))
  const dbAfter = Object.keys(after).find((k) => /^id: "db"$/m.test(after[k]))
  console.log('after renaming API: Orders DB (id db) is in', dbAfter, '| API (id api) is in', Object.keys(after).find((k) => /^id: "api"$/m.test(after[k])))
  console.log('node files written:', Object.keys({ ...before, ...after }).filter((k) => k.startsWith('nodes/') && before[k] !== after[k]).sort().map((k) => `${k in after ? (k in before ? '~' : '+') : '-'}${k}`).join(' '))
  await shot(page, 'f3-rename')
  bug = dbBefore !== dbAfter
  if (problems.length) console.log(problems)
} finally { await close() }
console.log(bug ? 'BUG: the file of an element nobody changed moved' : 'OK')
process.exit(bug ? 1 : 0)
