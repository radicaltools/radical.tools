// F1: a requirement that says "cannot exceed 20" is reported as allowing more than 20,
// against the person's "at most 20". Usage: node f1-cannot-exceed.mjs
import { quoteCase } from './words.mjs'
const answer = 'A basket holds at most 20 items.'
const cases = {
  'cannot exceed': 'ensure that a basket cannot exceed 20 items',
  "can't exceed": "ensure that a basket can't exceed 20 items",
  "doesn't exceed": "ensure that a basket doesn't exceed 20 items",
  'cannot hold more than': 'ensure that a basket cannot hold more than 20 items',
  'control: holds at most': 'ensure that a basket holds at most 20 items',
  'control: holds more than (a real error)': 'let a basket hold more than 20 items',
}
let wrong = 0
for (const [k, action] of Object.entries(cases)) {
  const { report, check } = await quoteCase('f1', { answer, action })
  const differs = check.filter((c) => c.startsWith('quote-value-differs'))
  console.log(`\n[${k}] "The system shall ${action}."\n  MCP add_relation says: ${report || '(nothing)'}\n  radical check: ${differs.length ? differs.join(' | ') : 'no quote-value-differs'}`)
  if (!k.startsWith('control') && differs.length) wrong++
}
console.log(`\n${wrong} of 4 requirements that keep the limit are reported as turning it round`)
process.exitCode = wrong ? 1 : 0
