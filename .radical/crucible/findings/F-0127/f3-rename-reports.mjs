// F3: renaming a requirement or a need over MCP is answered with every finding about the
// person's words it had before, as if the rename brought them in. Usage: node f3-rename-reports.mjs
import { mcp, freshFolder } from './lib.mjs'
const f = freshFolder('f3')
const m = await mcp(f)
const words = (t) => (t.split("review_requirements shows them side by side):")[1] ?? '').trim().split('\n').filter(Boolean)
try {
  await m.call('get_model_summary')
  await m.call('add_node', { tempId: 'need', type: 'need', label: 'Basket brief', description: 'Q: How many items may a basket hold?\nA: A basket holds at most 20 items.\n\nQ: How long is a basket kept?\nA: An idle basket is kept for 30 days.' })
  await m.call('add_node', { tempId: 'req', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 25 items in a basket' } })
  const add = await m.call('add_relation', { sourceId: 'req', targetId: 'need', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })
  console.log('add_relation (brings in):', words(add.text))
  const r1 = await m.call('update_node', { id: 'req', label: 'Basket size' })
  console.log('\nupdate_node label of the requirement only:', words(r1.text))
  const r2 = await m.call('update_node', { id: 'need', label: 'Shop brief' })
  console.log('\nupdate_node label of the need only:', words(r2.text))
  const r3 = await m.call('update_node', { id: 'req', properties: { rationale: 'Agreed on the call.' } })
  console.log('\ncontrol, update_node rationale (no label):', words(r3.text))
  const n = words(r1.text).length + words(r2.text).length
  console.log(`\n${n} findings reported as brought in by two renames that change no word, value or quote`)
  process.exitCode = n ? 1 : 0
} finally { await m.close() }
