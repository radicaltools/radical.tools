// F1: an MCP write that removes some of a requirement's findings about the person's words answers with
// the ones left as if the write brought them in: correcting one of two wrong values, quoting one of the
// two parts of an answer, adding a second scenario. Usage: node f1-partial-fix-reported.mjs
import { mcp, freshFolder, DIR } from './lib.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
const f = freshFolder('f1')
const m = await mcp(f)
const words = (t) => (t.split('review_requirements shows them side by side):')[1] ?? '').trim().split('\n').filter(Boolean)
const log = []; const say = (s) => { console.log(s); log.push(s) }
let reported = 0
const step = async (what, name, args, improves) => {
  const r = await m.call(name, args)
  const w = words(r.text)
  say(`\n${what}\n  reported as brought in: ${w.length ? '\n  ' + w.join('\n  ') : '(nothing)'}`)
  if (improves) reported += w.length
}
try {
  await m.call('get_model_summary')
  await m.call('add_node', { tempId: 'need', type: 'need', label: 'Basket brief', description: 'Q: What are the limits?\nA: A basket holds at most 20 items and is kept for 30 days.\n\nQ: What else?\nA: Members pay no delivery fee.\n\nA guest pays 5 € for delivery.' })
  await m.call('add_node', { tempId: 'req', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 25 items in a basket for 7 days' } })
  await step('1. add_relation derives quoting "A basket holds at most 20 items and is kept for 30 days." (requirement says 25 and 7)', 'add_relation', { sourceId: 'req', targetId: 'need', relationType: 'derives', properties: { quote: 'A basket holds at most 20 items and is kept for 30 days.' } }, false)
  await step('2. update_node: correct 25 to 20 (7 days still wrong, as before)', 'update_node', { id: 'req', properties: { action: 'keep at most 20 items in a basket for 7 days' } }, true)
  await step('3. update_node: correct 7 to 30', 'update_node', { id: 'req', properties: { action: 'keep at most 20 items in a basket for 30 days' } }, true)
  await m.call('add_node', { tempId: 'req2', type: 'requirement', label: 'Member delivery', properties: { ears_type: 'ubiquitous', action: 'charge members no delivery fee' } })
  await step('4. add_relation: "Member delivery" quotes the first of the two paragraphs of an answer no requirement quoted', 'add_relation', { sourceId: 'req2', targetId: 'need', relationType: 'derives', properties: { quote: 'Members pay no delivery fee.' } }, true)
  await m.call('add_node', { tempId: 'sc', type: 'scenario', label: 'Full basket', properties: { given: 'a basket', when: 'adding an item', then: 'it is refused' } })
  await step('5. add_relation: scenario "Full basket" verifies "Basket limit" (names neither 20 nor 30)', 'add_relation', { sourceId: 'sc', targetId: 'req', relationType: 'verifies' }, false)
  await step('6. update_node: the scenario names 20 (30 still missing, as before)', 'update_node', { id: 'sc', properties: { given: 'a basket with 20 items' } }, true)
  await m.call('add_node', { tempId: 'sc2', type: 'scenario', label: 'Old basket', properties: { given: 'a basket', when: 'time passes', then: 'it is gone' } })
  await step('7. add_relation: a second scenario "Old basket" verifies "Basket limit"', 'add_relation', { sourceId: 'sc2', targetId: 'req', relationType: 'verifies' }, true)
} finally { await m.close() }
say(`\n${reported} findings reported as brought in by writes (2, 3, 4, 6, 7) that only took findings away`)
mkdirSync(join(DIR, 'shots'), { recursive: true }); writeFileSync(join(DIR, 'shots', 'f1.txt'), log.join('\n') + '\n')
console.log(`REPRODUCED: ${reported ? 'yes' : 'no'}`)
process.exitCode = reported ? 1 : 0
