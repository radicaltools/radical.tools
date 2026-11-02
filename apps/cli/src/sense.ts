import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { ELEMENT_LABEL, MEASUREMENTS_FILE, REVIEWS_FILE, addReview, appliedElements, isSensorName, mergeMeasurements, metricsFileProblems, parseMeasure, parseMeasurementStore, parseMetricsFile, serializeMeasurementStore, serializeMetricsFile } from '@radical/common/check'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { MD_MANIFEST_FILE, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { originModel, originOf } from '@radical/common/model'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { readEditorStateFile } from '@radical/node-files/selectionFile'
import { writeBeside, type Io } from './check'
import { SENSORS_FILE, repositorySensors } from './repositorySensors'
import { REVIEWS_FILE as REPOSITORY_REVIEWS, elementPaths, mappingRoot, readRepositoryMapping, type MappedElement } from '@radical/node-files/repositoryLayout'
import { modelFolderArg } from './modelFolder'
import { composeFolder, federationOthers } from './federation'
import { SENSOR_ADAPTERS, sensorAdapter } from './sensors/registry'

export const SENSE_USAGE = `Usage: radical sense <adapter> [input] [options]
       radical sense run --trigger <event> --out <dir> [--folder <dir>] [--context <k=v>]
       radical sense review <name> --passed|--failed --by <who> [--note <text>] [--folder <dir>]

Measures with one sensor adapter and keeps what it measured beside the model,
in .state/measurements.json, for radical check and Studio's Inspector. A
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
a line in <dir>. It names each line it could not measure. A line may name a
sensor of the repository's ${SENSORS_FILE} instead of an adapter: its
command runs from the repository's root once for each of the model's
elements the fitness function's ADR constrains (also an ADR of a model it
depends on, deps.json), with --context <json> (the fitness function, the
ADR, the element with its paths from .radical/radical.json, metricsOut: a
file it may write radical-metrics/1 measurements to), measured as
<sensor>.exit_code and <sensor>.duration labelled element=<id>.

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

/** A node's own properties, for a sensor's context: what the model states
 *  about it beyond its place on a canvas. */
function properties(node: C4Node): Record<string, unknown> {
  const { id: _id, type: _type, label: _label, x: _x, y: _y, width: _w, height: _h, collapsed: _c, parentId: _p, origin: _o, ...rest } = node as C4Node & { origin?: string }
  return rest
}

/** What a sensor of the repository gets in --context: the fitness function,
 *  the ADR and the element it measures. */
export interface SensorContext {
  fitnessFunction: { id: string; label: string; model: string; properties: Record<string, unknown> }
  adr: { id: string; label: string; model: string } | null
  /** `paths`: where the repository builds it, from .radical/radical.json
   *  (its nearest mapped ancestor's), from the repository's root. */
  element: { id: string; label: string; type: string; technology: string | null; parent: { id: string; label: string; type: string } | null; paths: string[]; properties: Record<string, unknown> } | null
  /** A file the sensor may write radical-metrics/1 measurements to. */
  metricsOut: string
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fitness-function'

/** The fitness functions' elements and the context their sensors get. */
function sensorModel(data: Pick<DiagramData, 'nodes' | 'relations'>, name: string, mapped: MappedElement[]) {
  const nodes = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
  const check = { nodes, relations: Object.fromEntries(data.relations.map((r) => [r.id, r])) }
  const modelOf = (n: C4Node): string => { const o = originOf(n); return o ? originModel(o) : name }
  const adrsOf = (ff: C4Node): C4Node[] => data.relations
    .filter((r) => r.relationType === 'implements' && r.sourceId === ff.id && nodes[r.targetId]?.type === 'adr').map((r) => nodes[r.targetId])
  return {
    /** The model's own elements the ADRs `ff` implements constrain. */
    applied: (ff: C4Node): C4Node[] => appliedElements(check as never, ff).filter((n) => !originOf(n)),
    context: (ff: C4Node, element: C4Node | null, metricsOut: string): SensorContext => {
      const adr = (element && adrsOf(ff).find((a) => data.relations.some((r) => r.relationType === 'constrains' && r.sourceId === a.id && r.targetId === element.id))) ?? adrsOf(ff)[0]
      const parent = element?.parentId ? nodes[element.parentId] : undefined
      return {
        fitnessFunction: { id: ff.id, label: ff.label, model: modelOf(ff), properties: properties(ff) },
        adr: adr ? { id: adr.id, label: adr.label, model: modelOf(adr) } : null,
        element: element ? {
          id: element.id, label: element.label, type: element.type,
          technology: typeof (element as { technology?: unknown }).technology === 'string' ? (element as { technology: string }).technology : null,
          parent: parent ? { id: parent.id, label: parent.label, type: parent.type } : null,
          paths: elementPaths(mapped, element.id, (id) => nodes[id]?.parentId),
          properties: properties(element),
        } : null,
        metricsOut,
      }
    },
  }
}

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
  const named = await modelFolderArg(given, io.cwd)
  const folder = resolve(io.cwd, named)
  let nodes
  let model
  let sensors
  try {
    if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) throw new Error(`no ${MD_MANIFEST_FILE}`)
    const files = await new MdFolderSession(diskFolderStorage(folder), { writeCache: false }).readAll()
    const own = deserializeFromMdFolder(files).data
    // With deps.json: also the fitness functions of the models it depends on.
    const federation = await composeFolder(folder)
    const others = federation ? federationOthers(files, federation.fetched) : null
    nodes = [...own.nodes, ...others?.nodes ?? []]
    model = sensorModel({ nodes, relations: [...own.relations, ...others?.relations ?? []] }, federation?.deps.name || basename(folder), (await readRepositoryMapping(folder))?.implements ?? [])
    sensors = await repositorySensors(folder)
  } catch (error) {
    io.err(`Cannot read the model folder ${named}: ${(error as Error).message}`)
    return 2
  }
  const fields = (n: unknown): Record<string, unknown> => n as Record<string, unknown>
  const due = nodes.filter((n) => n.type === 'fitness-fn' && fields(n).cadence === 'triggered' && fields(n).trigger === trigger && fields(n).invocation === 'automated')
  const extra = (context ?? []).flatMap((c) => ['--context', c])
  let failed = 0
  let ran = 0
  const measure = async (node: C4Node, line: { raw: string }, file: string, args: string[], what = '', cwd = io.cwd): Promise<boolean> => {
    const errors: string[] = []
    const code = await senseCommand(args, { ...io, cwd, err: (text) => { errors.push(text); io.err(text) } }, now)
    if (code === 0) io.out(`${node.label}: measured "${line.raw}"${what} into ${file}`)
    else io.err(`${node.label}: cannot measure "${line.raw}"${what}: ${errors[0]?.split('\n')[0] ?? `exit status ${code}`}`)
    return code === 0
  }
  for (const node of due) {
    const lines = parseMeasure(fields(node).measure)
    // Another model's fitness function measures only the elements of this
    // model its ADR constrains; its built-in sensors are its own model's.
    const elements = model.applied(node)
    if (originOf(node) && !elements.length) continue
    for (const [i, line] of lines.entries()) {
      const base = `${slug(node.label)}${lines.length > 1 ? `-${i + 1}` : ''}`
      const sensor = sensors?.sensors[line.sensor]
      if (sensor) {
        for (const element of elements.length ? elements : [null]) {
          ran++
          const file = join(resolve(io.cwd, out), `${base}${element ? `-${slug(element.label)}` : ''}.json`)
          const metricsOut = file.replace(/\.json$/, '.sensor.json')
          await mkdir(dirname(metricsOut), { recursive: true })
          await rm(metricsOut, { force: true })
          const sensorContext = model.context(node, element, metricsOut)
          const labels = element ? ['--label', `${ELEMENT_LABEL}=${element.id}`] : []
          // A command gets the context; an adapter, its arguments.
          const args = 'adapter' in sensor
            ? [sensor.adapter, '--out', file, ...labels, ...extra, ...sensor.args, ...line.args]
            : ['command', '--name', line.sensor, '--out', file, ...labels, ...extra, '--', ...sensor.command, ...line.args, '--context', JSON.stringify(sensorContext)]
          const ok = await measure(node, line, file, args, element ? ` for ${element.label}` : '', sensors!.root)
          if (!ok) { failed++; continue }
          // What the sensor measured itself, labelled with the element as
          // its exit code is.
          const written = await readFile(metricsOut, 'utf8').catch(() => null)
          if (written === null) continue
          try {
            const measured = parseMetricsFile(written, line.sensor)
            await writeFile(metricsOut, serializeMetricsFile({
              source: line.sensor, at: now().toISOString(),
              measurements: measured.map(({ source: _s, at: _a, context: _c, ...m }) => ({ ...m, labels: { ...m.labels, ...(element ? { [ELEMENT_LABEL]: element.id } : {}) } })),
            }))
          } catch (error) {
            failed++
            await rm(metricsOut, { force: true })
            io.err(`${node.label}: sensor ${line.sensor} wrote no radical-metrics/1 to metricsOut: ${(error as Error).message}`)
          }
        }
        continue
      }
      ran++
      const file = join(resolve(io.cwd, out), `${base}.json`)
      if (!isSensorName(line.sensor)) {
        failed++
        io.err(`${node.label}: cannot measure "${line.raw}": no sensor ${line.sensor}, neither an adapter (radical sense --list) nor in ${sensors ? sensors.file : `the repository's ${SENSORS_FILE}`}.`)
        continue
      }
      // The run's own options before the line's words, which may end in
      // a command after --.
      if (!await measure(node, line, file, [line.sensor, '--out', file, ...extra, ...line.args])) failed++
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
  const folder = resolve(io.cwd, await modelFolderArg(values.folder, io.cwd))
  if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) {
    io.err(`${values.folder ?? 'The working directory'} is no model folder (no ${MD_MANIFEST_FILE}); name one with --folder.`)
    return 2
  }
  // In the repository's .radical/reviews.json, beside how it meets the model.
  const path = join(await mappingRoot(folder), REPOSITORY_REVIEWS)
  const existing = await readFile(path, 'utf8').catch(() => undefined)
  const result = values.passed ? 'passed' : 'failed'
  let text
  try {
    text = addReview(existing, { name, result, by: values.by.trim(), at: now().toISOString(), ...(values.note?.trim() ? { note: values.note.trim() } : {}) })
  } catch (error) {
    io.err(`Cannot read ${REVIEWS_FILE}: ${(error as Error).message}`)
    return 2
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, 'utf8')
  io.out(`Recorded in ${REPOSITORY_REVIEWS}: ${name} ${result}, by ${values.by.trim()}. Commit it.`)
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
    const folder = resolve(io.cwd, await modelFolderArg(typeof values.folder === 'string' ? values.folder : undefined, io.cwd))
    if (!(await stat(join(folder, MD_MANIFEST_FILE)).then((s) => s.isFile(), () => false))) {
      io.err(`${typeof values.folder === 'string' ? values.folder : 'The working directory'} is no model folder (no ${MD_MANIFEST_FILE}); name one with --folder, or write a file with --out.`)
      return 2
    }
    const store = join(folder, MEASUREMENTS_FILE)
    const existing = parseMeasurementStore(await readEditorStateFile(folder, MEASUREMENTS_FILE) ?? '')
    await writeBeside(store, serializeMeasurementStore(mergeMeasurements(existing, parseMetricsFile(text, adapter.name))))
  }
  for (const m of measured) io.out(`${m.metric} ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
  return 0
}
