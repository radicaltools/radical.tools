// ─── Radical Assay: what a unit's code says ──────────────────────────────────
//
// Read from the source files of each unit, generated code and tests left
// out: the URL paths and addresses its strings name, the gRPC services it
// registers and the clients it makes (of the services .proto files declare),
// the databases its connection strings name and the tables its SQL names.
// VB6 strings continued over lines (" & _) are joined first.

import { extname } from 'node:path'
import { addressesIn } from './runtime'
import type { AddressFact, ApiFact, ClientFact, DatabaseFact, TableFact, Unit, UrlFact } from './facts'
import { GENERATED, RepoFiles, TEST_FILE, escapeRe, lineAt, owner } from './files'
import { settingsFor, springConfigOwners } from './spring'
import { inlineValues, vbValues, type VbValues } from './values'

const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.go', '.py', '.java', '.kt', '.cs', '.vb', '.bas', '.cls', '.frm', '.ctl', '.dsr', '.dob', '.pag', '.php', '.rb', '.ex', '.exs', '.rs', '.scala', '.fs'])
const CONFIG = /\.(json|ya?ml|properties|config|xml|ini|udl|env|toml|conf|template|tmpl|ora)$|(^|\/)\.env(\.[\w-]+)?$/i
/** Paths that name a file, not an endpoint. */
const FILE_PATH = /\.(js|mjs|cjs|ts|tsx|jsx|css|scss|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|html?|json|md|txt|xml|ya?ml|pdf|zip|wasm|exe|dll|so|sh)$/i
/** Folders of a machine, not of an API. */
const SYSTEM_PATH = /^\/(usr|dev|etc|tmp|var|bin|sbin|opt|proc|mnt|srv|nix|private)(\/|$)|^\/(Users|Library|System|Volumes)\//

/** A URL path a string names, normalized ("/orders/{}"), or null when it names none. */
/** A vocabulary's domain (schema.org in JSON-LD, w3.org in a namespace) or a code host's (github.com): it names a
 *  standard or a project's page (its API, api.github.com, is a service), and its paths are no routes. */
export const NOT_SERVICE_HOST = /(^|\.)(schema\.org|w3\.org|json-schema\.org|xmlsoap\.org|purl\.org|ogp\.me|openxmlformats\.org|schemas\.microsoft\.com|tempuri\.org)$|^(www\.)?(github\.com|gitlab\.com|bitbucket\.org)$/i

export function urlPathOf(literal: string): string | null {
  const host = /^https?:\/\/([^/\s:]+)/i.exec(literal)?.[1]
  if (host && NOT_SERVICE_HOST.test(host)) return null
  // A host, or a variable holding one (`${API}/orders`), goes.
  let path = literal.replace(/^https?:\/\/[^/\s]+/i, '').replace(/^\$\{[^}]*\}/, '')
  if (!path.startsWith('/') || path.startsWith('//')) return null
  path = path.replace(/\$\{[^}]*\}/g, '{}').replace(/[?#].*$/, '').replace(/\/+$/, '')
  if (!path || /\s/.test(path) || path.length > 200 || FILE_PATH.test(path) || SYSTEM_PATH.test(path)) return null
  const segments = path.split('/').slice(1)
  if (!segments.length || !segments.some((s) => /[A-Za-z]/.test(s))) return null
  // A file beside the code (__DIR__ . '/../vendor/autoload.php'), not an endpoint.
  if (segments.some((s) => s === '.' || s === '..')) return null
  // A command typed in a chat or a console (/SALIR, /MEDITAR), not a path: one upper-case word.
  if (segments.length === 1 && /^[A-Z][A-Z0-9_]*$/.test(segments[0])) return null
  if (!segments.every((s) => /^(\{[^}]*\}|:[A-Za-z_]\w*|[A-Za-z0-9._~%@-]*)$/.test(s))) return null
  return `/${segments.map((s) => (s.startsWith(':') || /^\{.*\}$/.test(s) ? '{}' : s)).join('/')}`
}

/** Where an address calls nothing: CI configuration, translations, lock files. */
/** A framework's migrations: Rails', Ecto's, Laravel's. */
export const MIGRATION = /(^|\/)(db\/migrate|priv\/[^/]+\/migrations|database\/migrations)\//
/** A CI pipeline's files: the databases its jobs start are the tests', not the system's. */
const CI = /(^|\/)(\.github|\.gitlab|\.circleci|\.buildkite)\/|(^|\/)(\.gitlab-ci|azure-pipelines|bitbucket-pipelines|\.travis)\.ya?ml$/i
const NO_CALLS = /(^|\/)(\.github|\.gitlab|\.circleci|lang|langs|language|languages|lenguajes|idiomas|locale|locales|i18n|l10n|translations?)\/|(^|\/)(package-lock|npm-shrinkwrap)\.json$/i
/** A line whose address names a page's link, an XML namespace or a schema, not a call. */
const NOT_CALLED = /\bhref\s*=|\bxmlns(?::\w+)?\s*=|schemaLocation\s*=|["']\$schema["']\s*:/i
/** The line of the text an index falls on. */
const lineTextAt = (text: string, index: number): string => {
  const end = text.indexOf('\n', index)
  return text.slice(text.lastIndexOf('\n', index) + 1, end < 0 ? undefined : end)
}
/** A line that opens an address in the user's browser rather than calling it (Inet's OpenURL is a call). */
const BROWSER = /\bShellExecute\w*\b|\bShell\s*\(|\bProcess\.Start\b|\bwebbrowser\.open|\bwindow\.open\b|\.Navigate2?\b|\bLaunchUrl\b|\bopenExternal\b/i

/** VB statements continued over lines (" & _, or _) joined into one, each on its first line, and as many empty lines
 *  after it as it was continued over: every line below keeps its number, so evidence cites the right one. */
export function joinContinuations(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\r$/, '')
    let joined = 0
    while (i + 1 < lines.length && /\s_\s*$/.test(line)) {
      const next = lines[++i].replace(/\r$/, '')
      joined++
      line = /"\s*&\s*_\s*$/.test(line) && /^\s*"/.test(next) ? line.replace(/"\s*&\s*_\s*$/, '') + next.replace(/^\s*"/, '') : `${line.replace(/\s_\s*$/, '')} ${next.trim()}`
    }
    out.push(line, ...Array<string>(joined).fill(''))
  }
  return out.join('\n')
}

/** VB code without its comments (' or Rem to the end of a line, outside a string), its lines kept. */
export function withoutVbComments(text: string): string {
  return text.split('\n').map((line) => {
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') quoted = !quoted
      else if (!quoted && (c === "'" || (/^rem\b/i.test(line.slice(i)) && /^\s*$/.test(line.slice(0, i))))) return line.slice(0, i)
    }
    return line
  }).join('\n')
}

/** String literals: '…', "…" and `…` (a template's ${…} may hold spaces). */
const STRING = /(["'`])((?:\$\{[^}]*\}|(?!\1)[^\\\n]|\\.)*)\1/g
/** VB strings: "…" with "" inside; ' starts a comment. */
const VB_STRING = /()"((?:[^"\n]|"")*)"/g
/** VB source: modules, classes, forms, controls, designers and documents. */
const VB_CODE = /\.(bas|cls|frm|ctl|dsr|dob|pag|vb)$/i

const RAILS_ADAPTERS: Record<string, string> = { postgresql: 'postgresql', postgis: 'postgresql', mysql2: 'mysql', trilogy: 'mysql', mysql: 'mysql', sqlserver: 'sqlserver', sqlite3: 'sqlite' }

/** Rails' database.yml as one connection URL on the database line of the environment that runs (production, else
 *  development, else the first), its settings merged with those it inherits (<<: *default); ERB's ENV.fetch("K") { "v" }
 *  and ENV["K"] || "v" read as their defaults. Every other line is emptied (lines hold). */
export function railsDatabases(text: string): string {
  const erb = text
    .replace(/<%=\s*ENV\.fetch\(\s*["']\w+["']\s*(?:,\s*["']?([^"')]*?)["']?\s*)?\)\s*(?:\{\s*["']?([^"'}]*?)["']?\s*\})?\s*%>/g, (_, a?: string, b?: string) => (b ?? a ?? '').trim())
    .replace(/<%=\s*ENV\[\s*["']\w+["']\s*\]\s*(?:\|\|\s*["']([^"']*)["'])?\s*%>/g, (_, a?: string) => a ?? '')
  const lines = erb.split('\n')
  const sections = new Map<string, { anchor?: string; inherits?: string; settings: Record<string, { value: string; line: number }> }>()
  let current: { anchor?: string; inherits?: string; settings: Record<string, { value: string; line: number }> } | undefined
  for (const [i, line] of lines.entries()) {
    const top = /^([\w-]+):\s*(?:&([\w-]+))?\s*$/.exec(line)
    if (top) { current = { ...(top[2] ? { anchor: top[2] } : {}), settings: {} }; sections.set(top[1], current); continue }
    const merge = /^\s+<<:\s*\*([\w-]+)/.exec(line)
    if (merge && current) { current.inherits = merge[1]; continue }
    const kv = /^\s+([\w-]+):\s*["']?([^"'#\n]*?)["']?\s*$/.exec(line)
    if (kv && current) current.settings[kv[1]] = { value: kv[2], line: i }
  }
  const byAnchor = (a: string) => [...sections.values()].find((s) => s.anchor === a)
  const merged = (s: NonNullable<typeof current>, depth = 0): Record<string, { value: string; line: number }> =>
    ({ ...(s.inherits && depth < 5 && byAnchor(s.inherits) ? merged(byAnchor(s.inherits)!, depth + 1) : {}), ...s.settings })
  const env = sections.get('production') ?? sections.get('development') ?? [...sections.values()].find((s) => !s.anchor)
  const blank = lines.map(() => '')
  if (!env) return blank.join('\n')
  const settings = merged(env)
  const scheme = RAILS_ADAPTERS[settings.adapter?.value ?? '']
  const at = settings.url ?? settings.database
  if (at) {
    blank[at.line] = settings.url ? `url: ${settings.url.value}`
      : scheme === 'sqlite' ? `database: sqlite:///${settings.database!.value}`
        : scheme ? `database: ${scheme}://${settings.host?.value || 'localhost'}/${settings.database!.value}` : ''
  }
  return blank.join('\n')
}

/** A database a connection string names. */
export function connectionOf(text: string): { engine: string; server?: string; name?: string; explicit?: boolean } | null {
  const field = (k: string) => new RegExp(`(?:^|;)\\s*(?:${k})\\s*=\\s*([^;"']*)`, 'i').exec(text)?.[1]?.trim() || undefined
  // An ODBC driver names its engine, whatever fills in the server and the database at run time.
  const driver = /\bDRIVER\s*=\s*\{([^}]*)\}/i.exec(text)?.[1]
  if (driver) {
    const engine = /mysql/i.test(driver) ? 'MySQL' : /mariadb/i.test(driver) ? 'MariaDB' : /postgres/i.test(driver) ? 'PostgreSQL'
      : /sql server|sql native|odbc driver \d+ for sql/i.test(driver) ? 'SQL Server' : /oracle/i.test(driver) ? 'Oracle'
        : /access|\*\.mdb/i.test(driver) ? 'Access' : /sqlite/i.test(driver) ? 'SQLite' : /db2/i.test(driver) ? 'Db2' : 'ODBC'
    const dbq = field('DBQ')
    const name = field('Database') ?? (dbq ? dbq.split(/[\\/]/).pop() : undefined)
    return { engine, ...(field('Server|Host') ? { server: field('Server|Host') } : {}), ...(name ? { name } : {}), explicit: true }
  }
  // Go's MySQL driver: user:password@tcp(db:3306)/shop.
  const go = /@tcp\(([\w.-]+)(?::\d+)?\)\/([\w-]+)/.exec(text)
  if (go) return { engine: 'MySQL', server: go[1], name: go[2] }
  // PHP's PDO: mysql:host=db;dbname=shop.
  const pdo = /\b(mysql|pgsql|sqlsrv|oci|sqlite|odbc):(?:[^'"\s]*?host=([^;'"\s]+))?[^'"\s]*?(?:dbname|database)=([^;'"\s]+)/i.exec(text)
  if (pdo) {
    const engine = { mysql: 'MySQL', pgsql: 'PostgreSQL', sqlsrv: 'SQL Server', oci: 'Oracle', sqlite: 'SQLite', odbc: 'ODBC' }[pdo[1].toLowerCase()]!
    return { engine, ...(pdo[2] ? { server: pdo[2] } : {}), name: pdo[3] }
  }
  const provider = field('Provider')
  // An OLE DB provider, not any "provider=" setting.
  if (provider && (/SQLOLEDB|SQLNCLI|MSOLEDBSQL|OLEDB|MSDA|OraOLEDB|IBMDA|DB2OLEDB/i.test(provider) || /Data Source\s*=/i.test(text))) {
    const engine = /SQLOLEDB|SQLNCLI|MSOLEDBSQL/i.test(provider) ? 'SQL Server' : /Jet\.OLEDB|ACE\.OLEDB/i.test(provider) ? 'Access' : /OraOLEDB|MSDAORA/i.test(provider) ? 'Oracle' : /MSDASQL/i.test(provider) ? 'ODBC' : provider
    const source = field('Data Source')
    // Jet and ACE open a file, whatever its name ends in (pharmacy.dll).
    const file = source && (/\.(mdb|accdb)$/i.test(source) || /Jet\.OLEDB|ACE\.OLEDB/i.test(provider)) ? source.split(/[\\/]/).pop() : undefined
    return { engine, ...(source && !file ? { server: source } : {}), ...((field('Initial Catalog') ?? file) ? { name: field('Initial Catalog') ?? file } : {}), explicit: true }
  }
  const dsn = field('DSN')
  if (dsn) return { engine: 'ODBC', name: dsn }
  // Oracle: a TNS descriptor (HOST=, SERVICE_NAME= or SID=), JDBC's thin or OCI URL (@//host:port/service, @host:port:SID),
  // or an Easy Connect string (host:port/service).
  const descriptor = /\(\s*DESCRIPTION\s*=\s*\(/i.test(text) ? { host: /\(\s*HOST\s*=\s*([^)\s]+)\s*\)/i.exec(text)?.[1], name: /\(\s*(?:SERVICE_NAME|SID)\s*=\s*([^)\s]+)\s*\)/i.exec(text)?.[1] } : undefined
  if (descriptor) return { engine: 'Oracle', ...(descriptor.host ? { server: descriptor.host } : {}), ...(descriptor.name ? { name: descriptor.name } : {}), explicit: true }
  const thin = /jdbc:oracle:(?:thin|oci8?|kprb):(?:[^@\s"']*)?@(?:\/\/)?([\w.-]+)(?::\d+)?(?:[/:]([\w.$-]+))?/i.exec(text)
  if (thin) return { engine: 'Oracle', server: thin[1], ...(thin[2] ? { name: thin[2] } : {}), explicit: true }
  const easy = /^\s*(?:\/\/)?([A-Za-z][\w.-]*):\d{2,5}\/([\w.$-]+)\s*$/.exec(text)
  if (easy) return { engine: 'Oracle', server: easy[1], name: easy[2] }
  const jdbc = /jdbc:([a-z]+)(?::[a-z]+)*:(?:\/\/|@)?([^/:;?\s"']+)?(?::\d+)?(?:[/:;](?:databaseName=)?([\w-]+))?/i.exec(text)
  if (jdbc) {
    const engine = { postgresql: 'PostgreSQL', mysql: 'MySQL', mariadb: 'MariaDB', sqlserver: 'SQL Server', oracle: 'Oracle', h2: 'H2', hsqldb: 'HSQLDB', db2: 'Db2' }[jdbc[1].toLowerCase()] ?? jdbc[1]
    return { engine, ...(jdbc[2] && jdbc[2] !== 'mem' ? { server: jdbc[2] } : {}), ...(jdbc[3] ? { name: jdbc[3] } : {}) }
  }
  // An SQLite URL names its file (sqlite:///%kernel.project_dir%/data/database.sqlite).
  const sqlite = /\bsqlite:\/\/\/?([^\s"'<?]+)/i.exec(text)
  if (sqlite) {
    const file = sqlite[1].split(/[\\/]/).pop() ?? ''
    return /^[\w.-]+$/.test(file) && !/memory/i.test(file) ? { engine: 'SQLite', name: file } : null
  }
  // ClickHouse: its URL, or its HTTP interface on port 8123 (http://events_db:8123/events).
  const clickhouse = /\bclickhouse:\/\/(?:[^@\s/]+@)?([\w.-]+)(?::\d+)?(?:\/([\w-]+))?|\bhttps?:\/\/([\w.-]+):8123\/([\w-]+)/i.exec(text)
  if (clickhouse) return { engine: 'ClickHouse', server: clickhouse[1] ?? clickhouse[3], ...((clickhouse[2] ?? clickhouse[4]) ? { name: clickhouse[2] ?? clickhouse[4] } : {}) }
  // A user and password taken from the environment (postgres:${POSTGRES_PASSWORD}@db) leave the server and name read; a
  // host filled in at run time (#{socket_dir}) is none.
  const url = /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|sqlserver|mssql):\/\/(?:(?:[$#]\{[^{}]*\}|[^@\s/])+@)?([\w.-]+)(?::\d+)?(?=[/?\s"'<]|$)(?:\/([\w-]+))?/i.exec(text)
  if (url) {
    const engine = { postgres: 'PostgreSQL', postgresql: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB', 'mongodb+srv': 'MongoDB', redis: 'Redis', sqlserver: 'SQL Server', mssql: 'SQL Server' }[url[1].toLowerCase()]!
    return { engine, server: url[2], ...(url[3] ? { name: url[3] } : {}) }
  }
  const server = field('Server|Data Source|Host')
  const database = field('Database|Initial Catalog')
  if (server && database) return { engine: /\bHost\s*=/i.test(text) ? 'PostgreSQL' : 'SQL Server', server, name: database }
  return null
}

/** Tables SQL names: after FROM, JOIN, INTO, UPDATE (and TABLE). */
const NOT_TABLES = new Set(['select', 'where', 'set', 'values', 'dual', 'as', 'on', 'and', 'or', 'the', 'a', 'an', 'to', 'of', 'in', 'is'])
export function tablesOf(sql: string): string[] {
  // A statement, not a caption: SELECT … FROM, INSERT INTO, UPDATE … SET, DELETE FROM, MERGE INTO, WITH … AS.
  if (!/^\s*\(?\s*(select\b[\s\S]*\bfrom\b|insert\s+into\b|update\s+\S+\s+set\b|delete\s+from\b|merge\s+into\b|with\s+\w+\s+as\b)/i.test(sql)) return []
  const out = new Set<string>()
  // (A SELECT's INTO names a variable: SELECT planet INTO target FROM …)
  const select = /^\s*\(?\s*select\b/i.test(sql)
  for (const m of sql.matchAll(/\b(from|join|into|update|table)\s+[[`"]?([A-Za-z_][\w$]*)[\]`"]?(?:\s*\.\s*[[`"]?([A-Za-z_][\w$]*)[\]`"]?)?/gi)) {
    if (select && m[1].toLowerCase() === 'into') continue
    const name = m[3] ? `${m[2]}.${m[3]}` : m[2]
    if (!NOT_TABLES.has(name.toLowerCase())) out.add(name)
  }
  return [...out]
}

/** A host name given as a default to a setting named for an address. */
const HOSTISH = '\\w*(?:HOST|ADDR|ADDRESS|URL|URI|ENDPOINT|SERVER|SERVICE)\\w*'
const DEFAULT_HOST = new RegExp([
  `\\b${HOSTISH}\\s*(?:\\|\\||\\?\\?)\\s*["']([a-z][a-z0-9-]{1,40})["']`,
  `(?:getenv|environ\\.get|Getenv|getProperty|GetValue<string>)\\(\\s*["']${HOSTISH}["']\\s*,\\s*["']([a-z][a-z0-9-]{1,40})["']`,
  `\\$\\{[\\w.-]*(?:host|addr|url|uri|endpoint|server|service)[\\w.-]*:(?:https?:\\/\\/)?([a-z][a-z0-9-]{1,40})(?=[:/}])`,
  `getenv\\(\\s*"${HOSTISH}"\\s*\\)\\s*==\\s*null\\s*\\?\\s*"([a-z][a-z0-9-]{1,40})"`,
  `\\b\\w*(?:Host|Hostname|HostName|Endpoint)\\(\\s*["']([a-z][a-z0-9-]{1,40})["']\\s*\\)`,
].join('|'), 'gi')
/** A variable named for another service's address: ${CATALOGUE_HOST}, $CART_URL, %ORDERS_ENDPOINT%. */
const NAMED_HOST = /[$%]\{?([A-Z][A-Z0-9_]*?)_(?:HOST|ADDR|ADDRESS|URL|URI|ENDPOINT|SERVICE_HOST)\b\}?%?/g

/** gRPC: a unit serving `service`, and one making a client of it, in any of the usual languages. */
const serves = (s: string): RegExp => new RegExp(`Register${s}Server\\(|add_${s}Servicer_to_server|extends\\s+(?:[\\w.]+\\.)?${s}Grpc\\.${s}ImplBase|:\\s*(?:[\\w.]+\\.)?${s}\\.${s}Base\\b|\\.${s}\\.service\\b|${s}\\.service\\s*,`)
const calls = (s: string): RegExp => new RegExp(`New${s}Client\\(|${s}Stub\\(|${s}Grpc\\.new(?:Blocking|Future)?Stub\\(|new\\s+${s}\\.${s}Client\\(|new\\s+\\w+\\.${s}\\(|\\b${s}Client\\(`)

export interface CodeFacts {
  urls: UrlFact[]
  addresses: AddressFact[]
  apis: ApiFact[]
  clients: ClientFact[]
  databases: DatabaseFact[]
  tables: TableFact[]
  /** What was read as no fact, and why. */
  notes: string[]
}

export function readCode(files: RepoFiles, repo: string, units: Unit[]): CodeFacts {
  const out: CodeFacts = { urls: [], addresses: [], apis: [], clients: [], databases: [], tables: [], notes: [] }
  const seen = new Set<string>()
  const once = (id: string): boolean => (seen.has(id) ? false : (seen.add(id), true))

  // Access databases: the .mdb and .accdb files the repository holds, and what each unit's code names of them.
  const accessFiles = new Set(files.list.filter((f) => /\.(mdb|accdb)$/i.test(f)).map((f) => f.slice(f.lastIndexOf('/') + 1).toLowerCase()))
  const accessNamed = new Map<string, Array<{ name: string; evidence: { file: string; line: number } }>>()
  const accessUsers = new Set<string>()

  // What each unit's VB code sets its constants, variables and settings to, read once a unit.
  const valuesByUnit = new Map<string, VbValues>()
  const valuesOf = (unit: Unit): VbValues => {
    const known = valuesByUnit.get(unit.id)
    if (known) return known
    const mine = files.list.filter((f) => owner(units, f)?.id === unit.id)
    const values = vbValues(files, mine.filter((f) => VB_CODE.test(f)).map((f) => joinContinuations(withoutVbComments(files.read(f)))), mine.filter((f) => /\.ini$/i.test(f)))
    valuesByUnit.set(unit.id, values)
    return values
  }

  // The services every .proto of the repository declares.
  const protoServices = [...new Set(files.named(/\.proto$/).flatMap((f) => [...files.read(f).matchAll(/^\s*service\s+(\w+)\s*\{/gm)].map((m) => m[1])))]

  // A config server's files are read as the configuration of the applications they configure.
  const configures = springConfigOwners(files, units)
  const readings = files.list.flatMap((file): Array<[string, Unit | undefined]> => configures.get(file)?.map((u) => [file, u] as [string, Unit]) ?? [[file, owner(units, file)]])
  for (const [file, unit] of readings) {
    const ext = extname(file).toLowerCase()
    const config = CONFIG.test(file)
    // An Oracle package's addresses: the services its PL/SQL calls through UTL_HTTP ('https://hooks.slack.com/…').
    if (/\.(pks|pkb|pck|pls|plb|spc|bdy)$/i.test(file) && unit && !TEST_FILE.test(file)) {
      const sql = files.read(file)
      for (const m of sql.matchAll(/'(https?:\/\/[^'\s]+)'/g)) {
        // (A page's link, htp.anchor or href, is the user's to open; a namespace, xmlns, names no service.)
        if (/\bhtp\.(anchor|a)\b|\bhtf\.anchor\b/i.test(lineTextAt(sql, m.index!)) || NOT_CALLED.test(lineTextAt(sql, m.index!))) continue
        for (const a of addressesIn(m[1], false).filter((x) => !NOT_SERVICE_HOST.test(x.host))) {
          const id = `${repo}:address:${unit.path}:${a.text}`
          if (!out.addresses.some((x) => x.id === id)) out.addresses.push({ id, unit: unit.id, ...(a.scheme ? { scheme: a.scheme } : {}), host: a.host, ...(a.port ? { port: a.port } : {}), text: a.text, evidence: { file, line: lineAt(sql, m.index!) } })
        }
      }
      continue
    }
    if (!SOURCE.has(ext) && !config) continue
    // A test's settings (src/test/resources: an in-memory database, a stub's address) are the test's, not the system's.
    if (!unit || GENERATED.test(file) || (TEST_FILE.test(file) && !config) || (config && /(^|\/)(src\/test|testdata|fixtures?|__fixtures__)\//.test(file))) continue
    let text = configures.has(file) ? settingsFor(files, file, unit) : files.read(file)
    if (!text) continue
    // VB6 continues a string over lines: "a" & _ ⏎ "b" is "ab".
    const vb = VB_CODE.test(file)
    // A variable spliced into a string ("Server=" & DBservidor & ";…") is the value the unit sets it to.
    if (vb) text = inlineValues(joinContinuations(withoutVbComments(text)), valuesOf(unit))
    // A commented line of a configuration file sets nothing (lines hold: it is emptied, not removed).
    if (config && /\.(ya?ml|properties|env|toml|conf|ini)$|(^|\/)\.env(\.[\w-]+)?$/i.test(file)) text = text.replace(/^[ \t]*#.*$/gm, '').replace(/\.ini$/i.test(file) ? /^[ \t]*;.*$/gm : /$^/, '')
    // ${key:default} (${KEY:-default}) is its default where nothing sets it, for every reader below (on its line: lines
    // hold); ${KEY:?message} has none. The setting's name tells what the default is (a host's), so it is read before.
    const unresolved = text
    text = text.replace(/\$\{([\w.-]+):([^${}\n]*)\}/g, (_, key: string, value: string) => (value.startsWith('?') ? `\${${key}}` : value.replace(/^-/, '')))
    // A compose file's or a deployment manifest's connection strings are the services' it runs (runtime.ts).
    const deployment = config && (/(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(file) || /^\s*kind\s*:\s*(Deployment|StatefulSet|DaemonSet|Service|Job|CronJob|ConfigMap)\b/m.test(text))
    // Rails' config/database.yml: ENV.fetch("POSTGRES_DB") { "maybe_production" } is its default, each environment's
    // settings a connection (the production one first, else development's).
    if (/(^|\/)config\/database\.ya?ml$/.test(file)) text = railsDatabases(text)
    const at = (index: number) => ({ file, line: lineAt(text, index) })

    // Connection strings, in code and configuration alike.
    // Oracle's Easy Connect and TNS strings a client is given (connectString, dsn, makedsn, Data Source=(DESCRIPTION=…)).
    for (const m of deployment || CI.test(file) ? [] : text.matchAll(/\b(?:connectString|connect_string|dsn)\s*[=:]\s*["'](\/\/)?([A-Za-z][\w.-]*:\d{2,5}\/[\w.$-]+)["']|\bmakedsn\(\s*["']([\w.-]+)["']\s*,\s*\d+\s*,\s*(?:service_name|sid)\s*=\s*["']([\w.$-]+)["']|\(\s*DESCRIPTION\s*=(?=\s*\()(?:[^"'\n]|\n(?=\s*\())*/gi)) {
      const db = m[2] ? connectionOf(m[2]) : m[3] ? { engine: 'Oracle', server: m[3], name: m[4] } : connectionOf(m[0])
      if (!db) continue
      const id = `${repo}:db:${unit.path}:Oracle/${db.name ?? db.server ?? ''}`
      if (once(id)) out.databases.push({ id, unit: unit.id, engine: 'Oracle', ...(db.server ? { server: db.server } : {}), ...(db.name ? { name: db.name } : {}), evidence: at(m.index!) })
    }
    for (const m of deployment || CI.test(file) ? [] : text.matchAll(/\bclickhouse:\/\/[^\s"'<]+|\bhttps?:\/\/[\w.-]+:8123\/[\w-]+|\bsqlite:\/\/\/?[^\s"'<]+|[\w-]*(?::[^@\s"']*)?@tcp\([\w.:-]+\)\/[\w-]+|\b(?:mysql|pgsql|sqlsrv|oci|sqlite):[^"'\s]*?dbname=[^"'\s]+|\bDRIVER\s*=\s*\{[^}\n]*\}[^"'\n]*|(?:Provider|DSN|Data Source|Server|Host)\s*=[^"'\n]*(?:;[^"'\n]*)+|jdbc:[^\s"'<]+|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|sqlserver|mssql):\/\/[^\s"'<]+/gi)) {
      const db = connectionOf(m[0])
      if (!db) continue
      // A name filled in at run time ($dsn, {db}, %DB%) names nothing.
      if (db.name && /[$%{}]/.test(db.name)) delete db.name
      // A placeholder for the name (YOUR DATABASE NAME, db_name) names none either.
      if (db.name && db.engine !== 'Access' && (/^(your|enter|my)[\s_-]/i.test(db.name) || /^(database|db)[\s_-]?name$|\s(database|db)\s+name$/i.test(db.name))) delete db.name
      if (db.server && /[$%{}]/.test(db.server)) delete db.server
      // Neither a server nor a name: a variable assigned, not a connection string, unless a driver or provider names the engine.
      if (!db.server && !db.name && !db.explicit) continue
      // One database per name: a developer's and a container's connection string name the same one.
      if (db.server) db.server = db.server.replace(/[,:]\d+$/, '')
      // An Access file is one whatever the case of its name (hms.mdb, HMS.MDB).
      const id = `${repo}:db:${unit.path}:${db.engine}/${db.engine === 'Access' ? (db.name ?? '').toLowerCase() : db.name ?? db.server ?? ''}`
      // The same database named again: a server's connection string over a developer's local one.
      const known = out.databases.findIndex((d) => d.id === id)
      if (known >= 0 && /^(localhost|127\.0\.0\.1)$/i.test(out.databases[known].server ?? '') && db.server && !/^(localhost|127\.0\.0\.1)$/i.test(db.server)) out.databases.splice(known, 1)
      if (out.databases.some((d) => d.id === id)) continue
      seen.add(id)
      out.databases.push({ id, unit: unit.id, engine: db.engine, ...(db.server ? { server: db.server } : {}), ...(db.name ? { name: db.name } : {}), evidence: at(m.index!) })
    }

    // A .NET project on SQLite (Microsoft.EntityFrameworkCore.Sqlite, Microsoft.Data.Sqlite): its settings' (appsettings,
    // App.config) or its code's "Data Source=discountdb" (UseSqlite("Data Source=pets.db")) alone names the database file.
    if (((config && /(^|\/)(appsettings(\.[\w-]+)?\.json|app\.config|web\.config)$/i.test(file)) || /\.cs$/i.test(file)) && /\bSqlite\b/i.test(files.read(unit.evidence.file))) {
      for (const m of text.matchAll(/"Data Source\s*=\s*([\w.-]+)"/gi)) {
        const id = `${repo}:db:${unit.path}:SQLite/${m[1]}`
        if (once(id)) out.databases.push({ id, unit: unit.id, engine: 'SQLite', name: m[1], evidence: at(m.index!) })
      }
    }

    // A Prometheus configuration's scrape targets: the services it reads metrics from (targets: ['api-gateway:8080']).
    if (config && /^scrape_configs\s*:/m.test(text)) {
      for (const list of text.matchAll(/\btargets\s*:\s*\[([^\]]*)\]/g)) {
        for (const t of list[1].matchAll(/["']([a-z][\w.-]*):(\d{2,5})["']/gi)) {
          const id = `${repo}:address:${unit.path}:scrape:${t[1]}:${t[2]}`
          if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'scrape', host: t[1].toLowerCase(), port: Number(t[2]), text: t[0], evidence: at(list.index!) })
        }
      }
    }

    // An Android app's SQLite database, by the name Room gives its file.
    for (const m of ext === '.kt' || ext === '.java' ? text.matchAll(/\bRoom\.databaseBuilder\s*\([^,()]+,\s*[\w.:]+\s*,\s*"([\w.-]+)"/g) : []) {
      const id = `${repo}:db:${unit.path}:SQLite/${m[1]}`
      if (once(id)) out.databases.push({ id, unit: unit.id, engine: 'SQLite', name: m[1], evidence: at(m.index!) })
    }

    // A VB6 data control reads a table, or the table its SQL names: RecordSource = "Users", in its properties or its code.
    if (vb) {
      for (const m of text.matchAll(/^\s*(?:\w+\.)?RecordSource\s*=\s*"((?:[^"]|"")+)"/gm)) {
        const source = m[1].replace(/""/g, '"')
        for (const table of /^[A-Za-z_][\w$]*$/.test(source) ? [source] : tablesOf(source)) {
          const id = `${repo}:table:${unit.path}:${table.toLowerCase()}`
          if (once(id)) out.tables.push({ id, unit: unit.id, table, evidence: at(m.index!) })
        }
      }
      // A table opened by its name: db.OpenRecordset("Items"), rs.Open "Items", cn, , , adCmdTable.
      for (const m of text.matchAll(/\bOpenRecordset\s*\(\s*"([A-Za-z_][\w$]*)"|\.Open\s+"([A-Za-z_][\w$]*)"\s*,[^\n]*\badCmdTable(?:Direct)?\b/g)) {
        const table = m[1] ?? m[2]
        const id = `${repo}:table:${unit.path}:${table.toLowerCase()}`
        if (once(id)) out.tables.push({ id, unit: unit.id, table, evidence: at(m.index!) })
      }
      // Access through DAO, Jet or ACE, or a data control: the unit uses the Access files its code names.
      if (/\bOpenDatabase\s*\(|\bDBEngine\b|Jet\.OLEDB|ACE\.OLEDB|Microsoft Access Driver|^\s*(?:\w+\.)?DatabaseName\s*=/im.test(text)) accessUsers.add(unit.id)
      for (const m of text.matchAll(/"([^"\n]*?([^"\\/\n]+\.(?:mdb|accdb)))"/gi)) {
        if (!accessFiles.has(m[2].toLowerCase())) continue
        accessNamed.set(unit.id, [...(accessNamed.get(unit.id) ?? []), { name: m[2], evidence: at(m.index!) }])
      }
      // A form's fields holding a host and a port by default: an address of the unit, or, beside a listening socket, its port.
      if (/\.(frm|dob|pag|ctl)$/i.test(file)) formAddress(text, file, unit, repo, out, once)
      // A socket connecting to a port the code names, or one a constant, variable or setting holds: Winsock1.Connect
      // ServerName, 6123; .RemoteHost = GAME_IP and .RemotePort = GAME_PORT before a bare .Connect.
      const values = valuesOf(unit)
      const hostOf = (expr: string): string => (values.resolve(expr) ?? /^"([^"]+)"$/.exec(expr.trim())?.[1] ?? expr.trim()).toLowerCase()
      const remoteHost = /\.RemoteHost\s*=\s*([^\n]+)/i.exec(text)?.[1]
      const connects = [
        ...[...text.matchAll(/\.Connect\s*\(?\s*("[^"]+"|[\w.]+\$?)\s*,\s*([\w.]+\$?)/gi)].map((m) => ({ host: m[1], port: m[2], index: m.index! })),
        ...[...text.matchAll(/\.RemotePort\s*=\s*([^\n]+)/gi)].map((m) => ({ host: remoteHost ?? 'localhost', port: m[1], index: m.index! })),
      ]
      for (const c of connects) {
        const port = /^\d+$/.test(c.port.trim()) ? c.port.trim() : values.resolve(c.port)
        if (!port || !/^\d{2,5}$/.test(port)) continue
        const host = hostOf(c.host)
        const id = `${repo}:address:${unit.path}:connect:${host}:${port}`
        if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'socket', host, port: Number(port), text: lineTextAt(text, c.index).trim(), evidence: at(c.index) })
      }
      // A socket listening on a port a constant, variable or setting holds: .LocalPort = GAME_PORT and .Listen.
      if (/\.Listen\b/i.test(text)) {
        for (const m of text.matchAll(/\.LocalPort\s*=\s*([^\n]+)/gi)) {
          const port = values.resolve(m[1])
          if (port && /^\d{2,5}$/.test(port)) unit.ports = [...new Set([...(unit.ports ?? []), Number(port)])].sort((a, b) => a - b)
        }
      }
    }

    // A host given as a default: process.env.CART_HOST || 'cart', os.getenv('CART_HOST', 'cart'), ${cart.host:cart}.
    for (const m of unresolved.matchAll(DEFAULT_HOST)) {
      const host = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]).toLowerCase()
      const id = `${repo}:address:${unit.path}:default:${host}`
      if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'default', host, text: m[0], evidence: { file, line: lineAt(unresolved, m.index!) } })
    }

    for (const m of text.matchAll(NAMED_HOST)) {
      const host = m[1].toLowerCase().replace(/_/g, '-')
      if (host === 'db' || host === 'database') continue
      const id = `${repo}:address:${unit.path}:variable:${host}`
      if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'variable', host, text: m[0], evidence: at(m.index!) })
    }

    // Deployment manifests are the services' (runtime.ts), not the folder's they lie in.
    if (config && /^\s*kind\s*:\s*(Deployment|StatefulSet|DaemonSet|Service|Job|CronJob|ConfigMap)\b/m.test(text)) continue
    if (config && /(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(file)) continue

    // CI configuration and translations name addresses no unit calls.
    if (NO_CALLS.test(file)) continue

    if (config) {
      // A gateway's route to a service by its id (zuul's serviceId: orders).
      for (const m of text.matchAll(/^\s*serviceId\s*[=:]\s*["']?([a-z][a-z0-9-]{1,40})["']?\s*$/gim)) {
        const id = `${repo}:address:${unit.path}:route:${m[1].toLowerCase()}`
        if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'route', host: m[1].toLowerCase(), text: m[0].trim(), evidence: at(m.index!) })
      }
      // A setting named for a host: spring.rabbitmq.host=rabbitmq, redis: { host: cache }.
      for (const m of text.matchAll(/^\s*["']?[\w.-]*(?:host|hostname|address|server|endpoint)["']?\s*[=:]\s*["']?([a-z][a-z0-9-]{1,40}(?:\.[a-z0-9-]+)*)["']?\s*,?\s*$/gim)) {
        const host = m[1].toLowerCase()
        if (['localhost', 'true', 'false', 'null', 'none'].includes(host)) continue
        const id = `${repo}:address:${unit.path}:setting:${host}`
        if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'setting', host, text: m[0].trim(), evidence: at(m.index!) })
      }
      for (const a of addressesIn(text, false)) {
        if (NOT_CALLED.test(lineTextAt(text, a.index))) continue
        const id = `${repo}:address:${unit.path}:${a.text}`
        if (once(id)) out.addresses.push({ id, unit: unit.id, ...(a.scheme ? { scheme: a.scheme } : {}), host: a.host, ...(a.port ? { port: a.port } : {}), text: a.text, evidence: at(a.index) })
      }
      continue
    }

    for (const m of text.matchAll(vb ? VB_STRING : STRING)) {
      // A template's value with a default is its default where nothing sets it: `localhost:${process.env.PORT || 3002}`.
      const literal = vb ? m[2] : m[2].replace(/\$\{[^{}]*?(?:\|\||\?\?)\s*['"]?([\w.-]+)['"]?\s*\}/g, '$1')
      // An address opened in the browser is a page for the user, not a call of the unit.
      const lineText = lineTextAt(text, m.index!)
      const opened = BROWSER.test(lineText) || NOT_CALLED.test(lineText)
      // In VB code a lone segment (/_BUG, /json) is a command or a fragment far more often than a route.
      const found = opened ? null : urlPathOf(literal)
      const path = vb && found && found.split('/').length === 2 ? null : found
      if (path) {
        const id = `${repo}:url:${unit.path}:${path}`
        if (once(id)) out.urls.push({ id, unit: unit.id, path, evidence: at(m.index!) })
      }
      for (const a of opened ? [] : addressesIn(literal, false)) {
        const id = `${repo}:address:${unit.path}:${a.text}`
        if (once(id)) out.addresses.push({ id, unit: unit.id, ...(a.scheme ? { scheme: a.scheme } : {}), host: a.host, ...(a.port ? { port: a.port } : {}), text: a.text, evidence: at(m.index!) })
      }
      // JPQL (a Spring Data @Query, createQuery) names entities, not tables; a migration's SQL names the tables of its
      // time, which the replayed migrations or the schema already hold.
      const jpql = /\.(java|kt)$/.test(file) && /@Query\s*\(|\bcreateQuery\s*\(/.test(lineText) && !/nativeQuery\s*=\s*true/.test(lineText)
      for (const table of jpql || MIGRATION.test(file) ? [] : tablesOf(literal)) {
        const id = `${repo}:table:${unit.path}:${table.toLowerCase()}`
        if (once(id)) out.tables.push({ id, unit: unit.id, table, evidence: at(m.index!) })
      }
    }

    // A service looked up by name: Spring's discovery client, a Feign client.
    for (const m of text.matchAll(/\bgetInstances\(\s*"([\w.-]+)"|@FeignClient\(\s*(?:(?:name|value)\s*=\s*)?"([\w.-]+)"/g)) {
      const host = (m[1] ?? m[2]).toLowerCase()
      const id = `${repo}:address:${unit.path}:discovery:${host}`
      if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'discovery', host, text: m[0], evidence: at(m.index!) })
    }

    for (const s of protoServices) {
      const server = serves(s).exec(text)
      if (server) {
        const id = `${repo}:api:${unit.path}:grpc ${s}`
        if (once(id)) out.apis.push({ id, unit: unit.id, protocol: 'grpc', method: 'service', path: s, evidence: at(server.index) })
      }
      const client = calls(s).exec(text)
      if (client) {
        const id = `${repo}:client:${unit.path}:${s}`
        if (once(id)) out.clients.push({ id, unit: unit.id, service: s, evidence: at(client.index) })
      }
    }
  }
  // A database a driver names without its name, beside one of that engine the unit names, is that one.
  out.databases = out.databases.filter((d) => d.name || d.server || !out.databases.some((o) => o !== d && o.unit === d.unit && o.engine === d.engine && (o.name || o.server)))
  // A developer's local database beside the same one on a server is the same database.
  const local = (s?: string) => !!s && /^(localhost|127\.0\.0\.1|\.|\(local\)|\(localdb\).*)$/i.test(s)
  out.databases = out.databases.filter((d) => !local(d.server) || !out.databases.some((o) => o !== d && o.unit === d.unit && o.engine === d.engine && o.server && !local(o.server)))
  // One file naming three engines or more is a library's templates (one per engine it supports), not databases it uses.
  const engines = new Map<string, Set<string>>()
  for (const d of out.databases) engines.set(d.evidence.file, (engines.get(d.evidence.file) ?? new Set()).add(d.engine))
  for (const [file, set] of engines) {
    if (set.size < 3) continue
    out.databases = out.databases.filter((d) => d.evidence.file !== file)
    out.notes.push(`${file} holds connection strings of ${set.size} engines (${[...set].sort().join(', ')}): a library's templates, read as no database`)
  }
  // The Access files a unit's code names, where it uses Access: each a database it uses.
  for (const [unitId, named] of accessNamed) {
    if (!accessUsers.has(unitId)) continue
    const unit = units.find((u) => u.id === unitId)!
    // Where the code connects to it or opens it says more than where it copies or deletes it.
    const opens = (n: { evidence: { file: string; line: number } }): boolean => /ConnectionString|Data Source|DBQ|OpenDatabase|DatabaseName|\.Open\b|Provider/i.test(files.read(n.evidence.file).split('\n')[n.evidence.line - 1] ?? '')
    for (const n of [...named.filter(opens), ...named.filter((x) => !opens(x))]) {
      const id = `${repo}:db:${unit.path}:Access/${n.name.toLowerCase()}`
      if (out.databases.some((d) => d.unit === unitId && d.engine === 'Access' && d.name?.toLowerCase() === n.name.toLowerCase())) continue
      out.databases.push({ id, unit: unitId, engine: 'Access', name: n.name, evidence: n.evidence })
    }
  }
  // A gRPC client a library's function makes is a client of each unit that imports the library and calls that function.
  for (const c of [...out.clients]) {
    const library = units.find((u) => u.id === c.unit)
    if (!library || library.kind !== 'library' || library.named === false) continue
    const before = files.read(c.evidence.file).split('\n').slice(0, c.evidence.line).join('\n')
    const fn = [...before.matchAll(/^\s*(?:func\s+(?:\([^)]*\)\s*)?|(?:export\s+)?(?:async\s+)?function\s+|def\s+)([A-Za-z_]\w*)\s*\(/gm)].pop()?.[1]
    if (!fn) continue
    for (const file of files.list) {
      const unit = owner(units, file)
      if (!unit || unit.id === library.id || !SOURCE.has(extname(file).toLowerCase()) || TEST_FILE.test(file) || GENERATED.test(file)) continue
      const text = files.read(file)
      const call = text.includes(library.name) ? new RegExp(`\\b${escapeRe(fn)}\\s*\\(`).exec(text) : null
      const id = `${repo}:client:${unit.path}:${c.service}`
      if (call && once(id)) out.clients.push({ id, unit: unit.id, service: c.service, evidence: { file, line: lineAt(text, call.index) } })
    }
  }
  // A nameless SQL Server, ODBC or MySQL connection, where the repository's SQL scripts name one database (USE, CREATE
  // DATABASE, a dump's -- Database: header), is that one.
  const scripted = new Set(files.list.filter((f) => /\.sql$/i.test(f)).flatMap((f) => [...files.read(f).matchAll(/^\s*(?:use|create\s+database(?:\s+if\s+not\s+exists)?)\s+[[`"]?(\w+)[\]`"]?|^--\s*Database:\s*[`'"]?(\w+)/gim)].map((m) => m[1] ?? m[2]).filter((n) => !/^(master|tempdb|model|msdb|mysql|information_schema)$/i.test(n))))
  const scriptedNames = [...new Map([...scripted].map((n) => [n.toLowerCase(), n])).values()]
  if (scriptedNames.length === 1) {
    for (const d of out.databases) {
      if (d.name || !['SQL Server', 'ODBC', 'MySQL', 'MariaDB'].includes(d.engine)) continue
      d.name = scriptedNames[0]
      d.id = `${d.id.slice(0, d.id.lastIndexOf(':') + 1)}${d.engine}/${d.name}`
    }
    out.databases = out.databases.filter((d, i) => out.databases.findIndex((o) => o.id === d.id) === i)
  }
  // A nameless connection beside a database of its engine the unit names is that one.
  out.databases = out.databases.filter((d) => d.name || d.server || !out.databases.some((o) => o !== d && o.unit === d.unit && o.engine === d.engine && (o.name || o.server)))
  // A connection of Access or ODBC with neither name nor server, beside none of its engine named, names no database.
  out.databases = out.databases.filter((d) => {
    if (d.name || d.server || !['Access', 'ODBC'].includes(d.engine) || out.databases.some((o) => o !== d && o.unit === d.unit && o.engine === d.engine && o.name)) return true
    out.notes.push(`${d.evidence.file}:${d.evidence.line} connects to ${d.engine} with its database filled in at run time: no database read`)
    return false
  })
  return out
}

export { escapeRe }

/** A form's text fields holding a host and a port by default (txtHost = "127.0.0.1", txtPort = "502"): an address of the
 *  unit; a port field of a form whose code listens (Listen, Bind, LocalPort): a port the unit listens on. */
function formAddress(text: string, file: string, unit: Unit, repo: string, out: CodeFacts, once: (id: string) => boolean): void {
  const fields = [...text.matchAll(/^\s*Begin\s+VB\.TextBox\s+(\w+)\s*$([\s\S]*?)^\s*End\s*$/gm)].map((m) => ({
    name: m[1], value: /^\s*Text\s*=\s*"([^"]*)"/m.exec(m[2])?.[1]?.trim() ?? '', index: m.index!,
  }))
  const host = fields.find((f) => /(host|ip|server)/i.test(f.name) && /^(localhost|\d{1,3}(\.\d{1,3}){3}|[a-z][\w-]*(\.[\w-]+)+)$/i.test(f.value))
  const port = fields.find((f) => /port/i.test(f.name) && !/(serial|com)/i.test(f.name) && /^\d{1,5}$/.test(f.value) && Number(f.value) > 0 && Number(f.value) < 65536)
  if (!port) return
  const portNo = Number(port.value)
  const line = (i: number) => text.slice(0, i).split('\n').length
  // A server starts on it: Listen, Bind, LocalPort; or, with no host field beside it, a Start the port field's value reaches.
  const portRead = new RegExp(`\\b${port.name}\\.Text\\b|Val\\(\\s*${port.name}\\b`, 'i').test(text)
  if (/\.Listen\b|\.Bind\b|\bLocalPort\s*=|\bStartListen|\bStartServer/i.test(text) || (!host && portRead && /\.Start\b/i.test(text))) {
    unit.ports = [...new Set([...(unit.ports ?? []), portNo])].sort((a, b) => a - b)
    return
  }
  if (!host) return
  const id = `${repo}:address:${unit.path}:form:${host.value}:${portNo}`
  if (once(id)) out.addresses.push({ id, unit: unit.id, scheme: 'form', host: host.value, port: portNo, text: `${host.name}=${host.value} ${port.name}=${portNo}`, evidence: { file, line: line(host.index) + 1 } })
}
