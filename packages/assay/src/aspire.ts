// ─── Radical Assay: .NET Aspire ──────────────────────────────────────────────
//
// An Aspire AppHost describes in C# what docker-compose describes in YAML:
// var basket = builder.AddProject<Projects.Basket_API>("basket-api")
//   .WithReference(redis).WithReference(rabbitMq) runs a project of the
// repository beside a cache and a queue it uses. Read as services, each with
// what it references.

import type { DatabaseFact, ServiceFact, Unit } from './facts'
import { RepoFiles, dirOf, lineAt, resolveFrom } from './files'

/** What an Aspire resource runs, by the method that adds it. */
const KINDS: Array<[RegExp, ServiceFact['role'], string?]> = [
  [/^(Project|DotnetProject|NpmApp|NodeApp|PythonApp|UvicornApp|Executable|Container|Dockerfile|JavaApp|SpringApp)$/, 'app'],
  [/^(Redis|Garnet|Valkey|AzureRedis)$/, 'cache'],
  [/^(RabbitMQ|Kafka|Nats|AzureServiceBus|AzureEventHubs)$/, 'queue'],
  [/^(Postgres|AzurePostgresFlexibleServer)$/, 'database', 'PostgreSQL'], [/^(SqlServer|AzureSqlServer)$/, 'database', 'SQL Server'],
  [/^(MySql)$/, 'database', 'MySQL'], [/^(MongoDB)$/, 'database', 'MongoDB'], [/^(Oracle)$/, 'database', 'Oracle'], [/^(AzureCosmosDB)$/, 'database', 'Cosmos DB'],
]

export function readAspire(files: RepoFiles, repo: string, units: Unit[]): { services: ServiceFact[]; databases: DatabaseFact[] } {
  const services: ServiceFact[] = []
  const databases: DatabaseFact[] = []
  const hosts = files.list.filter((f) => f.endsWith('.cs') && /DistributedApplication\.CreateBuilder/.test(files.read(f)))
  const folders = [...new Set(hosts.map(dirOf))]
  // An AppHost's sources: the files of its folder (extension methods add resources too).
  const sources = files.list.filter((f) => f.endsWith('.cs') && folders.includes(dirOf(f)))
  const byVar = new Map<string, ServiceFact>()
  const engineOf = new Map<string, string>()

  for (const file of sources) {
    const raw = files.read(file)
    const text = raw.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    for (const m of text.matchAll(/(?:var\s+(\w+)\s*=\s*)?(\w+)\s*\.\s*Add(\w+?)(?:<Projects\.(\w+)>)?\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?[^;]*;/g)) {
      const [statement, variable, receiver, kind, projectType, name, second] = m
      const found = KINDS.find(([re]) => re.test(kind))
      const parent = byVar.get(receiver)
      // postgres.AddDatabase("catalogdb"): a database of the server it is added to.
      const role = kind === 'Database' ? 'database' : found?.[1]
      if (!role) continue
      const evidence = { file, line: lineAt(raw, m.index! + (statement.indexOf(`Add${kind}`) >= 0 ? statement.indexOf(`Add${kind}`) : 0)) }
      let unit: Unit | undefined
      if (role === 'app') {
        const project = projectType?.replace(/_/g, '.')
        const path = second && /[\\/]/.test(second) ? resolveFrom(dirOf(file), second) : null
        unit = units.find((u) => (path && (u.path === path || u.path === dirOf(path))) || (project && u.name.toLowerCase() === project.toLowerCase()))
      }
      const id = `${repo}:service:${name}`
      const service: ServiceFact = services.find((s) => s.id === id) ?? { id, name, ...(unit ? { unit: unit.id } : {}), role, dependsOn: [], evidence }
      if (!services.includes(service)) services.push(service)
      if (variable) byVar.set(variable, service)
      const engine = kind === 'Database' ? (parent ? engineOf.get(parent.name) : undefined) : found?.[2]
      if (engine) engineOf.set(name, engine)
      if (role === 'database' && kind === 'Database') databases.push({ id: `${repo}:db:service:${name}`, service: id, engine: engine ?? 'database', name, evidence })
    }
    // var identityEndpoint = identityApi.GetEndpoint(…) stands for identityApi.
    for (const m of text.matchAll(/var\s+(\w+)\s*=\s*(\w+)\.GetEndpoint\(/g)) {
      const s = byVar.get(m[2])
      if (s) byVar.set(m[1], s)
    }
    // What each resource references: .WithReference(x), .WithEnvironment("…", x), on its own statement or a later one.
    for (const m of text.matchAll(/(?:var\s+(\w+)\s*=\s*)?(\w+)\s*\.\s*(?:Add\w+(?:<[^>]+>)?\(\s*"([^"]+)"[^;]*?|[^;]*?)((?:\.\s*With(?:Reference|Environment)\([^;]*?)+);/g)) {
      const owner = m[3] ? services.find((s) => s.name === m[3]) : byVar.get(m[2])
      if (!owner) continue
      for (const r of m[4].matchAll(/\.\s*WithReference\(\s*(\w+)\s*\)|\.\s*WithEnvironment\(\s*"[^"]*"\s*,\s*(\w+)\s*\)/g)) {
        const target = byVar.get(r[1] ?? r[2])
        if (target && target !== owner && !owner.dependsOn.includes(target.name)) owner.dependsOn.push(target.name)
      }
    }
  }
  return { services, databases }
}
