// F1: forge_finish ends a run while a stage is still open (generating, or
// with a refinement proposal waiting for the user's answer). After the
// "finished" run the MCP server still guards the model tools as if the
// stage ran: add_node of a system, update_node and delete_node of the
// requirement the first stage made are refused, and .state/forge-run.json
// (Studio's view of the run) shows the stage generating / waiting for an
// answer in a finished run.
//   node f1-finished-run-still-guards.mjs
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { DIR, mcp, freshRepo } from './lib.mjs'
const results = []
for (const withProposal of [false, true]) {
  const folder = freshRepo(join(DIR, `work/f1-${withProposal ? 'proposal' : 'open'}`), null)
  const m = await mcp(folder)
  const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
  await must('forge_start', { description: 'A small shop: customers order books and pay by card.', languages: { conversation: 'English', model: 'English' }, views: { structure: 'layers' } })
  await must('forge_clarify', { stage: 'requirements' })
  await must('forge_generate', { stage: 'requirements', concerns: [] })
  await must('add_node', { type: 'requirement', label: 'Pay by card', tempId: 'req' })
  await must('forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
  await must('forge_clarify', { stage: 'domain' })
  await must('forge_generate', { stage: 'domain' })
  if (withProposal) await must('forge_propose_refinement', { stage: 'domain', reason: 'Refunds are missing.', changes: [{ tool: 'add_node', input: { type: 'requirement', label: 'Refund a payment', tempId: 'r2' } }] })
  const finish = await m.call('forge_finish', {})
  const status = JSON.parse(readFileSync(join(folder, '.state/forge-run.json'), 'utf8'))
  const domain = status.stages.find((s) => s.id === 'domain')
  console.log(`\n== Domain stage ${withProposal ? 'with a proposal waiting' : 'open'}, then forge_finish: ${finish.ok ? 'accepted' : 'refused'}`)
  console.log(`forge_finish: ${finish.text.split('\n').find((l) => l.startsWith('- Domain'))}`)
  console.log(`forge-run.json: state ${status.state}, domain ${JSON.stringify(domain)}`)
  const after = []
  for (const [name, args] of [['add_node', { type: 'system', label: 'Shop', tempId: 'sys' }], ['update_node', { id: 'req', label: 'Pay by card or cash' }], ['delete_node', { id: 'req' }]]) {
    const r = await m.call(name, args)
    after.push(r.ok)
    console.log(`after the finish, ${name}: ${r.ok ? 'ok' : `REFUSED - ${r.text}`}`)
  }
  await m.close()
  results.push(finish.ok && status.state === 'finished' && after.some((ok) => !ok))
}
const bug = results.every(Boolean)
console.log(`\nREPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exitCode = bug ? 1 : 0
