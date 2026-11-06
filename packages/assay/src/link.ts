// ─── Radical Assay: links across units ───────────────────────────────────────
//
// What no single file states: which unit uses which, within a repository and
// across them. Observed when a manifest, a project reference, a deployment
// or a connection string states it; inferred when it is concluded: a path
// another unit's OpenAPI declares, a client of a gRPC service another unit
// registers, an address whose host names another unit or service. Every link
// cites the facts of both sides.

import type { AddressFact, ApiFact, Link, RepositoryFacts, ServiceFact, Unit, UrlFact } from './facts'

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
      const targets = dep.target ? units.filter((u) => u.id === dep.target) : byPackage.get(dep.package.toLowerCase()) ?? []
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
  for (const a of repositories.flatMap((r) => r.addresses) as AddressFact[]) {
    const holder = a.service ? serviceOf.get(a.service) : undefined
    const from = a.unit ?? holder?.unit
    if (!from) continue
    const local = ['localhost', '127.0.0.1', '0.0.0.0', 'host.docker.internal'].includes(a.host)
    // A local port names a unit only when no other unit listens on it too (5000 is everyone's default).
    const listening = local && a.port !== undefined ? units.filter((u) => u.ports?.includes(a.port!)) : []
    const targets = local
      ? (listening.length === 1 ? listening : []).map((u) => ({ unit: u, service: undefined as ServiceFact | undefined }))
      : byName.get(a.host) ?? byName.get(a.host.split('.')[0]) ?? []
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
      const other = services.find((x) => x.name === name)
      if (!other) continue
      add('runtime', s.unit, other.unit ?? databaseOf.get(other.id)?.id ?? other.id, 'observed', [s.id, other.id], `depends on ${name}`)
    }
  }

  // Data: a database a unit's connection string names; the deployed service, when its server is one.
  for (const db of repositories.flatMap((r) => r.databases)) {
    if (!db.unit) continue
    const host = db.server?.toLowerCase().replace(/[\\/].*$/, '')
    const named = host ? (byName.get(host) ?? []).find((t) => t.unit?.id !== db.unit) : undefined
    add('data', db.unit, db.id, 'observed', [db.id, ...(named?.service ? [named.service.id] : [])], `${db.engine}${db.name ? ` ${db.name}` : ''}`)
    const via = named ? named.unit?.id ?? named.service!.id : undefined
    const link = links.get(`link:data:${db.unit}->${db.id}`)
    if (link && via) link.via = via
  }

  return [...links.values()].sort((a, b) => a.id.localeCompare(b.id))
}
