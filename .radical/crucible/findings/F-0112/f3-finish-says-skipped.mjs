// F3: forge_finish reports every stage that did not run as "skipped", though
// the agent skipped only two (forge_skip_stage, with a reason) and left the
// Requirements stage in clarifying; the run status Studio reads
// (.state/forge-run.json) says those stages are pending / clarifying.
//   node f3-finish-says-skipped.mjs
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { DIR, mcp, freshRepo } from './lib.mjs'
const dir = join(DIR, 'work/f3')
const folder = freshRepo(dir, null)
const m = await mcp(folder)
const must = async (name, args) => { const r = await m.call(name, args); if (!r.ok) throw new Error(`${name}: ${r.text}`); return r }
await must('forge_start', { description: 'A small shop: customers order books and pay by card.', languages: { conversation: 'English', model: 'English' } })
await must('forge_skip_stage', { stages: ['mockups', 'states'], reason: 'a back end, no lifecycles' })
await must('forge_clarify', { stage: 'requirements' })
const finish = await must('forge_finish', {})
await m.close()
const said = Object.fromEntries(finish.text.split('\n').filter((l) => l.startsWith('- ')).map((l) => { const [title, rest] = l.slice(2).split(': '); return [title, rest] }))
const status = JSON.parse(readFileSync(join(folder, '.state/forge-run.json'), 'utf8'))
console.log('forge_finish says:', JSON.stringify(said, null, 1))
console.log('forge-run.json (Studio):', status.state, JSON.stringify(status.stages.map((s) => `${s.id}: ${s.status}`)))
const toldSkipped = Object.values(said).filter((v) => v.startsWith('skipped')).length
const reallySkipped = status.stages.filter((s) => s.status === 'skipped').length
console.log(`agent told ${toldSkipped} stages skipped; ${reallySkipped} were skipped; Studio shows ${status.stages.filter((s) => s.status !== 'skipped').map((s) => s.status).join(', ')} for the others in a ${status.state} run`)
const bug = toldSkipped === 9 && reallySkipped === 2
console.log(bug ? 'BUG REPRODUCED' : 'not reproduced')
process.exitCode = bug ? 1 : 0
