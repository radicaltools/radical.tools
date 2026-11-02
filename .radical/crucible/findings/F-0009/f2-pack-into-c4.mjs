// F2: Studio imports a concern pack into a model on the C4 metamodel, which
// has no ADR, need, requirement, scenario or fitness-function types; its own
// validation then flags every imported element. The MCP server refuses the
// same import.
// node f2-pack-into-c4.mjs   (Studio on 4572, Hub on 4672)
import { launch, seed, open, stored, waitFor, addPack, fixture, DIR } from './lib.mjs'
import { connect, call } from './mcp.mjs'
import { rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

let studioBug = false, mcpRefuses = false
const { browser, page, errors, outside } = await launch()
try {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-builtin', name: 'C4 (built-in)', nodeTypes: {}, relationTypes: {} }
  await seed(page, doc)
  await open(page, 'v-containers')
  await page.waitForTimeout(1000)
  const palette = await page.locator('.palette-item').allInnerTexts()
  console.log('palette:', palette.map((t) => t.trim()).join(', '))
  const before = await stored(page)
  const wizard = await addPack(page, 'Authentication')
  console.log('wizard says:', (await wizard.locator('.nw-body').innerText()).trim())
  console.log('Add to model enabled:', await wizard.getByRole('button', { name: 'Add to model' }).first().isEnabled())
  await wizard.getByRole('button', { name: 'Add to model' }).first().click()
  await waitFor(async () => (await stored(page)).nodes.length > before.nodes.length, 8000)
  const after = await stored(page)
  const added = after.nodes.filter((n) => !before.nodes.some((b) => b.id === n.id))
  console.log(`imported ${added.length} elements of types ${[...new Set(added.map((n) => n.type))].join(', ')}`)
  await page.screenshot({ path: DIR + 'shots/f2-canvas.png' })
  await page.goto(page.url().replace('/m/designer/', '/m/metamodel/'))
  await page.waitForTimeout(2500)
  const body = await page.locator('body').innerText()
  const unknown = body.match(/has unknown type "[a-z-]+"/g) ?? []
  console.log(`metamodel editor validation: ${unknown.length} "unknown type" issues, e.g. ${unknown[0]}`)
  await page.screenshot({ path: DIR + 'shots/f2.png' })
  studioBug = added.length > 0 && unknown.length > 0
  console.log('errors', errors, 'outside', outside)
} finally { await browser.close() }

// The same through the MCP server, on a folder whose metamodel holds the C4 types only.
const folder = new URL('./models/f2', import.meta.url).pathname
rmSync(folder, { recursive: true, force: true }); mkdirSync(folder, { recursive: true })
let c = await connect(folder)
await call(c, 'get_model_summary')
await c.close()
const mm = JSON.parse(readFileSync(folder + '/metamodel.json', 'utf8'))
const keep = ['person', 'system', 'container', 'component', 'database', 'webapp', 'queue', 'group']
mm.id = 'c4-only'; mm.name = 'C4 only'; mm.viewpoints = []
mm.nodeTypes = Object.fromEntries(Object.entries(mm.nodeTypes).filter(([k]) => keep.includes(k)))
mm.relationTypes = Object.fromEntries(Object.entries(mm.relationTypes)
  .map(([k, r]) => [k, { ...r, allowedPairs: r.allowedPairs.filter((p) => keep.includes(p.from) && keep.includes(p.to)) }])
  .filter(([, r]) => r.allowedPairs.length))
writeFileSync(folder + '/metamodel.json', JSON.stringify(mm, null, 2))
c = await connect(folder)
await call(c, 'add_node', { tempId: 's', type: 'system', label: 'Shop' })
const r = await call(c, 'forge_import_hub_concept', { conceptId: 'concern-authentication' })
console.log('MCP forge_import_hub_concept:', r.error ? 'refused:' : 'done:', r.text.split('\n')[0])
mcpRefuses = r.error
await c.close()

const bug = studioBug && mcpRefuses
console.log(bug ? 'REPRODUCED' : 'not reproduced')
process.exit(bug ? 1 : 0)
