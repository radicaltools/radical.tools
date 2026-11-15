// F3: Saving the Inspector's Settings (any change, here one rule's severity)
// rewrites the repository's .radical/radical.json from the copy Studio last
// polled (every 3 s), not from the file: a test an agent bound with
// set_verification just before is unbound again, silently.
//   node f3-settings-save-drops-binding.mjs <studio port>
// The model is made on disk with the MCP server and copied into the page's
// OPFS as a repository (.radical/model, .radical/radical.json); the agent's
// write is made on disk and delivered to the folder Studio has open, as
// apps/e2e/tests/studio/folders.spec.ts does.
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { DIR, mcp, freshRepo } from './lib.mjs'
import { launchFolder, copyToOpfs, writeOpfs, readOpfs } from './blib.mjs'
const port = Number(process.argv[2] ?? 4517)
const dir = join(DIR, 'work/f3')
const folder = freshRepo(dir, null)
const m = await mcp(folder)
const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
await must('add_node', { type: 'scenario', label: 'Pays', tempId: 'pays', properties: { given: 'a cart', when: 'paying', then: 'paid' } })
await must('set_verification', { id: 'pays', tests: ['tests/pay.test.ts › pays by card'] })
const b = await launchFolder({ port })
const { page } = b
let bug = false
try {
  await page.goto('/')
  await copyToOpfs(page, folder, '.radical/model')
  await writeOpfs(page, '.radical/radical.json', readFileSync(join(dir, '.radical/radical.json'), 'utf8'))
  await writeOpfs(page, '.radical/model/.state/test-results.json', JSON.stringify({ version: 1, readAt: new Date().toISOString(), reports: ['reports/vitest.json'], cases: [{ file: 'tests/pay.test.ts', title: ['pays by card'], status: 'passed' }] }))
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await page.locator('.welcome-overlay').waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: /^Inspector/ }).click({ timeout: 10_000 })
  await page.getByRole('tab', { name: /^Settings/ }).click()
  // The person changes a rule's severity in Settings…
  await page.locator('[data-rule="scenario-verifies-nothing"]').getByRole('button', { name: 'Error', exact: true }).click()
  // …while the agent binds a second test to the scenario.
  console.log((await must('set_verification', { id: 'pays', tests: ['tests/pay.test.ts › declines an expired card'] })).text)
  const agent = readFileSync(join(dir, '.radical/radical.json'), 'utf8')
  await writeOpfs(page, '.radical/radical.json', agent)
  const before = JSON.parse(agent).verifies[0].tests
  // The person saves.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.locator('.insp-savebar').waitFor({ state: 'detached' })
  await page.waitForTimeout(3500)
  const after = JSON.parse(await readOpfs(page, '.radical/radical.json')).verifies?.[0]?.tests ?? []
  const check = JSON.parse(await readOpfs(page, '.radical/model/check.json'))
  console.log(`radical.json after the agent's set_verification: Pays binds ${before.length}: ${JSON.stringify(before)}`)
  console.log(`radical.json after Settings' Save: Pays binds ${after.length}: ${JSON.stringify(after)}`)
  console.log(`check.json after Save: ${JSON.stringify(check.rules)}`)
  await page.getByRole('tab', { name: /^Implementation/ }).click().catch(() => {})
  await page.screenshot({ path: join(DIR, 'shots/f3-after-save.png') })
  bug = before.length === 2 && after.length === 1
  if (b.problems.length) console.log('problems:', b.problems)
} finally {
  await b.close(); await m.close()
}
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exitCode = bug ? 1 : 0
