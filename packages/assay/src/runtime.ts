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
import { RepoFiles, dirOf, escapeRe, lineOf, resolveFrom } from './files'

/** What an image runs, by its name. */
const ROLES: Array<[RegExp, ServiceFact['role'], string?]> = [
  [/(^|\/)(postgres|postgis)/, 'database', 'PostgreSQL'], [/(^|\/)(mysql|mariadb)/, 'database', 'MySQL'], [/(^|\/)mongo/, 'database', 'MongoDB'],
  [/mssql|sql-server|sqlserver|azure-sql-edge/, 'database', 'SQL Server'], [/(^|\/)oracle|gvenzl\/oracle/, 'database', 'Oracle'],
  [/(^|\/)cassandra/, 'database', 'Cassandra'], [/elasticsearch|opensearch/, 'database', 'Elasticsearch'], [/spanner/, 'database', 'Spanner'],
  [/(^|\/)(redis|valkey|memcached)/, 'cache'], [/rabbitmq|kafka|nats|activemq|pulsar|redpanda/, 'queue'],
  [/zipkin|jaeger|prometheus|grafana|fluentd|fluent-bit|logstash|loki|otel|opentelemetry|tempo|kibana|log-server|elastic\/apm|datadog|newrelic/, 'observability'],
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
    if (/^(file|data|mailto|jdbc|urn)$/.test(scheme)) continue
    // A database's URL is its connection string, read as a database (code.ts), not as a call.
    if (/^(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis|rediss|sqlserver|mssql|oracle)$/.test(scheme) || /jdbc:[\w:]*$/i.test(text.slice(Math.max(0, m.index! - 20), m.index!))) continue
    out.push({ scheme, host: m[2].toLowerCase(), ...(m[3] ? { port: Number(m[3]) } : {}), text: m[0], index: m.index! })
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

/** The text's values as strings: an environment as a list ("K=V") or a map. */
function environment(env: unknown): string[] {
  if (Array.isArray(env)) return env.filter((e): e is string => typeof e === 'string').map((e) => e.slice(e.indexOf('=') + 1))
  if (env && typeof env === 'object') return Object.values(env as Record<string, unknown>).filter((v) => typeof v === 'string' || typeof v === 'number').map(String)
  return []
}

/** The unit a service runs: built from its folder, else the one its name or image names. */
function unitFor(units: Unit[], name: string, image: string | undefined, built: string | null): Unit | undefined {
  if (built) {
    const exact = units.find((u) => u.path === built) ?? units.filter((u) => built.startsWith(`${u.path}/`) || u.path.startsWith(`${built}/`)).sort((a, b) => b.path.length - a.path.length)[0]
    if (exact) return exact
  }
  const names = [name, image?.split('/').pop()?.split(':')[0]].filter((n): n is string => !!n).map((n) => n.toLowerCase())
  return units.find((u) => [u.name, ...(u.aliases ?? []), u.path.split('/').pop() ?? ''].some((a) => names.includes(a.toLowerCase())))
}

export function readRuntime(files: RepoFiles, repo: string, units: Unit[]): Runtime {
  const services: ServiceFact[] = []
  const addresses: AddressFact[] = []
  const databases: DatabaseFact[] = []
  const notes: string[] = []
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
      let doc: { services?: Record<string, Record<string, unknown>> }
      try { doc = load(text) as typeof doc } catch (error) { notes.push(`${file} does not read as YAML: ${(error as Error).message.split('\n')[0]}`); continue }
      for (const [name, def] of Object.entries(doc?.services ?? {})) {
        if (!def || typeof def !== 'object') continue
        const image = typeof def.image === 'string' ? def.image : undefined
        const build = typeof def.build === 'string' ? def.build : typeof (def.build as { context?: unknown })?.context === 'string' ? (def.build as { context: string }).context : null
        const dockerfile = typeof (def.build as { dockerfile?: unknown })?.dockerfile === 'string' ? (def.build as { dockerfile: string }).dockerfile : null
        const context = build !== null ? resolveFrom(dirOf(file), build) : null
        // Built from a Dockerfile in a unit's folder, though from the root's context.
        const built = context !== null && dockerfile ? dirOf(resolveFrom(context, dockerfile) ?? '') : context
        const unit = unitFor(units, name, image, built)
        const dependsOn = Array.isArray(def.depends_on) ? def.depends_on.map(String) : def.depends_on && typeof def.depends_on === 'object' ? Object.keys(def.depends_on) : []
        const s = service({ name, file, ...(unit ? { unit: unit.id } : {}), ...(image ? { image } : {}), role: unit ? 'app' : roleOf(`${image ?? ''} ${name}`).role, dependsOn, evidence: { file, line: lineOf(text, new RegExp(`^\\s+${escapeRe(name)}\\s*:`, 'm')) } })
        addAddresses(environment(def.environment), file, text, { service: s.id })
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
  for (const u of units) {
    const prefix = u.path === '.' ? '' : `${u.path}/`
    const configs = files.list.filter((f) => f.startsWith(prefix) && /(^|\/)(application|bootstrap)(-[\w-]+)?\.(ya?ml|properties)$|(^|\/)appsettings(\.[\w-]+)?\.json$|(^|\/)launchSettings\.json$|(^|\/)\.env(\.[\w-]+)?$/.test(f))
    for (const file of configs) {
      const text = files.read(file)
      const springName = /spring\.application\.name\s*[=:]\s*([\w.-]+)/.exec(text)?.[1] ?? (() => {
        try { return ((load(text) as { spring?: { application?: { name?: unknown } } })?.spring?.application?.name as string | undefined) } catch { return undefined }
      })()
      if (springName && typeof springName === 'string' && !(u.aliases ?? []).includes(springName)) u.aliases = [...(u.aliases ?? []), springName]
      const ports = [
        ...[...text.matchAll(/server\.port\s*[=:]\s*(\d{2,5})/g)].map((m) => Number(m[1])),
        ...(/^server\s*:\s*$/m.test(text) ? [...text.matchAll(/^\s+port\s*:\s*(\d{2,5})\s*$/gm)].map((m) => Number(m[1])) : []),
        ...(file.endsWith('launchSettings.json') ? [...text.matchAll(/"applicationUrl"\s*:\s*"([^"]+)"/g)].flatMap((m) => [...m[1].matchAll(/:(\d{2,5})/g)].map((p) => Number(p[1]))) : []),
      ]
      if (ports.length) u.ports = [...new Set([...(u.ports ?? []), ...ports])].sort((a, b) => a - b)
      if (!file.endsWith('launchSettings.json')) addAddresses([text], file, text, { unit: u.id })
    }
    const dockerfile = files.read(`${prefix}Dockerfile`)
    const exposed = [...dockerfile.matchAll(/^EXPOSE\s+(.+)$/gmi)].flatMap((m) => m[1].split(/\s+/).map((p) => Number(p.split('/')[0]))).filter((p) => p > 0)
    if (exposed.length) u.ports = [...new Set([...(u.ports ?? []), ...exposed])].sort((a, b) => a - b)
  }
  return { services, addresses, databases, notes }
}
