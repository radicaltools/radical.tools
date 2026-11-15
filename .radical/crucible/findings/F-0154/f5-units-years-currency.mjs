// F5: a requirement that changes the person's unit passes the check when the unit is years, months or a
// currency: 10 years written as 10 days, 6 months as 6 weeks, 5 € as 5 USD; 30 days as 30 minutes is warned.
// Usage: node f5-units-years-currency.mjs
import { runCases, has } from './wordcase.mjs'
const r = await runCases('f5', [
  ['years-to-days', { answer: 'Invoices are kept for 10 years.', action: 'keep invoices for 10 days' }],
  ['months-to-weeks', { answer: 'An idle basket is kept for 6 months.', action: 'keep an idle basket for 6 weeks' }],
  ['euro-to-usd', { answer: 'A guest pays 5 € for delivery.', action: 'charge a guest 5 USD for delivery' }],
  ['control-days-to-minutes', { answer: 'An idle basket is kept for 30 days.', action: 'keep an idle basket for 30 minutes' }],
])
const silent = ['years-to-days', 'months-to-weeks', 'euro-to-usd'].filter((k) => !r[k].length)
console.log(`\n${silent.length} of 3 changed units pass with no finding; control warned: ${has(r['control-days-to-minutes'], 'quote-value-differs')}`)
console.log(`REPRODUCED: ${silent.length ? 'yes' : 'no'}`)
process.exitCode = silent.length ? 1 : 0
