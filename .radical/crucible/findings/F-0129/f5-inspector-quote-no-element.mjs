// F5: in Studio's Inspector the findings about a requirement's quote (derives-quote-not-in-need, an error,
// quote-value-missing, quote-value-differs) name no element and have no Open, though the Overview says each
// finding leads to its element; requirement-value-unquoted of the same requirement has both.
// The model is written through the MCP server into work/f5, then copied into the browser's own folder.
// Usage: node f5-inspector-quote-no-element.mjs [port=4510]
import { mcp, freshFolder, readTree, launchFolder, opfsWrite, openFolder, DIR } from './lib.mjs'
const port = Number(process.argv[2] ?? 4510)
const f = freshFolder('f5')
const m = await mcp(f)
try {
  await m.call('get_model_summary')
  await m.call('add_node', { tempId: 'need', type: 'need', label: 'Basket brief', description: 'Q: How many items may a basket hold?\nA: A basket holds at most 20 items.\n\nQ: How long is a basket kept?\nA: An idle basket is kept for 30 days.' })
  await m.call('add_node', { tempId: 'r1', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 25 items in a basket' } })
  await m.call('add_relation', { sourceId: 'r1', targetId: 'need', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })
  await m.call('add_node', { tempId: 'r2', type: 'requirement', label: 'Basket kept', properties: { ears_type: 'ubiquitous', action: 'keep an idle basket for 30 days' } })
  await m.call('add_relation', { sourceId: 'r2', targetId: 'need', relationType: 'derives', properties: { quote: 'An idle basket is kept for 7 days.' } })
  await m.call('create_view', { name: 'Requirements', nodeIds: ['need', 'r1', 'r2'] })
} finally { await m.close() }
const files = readTree(f)
const { page, problems, close } = await launchFolder({ port })
let bad = 0
try {
  await page.goto('/')
  for (const [p, c] of Object.entries(files)) if (!p.startsWith('.state/')) await opfsWrite(page, p, c)
  // A check report beside the model (radical check --report), so that the Inspector opens.
  await opfsWrite(page, '.state/test-results.json', JSON.stringify({ version: 1, readAt: new Date().toISOString(), reports: ['reports/unit.json'], cases: [] }))
  await openFolder(page)
  await page.getByRole('button', { name: /^Inspector/ }).click()
  await page.locator('.insp-finding').first().waitFor()
  await page.waitForTimeout(1000)
  console.log('Overview says:', (await page.getByText(/each finding below leads/).first().innerText()).replace(/\n/g, ' '))
  await page.locator('details.insp-group').evaluateAll((ds) => ds.forEach((d) => { d.open = true }))
  const rows = await page.locator('.insp-finding').evaluateAll((els) => els.map((e) => ({ rule: e.dataset.rule, chip: !!e.querySelector('.insp-chip, [class*="chip"]'), open: [...e.querySelectorAll('button')].some((b) => /^Open /.test(b.getAttribute('aria-label') ?? '')), text: e.innerText.replace(/\s*\n\s*/g, ' / ') })))
  for (const r of rows.filter((r) => /quote|value/.test(r.rule))) {
    console.log(`${r.open ? 'Open   ' : 'NO OPEN'} ${r.rule}: ${r.text}`)
    if (!r.open) bad++
  }
  await page.locator('.insp-finding[data-rule="derives-quote-not-in-need"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/shots/f5-inspector.png` })
  console.log(`\n${bad} findings about the person's words lead to no element`)
  if (problems.length) console.log(problems)
} finally { await close() }
process.exitCode = bad ? 1 : 0
