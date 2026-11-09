// Radical Assay's bench, from microSecEnD (Schneider et al., MSR 2023; Apache-2.0): 17 Java microservice
// applications whose dataflow diagrams were drawn by hand, with each node traced to a line of the code. This turns
// each diagram into a bench entry as written, without running Assay: a service's node is the folder of the manifest
// nearest the file it is traced to, a node traced to a compose file is the folder that service is built from or
// service:<name>; a flow is a call between its two nodes, either way (a diagram's flow is data, not who calls whom).
// External entities (users, websites, mail servers) and nodes traced to nothing are left out, as are flows to them.
// Run: MICROSECEND=<clone of tuhh-softsec/microSecEnD> npx tsx packages/assay/bench/microsecend.ts [--write]

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const dataset = process.env.MICROSECEND
if (!dataset) { console.error('MICROSECEND=<clone of tuhh-softsec/microSecEnD> is needed'); process.exit(2) }
const cache = join(process.env.ASSAY_BENCH ?? join(homedir(), '.cache', 'radical-assay-bench'), 'microsecend')
const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

interface Dfd { services: Array<{ name: string; stereotypes: string[] }>; external_entities?: Array<{ name: string }>; information_flows: Array<{ sender: string; receiver: string }> }
interface Trace { nodes: Record<string, { file: string }> }
const MANIFEST = /^(pom\.xml|build\.gradle(\.kts)?|package\.json|go\.mod|.+\.csproj|requirements\.txt|pyproject\.toml|Dockerfile)$/
const key = (name: string): string => name.toLowerCase().replace(/[-_]/g, '')
/** The dataset's JSON, some of it with trailing commas. */
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8').replace(/,(\s*[}\]])/g, '$1')) as T

const index = JSON.parse(readFileSync(join(dataset, 'dataset', 'dataset.json'), 'utf8')) as Record<string, { slug: string; branch?: string; title?: string; tech?: unknown }>
const entries: unknown[] = []
for (const [name, about] of Object.entries(index)) {
  const dir = join(cache, name)
  const url = `https://github.com/${about.slug}.git`
  if (!existsSync(dir)) execFileSync('git', ['clone', '-q', url, dir])
  // The code as the dataset drew it: the branch it names, at its last commit before the diagram was added.
  const added = git(dataset, 'log', '--diff-filter=A', '--format=%cI', '--', `dataset/${name}`).split('\n').pop()!
  const commit = git(dir, 'rev-list', '-1', `--before=${added}`, about.branch ? `origin/${about.branch}` : 'HEAD')
  git(dir, '-c', 'advice.detachedHead=false', 'checkout', '-q', commit)
  const files = git(dir, 'ls-files').split('\n')
  const has = (path: string): boolean => files.includes(path) || files.some((f) => f.startsWith(`${path}/`))

  const dfd = json<Dfd>(join(dataset, 'dataset', name, `${name}.json`))
  const trace = json<Trace>(join(dataset, 'dataset', name, `${name}_traceability.json`))
  const traced = new Map(Object.entries(trace.nodes).map(([k, v]) => [key(k), v.file]))
  const external = new Set((dfd.external_entities ?? []).map((e) => key(e.name)))
  const ends = new Map<string, string>()
  const notes: string[] = []
  for (const s of dfd.services) {
    const file = traced.get(key(s.name))
    if (!file || file === 'implicit') { notes.push(`${s.name}: traced to nothing`); continue }
    // https://github.com/<owner>/<repo>/blob/<branch>/<path>#L<n>; some paths repeat the branch.
    const m = /\/blob\/([^/]+)\/(.+?)(?:#L(\d+))?$/.exec(file)
    if (!m) { notes.push(`${s.name}: ${file}`); continue }
    let path = m[2]
    if (!has(path) && path.startsWith(`${m[1]}/`)) path = path.slice(m[1].length + 1)
    if (!has(path)) { notes.push(`${s.name}: ${path} is not in the code`); continue }
    if (/(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(path)) {
      // A compose service: the folder it is built from, else the service by name.
      const compose = load(readFileSync(join(dir, path), 'utf8')) as { services?: Record<string, { build?: string | { context?: string; dockerfile?: string } }> } & Record<string, unknown>
      const services = (compose.services ?? compose) as Record<string, { build?: string | { context?: string; dockerfile?: string } }>
      const line = Number(m[3] ?? 0)
      const text = readFileSync(join(dir, path), 'utf8').split('\n')
      const at = Object.keys(services).find((n) => key(n) === key(s.name)) ?? Object.keys(services).filter((n) => text.findIndex((l) => new RegExp(`^\\s{0,4}${n}\\s*:`).test(l)) + 1 <= line).pop()
      const def = at ? services[at] : undefined
      const build = typeof def?.build === 'string' ? def.build : def?.build?.context
      const folder = build !== undefined ? posix.normalize(posix.join(posix.dirname(path), build, typeof def?.build === 'object' && def.build.dockerfile ? posix.dirname(def.build.dockerfile) : '.')) : undefined
      ends.set(key(s.name), folder !== undefined ? folder.replace(/\/$/, '') || '.' : `service:${at ?? s.name}`)
      continue
    }
    // The folder of the manifest nearest the file.
    let at = posix.dirname(path)
    while (at !== '.' && !files.some((f) => posix.dirname(f) === at && MANIFEST.test(posix.basename(f)))) at = posix.dirname(at)
    ends.set(key(s.name), at)
  }
  const pairs = new Map<string, [string, string]>()
  let left = 0
  for (const f of dfd.information_flows) {
    const [a, b] = [ends.get(key(f.sender)), ends.get(key(f.receiver))]
    if (!a || !b || external.has(key(f.sender)) || external.has(key(f.receiver))) { left++; continue }
    if (a === b) continue
    const pair = [a, b].sort() as [string, string]
    pairs.set(pair.join('\u0000'), pair)
  }
  const units = [...new Set([...ends.values()].filter((e) => !e.startsWith('service:')))].sort()
  entries.push({
    name, about: `${about.title ?? about.slug}: a Java microservice application of microSecEnD, its dataflow diagram drawn by hand (Schneider et al., MSR 2023, Apache-2.0) and turned into this entry by packages/assay/bench/microsecend.ts before Assay ran on it; calls are judged either way. ${left} flows to external entities or untraced nodes left out.${notes.length ? ` Not mapped: ${notes.join('; ')}.` : ''}`,
    url, commit, stacks: 'Java, Spring Boot, Spring Cloud (microSecEnD)', undirected: true, units, calls: [...pairs.values()], optional: [],
  })
  console.log(`${name}: ${units.length} units, ${pairs.size} calls, ${left} flows left out${notes.length ? `; ${notes.join('; ')}` : ''}`)
  for (const [k, v] of ends) console.log(`  ${k} → ${v}`)
}
if (process.argv.includes('--write')) {
  const out = fileURLToPath(new URL('./microsecend.json', import.meta.url))
  writeFileSync(out, `${JSON.stringify({ about: 'microSecEnD (https://github.com/tuhh-softsec/microSecEnD): 17 Java microservice applications whose dataflow diagrams were drawn by hand, a ground truth Assay was never tuned on. Written by microsecend.ts.', repositories: entries }, null, 2)}\n`)
  console.log(`written ${dirname(out)}/microsecend.json`)
}
