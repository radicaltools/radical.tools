// The night's measurements, turned into findings (ADR Studio's speed is
// measured nightly). Each metric condition of an automated fitness function
// triggered on the night (--trigger nightly, as radical sense run --trigger
// nightly ran its measure) that does not hold, or that the night measured
// nothing for, becomes a finding in the findings
// folder (source sense), unless an open finding already says the same. The
// conditions are evaluated as radical check evaluates them; one against a
// baseline compares with the median of the earlier nights (--baseline), and
// makes no finding while there are none.
//
//   tsx tools/nightly-findings.ts <model folder> <findings folder>
//       --metrics <file|dir> [--metrics …] [--baseline <file|dir> …] --trigger <event>
//       [--commit <sha>] [--run <url>]
//
// Prints the findings written, one path a line; nothing when there are none.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { REVIEW_METRIC, evaluateMetric, parseConditions, parseMaxAge, parseMetricsFile, type Measurement } from '@radical/common/check'
import type { C4Node } from '@radical/common/c4'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { nextFindingId, readFindings, writeFinding, type Finding } from '@radical/crucible/findings'

export interface NightlyOptions {
  /** The event the night's fitness functions are triggered on (nightly). */
  trigger: string
  commit?: string
  /** The CI run, linked from the finding. */
  run?: string
  now: number
}

const OPEN = new Set(['open', 'question'])

/** The findings the night's `measurements` give for `nodes`, not counting
 *  those an open finding in `existing` already says. */
export function nightlyFindings(nodes: C4Node[], measurements: Measurement[], existing: Finding[], options: NightlyOptions, baseline: Measurement[] = []): Finding[] {
  const ids = existing.map((f) => f.id)
  const known = new Set(existing.filter((f) => OPEN.has(f.status)).map((f) => f.signature))
  const day = new Date(options.now).toISOString().slice(0, 10)
  const out: Finding[] = []
  for (const node of nodes) {
    const props = node as unknown as Record<string, unknown>
    if (node.type !== 'fitness-fn' || props.cadence !== 'triggered' || props.trigger !== options.trigger || props.invocation !== 'automated') continue
    const maxAge = parseMaxAge(props.max_age) ?? undefined
    for (const condition of parseConditions(props.metrics)) {
      if (condition.kind !== 'metric' || condition.metric === REVIEW_METRIC) continue
      const result = evaluateMetric(condition, measurements, maxAge, options.now, baseline)
      if (result.outcome === 'passed') continue
      // Measured, but no earlier night to compare with yet: nothing wrong.
      if (result.outcome === 'not-run' && result.measurement) continue
      const signature = `sense|${node.id}|${condition.raw}|${result.outcome === 'failed' ? 'failed' : 'not-measured'}`
      if (known.has(signature)) continue
      known.add(signature)
      const m = result.measurement
      const measured = m ? `${m.value}${m.unit ? ` ${m.unit}` : ''}` : null
      const where = m ? ` (${Object.entries(m.labels).map(([k, v]) => `${k}=${v}`).join(', ')}; ${m.source}, ${m.at}${m.context ? `; ${Object.entries(m.context).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''})` : ''
      const id = nextFindingId(ids)
      ids.push(id)
      const b = condition.baseline
      const limit = b
        ? `the baseline${b.by ? ` ${b.sign < 0 ? '-' : '+'} ${b.by}${b.percent ? '%' : ` ${b.unit}`}` : ''} (${result.detail})`
        : `${condition.op} ${condition.value}${condition.unit ? ` ${condition.unit}` : ''}`
      out.push({
        id,
        title: result.outcome === 'failed'
          ? `${node.label}: ${condition.metric} measured ${measured}, beyond ${limit}`
          : `${node.label}: the night measured no ${condition.metric}`,
        source: 'sense',
        status: 'open',
        rule: `${node.type === 'fitness-fn' ? 'Fitness function' : 'Scenario'} "${node.label}"`,
        signature,
        round: 'nightly',
        ...(options.commit ? { commit: options.commit.slice(0, 8) } : {}),
        found: day,
        steps: [
          `The nightly workflow (.github/workflows/nightly.yml) measures ${condition.metric}${options.commit ? ` on commit ${options.commit.slice(0, 8)}` : ''}${options.run ? ` (${options.run})` : ''}`,
          `radical check reads the condition "${condition.raw}" of ${node.type === 'fitness-fn' ? 'fitness function' : 'scenario'} "${node.label}"`,
        ],
        detail: [
          `Expected: ${condition.raw}`,
          `Actual: ${result.outcome === 'failed' ? `${measured}${where}${result.detail ? `; ${result.detail}` : ''}` : result.outcome === 'stale' ? `only a stale measurement, ${result.detail}` : result.outcome === 'invalid' ? `cannot be evaluated: ${result.detail}` : 'nothing measured'}`,
        ].join('\n'),
      })
    }
  }
  return out
}

/** The measurements in `paths`: radical-metrics/1 files, or folders of them. */
function readMeasurements(paths: string[]): Measurement[] {
  const files = paths.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => join(p, f)) : [p]))
  return files.flatMap((f) => parseMetricsFile(readFileSync(f, 'utf8'), f))
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { metrics: { type: 'string', multiple: true }, baseline: { type: 'string', multiple: true }, trigger: { type: 'string' }, commit: { type: 'string' }, run: { type: 'string' } },
  })
  const [folder, findingsDir] = positionals
  if (!folder || !findingsDir || !values.trigger) throw new Error('usage: nightly-findings <model folder> <findings folder> --metrics <file|dir> --trigger <event>')
  const files = await new MdFolderSession(diskFolderStorage(resolve(folder)), { writeCache: false }).readAll()
  const { data } = deserializeFromMdFolder(files)
  const there = (p: string): boolean => { try { statSync(p); return true } catch { return false } }
  const measurements = readMeasurements((values.metrics ?? []).filter(there))
  const baseline = readMeasurements((values.baseline ?? []).filter(there))
  const found = nightlyFindings(data.nodes, measurements, readFindings(findingsDir), { trigger: values.trigger, commit: values.commit, run: values.run, now: Date.now() }, baseline)
  for (const finding of found) console.log(writeFinding(findingsDir, finding))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error((error as Error).message)
    process.exit(2)
  })
}
