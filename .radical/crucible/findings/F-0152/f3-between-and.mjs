// F3: "between 8 and 64" in the person's words is never read as a range (the clause is cut at "and"),
// so a requirement that turns it into "at most 8" gets no quote-value-differs, while "from 8 to 64" does.
// Usage: node f3-between-and.mjs
import { runCases, has } from './wordcase.mjs'
const action = 'accept a password of at most 8 characters'
const r = await runCases('f3', [
  ['between-and', { answer: 'A password has between 8 and 64 characters.', action }],
  ['control-from-to', { answer: 'A password has from 8 to 64 characters.', action }],
])
const bug = has(r['control-from-to'], 'quote-value-differs') && !has(r['between-and'], 'quote-value-differs')
console.log(`\nquote-value-differs: from … to ${has(r['control-from-to'], 'quote-value-differs')}, between … and ${has(r['between-and'], 'quote-value-differs')}`)
console.log(`REPRODUCED: ${bug ? 'yes' : 'no'}`)
process.exitCode = bug ? 1 : 0
