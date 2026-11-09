// ─── Radical Assay: how the system runs ──────────────────────────────────────
//
// Deployment files say what runs and, in its environment, what calls what,
// whatever the language: the services of docker-compose files and Kubernetes
// manifests (built from a unit, or an image of a database, queue or cache)
// and the addresses their environment gives. Configuration says what a unit
// is called (a Spring application's name) and where it listens.

import { load, loadAll } from './yaml'
import type { AddressFact, DatabaseFact, ServiceFact, Unit } from './facts'
import { readAspire } from './aspire'
import { connectionOf } from './code'
import { keysOf, settingsFor, springConfigOwners } from './spring'
import { composeServices } from './stacks'
import { RepoFiles, dirOf, escapeRe, lineAt, lineOf, owner, resolveFrom } from './files'

/** What an image runs, by its name. */
const ROLES: Array<[RegExp, ServiceFact['role'], string?]> = [
  [/(^|\/)(postgres|postgis)/, 'database', 'PostgreSQL'], [/(^|\/)(mysql|mariadb)/, 'database', 'MySQL'], [/(^|\/)mongo/, 'database', 'MongoDB'],
  [/mssql|sql-server|sqlserver|azure-sql-edge/, 'database', 'SQL Server'], [/(^|\/)oracle|gvenzl\/oracle/, 'database', 'Oracle'],
  [/(^|\/)cassandra/, 'database', 'Cassandra'], [/elasticsearch|opensearch/, 'database', 'Elasticsearch'], [/spanner/, 'database', 'Spanner'],
  [/(^|\/)(redis|valkey|memcached)/, 'cache'], [/rabbitmq|kafka|nats|activemq|pulsar|redpanda/, 'queue'],
  [/zipkin|jaeger|prometheus|grafana|fluentd|fluent-bit|logstash|loki|otel|opentelemetry|tempo|kibana|log-server|elastic\/apm|datadog|newrelic|opamp/, 'observability'],
]

export const roleOf = (image: string): { role: ServiceFact['role']; engine?: string } => {
  for (const [re, role, engine] of ROLES) if (re.test(image.toLowerCase())) return { role, ...(engine ? { engine } : {}) }
  return { role: 'other' }
}

/** Hosts that name no other service. */
const LOCAL = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'host.docker.internal'])

/** Addresses a text names: URLs with a host (http://orders:8080/x, lb://orders, jdbc:… aside) and host:port pairs. */
export function addressesIn(text: string, withHostPort: boolean): Array<{ scheme?: string; host: string; port?: number; text: string; index: number }> {
  const out: Array<{ scheme?: string; host: string; port?: number; text: string; index: number }> = []
  for (const m of text.matchAll(/\b([a-z][a-z0-9+.-]*):\/\/(?:[^@\s/'"`]+@)?([A-Za-z0-9][A-Za-z0-9.-]*)(?::(\d{2,5}))?/g)) {
    const scheme = m[1].toLowerCase()
    if (/^(file|data|mailto|jdbc|urn|php)$/.test(scheme)) continue
    // A database's URL is its connection string, read as a database (code.ts), not as a call.
    if (/^(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis|rediss|sqlserver|mssql|oracle)$/.test(scheme) || /jdbc:[\w:]*$/i.test(text.slice(Math.max(0, m.index! - 20), m.index!))) continue
    // A password in the address is no fact to keep (http://user:secret@registry:8761).
    out.push({ scheme, host: m[2].toLowerCase(), ...(m[3] ? { port: Number(m[3]) } : {}), text: m[0].replace(/\/\/([^:@\s/]+):[^@\s/]+@/, '//$1:***@'), index: m.index! })
  }
  if (withHostPort) {
    for (const m of text.matchAll(/(?<![\w.\/:@-])([a-z][a-z0-9-]{1,62}(?:\.[a-z0-9-]+)*):(\d{2,5})\b/g)) {
      if (out.some((o) => o.index <= m.index! && m.index! < o.index + o.text.length)) continue
      out.push({ host: m[1].toLowerCase(), port: Number(m[2]), text: m[0], index: m.index! })
    }
  }
  return out.filter((a) => !LOCAL.has(a.host) || a.port !== undefined)
}

export interface Runtime {
  services: ServiceFact[]
  addresses: AddressFact[]
  databases: DatabaseFact[]
  notes: string[]
}

const YAML = /\.(ya?ml)$/i

/** The variables a compose file's .env sets, each expanded with the others (CART_ADDR=cart:${CART_PORT}). */
function dotEnv(text: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const m of text.matchAll(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^#\n]*?))\s*(?:#.*)?$/gm)) vars.set(m[1], m[2] ?? m[3] ?? m[4] ?? '')
  for (let pass = 0; pass < 5; pass++) for (const [k, v] of vars) vars.set(k, interpolate(v, vars))
  return vars
}

/** Compose's interpolation: ${VAR}, ${VAR:-default}, ${VAR-default}, $VAR, from the variables known; unknown ones stay. */
function interpolate(text: string, vars: Map<string, string>): string {
  return text.replace(/\$\{([A-Za-z_]\w*)(?::?-([^}]*))?\}|\$([A-Za-z_]\w*)/g, (m, braced?: string, fallback?: string, bare?: string) => {
    const value = vars.get(braced ?? bare!)
    return value !== undefined && value !== '' ? value : fallback ?? m
  })
}

/** The text's values as strings: an environment as a list ("K=V") or a map. */
function environment(env: unknown): string[] {
  if (Array.isArray(env)) return env.filter((e): e is string => typeof e === 'string').map((e) => e.slice(e.indexOf('=') + 1))
  if (env && typeof env === 'object') return Object.values(env as Record<string, unknown>).filter((v) => typeof v === 'string' || typeof v === 'number').map(String)
  return []
}

/** The unit a service runs: built from its folder, else the one its name or image names. */
function unitFor(units: Unit[], name: string, image: string | undefined, built: string | null, mounted: string[] = []): Unit | undefined {
  if (built) {
    const exact = units.find((u) => u.path === built) ?? units.filter((u) => built.startsWith(`${u.path}/`) || u.path.startsWith(`${built}/`)).sort((a, b) => b.path.length - a.path.length)[0]
    if (exact) return exact
  }
  // Built from a runner image, the one unit whose folder it mounts (./web:/web).
  const inMounts = units.filter((u) => mounted.some((m) => u.path === m || u.path.startsWith(`${m}/`)))
  if (inMounts.length === 1) return inMounts[0]
  const names = [name, image?.split('/').pop()?.split(':')[0]].filter((n): n is string => !!n).map((n) => n.toLowerCase())
  const known = (u: Unit): string[] => [u.name, ...(u.aliases ?? []), u.path.split('/').pop() ?? ''].filter(Boolean).map((a) => a.toLowerCase())
  const exact = units.find((u) => known(u).some((a) => names.includes(a)))
  if (exact) return exact
  // The same name spelt with or without its separators (configserver, config-server), or an image named for the unit
  // with a prefix (basic-config-server; a service's own name with one, valkey-cart, is no such name): only when one unit
  // is so named.
  const bare = (n: string): string => n.replace(/[-_.]/g, '')
  const imageName = image?.split('/').pop()?.split(':')[0]?.toLowerCase()
  const loose = units.filter((u) => known(u).some((a) => a.length >= 4 && (names.some((n) => bare(n) === bare(a)) || (!!imageName && (imageName.endsWith(`-${a}`) || imageName.endsWith(`_${a}`))))))
  return loose.length === 1 ? loose[0] : undefined
}

/** The unit of those in the build's context that its Dockerfile builds or publishes (dotnet publish "X.csproj"). */
function builtBy(dockerfile: string, units: Unit[], context: string): Unit | undefined {
  const projects = [...dockerfile.matchAll(/^\s*RUN\s+dotnet\s+(?:publish|build)\s+"?(?:[^"\s]*\/)?([\w.-]+)\.(?:cs|fs|vb)proj"?/gmi)].map((m) => m[1].toLowerCase())
  if (!projects.length) return undefined
  const inside = units.filter((u) => context === '.' || u.path === context || u.path.startsWith(`${context}/`))
  return inside.find((u) => projects.includes(u.name.toLowerCase()))
}

export function readRuntime(files: RepoFiles, repo: string, units: Unit[]): Runtime {
  const services: ServiceFact[] = []
  const addresses: AddressFact[] = []
  const databases: DatabaseFact[] = []
  const notes: string[] = []
  const published = new Map<string, number[]>()
  // One service per name: docker-compose, Kubernetes and its overlays name the same one again.
  const service = (s: Omit<ServiceFact, 'id'> & { file: string }): ServiceFact => {
    const id = `${repo}:service:${s.name}`
    const existing = services.find((x) => x.id === id)
    if (existing) {
      // An override file or another manifest completes what the first one left out.
      if (!existing.unit && s.unit) { existing.unit = s.unit; existing.role = 'app' }
      if (!existing.image && s.image) existing.image = s.image
      existing.dependsOn = [...new Set([...existing.dependsOn, ...s.dependsOn])]
      return existing
    }
    const { file: _file, ...rest } = s
    const fact = { id, ...rest }
    services.push(fact)
    const { role, engine } = roleOf(s.image ?? '')
    if (role === 'database' && engine) databases.push({ id: `${repo}:db:service:${s.name}`, service: id, engine, name: s.name, evidence: s.evidence })
    return fact
  }
  const addAddresses = (texts: string[], file: string, text: string, owner: { unit?: string; service?: string }) => {
    for (const value of texts) {
      for (const a of addressesIn(value, true)) {
        const id = `${repo}:address:${file}:${a.text}`
        if (addresses.some((x) => x.id === id)) continue
        addresses.push({ id, ...owner, ...(a.scheme ? { scheme: a.scheme } : {}), host: a.host, ...(a.port ? { port: a.port } : {}), text: a.text, evidence: { file, line: lineOf(text, a.text) } })
      }
    }
  }

  // A test's compose file runs a test's world, not the system.
  for (const file of files.list.filter((f) => YAML.test(f) && !/(^|\/)(tests?|__tests__|e2e|fixtures?|testdata)\//i.test(f))) {
    const text = files.read(file)
    // A Helm template is no YAML until it is rendered.
    if (!text || /\{\{.*\}\}/.test(text)) continue
    // docker-compose: a top-level services map.
    if (/(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(file) || /^services\s*:/m.test(text) && /^\s+(image|build)\s*:/m.test(text)) {
      // The .env beside it sets what it interpolates, and what a variable it passes by name only (- CART_ADDR) holds.
      const vars = dotEnv(files.read(`${dirOf(file) === '.' ? '' : `${dirOf(file)}/`}.env`))
      const given = vars.size ? interpolate(text, vars).replace(/^(\s*-\s*)([A-Za-z_]\w*)\s*$/gm, (m, lead: string, name: string) => (vars.has(name) ? `${lead}${name}=${vars.get(name)}` : m)) : text
      let doc: { services?: Record<string, Record<string, unknown>> }
      try { doc = load(given) as typeof doc } catch (error) { notes.push(`${file} does not read as YAML: ${(error as Error).message.split('\n')[0]}`); continue }
      for (const [name, def] of Object.entries(composeServices(doc))) {
        if (!def || typeof def !== 'object') continue
        const image = typeof def.image === 'string' ? def.image : undefined
        const build = typeof def.build === 'string' ? def.build : typeof (def.build as { context?: unknown })?.context === 'string' ? (def.build as { context: string }).context : null
        const dockerfile = typeof (def.build as { dockerfile?: unknown })?.dockerfile === 'string' ? (def.build as { dockerfile: string }).dockerfile : null
        const context = build !== null ? resolveFrom(dirOf(file), build) : null
        // Built from a Dockerfile in a unit's folder, though from the root's context.
        const built = context !== null && dockerfile ? dirOf(resolveFrom(context, dockerfile) ?? '') : context
        // The project its Dockerfile builds, where the context holds several.
        const dockerPath = context !== null ? resolveFrom(context, dockerfile ?? 'Dockerfile') : null
        const mounted = (Array.isArray(def.volumes) ? def.volumes : []).filter((v): v is string => typeof v === 'string' && /^\.{1,2}(\/|:)/.test(v)).map((v) => resolveFrom(dirOf(file), v.split(':')[0])).filter((v): v is string => !!v && v !== '.')
        const unit = (context !== null && dockerPath ? builtBy(files.read(dockerPath), units, context) : undefined) ?? unitFor(units, name, image, built, mounted)
        // A service waited for until it completes (condition: service_completed_successfully) runs before, not for, this one.
        // Compose's first format links services it talks to (links: ["db:database"]), as depends_on does since.
        const linked = Array.isArray(def.links) ? def.links.map((l) => String(l).split(':')[0]) : []
        const dependsOn = linked.length && !def.depends_on ? linked : Array.isArray(def.depends_on) ? def.depends_on.map(String) : def.depends_on && typeof def.depends_on === 'object'
          ? Object.entries(def.depends_on as Record<string, { condition?: unknown } | null>).filter(([, d]) => d?.condition !== 'service_completed_successfully').map(([n]) => n) : []
        const s = service({ name, file, ...(unit ? { unit: unit.id } : {}), ...(image ? { image } : {}), role: unit ? 'app' : roleOf(`${image ?? ''} ${name}`).role, dependsOn, evidence: { file, line: lineOf(text, new RegExp(`^\\s+${escapeRe(name)}\\s*:`, 'm')) } })
        // The ports it publishes on this machine ("127.0.0.1:3002:8080", "8080:80", { published: 8080 }).
        for (const p of Array.isArray(def.ports) ? def.ports : []) {
          const parts = typeof p === 'string' || typeof p === 'number' ? String(p).split(':') : []
          const host = typeof p === 'object' && p ? (p as { published?: unknown }).published : parts.length === 3 ? parts[1] : parts.length === 2 ? parts[0] : undefined
          if (/^\d{2,5}$/.test(String(host ?? ''))) published.set(s.id, [...(published.get(s.id) ?? []), Number(host)])
        }
        addAddresses(environment(def.environment), file, text, { service: s.id })
        // A connection string in the environment of a service a unit runs: a database of that unit.
        for (const value of unit ? environment(def.environment) : []) {
          const db = connectionOf(value)
          if (!db?.name || /[$%{}]/.test(db.name)) continue
          const id = `${repo}:db:${unit!.path}:${db.engine}/${db.name}`
          if (!databases.some((d) => d.id === id)) databases.push({ id, unit: unit!.id, engine: db.engine, name: db.name, ...(db.server ? { server: db.server.replace(/[,:]\d+$/, '') } : {}), evidence: { file, line: lineOf(text, value.slice(0, 40)) } })
        }
      }
      continue
    }
    // Kubernetes: Deployments and the like, each container's image and environment.
    if (/^\s*kind\s*:\s*(Deployment|StatefulSet|DaemonSet|Job|CronJob)\b/m.test(text)) {
      let docs: unknown[]
      try { docs = loadAll(text) } catch (error) { notes.push(`${file} does not read as YAML: ${(error as Error).message.split('\n')[0]}`); continue }
      for (const doc of docs as Array<{ kind?: string; metadata?: { name?: string }; spec?: { template?: { spec?: { containers?: Array<{ name?: string; image?: string; env?: Array<{ value?: unknown }> }> } }; jobTemplate?: unknown } }>) {
        if (!doc || !/^(Deployment|StatefulSet|DaemonSet|Job|CronJob)$/.test(doc.kind ?? '')) continue
        const name = doc.metadata?.name
        if (!name) continue
        for (const c of doc.spec?.template?.spec?.containers ?? []) {
          const image = typeof c.image === 'string' ? c.image : undefined
          const unit = unitFor(units, name, image, null)
          const s = service({ name, file, ...(unit ? { unit: unit.id } : {}), ...(image ? { image } : {}), role: unit ? 'app' : roleOf(`${image ?? ''} ${name}`).role, dependsOn: [], evidence: { file, line: lineOf(text, new RegExp(`name:\\s*${escapeRe(name)}\\b`)) } })
          addAddresses((c.env ?? []).map((e) => e?.value).filter((v): v is string => typeof v === 'string'), file, text, { service: s.id })
        }
      }
    }
  }

  // .NET Aspire: its AppHost's resources, as services with what each references.
  const aspire = readAspire(files, repo, units)
  for (const s of aspire.services) if (!services.some((x) => x.id === s.id)) services.push(s)
  databases.push(...aspire.databases.filter((d) => !databases.some((x) => x.id === d.id)))

  // Configuration of a unit: its Spring name, its port, and the addresses it names.
  // A service's published ports are its unit's, on this machine.
  for (const [id, ports] of published) {
    const u = units.find((x) => x.id === services.find((s) => s.id === id)?.unit)
    if (u) u.ports = [...new Set([...(u.ports ?? []), ...ports])].sort((a, b) => a - b)
  }
  // A config server's files are the configuration of the applications they configure.
  const configures = springConfigOwners(files, units)
  for (const u of units) {
    const prefix = u.path === '.' ? '' : `${u.path}/`
    const configs = [
      // A test's settings (src/test/resources) are the test's, not the system's.
      ...files.list.filter((f) => f.startsWith(prefix) && !configures.has(f) && !/(^|\/)src\/test\//.test(f) && /(^|\/)(application|bootstrap)(-[\w-]+)?\.(ya?ml|properties)$|(^|\/)appsettings(\.[\w-]+)?\.json$|(^|\/)launchSettings\.json$|(^|\/)\.env(\.[\w-]+)?$/.test(f)),
      ...[...configures].filter(([, configured]) => configured.includes(u)).map(([f]) => f),
    ]
    for (const file of configs) {
      const text = configures.has(file) ? settingsFor(files, file, u) : files.read(file)
      const springName = /spring\.application\.name\s*[=:]\s*([\w.-]+)/.exec(text)?.[1] ?? (() => {
        try { return ((load(text) as { spring?: { application?: { name?: unknown } } })?.spring?.application?.name as string | undefined) } catch { return undefined }
      })()
      if (springName && typeof springName === 'string' && !(u.aliases ?? []).includes(springName)) u.aliases = [...(u.aliases ?? []), springName]
      const ports = [
        ...[...text.matchAll(/server\.port\s*[=:]\s*(\d{2,5})/g)].map((m) => Number(m[1])),
        // server.port in YAML, as its key path says (spring.rabbitmq.port is a port it calls).
        ...((keys) => text.split('\n').flatMap((l, i) => keys[i] === 'server.port' && /^\s+port\s*:\s*(\d{2,5})\s*$/.test(l) ? [Number(/(\d{2,5})/.exec(l)![1])] : []))(keysOf(text)),
        ...(file.endsWith('launchSettings.json') ? [...text.matchAll(/"applicationUrl"\s*:\s*"([^"]+)"/g)].flatMap((m) => [...m[1].matchAll(/:(\d{2,5})/g)].map((p) => Number(p[1]))) : []),
      ]
      if (ports.length) u.ports = [...new Set([...(u.ports ?? []), ...ports])].sort((a, b) => a - b)
      if (!file.endsWith('launchSettings.json')) addAddresses([text], file, text, { unit: u.id })
      // An environment's database (Laravel, Rails, Django settings by env): DB_CONNECTION and DB_DATABASE.
      const env = (key: string) => new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\s#]+)`, 'm').exec(text)
      // Laravel's default connection (config/database.php) stands in for a DB_CONNECTION the file lacks.
      const settings = files.list.find((f) => f.startsWith(prefix) && /(^|\/)config\/database\.php$/i.test(f))
      const laravel = settings ? /'default'\s*=>\s*env\(\s*'DB_CONNECTION'\s*,\s*'(\w+)'/.exec(files.read(settings)) : null
      const kind = env('DB_CONNECTION') ?? laravel
      const name = env('DB_DATABASE')
      if (/\.env(\.[\w-]+)?$/.test(file) && kind && name) {
        const engine = ({ sqlsrv: 'SQL Server', mysql: 'MySQL', mariadb: 'MariaDB', pgsql: 'PostgreSQL', postgres: 'PostgreSQL', sqlite: 'SQLite', oracle: 'Oracle' } as Record<string, string>)[kind[1].toLowerCase()] ?? kind[1]
        const server = env('DB_HOST')?.[1]
        const id = `${repo}:db:${u.path}:${engine}/${name[1]}`
        if (!databases.some((d) => d.id === id)) databases.push({ id, unit: u.id, engine, name: name[1], ...(server ? { server } : {}), evidence: { file, line: lineAt(text, name.index) } })
      }
    }
    readSettings(files, repo, u, units, addresses)
    const dockerfile = files.read(`${prefix}Dockerfile`)
    const exposed = [...dockerfile.matchAll(/^EXPOSE\s+(.+)$/gmi)].flatMap((m) => m[1].split(/\s+/).map((p) => Number(p.split('/')[0]))).filter((p) => p > 0)
    if (exposed.length) u.ports = [...new Set([...(u.ports ?? []), ...exposed])].sort((a, b) => a - b)
  }
  // A config server serving its clients' configuration from another repository: what it configures is read there.
  for (const file of files.list.filter((f) => /(^|\/)(application|bootstrap)(-[\w-]+)?\.(ya?ml|properties)$/.test(f))) {
    const text = files.read(file)
    const keys = keysOf(text)
    for (const [i, line] of text.split('\n').entries()) {
      const uri = /^spring\.cloud\.config\.server\.git\.uri$/.test(keys[i] ?? '') && !/^\s*#/.test(line) ? /(https?:\/\/[^\s"'#]+|git@[^\s"'#]+)/.exec(line)?.[1] : undefined
      if (uri) notes.push(`${file}:${i + 1} serves its clients' configuration from ${uri}, another repository: give it to Assay too, to read the addresses and ports it sets`)
    }
  }
  return { services, addresses, databases, notes }
}

// ── INI-style settings ───────────────────────────────────────────────────────

/** A settings file: any .ini, and a .dat, .cfg or .conf in the unit's root or a settings folder (INIT/, config/). */
const SETTINGS = /\.ini$/i
const SETTINGS_ELSEWHERE = /\.(dat|cfg|conf)$/i
const SETTINGS_FOLDER = /^(init|config|conf|configs|settings|cfg|ini|setup)$/i
/** A key naming the port the program itself listens on, and a key naming a host. */
const OWN_PORT = /^(start|listen|server|local|bind|tcp)?[_-]?(port|puerto)$/i
const HOST_KEY = /^(ip|host|hostname|server|servidor|address|addr|direccion|remotehost)$/i
const HOST_VALUE = /^(\d{1,3}(\.\d{1,3}){3}|[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)*)$/i

/** The [sections] of an INI text, each with its key=value lines; lines before the first section are section "". */
export function iniSections(text: string): Array<{ name: string; line: number; entries: Array<{ key: string; value: string; line: number }> }> {
  const out = [{ name: '', line: 1, entries: [] as Array<{ key: string; value: string; line: number }> }]
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || /^[;#']/.test(line)) return
    const section = /^\[([^\]]+)\]$/.exec(line)
    if (section) { out.push({ name: section[1].trim(), line: i + 1, entries: [] }); return }
    const at = line.indexOf('=')
    if (at > 0) out[out.length - 1].entries.push({ key: line.slice(0, at).trim(), value: line.slice(at + 1).replace(/\s+['#;].*$/, '').trim().replace(/^"(.*)"$/, '$1'), line: i + 1 })
  })
  return out
}

/** A unit's INI-style settings: the port it listens on (StartPort=24582), and each section that gives a
 *  host and one port-like number (a server list's IP=… and PJ=…) as an address. */
function readSettings(files: RepoFiles, repo: string, u: Unit, units: Unit[], addresses: AddressFact[]): void {
  const prefix = u.path === '.' ? '' : `${u.path}/`
  for (const file of files.list) {
    if (!file.startsWith(prefix) || owner(units, file)?.id !== u.id || /(^|\/)(tests?|__tests__|fixtures?|testdata)\//i.test(file)) continue
    const folders = file.slice(prefix.length).split('/').slice(0, -1)
    if (!SETTINGS.test(file) && !(SETTINGS_ELSEWHERE.test(file) && (folders.length === 0 || folders.some((f) => SETTINGS_FOLDER.test(f))))) continue
    const text = files.read(file)
    if (!/^\s*\[[^\]\n]+\]\s*$/m.test(text.slice(0, 4000)) && !SETTINGS.test(file)) continue
    for (const section of iniSections(text)) {
      const host = section.entries.find((e) => HOST_KEY.test(e.key) && HOST_VALUE.test(e.value))
      const port = (e: { value: string }) => /^\d{2,5}$/.test(e.value) && Number(e.value) > 0 && Number(e.value) < 65536
      if (!host) {
        for (const e of section.entries) {
          if (OWN_PORT.test(e.key) && port(e)) u.ports = [...new Set([...(u.ports ?? []), Number(e.value)])].sort((a, b) => a - b)
        }
        continue
      }
      // The section's port: a key named for one, else its one number a port can be (PJ=24582).
      const named = section.entries.find((e) => /port|puerto/i.test(e.key) && port(e))
      const numbers = section.entries.filter((e) => e !== host && port(e) && Number(e.value) >= 1024)
      const at = named ?? (numbers.length === 1 ? numbers[0] : undefined)
      const id = `${repo}:address:${u.path}:ini:${host.value.toLowerCase()}${at ? `:${at.value}` : ''}`
      if (addresses.some((a) => a.id === id)) continue
      addresses.push({ id, unit: u.id, scheme: 'setting', host: host.value.toLowerCase(), ...(at ? { port: Number(at.value) } : {}), text: `${host.key}=${host.value}${at ? ` ${at.key}=${at.value}` : ''}`, evidence: { file, line: host.line } })
    }
  }
}

