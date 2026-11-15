// Q6 (question): since values keep their sign, a discount written "-10%" or a subtraction "minus 5 €" in the
// person's words is a negative value: a requirement that says "a discount of 10%" or "subtract 5 €" is warned
// twice (the quote's -10% missing, its own 10% unquoted). Usage: node q6-discount-sign.mjs
import { runCases, has } from './wordcase.mjs'
const r = await runCases('q6', [
  ['discount', { answer: 'Members get -10% on every basket.', action: 'give members a discount of 10% on every basket' }],
  ['subtraction', { answer: 'A member pays the basket total minus 5 € delivery.', action: 'subtract 5 € delivery from the basket total of a member' }],
])
const warned = Object.values(r).filter((f) => has(f, 'quote-value-missing') && has(f, 'requirement-value-unquoted')).length
console.log(`\n${warned} of 2 faithful rewrites warned twice`)
console.log(`REPRODUCED: ${warned ? 'yes' : 'no'}`)
process.exitCode = warned ? 1 : 0
