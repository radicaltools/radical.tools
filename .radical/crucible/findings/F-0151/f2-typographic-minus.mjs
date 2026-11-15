// F2: a need that writes its minus as a typographic dash (–18 °C, as word processors set it): the value is
// read as 18, while the limit is read as -18. A requirement that drops the sign passes the check, and one
// that copies the value with a hyphen gets two warnings. Usage: node f2-typographic-minus.mjs
import { runCases, has } from './wordcase.mjs'
const answer = 'The freezer alarm sounds when the temperature rises above –18 °C.'
const r = await runCases('f2', [
  ['drops-sign', { answer, action: 'sound the freezer alarm when the temperature rises above 18 °C' }],
  ['copies-with-hyphen', { answer, action: 'sound the freezer alarm when the temperature rises above -18 °C' }],
  ['control-hyphen-drop', { answer: answer.replace('–', '-'), action: 'sound the freezer alarm when the temperature rises above 18 °C' }],
])
const bug = !has(r['drops-sign'], 'quote-value-missing') || r['copies-with-hyphen'].length > 0
console.log(`\ndrop of the sign found: ${has(r['drops-sign'], 'quote-value-missing')} (with a hyphen: ${has(r['control-hyphen-drop'], 'quote-value-missing')}); findings on the faithful copy: ${r['copies-with-hyphen'].length}`)
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exitCode = bug ? 1 : 0
