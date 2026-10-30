import { readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { MEASUREMENTS_FILE, REVIEWS_FILE, addReview, isSensorName, mergeMeasurements, metricsFileProblems, parseMeasure, parseMeasurementStore, parseMetricsFile, serializeMeasurementStore, serializeMetricsFile } from '@radical/common/check'
import { MD_MANIFEST_FILE, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { writeBeside, type Io } from './check'
import { SENSOR_ADAPTERS, sensorAdapter } from './sensors/registry'

export const SENSE_USAGE = `Usage: radical sense <adapter> [input] [options]
       radical sense run --trigger <event> --out <dir> [--folder <dir>] [--context <k=v>]
       radical sense review <name> --passed|--failed --by <who> [--note <text>] [--folder <dir>]

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

run measures what the model says: every line of the measure of each
automated fitness function triggered on <event> (pull-request, nightly,
weekly, release, deploy), with its adapter, into one radical-metrics/1 file
a line in <dir>. It names each line it could not measure.

review records a person's review of a manual fitness function in the model
folder's reviews.json, kept in git; its \`review(<name>) passed\` condition
reads the latest review of <name>.

Adapters:
${SENSOR_ADAPTERS.map((a) => `  ${a.name.padEnd(18)}${a.description}`).join('\n')}
radical sense <adapter> --help shows an adapter's own options.

Exit status: 0 measured (whatever the values), 2 nothing measured (run: a\nline could not be measured).`

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

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fitness-function'

/** `radical sense run`: the measure lines of the fitness functions triggered
 *  on the event, each run with its adapter into a file of the directory. */
async function runCommand(args: string[], io: Io, now: () => Date): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({ args, options: { trigger: { type: 'string' }, out: { type: 'string' }, folder: { type: 'string' }, context: { type: 'string', multiple: true } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${SENSE_USAGE}`)
    return 2
  }
  const { trigger, out, folder: given, context } = parsed.values
  if (!trigger || !out) { io.err(SENSE_USAGE); return 2 }
  const folder = resolve(io.cwd, given ?? '.')
  let nodes
  try {
    if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) throw new Error(`no ${MD_MANIFEST_FILE}`)
    nodes = deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder), { writeCache: false }).readAll()).data.nodes
  } catch (error) {
    io.err(`Cannot read the model folder ${given ?? '.'}: ${(error as Error).message}`)
    return 2
  }
  const fields = (n: unknown): Record<string, unknown> => n as Record<string, unknown>
  const due = nodes.filter((n) => n.type === 'fitness-fn' && fields(n).cadence === 'triggered' && fields(n).trigger === trigger && fields(n).invocation === 'automated')
  const extra = (context ?? []).flatMap((c) => ['--context', c])
  let failed = 0
  let ran = 0
  for (const node of due) {
    const lines = parseMeasure(fields(node).measure)
    for (const [i, line] of lines.entries()) {
      ran++
      const file = join(resolve(io.cwd, out), `${slug(node.label)}${lines.length > 1 ? `-${i + 1}` : ''}.json`)
      if (!isSensorName(line.sensor)) {
        failed++
        io.err(`${node.label}: cannot measure "${line.raw}": no sensor ${line.sensor}.`)
        continue
      }
      const errors: string[] = []
      // The run's own options before the line's words, which may end in
      // a command after --.
      const code = await senseCommand([line.sensor, '--out', file, ...extra, ...line.args], { ...io, err: (text) => { errors.push(text); io.err(text) } }, now)
      if (code === 0) io.out(`${node.label}: measured "${line.raw}" into ${file}`)
      else {
        failed++
        io.err(`${node.label}: cannot measure "${line.raw}": ${errors[0]?.split('\n')[0] ?? `exit status ${code}`}`)
      }
    }
  }
  if (!ran) io.out(`No automated fitness function triggered on ${trigger} has a measure.`)
  return failed ? 2 : 0
}

/** `radical sense review`: a person's review, added to reviews.json. */
async function reviewCommand(args: string[], io: Io, now: () => Date): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { passed: { type: 'boolean', default: false }, failed: { type: 'boolean', default: false }, by: { type: 'string' }, note: { type: 'string' }, folder: { type: 'string' } } })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${SENSE_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  const name = positionals.join(' ').trim()
  if (!name || values.passed === values.failed || !values.by?.trim()) {
    io.err(`radical sense review needs the name of what was reviewed, one of --passed and --failed, and --by.\n\n${SENSE_USAGE}`)
    return 2
  }
  const folder = resolve(io.cwd, values.folder ?? '.')
  if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) {
    io.err(`${values.folder ?? 'The working directory'} is no model folder (no ${MD_MANIFEST_FILE}); name one with --folder.`)
    return 2
  }
  const path = join(folder, REVIEWS_FILE)
  const existing = await readFile(path, 'utf8').catch(() => undefined)
  const result = values.passed ? 'passed' : 'failed'
  let text
  try {
    text = addReview(existing, { name, result, by: values.by.trim(), at: now().toISOString(), ...(values.note?.trim() ? { note: values.note.trim() } : {}) })
  } catch (error) {
    io.err(`Cannot read ${REVIEWS_FILE}: ${(error as Error).message}`)
    return 2
  }
  await writeFile(path, text, 'utf8')
  io.out(`Recorded in ${REVIEWS_FILE}: ${name} ${result}, by ${values.by.trim()}. Commit it with the model.`)
  return 0
}

/** Runs `radical sense` with `args` (after the command name); returns the exit status. */
export async function senseCommand(args: string[], io: Io, now: () => Date = () => new Date()): Promise<number> {
  if (args[0] === 'run') return runCommand(args.slice(1), io, now)
  if (args[0] === 'review') return reviewCommand(args.slice(1), io, now)
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
