// F2: a requirement that drops the minus sign of the person's value passes the check.
// Usage: node f2-minus-sign.mjs
import { quoteCase } from './words.mjs'
const answer = 'The freezer alarm sounds when the temperature rises above -18 °C.'
const cases = {
  'sign dropped': 'sound the freezer alarm when the temperature rises above 18 °C',
  'control: minus as a word (the same value)': 'sound the freezer alarm when the temperature rises above minus 18 °C',
  'control: another number': 'sound the freezer alarm when the temperature rises above -17 °C',
}
let silent = 0
for (const [k, action] of Object.entries(cases)) {
  const { report, check } = await quoteCase('f2', { answer, action })
  console.log(`\n[${k}] "The system shall ${action}."\n  MCP add_relation says: ${report || '(nothing)'}\n  radical check: ${check.length ? check.join(' | ') : '(no finding)'}`)
  if (k === 'sign dropped' && !check.length) silent++
}
console.log(`\nThe person said -18 °C; a requirement that says 18 °C gets ${silent ? 'no finding' : 'a finding'}`)
process.exitCode = silent ? 1 : 0
