// F4: review_requirements says "Nothing to review" when only a requirement's derives relation changed
// (its quote now rests on other words, or it newly derives from a need), though get_changes lists it.
// The model is committed to a throwaway git repository in the system's temp folder (removed at the end).
// Usage: node f4-review-misses-quote.mjs
import { mcp } from './lib.mjs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const root = mkdtempSync(join(tmpdir(), 'run210-f4-'))
const git = (...a) => execFileSync('git', ['-c', 'user.email=run210@localhost', '-c', 'user.name=run210', ...a], { cwd: root, encoding: 'utf8' })
git('init', '-q', '-b', 'main')
const m = await mcp(join(root, 'model'))
let missed = 0
try {
  await m.call('get_model_summary')
  const need = (await m.call('add_node', { tempId: 'need', type: 'need', label: 'Basket brief', description: 'Q: How many items may a basket hold?\nA: A basket holds at most 20 items.\n\nQ: How long is a basket kept?\nA: An idle basket is kept for 30 days.' })).text.match(/Created node ([\w-]+)/)[1]
  const req = (await m.call('add_node', { tempId: 'req', type: 'requirement', label: 'Basket limit', properties: { ears_type: 'ubiquitous', action: 'keep at most 20 items in a basket' } })).text.match(/Created node ([\w-]+)/)[1]
  const rel = (await m.call('add_relation', { sourceId: req, targetId: need, relationType: 'derives', properties: { quote: 'A basket holds at most 20 items.' } })).text.match(/Relation ID: ([\w-]+)/)[1]
  const req2 = (await m.call('add_node', { tempId: 'req2', type: 'requirement', label: 'Idle baskets', properties: { ears_type: 'ubiquitous', action: 'delete an idle basket after 7 days' } })).text.match(/Created node ([\w-]+)/)[1]
  git('add', '-A'); git('commit', '-qm', 'base')
  console.log('1. Committed: need "Basket brief"; "Basket limit" quotes "A basket holds at most 20 items."; "Idle baskets" derives from nothing yet.')
  await m.call('update_relation', { id: rel, properties: { quote: 'An idle basket is kept for 30 days.' } })
  console.log('2. update_relation: the quote of "Basket limit" -> "An idle basket is kept for 30 days."')
  await m.call('add_relation', { sourceId: req2, targetId: need, relationType: 'derives', properties: { quote: 'An idle basket is kept for 30 days.' } })
  console.log('3. add_relation: "Idle baskets" derives from "Basket brief", quoting "An idle basket is kept for 30 days."')
  const changes = (await m.call('get_changes', { since: 'HEAD' })).text
  console.log('\nget_changes since HEAD:\n' + changes.split('\n').slice(0, 9).join('\n'))
  const review = (await m.call('review_requirements', { since: 'HEAD' })).text
  console.log('\nreview_requirements since HEAD:\n' + review.slice(0, 400))
  if (/^Nothing to review/.test(review)) missed = 2
  else missed = ['Basket limit', 'Idle baskets'].filter((l) => !review.includes(`## Requirement "${l}"`)).length
  console.log(`\n${missed} of 2 requirements whose derives relation changed are left out of the review`)
} finally { await m.close(); rmSync(root, { recursive: true, force: true }) }
process.exitCode = missed ? 1 : 0
