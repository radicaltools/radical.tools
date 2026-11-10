// ─── Radical Assay: facts ────────────────────────────────────────────────────
//
// What Assay reads from a repository without asking anyone (ADR Radical
// Assay): its units, in whatever stack and wherever they are in it, what each
// depends on, the APIs it declares or serves, the addresses and URL paths its
// code and configuration name, the gRPC clients it makes, the services its
// deployment files run, the databases and tables it uses (with their columns
// and foreign keys where a schema or an ORM class declares them), the values
// its statuses take, its entry points (routes, forms and menus, jobs,
// handlers), the groups of units its solutions name, and the tests its
// reports name. Each fact cites
// its file and line from the repository's root. A fact's id starts with the
// repository's name, so the facts of a run's repositories never clash and a
// plan can cite any of them.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PathFact, ScreenFact } from './explore'

/** Where a fact is written in the repository: a file from its root and a line (1-based). */
export interface Evidence {
  file: string
  line: number
}

/** The stack a unit is read from. */
export type Stack = 'npm' | 'maven' | 'gradle' | 'ant' | 'go' | 'dotnet' | 'python' | 'php' | 'ruby' | 'perl' | 'elixir' | 'rust' | 'vb6' | 'sql' | 'docker'

/** A unit of the repository: a project with a manifest of its own (or a folder with a Dockerfile). */
export interface Unit {
  id: string
  /** Folders of shared code it builds besides its own (a Go module's packages outside its main packages): files in no
   *  unit's folder there are its. */
  shares?: string[]
  /** Its name as its manifest gives it, else the folder's. */
  name: string
  /** False when no manifest names it and its name is its folder's: such a name links no dependency. */
  named?: boolean
  /** Other names others call it by: its folder's, a Maven artifactId, a Spring application name, a VB6 binary. */
  aliases?: string[]
  /** Its folder from the repository's root ("." for the root). */
  path: string
  stack: Stack
  /** An app runs (a bin, a start script, a Dockerfile, a main, a web SDK, a VB6 Exe); a library is used; tests check others. */
  kind: 'app' | 'library' | 'tests'
  /** Why it is the kind it is, for people. */
  why: string
  /** Frameworks and runtimes it names (React, Spring Boot, gRPC, ADO, …). */
  technology: string[]
  /** Ports it listens on, as its launch settings, Dockerfile or configuration give them. */
  ports?: number[]
  /** The test framework its manifest names, which a pending test of a scenario is written for. */
  testFramework?: TestFramework
  description?: string
  evidence: Evidence
}

/** The test frameworks Assay writes a pending test for. */
export type TestFramework = 'vitest' | 'jest' | 'mocha' | 'junit5' | 'junit4' | 'pytest' | 'xunit' | 'nunit' | 'mstest' | 'utplsql' | 'pgtap'

/** A unit depends on a package, or on another unit by path (a project reference). */
export interface DependencyFact {
  id: string
  unit: string
  /** The package's name (a Maven groupId:artifactId, a Go module, a NuGet package, a COM library). */
  package: string
  /** The unit it names, when it names one by path. */
  target?: string
  /** The binary a COM reference names (a VB6 DLL or OCX): another unit may build it. */
  file?: string
  /** Referenced, but no code of the unit uses it (an Office object library it never automates). */
  unused?: boolean
  evidence: Evidence
}

/** An operation a unit declares or serves: an OpenAPI operation, or a gRPC service it registers. */
export interface ApiFact {
  id: string
  /** The unit it belongs to (the nearest unit above its file). */
  unit: string
  protocol: 'http' | 'grpc'
  /** HTTP: the method; gRPC: "service". */
  method: string
  /** HTTP: the path as declared ("/orders/{id}"), with the servers' base path in front when one is given; gRPC: the service's name. */
  path: string
  /** HTTP: the servers' base path, which a caller's string may leave to a variable. */
  base?: string
  evidence: Evidence
}

/** A URL path a unit's code names in a string (a call, most likely). */
export interface UrlFact {
  id: string
  unit: string
  /** The path, with the parts filled in at run time written {} ("/orders/{}"). */
  path: string
  evidence: Evidence
}

/** A gRPC client of a service a unit's code makes. */
export interface ClientFact {
  id: string
  unit: string
  service: string
  evidence: Evidence
}

/** An address a unit's code or configuration, or a deployed service's environment, names. */
export interface AddressFact {
  id: string
  /** The unit whose file names it. */
  unit?: string
  /** The service whose environment names it. */
  service?: string
  scheme?: string
  host: string
  port?: number
  text: string
  evidence: Evidence
}

/** A service a deployment file (docker-compose, Kubernetes) runs. */
export interface ServiceFact {
  id: string
  name: string
  /** The unit it is built from or runs, when one is known. */
  unit?: string
  image?: string
  /** observability: tracing, metrics and logs (Zipkin, Prometheus, Fluentd, …), true calls but no part of what the system does. */
  role: 'app' | 'database' | 'queue' | 'cache' | 'observability' | 'other'
  /** The services it depends on (docker-compose depends_on), by name. */
  dependsOn: string[]
  /** A broker its clients' library connects to by default, deployed by nothing of the repository (its evidence: a
   *  client's dependency). */
  assumed?: boolean
  evidence: Evidence
}

/** A database a unit connects to (a connection string) or a deployment runs. */
export interface DatabaseFact {
  id: string
  unit?: string
  service?: string
  /** SQL Server, Oracle, Access, PostgreSQL, MySQL, MongoDB, Redis, ODBC, … */
  engine: string
  server?: string
  name?: string
  evidence: Evidence
}

/** A table the SQL in a unit's code names, an SQL file creates or an ORM class maps. */
export interface TableFact {
  id: string
  unit: string
  table: string
  /** Its unit's code names it (SQL in a string, a data control, an ORM class), beyond a schema file. */
  inCode?: boolean
  /** Where it is declared, its columns known: SQL (CREATE TABLE), JPA, Entity Framework Core, Django, SQLAlchemy, TypeORM, Prisma. */
  declared?: string
  /** Its columns, as declared; `type` as written (for an ORM class, the field's type). */
  /** …each with its line, in `file` where a later script's ALTER TABLE adds it. */
  columns?: Array<{ name: string; type?: string; notNull?: boolean; line: number; file?: string }>
  /** Its foreign keys: the column and the table it references (an ORM class's reference names the table its class maps). */
  references?: Array<{ column?: string; table: string; line: number }>
  evidence: Evidence
}

/** The values a status or state takes: an enum named for one, a CHECK … IN list, an SQL ENUM. */
export interface StateFact {
  id: string
  unit: string
  /** The enum's name, or the column's. */
  name: string
  values: string[]
  /** The table and column whose values they are, where the SQL or an ORM class says so. */
  table?: string
  column?: string
  /** A lifecycle kept in flags: each boolean column or nullable date, and the value it stands for (is_dead: dead,
   *  PaidOn: paid); the fact's values are each flag and its negation (dead, not dead). */
  flags?: Array<{ column: string; value: string; line: number }>
  /** The value a new one starts with, where the SQL gives the column a default. */
  initial?: string
  /** The lines of the repository's code that set a value (an assignment, a setter, an UPDATE … SET), each with its unit. */
  sets: Array<{ value: string; unit: string; file: string; line: number }>
  evidence: Evidence
}

/** A stored routine a database's scripts create: a procedure, a function, a package or one of its members, a trigger. */
export interface RoutineFact {
  id: string
  /** The unit whose scripts create it; none for a routine known only from the code's calls of it. */
  unit?: string
  /** Lower-case, as code calls it: proc, pkg (a package), pkg.member, a trigger's name. */
  name: string
  kind: 'procedure' | 'function' | 'package' | 'trigger'
  /** Oracle (PL/SQL), SQL Server (T-SQL), PostgreSQL (PL/pgSQL), MySQL. */
  dialect?: string
  /** A trigger's table. */
  table?: string
  /** The tables its body reads and writes, and the routines it calls, by name. */
  reads?: string[]
  writes?: string[]
  calls?: string[]
  /** Created by no script of the run: the code calls it, the database holds it. */
  called?: boolean
  evidence: Evidence
}

/** A unit's code calling a stored routine: JDBC's prepareCall, Spring's SimpleJdbcCall, JPA's @Procedure, ADO.NET's
 *  CommandType.StoredProcedure, Python's callproc, EXEC or CALL in its SQL. */
export interface RoutineCallFact {
  id: string
  unit: string
  /** The routine's lower-case name: pkg.member where a package or catalog names it. */
  routine: string
  via: string
  evidence: Evidence
}

/** A message a unit's code publishes or consumes: on a topic, a queue or an exchange by name, or of a message type a
 *  bus routes by its type (MassTransit). */
export interface MessageFact {
  id: string
  unit: string
  role: 'publishes' | 'consumes'
  /** The topic, queue or exchange; for a bus routing by type, the message type. */
  channel: string
  /** Kafka, RabbitMQ, a Spring Cloud Stream binding, MassTransit. */
  via: string
  evidence: Evidence
}

/** Where a user, a clock or another system enters a unit's code. */
export interface EntryFact {
  id: string
  unit: string
  /** route: an HTTP route its code declares; form, menu, control: a VB6 form, a menu item and a command button of it;
   *  job: a scheduled job; handler: a message or event handler. */
  kind: 'route' | 'form' | 'menu' | 'control' | 'job' | 'handler'
  /** The route's method, the form's or control's name, the job's or handler's method. */
  name: string
  /** A route's path, a form's or control's caption, a job's schedule, a handler's queue or topic. */
  detail?: string
  /** The form a menu item or control is on. */
  form?: string
  /** The code that runs: a VB6 control's Click handler. */
  handler?: Evidence
  evidence: Evidence
}

/** Units a solution or project group puts together (a VB6 .vbg, a .NET .sln). */
export interface GroupFact {
  id: string
  name: string
  units: string[]
  evidence: Evidence
}

/** A test a report of the repository names. */
export interface TestFact {
  id: string
  /** The unit whose folder holds the test file; absent when none does. */
  unit?: string
  /** `<file> › <title>`, the id .radical/radical.json verifies binds. */
  test: string
  /** not run: a database's test its code declares, which no report names (ADR Database tests declared in code are facts not run). */
  status: 'passed' | 'failed' | 'skipped' | 'not run'
  /** Its body is empty or asserts nothing (a JavaScript test): it passes whatever the code does. */
  checksNothing?: boolean
  evidence: Evidence
}

/** A document: a repository's README, docs or ADR record, or a source's
 *  document kept as text. Evidence of intent, never of what runs. */
export interface DocumentFact {
  id: string
  /** From the root of its repository or source. */
  file: string
  title: string
  headings: Array<{ level: number; text: string; line: number }>
  /** What a source's document was taken from: the link, or the file of the folder or .zip given. */
  origin?: string
  evidence: Evidence
}

export interface RepositoryFacts {
  /** The repository's name: its folder's. */
  repository: string
  /** Its folder, absolute. */
  dir: string
  /** HEAD when it has a commit. */
  commit?: string
  /** For a source of documents, what it was taken from (a folder, a .zip file or a link); none for code. */
  origin?: string
  units: Unit[]
  dependencies: DependencyFact[]
  apis: ApiFact[]
  urls: UrlFact[]
  clients: ClientFact[]
  addresses: AddressFact[]
  services: ServiceFact[]
  databases: DatabaseFact[]
  tables: TableFact[]
  states: StateFact[]
  entries: EntryFact[]
  messages: MessageFact[]
  routines: RoutineFact[]
  routineCalls: RoutineCallFact[]
  groups: GroupFact[]
  tests: TestFact[]
  documents: DocumentFact[]
  /** The screens and paths of an explored application (the Explore stage's session only). */
  screens: ScreenFact[]
  paths: PathFact[]
  /** What could not be read, said, not thrown: a manifest that does not parse, a report that is no report. */
  notes: string[]
}

/** The facts file of a repository, from its root. */
export const FACTS_FILE = '.radical/assay/facts.json'
/** Where the central repository keeps the facts of folders of code, which Assay leaves as they were. */
export const FOLDER_FACTS_DIR = '.radical/assay/facts'

/** The facts file of `dir`: its own FACTS_FILE when it is a repository, else `<root>`'s FOLDER_FACTS_DIR/<name>.json. */
export const factsFileOf = (dir: string, name: string, root: string): string =>
  existsSync(join(dir, '.git')) ? join(dir, FACTS_FILE) : join(root, FOLDER_FACTS_DIR, `${name}.json`)
const FORMAT = 'radical-assay-facts/1'

/** The lists of facts a repository's facts hold. */
export const FACT_LISTS = ['units', 'dependencies', 'apis', 'urls', 'clients', 'addresses', 'services', 'databases', 'tables', 'states', 'entries', 'messages', 'routines', 'routineCalls', 'groups', 'tests', 'documents', 'screens', 'paths'] as const

/** No facts yet: every list empty. */
export const emptyFacts = (repository: string, dir: string): RepositoryFacts => ({
  repository, dir, units: [], dependencies: [], apis: [], urls: [], clients: [], addresses: [], services: [], databases: [], tables: [], states: [], entries: [], messages: [], routines: [], routineCalls: [], groups: [], tests: [], documents: [], screens: [], paths: [], notes: [],
})

/** The facts as written to FACTS_FILE: without the absolute folder, which is the reader's. */
export function serializeFacts(facts: RepositoryFacts): string {
  const { dir: _dir, ...rest } = facts
  return `${JSON.stringify({ format: FORMAT, ...rest }, null, 2)}\n`
}

/** The facts of FACTS_FILE read from `dir`; throws when it is no facts file. */
export function parseFacts(text: string, dir: string): RepositoryFacts {
  const raw = JSON.parse(text) as Partial<RepositoryFacts> & { format?: string }
  if (raw.format !== FORMAT) throw new Error(`${FACTS_FILE}: not a ${FORMAT} file`)
  const { format: _format, ...rest } = raw
  return { ...emptyFacts(rest.repository ?? '', dir), ...rest, dir }
}

/** A link between two units (or a unit and a service or database it uses), of one repository or two. */
export interface Link {
  id: string
  /** package: a manifest or project reference; http: a path an OpenAPI description declares; grpc: a client of a service
   *  another unit registers; address: a host naming another unit or service; runtime: depends_on in a deployment;
   *  data: a database the unit connects to; message: a topic, queue or message type one unit publishes and another
   *  consumes; routine: a stored routine the unit's code calls, or a stored package another one's members call. */
  kind: 'package' | 'http' | 'grpc' | 'address' | 'runtime' | 'data' | 'message' | 'routine'
  /** A unit, or a stored package's routine fact. */
  from: string
  /** A unit, a service, database or routine fact. */
  to: string
  /** observed: a manifest, a project reference, a deployment or a connection string states it; inferred: concluded. */
  confidence: 'observed' | 'inferred'
  /** The facts on both sides. */
  facts: string[]
  /** For people: "depends on @shop/lib", "GET /orders/{id}". */
  detail: string
  /** data: the deployed service (or its unit) the database runs on, when its server names one. */
  via?: string
}

export type FactKind = 'unit' | 'dependency' | 'api' | 'url' | 'client' | 'address' | 'service' | 'database' | 'table' | 'state' | 'entry' | 'message' | 'routine' | 'routine-call' | 'group' | 'test' | 'document' | 'screen' | 'path' | 'link'
export type AnyFact = Unit | DependencyFact | ApiFact | UrlFact | ClientFact | AddressFact | ServiceFact | DatabaseFact | TableFact | StateFact | EntryFact | MessageFact | RoutineFact | RoutineCallFact | GroupFact | TestFact | DocumentFact | ScreenFact | PathFact | Link

const KIND_OF: Record<(typeof FACT_LISTS)[number], FactKind> = {
  units: 'unit', dependencies: 'dependency', apis: 'api', urls: 'url', clients: 'client', addresses: 'address',
  services: 'service', databases: 'database', tables: 'table', states: 'state', entries: 'entry', messages: 'message', routines: 'routine', routineCalls: 'routine-call', groups: 'group', tests: 'test', documents: 'document', screens: 'screen', paths: 'path',
}

/** Every fact of the repositories by id, links included. */
export function factIndex(repositories: RepositoryFacts[], links: Link[] = []): Map<string, { kind: FactKind; repository?: string; fact: AnyFact }> {
  const index = new Map<string, { kind: FactKind; repository?: string; fact: AnyFact }>()
  for (const r of repositories) {
    for (const list of FACT_LISTS) for (const fact of r[list] ?? []) index.set(fact.id, { kind: KIND_OF[list], repository: r.repository, fact })
  }
  for (const fact of links) index.set(fact.id, { kind: 'link', fact })
  return index
}
