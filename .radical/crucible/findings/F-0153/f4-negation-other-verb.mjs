// F4: a negation of another verb earlier in the sentence ("a guest who can't pay yet", "doesn't log in",
// "isn't logged in") turns the person's "at most 20 items" round: the requirement that copies "at most 20"
// is warned it allows up to 20 "where the words it quotes allow above 20 ("at most 20")".
// Usage: node f4-negation-other-verb.mjs
import { runCases, has } from './wordcase.mjs'
const action = 'keep at most 20 items in the basket of a guest'
const r = await runCases('f4', [
  ['cant-pay', { answer: "A guest who can't pay yet keeps at most 20 items in the basket.", action }],
  ['doesnt-log-in', { answer: "A guest who doesn't log in keeps at most 20 items in the basket.", action }],
  ['cannot-pay', { answer: 'A guest who cannot pay yet keeps at most 20 items in the basket.', action }],
  ['control', { answer: 'A guest who logs in later keeps at most 20 items in the basket.', action }],
])
const wrong = ['cant-pay', 'doesnt-log-in', 'cannot-pay'].filter((k) => has(r[k], 'quote-value-differs'))
console.log(`\n${wrong.length} of 3 negated sentences read as "above 20"; control: ${r.control.length} findings`)
console.log(`REPRODUCED: ${wrong.length ? 'yes' : 'no'}`)
process.exitCode = wrong.length ? 1 : 0
