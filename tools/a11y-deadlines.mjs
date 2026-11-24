#!/usr/bin/env node
// Fitness function "Tracked violations fixed in time" (Accessibility pack,
// FAILURES = deadline, FIX_DAYS = 30): the accessibility violations the
// checks accept, apps/e2e/a11y-known.json (tests/a11y/known.ts), each with an
// issue and a due date at most FIX_DAYS days after it was found. It counts
// the entries past their due date, due too late, without an issue, or with a
// date that is not one, prints them, and exits 1 on any. Run nightly: a
// due date passes without any change to the code.
//
// It is the sensor a11y-deadlines of .radical/sensors/sensors.json: with
// --context (radical sense run) it reads only the entries of the element's
// front end (an entry's `front` is the folder it is built from, matched to the
// element's paths in .radical/radical.json) and writes a11y.known.open,
// .overdue, .too_late, .no_issue, .invalid and .unfiled (an issue that is no
// link or number yet) as radical-metrics/1 to the context's metricsOut.
// Without --context it reads every entry: node tools/a11y-deadlines.mjs
//
//   --known <file>   the list (default apps/e2e/a11y-known.json)
//   --today <date>   YYYY-MM-DD (default: today, UTC)
//   --days <n>       FIX_DAYS (default 30)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = join(import.meta.dirname, '..')
const DAY = 86_400_000
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The counts over `entries`, and the entries each problem concerns. */
export function deadlines(entries, { today, days }) {
  const time = (d) => (DATE.test(d ?? '') ? Date.parse(`${d}T00:00:00Z`) : NaN)
  const invalid = entries.filter((e) => Number.isNaN(time(e.found)) || Number.isNaN(time(e.due)))
  const dated = entries.filter((e) => !invalid.includes(e))
  const overdue = dated.filter((e) => e.due < today)
  const tooLate = dated.filter((e) => (time(e.due) - time(e.found)) / DAY > days)
  const noIssue = entries.filter((e) => !String(e.issue ?? '').trim())
  const unfiled = entries.filter((e) => !noIssue.includes(e) && !/^(https?:\/\/\S+|#\d+)$/.test(String(e.issue).trim()))
  return {
    counts: { open: entries.length, overdue: overdue.length, too_late: tooLate.length, no_issue: noIssue.length, invalid: invalid.length, unfiled: unfiled.length },
    overdue, tooLate, noIssue, invalid, unfiled,
  }
}

/** Whether a front end's folder is one of the element's paths, or in one. */
export const inPaths = (front, paths) => paths.some((p) => p === '.' || p === '' || p === front || p.startsWith(`${front}/`) || front.startsWith(`${p}/`))

/** Runs the check; returns the exit status. */
export function main(argv, out = console) {
  const { values } = parseArgs({ args: argv, options: { known: { type: 'string' }, today: { type: 'string' }, days: { type: 'string' }, context: { type: 'string' } }, strict: true })
  const context = values.context ? JSON.parse(values.context) : null
  const element = context?.element
  if (context && !element) { out.error('no element in --context: run this sensor with radical sense run'); return 2 }
  if (element && !element.paths?.length) { out.error(`no paths for ${element.type} "${element.label}" (${element.id}) in .radical/radical.json`); return 2 }
  const file = resolve(ROOT, values.known ?? 'apps/e2e/a11y-known.json')
  const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  if (!Array.isArray(all)) { out.error(`${file} is not a list`); return 2 }
  const entries = element ? all.filter((e) => inPaths(String(e.front ?? ''), element.paths)) : all
  const today = values.today ?? new Date().toISOString().slice(0, 10)
  const days = Number(values.days ?? 30)
  const found = deadlines(entries, { today, days })
  if (context?.metricsOut) {
    writeFileSync(context.metricsOut, JSON.stringify({
      format: 'radical-metrics', version: 1, source: 'a11y-deadlines', at: new Date().toISOString(),
      measurements: Object.entries(found.counts).map(([name, value]) => ({ metric: `a11y.known.${name}`, value })),
    }, null, 1))
  }
  const where = element ? `${element.label}: ` : ''
  const line = (e) => `  ${e.state}: ${e.rule} (issue ${e.issue || 'none'}, found ${e.found}, due ${e.due})`
  const problems = [
    ['past their due date', found.overdue],
    [`due more than ${days} days after they were found`, found.tooLate],
    ['without an issue', found.noIssue],
    ['without a found or due date (YYYY-MM-DD)', found.invalid],
  ].filter(([, list]) => list.length)
  for (const [what, list] of problems) out.error(`${where}${list.length} tracked accessibility violation${list.length === 1 ? '' : 's'} ${what}:\n${list.map(line).join('\n')}`)
  if (problems.length) return 1
  const next = entries.map((e) => e.due).sort()[0]
  out.log(`${where}${entries.length} tracked accessibility violation${entries.length === 1 ? '' : 's'}, none overdue${next ? `; the next is due ${next}` : ''}${found.counts.unfiled ? `; ${found.counts.unfiled} with no issue filed yet` : ''}.`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
