import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories, type Link } from '../src/index'
import { polyglot } from './shop'

function read() {
  const facts = extractRepository(polyglot())
  const links = linkRepositories([facts])
  const s = (id: string) => id.replace('polyglot:', '')
  const linked = (kind?: Link['kind']) => links.filter((l) => !kind || l.kind === kind).map((l) => [l.kind, l.confidence, s(l.from), s(l.to), ...(l.via ? [s(l.via)] : [])])
  return { facts, links, s, linked }
}

describe('radical assay: units of every stack', () => {
  it('finds the units of every stack wherever they are, each with its kind, and the references between them by path', () => {
    const { facts, s } = read()
    expect(facts.units.map((u) => [u.path, u.stack, u.kind])).toEqual([
      ['apphost', 'dotnet', 'app'], ['catalog', 'go', 'app'], ['gateway', 'maven', 'app'],
      ['legacy/App', 'vb6', 'app'], ['legacy/Lib', 'vb6', 'library'], ['legacy/Tests', 'vb6', 'tests'],
      ['metrics', 'docker', 'app'], ['orders', 'maven', 'app'], ['recommender', 'python', 'app'],
      ['shared', 'dotnet', 'library'], ['tests/Web.Tests', 'dotnet', 'tests'], ['web', 'dotnet', 'app'],
    ])
    expect(facts.units.find((u) => u.path === 'orders')).toMatchObject({ name: 'shop:orders-service', aliases: ['orders-service', 'orders'], why: 'it has a Spring Boot application class' })
    expect(facts.units.find((u) => u.path === 'legacy/Lib')).toMatchObject({ name: 'Lib', aliases: ['ShopLib.dll', 'Lib.vbp'], description: 'VB6 ActiveX DLL' })
    expect(facts.dependencies.filter((d) => d.target).map((d) => [s(d.unit), s(d.target!), `${d.evidence.file}:${d.evidence.line}`])).toEqual([
      ['unit:legacy/Tests', 'unit:legacy/Lib', 'legacy/Tests/Tests.vbp:2'],
      ['unit:tests/Web.Tests', 'unit:web', 'tests/Web.Tests/Web.Tests.csproj:4'],
      ['unit:web', 'unit:shared', 'web/Web.csproj:3'],
    ])
    expect(facts.groups.map((g) => [g.name, g.units.map(s)])).toEqual([['Legacy', ['unit:legacy/App', 'unit:legacy/Lib', 'unit:legacy/Tests']]])
  })

  it('links a VB6 program to the library whose binary it references, and a project to the one it names by path', () => {
    const { linked } = read()
    expect(linked('package')).toEqual([
      ['package', 'observed', 'unit:legacy/App', 'unit:legacy/Lib'],
      ['package', 'observed', 'unit:legacy/Tests', 'unit:legacy/Lib'],
      ['package', 'observed', 'unit:tests/Web.Tests', 'unit:web'],
      ['package', 'observed', 'unit:web', 'unit:shared'],
    ])
  })
})

describe('radical assay: how the system runs', () => {
  it('reads the services of docker-compose, Kubernetes and Aspire, each with its unit, and what each depends on', () => {
    const { facts, s, linked } = read()
    expect(facts.services.map((x) => [x.name, x.role, x.unit ? s(x.unit) : null, x.dependsOn])).toEqual([
      ['orders', 'app', 'unit:orders', ['orders-db']], ['orders-db', 'database', null, []], ['catalog', 'app', 'unit:catalog', []],
      ['gateway', 'app', 'unit:gateway', ['orders']], ['recommender', 'app', 'unit:recommender', []],
      ['cache', 'cache', null, []], ['web', 'app', 'unit:web', ['cache']],
    ])
    expect(linked('runtime')).toEqual([
      ['runtime', 'observed', 'unit:gateway', 'unit:orders'],
      ['runtime', 'observed', 'unit:orders', 'db:service:orders-db'],
      ['runtime', 'observed', 'unit:web', 'service:cache'],
    ])
  })
})

describe('radical assay: gRPC', () => {
  it('takes a service a unit registers as its API, and links a unit making its client to it', () => {
    const { facts, s, linked } = read()
    expect(facts.apis.map((a) => [s(a.id), a.protocol, `${a.evidence.file}:${a.evidence.line}`])).toEqual([['api:catalog:grpc CatalogService', 'grpc', 'catalog/main.go:5']])
    expect(facts.clients.map((c) => [s(c.id), `${c.evidence.file}:${c.evidence.line}`])).toEqual([['client:recommender:CatalogService', 'recommender/main.py:3']])
    expect(linked('grpc')).toEqual([['grpc', 'inferred', 'unit:recommender', 'unit:catalog']])
  })
})

describe('radical assay: databases and tables', () => {
  it('reads the database a VB6 form and a Spring application connect to, and the tables the VB6 SQL names, not its captions', () => {
    const { facts, s, linked } = read()
    expect(facts.databases.map((d) => [s(d.id), d.engine, d.server ?? null, d.name ?? null, `${d.evidence.file}:${d.evidence.line}`])).toEqual([
      ['db:service:orders-db', 'PostgreSQL', null, 'orders-db', 'docker-compose.yml:8'],
      ['db:legacy/App:SQL Server/Shop', 'SQL Server', 'SQL02', 'Shop', 'legacy/App/frmMain.frm:6'],
      ['db:orders:PostgreSQL/orders', 'PostgreSQL', 'orders-db', 'orders', 'orders/src/main/resources/application.yml:5'],
    ])
    expect(facts.tables.map((t) => [t.table, `${t.evidence.file}:${t.evidence.line}`])).toEqual([['Customers', 'legacy/App/frmMain.frm:8'], ['Orders', 'legacy/App/frmMain.frm:8']])
    // The Spring application's database runs on the service compose deploys.
    expect(linked('data')).toEqual([
      ['data', 'observed', 'unit:legacy/App', 'db:legacy/App:SQL Server/Shop'],
      ['data', 'observed', 'unit:orders', 'db:orders:PostgreSQL/orders', 'service:orders-db'],
    ])
  })
})

describe('radical assay: addresses', () => {
  it('links a unit to the unit an address names: a load-balanced route, a URL in the environment, a host given as a default', () => {
    const { linked, links } = read()
    expect(linked('address')).toEqual([
      ['address', 'inferred', 'unit:gateway', 'unit:orders'],
      ['address', 'inferred', 'unit:orders', 'unit:catalog'],
      ['address', 'inferred', 'unit:recommender', 'unit:catalog'],
    ])
    expect(links.find((l) => l.kind === 'address' && l.from.endsWith('recommender'))!.detail).toBe("catalog:50051, getenv('CATALOG_ADDR', 'catalog'")
  })
})
