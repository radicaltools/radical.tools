import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { MEASUREMENTS_FILE, mergeMeasurements, metricsFileProblems, parseMeasurementStore, parseMetricsFile, serializeMeasurementStore, serializeMetricsFile } from '@radical/common/check'
import { MD_MANIFEST_FILE } from '@radical/common/formats/mdFolder'
import { writeBeside, type Io } from './check'
import { SENSOR_ADAPTERS, sensorAdapter } from './sensors/registry'

export const SENSE_USAGE = `Usage: radical sense <adapter> [input] [options]

Measures with one sensor adapter and keeps what it measured beside the model,
in .radical/measurements.json, for radical check and Studio's Inspector. A
sensor only measures: the conditions in the model's metrics judge the values.

  --folder <dir>      the model folder (default: the working directory)
  --out <file>        write a radical-metrics/1 file there instead (an artifact
                      for the job that runs radical check --metrics)
  --label <k=v>       a label on every measurement, which conditions match
                      (\`api.latency.p95{env=staging} <= 300 ms\`); repeat for more
  --context <k=v>     where it was measured (a commit, a run), shown, not matched
  --list              list the adapters

Adapters:
${SENSOR_ADAPTERS.map((a) => `  ${a.name.padEnd(18)}${a.description}`).join('\n')}
radical sense <adapter> --help shows an adapter's own options.

Exit status: 0 measured (whatever the values), 2 nothing measured.`

const COMMON = {
  folder: { type: 'string' },
  out: { type: 'string' },
  label: { type: 'string', multiple: true },
  context: { type: 'string', multiple: true },
  list: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const

function pairs(list: string[] | undefined, option: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of list ?? []) {
    const m = /^([\w.-]+)=(.*)$/.exec(item)
    if (!m) throw new Error(`--${option} ${item} is not <name>=<value>`)
    out[m[1]] = m[2]
  }
  return out
}

/** Runs `radical sense` with `args` (after the command name); returns the exit status. */
export async function senseCommand(args: string[], io: Io, now: () => Date = () => new Date()): Promise<number> {
  const name = args[0] && !args[0].startsWith('-') ? args[0] : undefined
  const adapter = name ? sensorAdapter(name) : undefined
  if (!name) {
    if (args.includes('--list')) { for (const a of SENSOR_ADAPTERS) io.out(`${a.name.padEnd(18)}${a.description}`); return 0 }
    if (args.includes('--help') || args.includes('-h')) { io.out(SENSE_USAGE); return 0 }
    io.err(SENSE_USAGE)
    return 2
  }
  if (!adapter) {
    io.err(`No sensor adapter ${name}. The adapters: ${SENSOR_ADAPTERS.map((a) => a.name).join(', ')}.`)
    return 2
  }
  // A command's own words follow --, untouched.
  const dash = args.indexOf('--')
  const own = dash < 0 ? args.slice(1) : args.slice(1, dash)
  const after = dash < 0 ? [] : args.slice(dash + 1)
  let parsed
  try {
    parsed = parseArgs({ args: own, allowPositionals: true, options: { ...COMMON, ...(adapter.options ?? {}) } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${adapter.usage}`)
    return 2
  }
  const { values, positionals } = parsed as { values: Record<string, string | boolean | string[] | undefined>; positionals: string[] }
  if (values.help) { io.out(adapter.usage); return 0 }

  let labels: Record<string, string>
  let context: Record<string, string>
  try {
    labels = pairs(values.label as string[] | undefined, 'label')
    context = pairs(values.context as string[] | undefined, 'context')
  } catch (error) {
    io.err((error as Error).message)
    return 2
  }
  const options = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in COMMON)))
  let measured
  try {
    measured = await adapter.measure({ args: [...positionals, ...after], options, cwd: io.cwd })
  } catch (error) {
    io.err(`radical sense ${adapter.name}: ${(error as Error).message}\n\n${adapter.usage}`)
    return 2
  }

  const text = serializeMetricsFile({
    source: adapter.name,
    at: now().toISOString(),
    ...(Object.keys(context).length ? { context } : {}),
    measurements: measured.map((m) => ({ ...m, ...(Object.keys(labels).length || m.labels ? { labels: { ...(m.labels ?? {}), ...labels } } : {}) })),
  })
  const problems = metricsFileProblems(JSON.parse(text))
  if (problems.length) {
    io.err(`radical sense ${adapter.name} measured something that is no radical-metrics/1: ${problems.join('; ')}`)
    return 2
  }
  if (typeof values.out === 'string') {
    await writeBeside(resolve(io.cwd, values.out), text)
  } else {
    const folder = resolve(io.cwd, typeof values.folder === 'string' ? values.folder : '.')
    if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) {
      io.err(`${typeof values.folder === 'string' ? values.folder : 'The working directory'} is no model folder (no ${MD_MANIFEST_FILE}); name one with --folder, or write a file with --out.`)
      return 2
    }
    const store = join(folder, MEASUREMENTS_FILE)
    const existing = await readFile(store, 'utf8').then(parseMeasurementStore, () => [])
    await writeBeside(store, serializeMeasurementStore(mergeMeasurements(existing, parseMetricsFile(text, adapter.name))))
  }
  for (const m of measured) io.out(`${m.metric} ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
  return 0
}
