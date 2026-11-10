// ─── Radical Assay: links across units ───────────────────────────────────────
//
// What no single file states: which unit uses which, within a repository and
// across them. Observed when a manifest, a project reference, a deployment
// or a connection string states it; inferred when it is concluded: a path
// another unit's OpenAPI declares, a client of a gRPC service another unit
// registers, an address whose host names another unit or service. Every link
// cites the facts of both sides.

import type { AddressFact, ApiFact, Link, RepositoryFacts, RoutineFact, ServiceFact, Unit, UrlFact } from './facts'
import { NOT_SERVICE_HOST } from './code'

/** Ports many programs listen on: a remote address on one of them names no unit by its port. */
const COMMON_PORTS = new Set([20, 21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 1433, 1521, 3000, 3306, 4200, 5000, 5001, 5173, 5432, 5672, 6379, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9090, 9200, 11211, 27017])

/** At most this many facts of one side are cited by a link. */
const CITED = 10

/** Paths every web app has: naming one says nothing of whom it calls. */
const GENERIC = /^\/(api\/?)?(health|healthz|ready|readiness|live|liveness|ping|status|metrics|version|info|login|logout|signin|signout|callback|index|home|error|favicon)?$/i

/** True when the path a string names (urlPathOf's: run-time parts as {}) is
 *  the declared path (parameters as {name}): segment by segment, a parameter
 *  matching any segment, a run-time part only a parameter. */
export function pathMatches(named: string, declared: string): boolean {
  const a = named.split('/').slice(1)
  const b = declared.replace(/\/+$/, '').split('/').slice(1)
  if (a.length !== b.length) return false
  return a.every((seg, i) => /^\{.*\}$/.test(b[i]) || seg === b[i])
}

/** The names others call a unit by, lower-cased: its name, its aliases, its folder's name. */
const callNames = (u: Unit): string[] =>
  [u.name, ...(u.aliases ?? []), u.path.split('/').pop() ?? ''].filter(Boolean).map((n) => n.toLowerCase())

/** The names a dependency on a unit may use: its manifest's name, and for VB6 its binaries. */
const packageNames = (u: Unit): string[] =>
  [...(u.named === false ? [] : [u.name]), ...(u.stack === 'vb6' ? u.aliases ?? [] : [])].map((n) => n.toLowerCase())

/** The links between the units of `repositories`. */
export function linkRepositories(repositories: RepositoryFacts[]): Link[] {
  const units = repositories.flatMap((r) => r.units)
  // A service a deployment of another repository runs: the unit named like it or its image, in any repository.
  const services = repositories.flatMap((r) => r.services).map((s) => {
    if (s.unit || (s.role !== 'other' && s.role !== 'app')) return s
    const names = [s.name, s.image?.split('/').pop()?.split(':')[0]].filter((n): n is string => !!n).map((n) => n.toLowerCase())
    const unit = units.filter((u) => u.kind !== 'tests').find((u) => callNames(u).some((n) => names.includes(n)))
    return unit ? { ...s, unit: unit.id, role: 'app' as const } : s
  })
  const links = new Map<string, Link>()
  const add = (kind: Link['kind'], from: string, to: string, confidence: Link['confidence'], facts: string[], detail: string): void => {
    if (from === to) return
    const id = `link:${kind}:${from}->${to}`
    const known = links.get(id)
    if (known) {
      for (const f of facts) if (!known.facts.includes(f) && known.facts.length < 2 * CITED) known.facts.push(f)
      if (!known.detail.includes(detail) && known.detail.length < 200) known.detail += `, ${detail}`
      return
    }
    links.set(id, { id, kind, from, to, confidence, facts: [...new Set(facts)], detail })
  }

  // Manifests and project references.
  const byPackage = new Map<string, Unit[]>()
  for (const u of units) for (const n of packageNames(u)) byPackage.set(n, [...(byPackage.get(n) ?? []), u])
  for (const r of repositories) {
    for (const dep of r.dependencies) {
      const targets = dep.target ? units.filter((u) => u.id === dep.target) : byPackage.get(dep.package.toLowerCase()) ?? (dep.file ? byPackage.get(dep.file.toLowerCase()) : undefined) ?? []
      for (const t of targets) add('package', dep.unit, t.id, 'observed', [dep.id, t.id], dep.target ? `references ${dep.package}` : `depends on ${dep.package}`)
    }
  }

  // HTTP: a path another unit's OpenAPI declares, with or without its base path.
  const apis = repositories.flatMap((r) => r.apis)
  const http = apis.filter((a) => a.protocol !== 'grpc')
  for (const url of repositories.flatMap((r) => r.urls) as UrlFact[]) {
    if (GENERIC.test(url.path)) continue
    for (const api of http as Array<ApiFact & { base?: string }>) {
      if (api.unit === url.unit) continue
      const bare = api.base && api.path.startsWith(api.base) ? api.path.slice(api.base.length) : null
      if (!pathMatches(url.path, api.path) && !(bare && url.path.split('/').length > 2 && pathMatches(url.path, bare))) continue
      add('http', url.unit, api.unit, 'inferred', [url.id, api.id], `${api.method} ${api.path}`)
    }
  }

  // gRPC: a client of a service another unit registers.
  for (const client of repositories.flatMap((r) => r.clients)) {
    for (const api of apis.filter((a) => a.protocol === 'grpc' && a.path === client.service && a.unit !== client.unit)) {
      add('grpc', client.unit, api.unit, 'inferred', [client.id, api.id], `gRPC ${client.service}`)
    }
  }

  // Addresses: a host naming another unit or service, or a local port another unit listens on.
  const serviceOf = new Map(services.map((s) => [s.id, s]))
  const byName = new Map<string, Array<{ unit?: Unit; service?: ServiceFact }>>()
  for (const u of units) for (const n of callNames(u)) byName.set(n, [...(byName.get(n) ?? []), { unit: u }])
  for (const s of services) byName.set(s.name.toLowerCase(), [...(byName.get(s.name.toLowerCase()) ?? []), { service: s, unit: units.find((u) => u.id === s.unit) }])
  // A name names a unit or service of the caller's own repository before one of another (two systems may both run a rabbitmq).
  const repoOf = (id: string): string => id.split(/:(?:unit|service|db):/)[0]
  const nameFrom = (name: string, from: string): Array<{ unit?: Unit; service?: ServiceFact }> | undefined => {
    const all = byName.get(name)
    const own = all?.filter((t) => repoOf(t.unit?.id ?? t.service!.id) === repoOf(from))
    return own?.length ? own : all
  }
  for (const a of repositories.flatMap((r) => r.addresses) as AddressFact[]) {
    const holder = a.service ? serviceOf.get(a.service) : undefined
    const from = a.unit ?? holder?.unit
    if (!from) continue
    const local = ['localhost', '127.0.0.1', '0.0.0.0', 'host.docker.internal'].includes(a.host)
    // A port names a unit only when no other unit listens on it too (5000 is everyone's default); away
    // from this machine, only a port few programs use (a game server's 24582, not 8080).
    const listening = a.port !== undefined && (local || !COMMON_PORTS.has(a.port)) ? units.filter((u) => u.ports?.includes(a.port!)) : []
    // Several listening on it (demos of one protocol): the one nearest the caller in the folders, when only one is.
    const caller = units.find((u) => u.id === from)
    const shared = (u: Unit): number => {
      if (!caller || u.id.split(':unit:')[0] !== caller.id.split(':unit:')[0]) return -1
      const a = caller.path.split('/')
      const b = u.path.split('/')
      let n = 0
      while (n < a.length && n < b.length && a[n] === b[n] && a[n] !== '.') n++
      return n
    }
    const best = listening.length > 1 ? Math.max(...listening.map(shared)) : 0
    const nearest = listening.length > 1 && best > 0 ? listening.filter((u) => shared(u) === best) : listening
    const byPort = (nearest.length === 1 ? nearest : []).map((u) => ({ unit: u, service: undefined as ServiceFact | undefined }))
    // A vocabulary's domain (schema.org in JSON-LD, w3.org in a namespace) or a code host's names no service.
    if (NOT_SERVICE_HOST.test(a.host)) continue
    // A subdomain of a public domain (api.github.com, docs.mattermost.com) names no unit by its first label; a product's
    // own domain (plausible.io) may name the unit serving it.
    const publicHost = /\.(com|org|net|io|dev|co|app|ai|cloud|info|biz|gov|edu|me|so|sh)(\.[a-z]{2})?$/i.test(a.host) && a.host.replace(/\.(co|com|org|net)\.[a-z]{2}$/i, '.x').split('.').length > 2
    const targets = local ? byPort : nameFrom(a.host, from) ?? (publicHost ? undefined : nameFrom(a.host.split('.')[0], from)) ?? byPort
    for (const t of targets) {
      const to = t.unit?.id ?? t.service?.id
      if (!to || to === from) continue
      add('address', from, to, 'inferred', [a.id, ...(t.unit ? [t.unit.id] : []), ...(t.service ? [t.service.id] : [])], a.text)
    }
  }

  // A deployed database stands for the database fact it is.
  const databaseOf = new Map(repositories.flatMap((r) => r.databases).filter((d) => d.service).map((d) => [d.service!, d]))
  // Deployment: depends_on between services.
  for (const s of services) {
    if (!s.unit) continue
    for (const name of s.dependsOn) {
      // A compose file's depends_on names a service of its own repository.
      const other = services.find((x) => x.name === name && repoOf(x.id) === repoOf(s.id))
      if (!other) continue
      // A migrator or a seeding job is waited for, not called.
      const job = units.find((u) => u.id === other.unit)
      if ([other.name, job?.name ?? '', job?.path.split('/').pop() ?? ''].some((n) => /migrat|seed/i.test(n))) continue
      add('runtime', s.unit, other.unit ?? databaseOf.get(other.id)?.id ?? other.id, 'observed', [s.id, other.id], `depends on ${name}`)
    }
  }

  // Data: a database a unit's connection string names; the deployed service, when its server is one.
  for (const db of repositories.flatMap((r) => r.databases)) {
    if (!db.unit) continue
    const host = db.server?.toLowerCase().replace(/[\\/].*$/, '')
    const named = host ? (nameFrom(host, db.unit) ?? []).find((t) => t.unit?.id !== db.unit) : undefined
    add('data', db.unit, db.id, 'observed', [db.id, ...(named?.service ? [named.service.id] : [])], `${db.engine}${db.name ? ` ${db.name}` : ''}`)
    const via = named ? named.unit?.id ?? named.service!.id : undefined
    const link = links.get(`link:data:${db.unit}->${db.id}`)
    if (link && via) link.via = via
  }

  // Routines: a unit's code calling a stored routine, the one a script of its own repository creates first, then any
  // repository's, then the one known only from the calls.
  const routines = repositories.flatMap((r) => r.routines ?? [])
  const sameName = (r: { name: string }, call: string): boolean => r.name === call || r.name.endsWith(`.${call}`) || call.endsWith(`.${r.name}`)
  for (const call of repositories.flatMap((r) => r.routineCalls ?? [])) {
    // (A script's call names the routine as its database knows it.)
    const candidates = routines.filter((r) => call.via === 'SQL script' ? r.name === call.routine : sameName(r, call.routine))
    const declared = candidates.filter((r) => !r.called)
    const own = declared.filter((r) => repoOf(r.id.replace(':routine:', ':unit:')) === repoOf(call.unit))
    for (const r of (own.length ? own : declared.length ? declared : candidates).slice(0, 3)) add('routine', call.unit, r.id, 'observed', [call.id, r.id], `calls ${r.name}`)
  }
  // A database project calling another one's routine, or referencing a table only another one creates (a schema's
  // foreign key to another schema's table), depends on it: Oracle's sample schemas, a PL/SQL library's demos.
  const sqlUnits = new Set(units.filter((u) => u.stack === 'sql').map((u) => u.id))
  for (const call of repositories.flatMap((r) => r.routineCalls ?? []).filter((c) => sqlUnits.has(c.unit))) {
    const callee = [...new Set(routines.filter((r) => !r.called && r.unit && r.unit !== call.unit && r.name === call.routine).map((r) => r.unit!))]
    for (const u of callee) add('routine', call.unit, u, 'observed', [call.id], `calls ${call.routine}`)
  }
  // A package whose members call another package's members calls that package: one link per pair, from the routine
  // facts of the packages (Alexandria's amazon_aws_s3_pkg.get_object calls http_util_pkg.get_blob_from_url).
  const packageOf = (r: RoutineFact): string | undefined => (r.name.includes('.') ? `${r.id.slice(0, r.id.length - r.name.length)}${r.name.split('.')[0]}` : undefined)
  const packages = new Set(routines.filter((r) => r.kind === 'package' && !r.called).map((r) => r.id))
  const declaredBy = new Map<string, RoutineFact[]>()
  for (const r of routines) if (!r.called && r.name.includes('.')) declaredBy.set(r.name, [...(declaredBy.get(r.name) ?? []), r])
  for (const r of routines.filter((x) => !x.called && x.calls?.length)) {
    const from = packageOf(r)
    if (!from || !packages.has(from)) continue
    for (const call of r.calls!) {
      const callee = declaredBy.get(call)?.find((x) => repoOf(x.id.replace(':routine:', ':unit:')) === repoOf(r.id.replace(':routine:', ':unit:')))
      const to = callee && packageOf(callee)
      if (to && to !== from && packages.has(to)) add('routine', from, to, 'observed', [r.id, callee.id], `calls ${call}`)
    }
  }
  const bare = (table: string): string => table.split('.').pop()!.toLowerCase()
  for (const r of repositories) {
    for (const t of r.tables.filter((t) => sqlUnits.has(t.unit))) {
      for (const ref of t.references ?? []) {
        if (r.tables.some((x) => x.unit === t.unit && bare(x.table) === bare(ref.table))) continue
        const owners = [...new Set(r.tables.filter((x) => sqlUnits.has(x.unit) && bare(x.table) === bare(ref.table)).map((x) => x.unit))]
        if (owners.length === 1) add('data', t.unit, owners[0], 'observed', [t.id], `references ${ref.table}`)
      }
    }
  }

  // Messages: a unit that publishes on a channel (a topic, a queue, a message type) calls each unit consuming it, those
  // of the publisher's repository first.
  const messages = repositories.flatMap((r) => r.messages ?? [])
  for (const pub of messages.filter((m) => m.role === 'publishes')) {
    const all = messages.filter((m) => m.role === 'consumes' && m.unit !== pub.unit && channelMatches(m.channel, pub.channel))
    const own = all.filter((m) => repoOf(m.unit) === repoOf(pub.unit))
    for (const con of own.length ? own : all) add('message', pub.unit, con.unit, 'inferred', [pub.id, con.id], `${pub.via} ${pub.channel}`)
  }

  // Spring Cloud's defaults: a client of Eureka, of a config server, of Kafka or of RabbitMQ that names no server of its
  // kind connects to the one its repository has, as Spring Cloud does on its own machine or network.
  for (const r of repositories) {
    const deps = r.dependencies.filter((d) => !d.target)
    const has = (u: Unit, re: RegExp): boolean => deps.some((d) => d.unit === u.id && re.test(d.package))
    for (const c of CONVENTIONS) {
      const servers = [
        ...r.units.filter((u) => c.server && has(u, c.server)).map((u) => u.id),
        ...(c.image ? services.filter((s) => repoOf(s.id) === r.repository && c.image!.test(`${s.image ?? ''} ${s.name}`) && !s.unit).map((s) => s.id) : []),
        ...(c.image ? r.units.filter((u) => u.stack === 'docker' && c.image!.test(u.name)).map((u) => u.id) : []),
      ]
      // Several (a broker beside its topics' generator, its connectors): the one named for its kind (kafka, rabbitmq, nats).
      const named = [...new Set(servers)].filter((id) => /^(kafka|rabbitmq|rabbit|nats|eureka|config)(-?server)?$/i.test(services.find((x) => x.id === id)?.name ?? r.units.find((u) => u.id === id)?.name ?? ''))
      if (new Set(servers).size !== 1 && named.length !== 1) continue
      if (new Set(servers).size !== 1) servers.splice(0, servers.length, named[0])
      // Only an app connects: a library is bundled into the apps that use it.
      for (const u of r.units.filter((x) => x.kind === 'app' && x.id !== servers[0] && !(c.server && has(x, c.server)))) {
        const dep = deps.find((d) => d.unit === u.id && c.client.test(d.package))
        // Named already: the client's addresses reach a server of this kind.
        if (!dep || [...links.values()].some((l) => l.from === u.id && l.to === servers[0])) continue
        add('address', u.id, servers[0], 'inferred', [dep.id, servers[0]], `${c.name} client (${dep.package}): the repository's only ${c.name}`)
      }
    }
  }

  return [...links.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** A consumer's channel takes a publisher's: the same name, case aside, or a NATS wildcard (ORDERS.* one token, ORDERS.>
 *  the rest). */
function channelMatches(consumer: string, published: string): boolean {
  if (consumer.toLowerCase() === published.toLowerCase()) return true
  if (!/(^|\.)[*>](\.|$)/.test(consumer)) return false
  const re = new RegExp(`^${consumer.split('.').map((t) => (t === '*' ? '[^.]+' : t === '>' ? '.+' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('\\.')}$`, 'i')
  return re.test(published)
}

/** The servers a client finds by default: Spring Cloud's by the client's dependency and the server's (a unit), and a
 *  broker's client of any stack (npm, PyPI, Go, NuGet) by the broker's image. */
export const CONVENTIONS: Array<{ name: string; client: RegExp; server?: RegExp; image?: RegExp; broker?: string }> = [
  { name: 'Eureka server', client: /(^|:)spring-cloud-starter(-netflix)?-eureka(-client)?$|(^|:)eureka-client$/, server: /(^|:)spring-cloud-(starter-(netflix-)?)?eureka-server$|(^|:)eureka-server$/ },
  { name: 'config server', client: /(^|:)spring-cloud-(starter-config|config-client)$/, server: /(^|:)spring-cloud-config-server$/ },
  { name: 'Kafka broker', client: /(^|:)(spring-kafka|kafka-clients|kafka-streams|spring-cloud-stream-binder-kafka(-streams)?|spring-cloud-starter-stream-kafka)$|^(kafkajs|kafka-python|aiokafka|confluent-kafka|faststream|Confluent\.Kafka)$|^github\.com\/(segmentio\/kafka-go|IBM\/sarama|Shopify\/sarama|confluentinc\/confluent-kafka-go)/, image: /\bkafka\b(?!-ui|-manager|drop|-connect)/i, broker: 'kafka' },
  { name: 'RabbitMQ broker', client: /(^|:)(spring-boot-starter-amqp|spring-rabbit|amqp-client|spring-cloud-stream-binder-rabbit|spring-cloud-starter-(stream|bus)-(rabbit|amqp))$|^(amqplib|amqp-connection-manager|pika|aio-pika|RabbitMQ\.Client|MassTransit\.RabbitMQ)$|^github\.com\/(rabbitmq\/amqp091-go|streadway\/amqp|ThreeDotsLabs\/watermill-amqp)/, image: /rabbit/i, broker: 'rabbitmq' },
  { name: 'NATS server', client: /^(nats|nats-py|NATS\.Client|NATS\.Net)$|^github\.com\/nats-io\/nats\.go/, image: /\bnats\b/i, broker: 'nats' },
]
