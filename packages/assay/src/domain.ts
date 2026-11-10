// ─── Radical Assay: what a unit keeps ────────────────────────────────────────
//
// The tables a unit's SQL creates or alters and its ORM classes map (JPA,
// Entity Framework Core, Django, SQLAlchemy, TypeORM, Prisma), each with its
// columns and foreign keys, and the values its statuses take (an enum named
// for one, a CHECK … IN list, an SQL ENUM) with the lines of code that set
// each value (ADR Assay writes the domain, processes and lifecycles it
// reads). A table an ORM class maps is the table its SQL names: one fact,
// its id the table's name.

import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { DatabaseFact, DependencyFact, RoutineFact, StateFact, TableFact, Unit } from './facts'
import { DEV_TOOLING, GENERATED, RepoFiles, TEST_FILE, dirOf, escapeRe, lineAt, owner, resolveFrom, withoutComments } from './files'
import { withoutVbComments } from './code'
import { laravelMigrations } from './laravel'
import { ectoMigrations, railsSchema } from './rails-ecto'
import { dialectOf, readRoutines, withoutSqlCommentsOrStrings, type ReadRoutine } from './routines'
import { strings } from './syntax'

type Column = NonNullable<TableFact['columns']>[number]
type Reference = NonNullable<TableFact['references']>[number]

/** A table as a schema or an ORM class declares it, before its references to classes are resolved. */
interface Declared {
  unit: Unit
  table: string
  /** The class that maps it, which another class's reference names. */
  className?: string
  declared: string
  columns: Column[]
  /** A reference names a table, or (ORM) a class whose table is found once every class is read. */
  references: Array<Reference & { className?: string }>
  evidence: { file: string; line: number }
}

/** A status's or state's name: OrderStatus, order_state, PHASE. */
const STATUS_NAME = /(status|state|phase|stage|lifecycle)(es|s)?(_?(code|cd|type|enum))?$/i
const isStatus = (name: string): boolean => STATUS_NAME.test(name) && !/^(is|has)[A-Z_]/.test(name)

const unquote = (name: string): string => name.replace(/^[`"[]|[`"\]]$/g, '')
/** schema.table → table. */
const bare = (name: string): string => unquote(name.split('.').pop() ?? name)
/** The schema a database puts a table in when none is named. */
const DEFAULT_SCHEMA = /^(dbo|public)$/i
/** schema.table → schema, unless it is the default one. */
const schemaOf = (name: string): string | undefined => {
  const parts = name.split('.')
  return parts.length > 1 && !DEFAULT_SCHEMA.test(unquote(parts[parts.length - 2])) ? unquote(parts[parts.length - 2]) : undefined
}
/** OrderItem → order_item. */
const snake = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase()
const quoted = (text: string): string[] => [...text.matchAll(/'((?:[^']|'')*)'|"([^"]*)"/g)].map((m) => (m[1] ?? m[2]).replace(/''/g, "'"))

/** The text between the bracket at `open` and the one that closes it, quotes aside; null when it never closes. */
function enclosed(text: string, open: number, pair = '()'): { body: string; start: number } | null {
  let depth = 0
  let quote = ''
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === pair[0]) depth++
    else if (c === pair[1] && --depth === 0) return { body: text.slice(open + 1, i), start: open + 1 }
  }
  return null
}

/** The parts of a list at its top level, each with where it starts. */
function topLevel(body: string, separator = ','): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth--
    else if ((c === separator && depth === 0) || i === body.length) {
      const text = body.slice(start, i)
      const lead = text.length - text.trimStart().length
      if (text.trim()) out.push({ text: text.trim(), at: start + lead })
      start = i + 1
    }
  }
  return out
}

/** SQL without its comments (--, # in MySQL, /* … *\/), its lines kept. */
/** A database's scripts: SQL, and Oracle's files of PL/SQL (package specs and bodies, procedures, functions, triggers). */
const SQL_SCRIPT = /\.(sql|pks|pkb|pls|plb|pck|spc|bdy|prc|fnc|trg|tps|tpb|ddl)$/i
/** A script named for undoing an install: drop_x.sql, hr_drop.sql, x-drop-objects.sql, uninstall.sql. */
const TEARDOWN = /(^|\/)(drop|uninstall|cleanup|clean|teardown|remove)([_.-][^/]*)?$|[_-](drop|uninstall|cleanup|clean|teardown|remove)([_-][a-z]+)?\.\w+$/i
const withoutSqlComments = (sql: string): string => sql.replace(/--[^\n]*|(^|[ \t,(])#[^\n'"]*$/gm, (m) => ' '.repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const SQL_NAME = '[`"[]?(?:\\w+[`"\\]]?\\.)?[`"[]?([A-Za-z_][\\w$]*(?:-[\\w$]+)*)[`"\\]]?'
const NOT_COLUMNS = /^(constraint|primary|unique|key|index|fulltext|spatial|exclude|period|like)\b/i

export interface SchemaState { name: string; values: string[]; initial?: string; table?: string; column?: string; file: string; line: number }

/** The files in the order their scripts run: a Sqitch project's deploy/ scripts in its plan's order, each appearance of
 *  a reworked change by the script it ran then (x@v1.0.sql, kept at the tag that froze it; x.sql the last), the rest as
 *  listed. Reworked scripts no plan runs are left out. */
function sqitchOrder(files: RepoFiles, list: string[]): string[] {
  const out = [...list]
  const reworked = new Set<string>()
  for (const plan of files.named(/^sqitch\.plan$/)) {
    const deploy = `${dirOf(plan) === '.' ? '' : `${dirOf(plan)}/`}deploy/`
    const lines = files.read(plan).split('\n')
    const steps: string[] = []
    lines.forEach((l, i) => {
      const name = /^([A-Za-z_][\w-]*)\s/.exec(l)?.[1]
      if (!name) return
      // A change appearing again later ran, here, the script as the last tag before that appearance froze it.
      const next = lines.findIndex((x, j) => j > i && /^([A-Za-z_][\w-]*)\s/.exec(x)?.[1] === name)
      const tag = next < 0 ? undefined : lines.slice(i + 1, next).map((x) => /^@([\w.-]+)\s/.exec(x)?.[1]).filter((t): t is string => !!t).pop()
      const file = `${deploy}${name}${tag ? `@${tag}` : ''}.sql`
      if (list.includes(file)) { steps.push(file); if (tag) reworked.add(file) }
    })
    const slots = out.map((f, i) => (f.startsWith(deploy) && !f.slice(deploy.length).includes('/') ? i : -1)).filter((i) => i >= 0)
    const rest = slots.map((i) => out[i]).filter((f) => !steps.includes(f))
    const ordered = [...steps, ...rest]
    slots.forEach((slot, k) => { out[slot] = ordered[k] })
  }
  return out.filter((f) => !/@[^/]*\.sql$/i.test(f) || reworked.has(f))
}

/** A column an ALTER TABLE adds to a table or drops from it. */
type ColumnChange = { table: string; add?: { name: string; type?: string; line: number }; drop?: string }

/** A table with a column added or dropped, the added one in `file` when another script adds it. */
function applyColumn(t: Omit<Declared, 'unit'>, c: ColumnChange, file?: string): void {
  const columns = (t.columns ??= [])
  if (c.add && !columns.some((x) => x.name.toLowerCase() === c.add!.name.toLowerCase())) columns.push({ ...c.add, ...(file && file !== t.evidence.file ? { file } : {}) })
  if (c.drop) for (let i = columns.length - 1; i >= 0; i--) if (columns[i].name.toLowerCase() === c.drop.toLowerCase()) columns.splice(i, 1)
}

/** The tables an SQL file creates and alters, with their columns, foreign keys and the values a status column takes. */
export function readSchema(sql: string, file: string): { tables: Array<Omit<Declared, 'unit'>>; states: SchemaState[]; views: string[]; databases: Array<{ name: string; engine: string; line: number }>; changes: Array<{ drop: string } | { from: string; to: string }>; columnChanges: ColumnChange[] } {
  const text = withoutSqlComments(sql)
  const tables: Array<Omit<Declared, 'unit'>> = []
  const states: SchemaState[] = []
  // Views are no tables: code selecting from one names no table of the domain.
  const views = [...text.matchAll(new RegExp(`\\b(?:create|alter)\\s+(?:or\\s+(?:replace|alter)\\s+)?(?:materialized\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}`, 'gi'))].map((m) => m[1])
  // (A sequence too: code selecting its last_value names no table either.)
  views.push(...[...text.matchAll(new RegExp(`\\bcreate\\s+sequence\\s+(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}`, 'gi'))].map((m) => m[1]))
  // The database the script creates, in the engine its dialect shows: MySQL's schema is one, Oracle's database link none.
  const engine = dialectOf(text) ?? 'SQL'
  const databases = [...text.matchAll(new RegExp(`\\bcreate\\s+(?:database|schema)\\s+(?!link\\b)(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}`, 'gi'))]
    .filter((m) => /database/i.test(m[0]) || engine === 'MySQL')
    .map((m) => ({ name: m[1], engine, line: lineAt(text, m.index!) }))
  // PostgreSQL: CREATE TYPE order_status AS ENUM ('new', 'paid').
  const types = new Map<string, SchemaState>()
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+type\\s+${SQL_NAME}\\s+as\\s+enum\\s*\\(([^)]*)\\)`, 'gi'))) {
    const values = quoted(m[2])
    if (values.length < 2) continue
    types.set(m[1].toLowerCase(), { name: m[1], values, file, line: lineAt(text, m.index!) })
  }
  // (Oracle's and SQL Server's temporary tables too: CREATE GLOBAL TEMPORARY TABLE.)
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+(?:(?:global|private)\\s+temporary\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}\\s*\\(`, 'gi'))) {
    // A table in a schema other than the default one keeps it: two schemas may hold one name.
    const schema = /^create\s+(?:(?:global|private)\s+temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?[`"[]?(\w+)[`"\]]?\s*\./i.exec(m[0])?.[1]
    const table = schema && !DEFAULT_SCHEMA.test(schema) ? `${schema}.${m[1]}` : m[1]
    const open = m.index! + m[0].length - 1
    const body = enclosed(text, open)
    const declared: Omit<Declared, 'unit'> = { table, declared: 'SQL', columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } }
    tables.push(declared)
    if (!body) continue
    for (const item of topLevel(body.body)) {
      const line = lineAt(text, body.start + item.at)
      const fk = new RegExp(`^(?:constraint\\s+\\S+\\s+)?foreign\\s+key\\s*\\(([^)]*)\\)\\s*references\\s+${SQL_NAME}`, 'i').exec(item.text)
      if (fk) { declared.references.push({ column: unquote(fk[1].split(',')[0].trim()), table: fk[2], line }); continue }
      const check = /^(?:constraint\s+\S+\s+)?check\s*\(\s*[`"[]?(\w+)[`"\]]?\s+in\s*\(([^)]*)\)/i.exec(item.text)
      if (check) {
        if (isStatus(check[1]) && quoted(check[2]).length >= 2) states.push({ name: check[1], values: quoted(check[2]), table, column: check[1], file, line })
        continue
      }
      if (NOT_COLUMNS.test(item.text)) continue
      const column = /^([`"[]?[A-Za-z_][\w$]*[`"\]]?)\s+([A-Za-z_][\w.]*(?:\s*\([^)]*\))?(?:\s+varying(?:\s*\(\d+\))?)?)?/.exec(item.text)
      if (!column) continue
      const name = unquote(column[1])
      const type = column[2]?.replace(/\s+/g, ' ')
      declared.columns.push({ name, ...(type ? { type: /^enum\b/i.test(type) ? 'ENUM' : type } : {}), ...(/\bnot\s+null\b|\bprimary\s+key\b/i.test(item.text) ? { notNull: true } : {}), line })
      const ref = new RegExp(`\\breferences\\s+${SQL_NAME}`, 'i').exec(item.text)
      if (ref) declared.references.push({ column: name, table: ref[1], line })
      // A status column's values: an inline CHECK … IN, a MySQL ENUM, or a type created as an enum.
      const inline = /\bcheck\s*\(\s*[`"[]?\w+[`"\]]?\s+in\s*\(([^)]*)\)/i.exec(item.text)?.[1] ?? (/^enum\s*\(/i.test(type ?? '') ? /\(([^)]*)\)/.exec(item.text.slice(column[1].length))?.[1] : undefined)
      const initial = /\bdefault\s+'([^']*)'/i.exec(item.text)?.[1]
      if (inline && isStatus(name) && quoted(inline).length >= 2) states.push({ name, values: quoted(inline), ...(initial ? { initial } : {}), table, column: name, file, line })
      const enumType = type && types.get(bare(type).toLowerCase())
      if (enumType) { enumType.table = table; enumType.column = name }
    }
  }
  // A table of another's shape: Oracle's object table (CREATE TABLE x OF type), PostgreSQL's partition (PARTITION OF).
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}\\s+(?:partition\\s+)?of\\s+${SQL_NAME}`, 'gi'))) {
    if (!tables.some((t) => t.table.toLowerCase() === m[1].toLowerCase())) tables.push({ table: m[1], declared: 'SQL', columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } })
  }
  // ALTER TABLE x ADD CONSTRAINT c FOREIGN KEY (…) REFERENCES y, and Oracle's ADD ( CONSTRAINT pk PRIMARY KEY (…),
  // CONSTRAINT c FOREIGN KEY (…) REFERENCES y ): each foreign key the statement adds.
  for (const m of text.matchAll(new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?${SQL_NAME}\\s+add\\b[^;]*`, 'gi'))) {
    for (const fk of m[0].matchAll(new RegExp(`\\bforeign\\s+key\\s*\\(([^)]*)\\)\\s*references\\s+${SQL_NAME}`, 'gi'))) {
      const line = lineAt(text, m.index! + fk.index!)
      const reference = { column: unquote(fk[1].split(',')[0].trim()), table: fk[2], line }
      const known = tables.find((t) => t.table.toLowerCase() === m[1].toLowerCase())
      if (known) known.references.push(reference)
      else tables.push({ table: m[1], declared: 'SQL', columns: [], references: [reference], evidence: { file, line } })
    }
  }
  for (const t of types.values()) if (isStatus(t.name)) states.push(t)
  // Tables the script drops or renames, in order: those it created before go or change name here, earlier scripts' with them.
  const changes: Array<{ drop: string } | { from: string; to: string }> = []
  const events = [
    ...[...text.matchAll(new RegExp(`\\bdrop\\s+table\\s+(?:if\\s+exists\\s+)?${SQL_NAME}`, 'gi'))].map((m) => ({ at: m.index!, change: { drop: m[1] } })),
    ...[...text.matchAll(new RegExp(`\\b(?:alter\\s+table\\s+(?:if\\s+exists\\s+)?${SQL_NAME}\\s+rename\\s+to|rename\\s+table\\s+${SQL_NAME}\\s+to)\\s+${SQL_NAME}`, 'gi'))].map((m) => ({ at: m.index!, change: { from: m[1] ?? m[2], to: m[3] } })),
  ].sort((a, b) => a.at - b.at)
  for (const e of events) {
    const line = lineAt(text, e.at)
    const named = (t: Omit<Declared, 'unit'>, name: string): boolean => bare(t.table).toLowerCase() === name.toLowerCase() && t.evidence.line <= line
    if ('drop' in e.change) { const gone = e.change.drop; for (let i = tables.length - 1; i >= 0; i--) if (named(tables[i], gone)) tables.splice(i, 1) }
    else { const { from, to } = e.change; for (const t of tables) if (named(t, from)) t.table = t.table.replace(/[^.]+$/, to) }
    changes.push(e.change)
  }
  // Columns an ALTER TABLE adds or drops (ADD COLUMN x, Oracle's ADD ( a …, b … ), DROP COLUMN x), in order: those of
  // this script's tables here, an earlier script's in domain.ts.
  const columnChanges: ColumnChange[] = []
  for (const m of text.matchAll(new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?${SQL_NAME}\\s+((?:add|drop)\\b[^;]*)`, 'gi'))) {
    const line = lineAt(text, m.index!)
    for (const { text: action } of topLevel(m[2])) {
      const add = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?(?:\(([\s\S]*)\)|([`"[]?\w+[`"\]]?)\s+([^\s,]+))/i.exec(action.trim())
      const drop = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?(?:\(([^)]*)\)|([`"[]?\w+[`"\]]?))/i.exec(action.trim())
      if (add) {
        const items = add[1] !== undefined ? topLevel(add[1]).map((x) => x.text.trim().split(/\s+/)) : [[add[2], add[3]]]
        for (const [name, type] of items) if (name && !NOT_COLUMNS.test(name) && !/^(constraint|primary|foreign|unique|check|index|key)$/i.test(name)) columnChanges.push({ table: m[1], add: { name: unquote(name), ...(type ? { type } : {}), line } })
      } else if (drop) {
        for (const name of drop[1] !== undefined ? drop[1].split(',') : [drop[2]]) if (name && !/^(constraint|primary|foreign|unique|check|index|key|default|not)$/i.test(name.trim())) columnChanges.push({ table: m[1], drop: unquote(name.trim()) })
      }
    }
  }
  for (const c of [...columnChanges]) {
    const t = tables.find((x) => bare(x.table).toLowerCase() === bare(c.table).toLowerCase())
    if (!t) continue
    applyColumn(t, c)
    columnChanges.splice(columnChanges.indexOf(c), 1)
  }
  return { tables, states, views, databases, changes, columnChanges }
}

// ── ORM classes ──────────────────────────────────────────────────────────────


/** A class's body in braces, after `from`. */
function classBody(text: string, from: number): { body: string; start: number } | null {
  const open = text.indexOf('{', from)
  return open < 0 ? null : enclosed(text, open, '{}')
}

/** The lines of a body at its own level (no nested braces), each with its offset. */
function ownLines(body: string): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = []
  let depth = 0
  let at = 0
  for (const line of body.split('\n')) {
    if (depth === 0) out.push({ text: line, at })
    for (const c of line) { if (c === '{') depth++; else if (c === '}') depth-- }
    at += line.length + 1
  }
  return out
}

const COLLECTION = /^(List|Set|Collection|ICollection|IList|IEnumerable|HashSet|Array|Iterable|IReadOnlyCollection|IReadOnlyList)\b|\[\]$/

function jpa(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const m of text.matchAll(/@Entity\b(?:\s*\([^)]*\))?/g)) {
    const cls = /\bclass\s+(\w+)/.exec(text.slice(m.index!))
    if (!cls) continue
    const head = text.slice(m.index!, m.index! + cls.index)
    // Room names its table in @Entity(tableName = …), whose foreign keys reference other entities' classes.
    const room = /^@Entity\s*\([^]*?\btableName\s*=\s*"([^"]+)"/.exec(head)?.[1]
    const named = room ?? /@Table\s*\(\s*(?:name\s*=\s*)?"([^"]+)"/.exec(head)?.[1] ?? /@Table\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(text.slice(Math.max(0, m.index! - 400), m.index! + cls.index))?.[1]
    const at = m.index! + cls.index
    const roomish = room !== undefined || /^import\s+androidx\.room\./m.test(text)
    const declared: Omit<Declared, 'unit'> = { table: named ?? (roomish ? cls[1] : snake(cls[1])), className: cls[1], declared: roomish ? 'Room' : 'JPA', columns: [], references: [], evidence: { file, line: lineAt(text, at) } }
    if (roomish) {
      for (const fk of head.matchAll(/\bForeignKey\s*\(\s*entity\s*=\s*(\w+)::class[^]*?childColumns\s*=\s*(?:\[|arrayOf\()\s*"(\w+)"/g)) {
        declared.references.push({ column: fk[2], table: '', className: fk[1], line: lineAt(text, m.index! + fk.index!) })
      }
    }
    out.push(declared)
    const body = classBody(text, at)
    if (!body) continue
    let annotations = ''
    for (const l of ownLines(body.body)) {
      const line = l.text.trim()
      if (!line) continue
      // Annotations on lines of their own come before the field they annotate.
      const lead = /^((?:@[\w.]+(?:\s*\((?:[^()]|\([^()]*\))*\))?\s*)+)/.exec(line)?.[1] ?? ''
      annotations += ` ${lead}`
      const rest = line.slice(lead.length).trim()
      if (!rest) continue
      const field = /^(?:(?:private|protected|public|final|transient)\s+)*([\w.]+(?:<[^;=]*>)?(?:\[\])?)\s+(\w+)\s*(?:=[^;]*)?;$/.exec(rest)
      const kotlin = /^(?:(?:private|protected|public|lateinit|override)\s+)*va[lr]\s+(\w+)\s*:\s*([\w.]+(?:<[^=]*>)?\??)/.exec(rest)
      const given = annotations
      annotations = ''
      if ((!field && !kotlin) || /\bstatic\b/.test(rest) || /@Transient\b|@OneToMany\b|@ManyToMany\b|@ElementCollection\b/.test(given)) continue
      const [type, name] = field ? [field[1], field[2]] : [kotlin![2].replace(/\?$/, ''), kotlin![1]]
      const line_ = lineAt(text, body.start + l.at)
      if (/@(ManyToOne|OneToOne)\b/.test(given)) {
        const column = /@JoinColumn\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(given)?.[1] ?? `${snake(name)}_id`
        if (!/@OneToOne\s*\([^)]*mappedBy/.test(given)) declared.references.push({ column, table: '', className: type, line: line_ })
        continue
      }
      if (COLLECTION.test(type)) continue
      declared.columns.push({ name: /@Column\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(given)?.[1] ?? name, type, line: line_ })
    }
  }
  return out
}

const CS_SIMPLE = /^(int|long|short|byte|string|decimal|double|float|bool|char|Guid|DateTime|DateTimeOffset|DateOnly|TimeOnly|TimeSpan|Int\d+|UInt\d+|String|Decimal|Boolean|byte\[\])\??$/

/** Entity Framework Core: the classes a DbContext's DbSets name (or [Table] marks), their tables by the DbSet's name. */
function efCore(files: RepoFiles, sources: string[], unitOf: (file: string) => string | undefined = () => '', reaches: (unit: string) => Set<string> = (u) => new Set([u])): Array<Omit<Declared, 'unit'>> {
  // The DbSets of each unit: a class is an entity of the unit whose DbContext names it, not of another with a class of
  // its name (a service reading the table with Dapper).
  const sets = new Map<string, string>()
  const setsIn = new Map<string, Set<string>>()
  // The tables classes map to, each with where it is said: two modules may each have a class of one name.
  const mapped = new Map<string, Array<{ table: string; file: string }>>()
  const map = (className: string, table: string, schema: string | undefined, file: string): void => {
    mapped.set(className, [...(mapped.get(className) ?? []), { table: schema && !DEFAULT_SCHEMA.test(schema) ? `${schema}.${table}` : table, file }])
  }
  // Where a unit's migrations hold a model snapshot, its tables are the snapshot's classes: a DbSet of another class (a
  // keyless query result, PetCount) maps to no table its migrations create.
  const snapshots = new Map<string, Set<string>>()
  for (const f of sources.filter((x) => /ModelSnapshot\.cs$/.test(x))) {
    const classes = [...files.read(f).matchAll(/\bEntity\(\s*"(?:[\w.]+\.)?(\w+)"/g)].map((m) => m[1])
    const unit = unitOf(f) ?? ''
    snapshots.set(unit, new Set([...(snapshots.get(unit) ?? []), ...classes]))
  }
  for (const f of sources.filter((x) => x.endsWith('.cs'))) {
    const text = files.read(f)
    for (const m of text.matchAll(/\bDbSet<(\w+)>\s+(\w+)/g)) {
      sets.set(m[1], m[2])
      for (const u of reaches(unitOf(f) ?? '')) setsIn.set(m[1], (setsIn.get(m[1]) ?? new Set()).add(u))
    }
    for (const m of text.matchAll(/\bEntity<(\w+)>\(\)\s*\.ToTable\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g)) map(m[1], m[2], m[3], f)
    // A configuration class: IEntityTypeConfiguration<Member> with builder.ToTable("Members", "meetings").
    const configured = /\bIEntityTypeConfiguration<(\w+)>/.exec(text)?.[1]
    const table = configured ? /\b\w+\.ToTable\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/.exec(text) : null
    if (configured && table) map(configured, table[1], table[2], f)
  }
  /** The table a class maps to, said nearest the class's file. */
  const tableOf = (className: string, file: string): string | undefined => {
    const shared = (a: string, b: string): number => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i }
    return (mapped.get(className) ?? []).sort((a, b) => shared(b.file, file) - shared(a.file, file))[0]?.table
  }
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const f of sources.filter((x) => x.endsWith('.cs'))) {
    const text = withoutComments(files.read(f))
    // [Table("order", Schema = "accounting")] names its table over the DbSet's name, other attributes around it.
    for (const m of text.matchAll(/(\[Table\(\s*"([^"]+)"([^\]]*)\]\s*)?(?:\[[^\]]*\]\s*)*(?:(?:public|internal|sealed|partial|abstract)\s+)*class\s+(\w+)/g)) {
      const name = m[4]
      if (snapshots.get(unitOf(f) ?? '') && !snapshots.get(unitOf(f) ?? '')!.has(name) && !m[2]) continue
      const mappedHere = (mapped.get(name) ?? []).some((x) => reaches(unitOf(x.file) ?? '').has(unitOf(f) ?? ''))
      if (!(sets.has(name) && setsIn.get(name)!.has(unitOf(f) ?? '')) && !m[2] && !mappedHere) continue
      const schema = /\bSchema\s*=\s*"([^"]+)"/.exec(m[3] ?? '')?.[1]
      const attributed = m[2] && (schema && !DEFAULT_SCHEMA.test(schema) ? `${schema}.${m[2]}` : m[2])
      const declared: Omit<Declared, 'unit'> = { table: attributed || (tableOf(name, f) ?? sets.get(name)!), className: name, declared: 'Entity Framework Core', columns: [], references: [], evidence: { file: f, line: lineAt(text, m.index! + (m[1]?.length ?? 0)) } }
      out.push(declared)
      const body = classBody(text, m.index! + m[0].length)
      if (!body) continue
      const props = [...body.body.matchAll(/(\[[^\]]*\]\s*)*\bpublic\s+(?:virtual\s+|required\s+)*([\w.]+(?:<[^>]*>)?\??)\s+(\w+)\s*\{\s*get;/g)]
      for (const p of props) {
        const [type, prop] = [p[2], p[3]]
        const line = lineAt(text, body.start + p.index! + (p[1]?.length ?? 0))
        if (COLLECTION.test(type)) continue
        const target = type.replace(/\?$/, '')
        if (sets.has(target) || (!CS_SIMPLE.test(type) && /\[ForeignKey\(/.test(p[1] ?? ''))) {
          const column = /\[ForeignKey\(\s*"(\w+)"/.exec(p[1] ?? '')?.[1] ?? `${prop}Id`
          declared.references.push({ column, table: '', className: target, line })
          continue
        }
        declared.columns.push({ name: prop, type, line })
      }
    }
  }
  return out
}

/** Model bases of Django and Wagtail (and of the packages they bring) a model class may derive from instead of models.Model. */
const DJANGO_BASES = new Set(['Model', 'Page', 'Orderable', 'ClusterableModel', 'AbstractFormField', 'AbstractEmailForm', 'AbstractForm', 'BaseGenericSetting', 'BaseSiteSetting', 'BaseSetting', 'TaskState', 'Task', 'TaggedItemBase', 'ItemBase', 'CommonGenericTaggedItemBase', 'AbstractUser', 'AbstractBaseUser', 'AbstractImage', 'AbstractRendition', 'AbstractDocument'])
/** A Django app's models: models.py, or a module of its models package. */
const DJANGO_MODELS = /(^|\/)(models\.py|models\/[^/]+\.py)$/

/** Python classes, each with its bases and body; a head may span lines (class Person(⏎ Base,⏎ ):). */
function pythonClasses(text: string): Array<{ name: string; bases: string[]; indent: number; line: number; body: Array<{ text: string; line: number }> }> {
  const out: Array<{ name: string; bases: string[]; indent: number; line: number; body: Array<{ text: string; line: number }> }> = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)class\s+(\w+)\s*\(/.exec(lines[i])
    if (!open) continue
    let head = lines[i]
    let last = i
    while (!/\)\s*:/.test(head) && last + 1 < lines.length && last - i < 20) head += ` ${lines[++last].trim()}`
    const bases = /\(([^)]*)\)\s*:/.exec(head)?.[1]
    if (bases === undefined) continue
    const indent = open[1].length
    const body: Array<{ text: string; line: number }> = []
    for (let j = last + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].length - lines[j].trimStart().length <= indent) break
      body.push({ text: lines[j], line: j + 1 })
    }
    out.push({ name: open[2], bases: bases.split(',').map((b) => b.trim()).filter(Boolean), indent, line: i + 1, body })
  }
  return out
}

/** The names of the repository's Django model classes: those deriving from models.Model, a model base of Django or
 *  Wagtail in an app's models, or another of them (abstract ones too: a model may derive from them). */
export function djangoModels(sources: Array<{ file: string; text: string }>): Set<string> {
  // A base of Django or Wagtail counts in an app's models that import them, and where the repository has no class of its name.
  const classes = sources.flatMap(({ file, text }) => pythonClasses(text).map((c) => ({ ...c, models: DJANGO_MODELS.test(file) && /^\s*(?:from|import)\s+(?:django|wagtail|modelcluster|taggit)\b/m.test(text) })))
  const own = new Set(classes.map((c) => c.name))
  const models = new Set<string>()
  for (let grown = true; grown;) {
    grown = false
    for (const c of classes) {
      if (models.has(c.name)) continue
      const named = c.bases.map((b) => b.split('.').pop()!)
      if (c.bases.includes('models.Model') || (c.models && named.some((b) => DJANGO_BASES.has(b) && !own.has(b))) || named.some((b) => models.has(b))) { models.add(c.name); grown = true }
    }
  }
  return models
}

/** Python classes: Django models (`models`: the repository's model classes) and SQLAlchemy's declarative classes. */
function python(text: string, file: string, models: Set<string>): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const c of pythonClasses(text)) {
    const all = c.body.map((b) => b.text).join('\n')
    const named = c.bases.map((b) => b.split('.').pop()!)
    const django = models.has(c.name) && (named.some((b) => b !== 'Model' && models.has(b)) || DJANGO_MODELS.test(file) || /=\s*models\.\w+Field\(|=\s*models\.ForeignKey\(/.test(all))
    const tablename = /^\s*__tablename__\s*=\s*['"](\w+)['"]/m.exec(all)?.[1]
    if (!django && !tablename) continue
    // An abstract model is a base of others, no table of its own.
    if (django && /^\s+class\s+Meta\b[^\n]*:[\s\S]*?^\s+abstract\s*=\s*True\b/m.test(all)) continue
    // Django names a model's table <app>_<model>, its app the folder of models.py.
    const app = file.split('/').slice(0, -1).filter((s) => s !== 'models').pop() ?? ''
    const table = tablename ?? /^\s*db_table\s*=\s*['"](\w+)['"]/m.exec(all)?.[1] ?? `${app ? `${app}_` : ''}${c.name.toLowerCase()}`
    const declared: Omit<Declared, 'unit'> = { table, className: c.name, declared: django ? 'Django' : 'SQLAlchemy', columns: [], references: [], evidence: { file, line: c.line } }
    out.push(declared)
    for (const [bi, b] of c.body.entries()) {
      if (django) {
        const f = /^\s+(\w+)\s*=\s*(?:models\.)?(\w+)\((.*)$/.exec(b.text)
        if (!f || !/Field$|^(ForeignKey|OneToOneField|ParentalKey)$/.test(f[2]) || (!/^\s+\w+\s*=\s*models\./.test(b.text) && !/^(ForeignKey|OneToOneField|ParentalKey|ManyToManyField|ParentalManyToManyField)$/.test(f[2]))) continue
        // The arguments, from the next line where the call breaks after its parenthesis.
        if (!f[3].trim()) f[3] = c.body.slice(bi + 1).find((x) => x.text.trim())?.text ?? ''
        const target = /^\s*['"]?(?:\w+\.)?(\w+)['"]?/.exec(f[3])?.[1] ?? ''
        if (/^(ForeignKey|OneToOneField|ParentalKey)$/.test(f[2])) {
          declared.references.push({ column: `${f[1]}_id`, table: '', className: target === 'self' ? c.name : target, line: b.line })
        } else if (/ManyToManyField$/.test(f[2])) {
          // Its join table, unless a model of the repository is its table (through=).
          if (/\bthrough\s*=/.test(f[3])) continue
          out.push({ table: `${table}_${f[1]}`, declared: 'Django', columns: [], evidence: { file, line: b.line }, references: [
            { column: `${c.name.toLowerCase()}_id`, table: '', className: c.name, line: b.line },
            { column: `${(target === 'self' ? c.name : target).toLowerCase()}_id`, table: '', className: target === 'self' ? c.name : target, line: b.line },
          ] })
        } else {
          declared.columns.push({ name: f[1], type: /\bchoices\s*=\s*(\w+)\.choices/.exec(f[3])?.[1] ?? f[2], line: b.line })
        }
        continue
      }
      const col = /^\s+(\w+)\s*(?::\s*Mapped\[([^\]]*)\]\s*)?=\s*(?:\w+\.)?(Column|mapped_column|relationship)\((.*)$/.exec(b.text)
      if (!col || col[3] === 'relationship') continue
      const fk = /ForeignKey\(\s*['"](?:\w+\.)?(\w+)\.\w+['"]/.exec(col[4])
      if (fk) declared.references.push({ column: col[1], table: fk[1], line: b.line })
      const type = /^\s*(?:\w+\.)?(Enum)\(\s*(\w+)/.exec(col[4])?.[2] ?? /^\s*(?:\w+\.)?([A-Z]\w*)/.exec(col[4])?.[1] ?? col[2]
      declared.columns.push({ name: col[1], ...(type ? { type } : {}), line: b.line })
    }
  }
  return out
}

/** PHP classes Doctrine maps (#[ORM\Entity], @ORM\Entity): the table #[ORM\Table] names, else the class in snake case
 *  (Symfony's underscore naming), its columns, its many-to-one references and its many-to-many join tables. */
function doctrine(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const m of text.matchAll(/(?:#\[|@)ORM\\Entity\b/g)) {
    const cls = /\bclass\s+(\w+)/.exec(text.slice(m.index!))
    if (!cls) continue
    const at = m.index! + cls.index
    const head = text.slice(m.index!, at)
    const table = /ORM\\Table\(\s*(?:name\s*[:=]\s*)?['"]([^'"]+)['"]/.exec(head)?.[1] ?? snake(cls[1])
    const declared: Omit<Declared, 'unit'> = { table, className: cls[1], declared: 'Doctrine', columns: [], references: [], evidence: { file, line: lineAt(text, at) } }
    out.push(declared)
    const body = classBody(text, at)
    if (!body) continue
    let attributes = ''
    for (const l of ownLines(body.body)) {
      const line = l.text.trim()
      if (/^#\[|^\*?\s*@ORM\\|^\/\*\*|^\*/.test(line)) { attributes += ` ${line}`; continue }
      const prop = /^(?:(?:public|protected|private|readonly)\s+)+(?:\??[\w\\]+\s+)?\$(\w+)/.exec(line)
      if (!prop) { if (line) attributes = ''; continue }
      const given = attributes
      attributes = ''
      const lineNo = lineAt(text, body.start + l.at)
      const target = /targetEntity\s*[:=]\s*['"]?\\?(?:[\w\\]+\\)?(\w+)(?:::class)?/.exec(given)?.[1]
      if (/ORM\\(ManyToOne|OneToOne)\b/.test(given) && target) {
        if (/ORM\\OneToOne\b/.test(given) && /mappedBy/.test(given)) continue
        declared.references.push({ column: /JoinColumn\([^)]*\bname\s*[:=]\s*['"](\w+)['"]/.exec(given)?.[1] ?? `${snake(prop[1])}_id`, table: '', className: target, line: lineNo })
      } else if (/ORM\\ManyToMany\b/.test(given) && target) {
        // The owning side's join table: the one it names, else <table>_<target's table>.
        if (/mappedBy/.test(given)) continue
        const named = /JoinTable\(\s*(?:name\s*[:=]\s*)?['"]([^'"]+)['"]/.exec(given)?.[1]
        out.push({ table: named ?? `${table}_${snake(target)}`, declared: 'Doctrine', columns: [], evidence: { file, line: lineNo }, references: [
          { column: `${snake(cls[1])}_id`, table: '', className: cls[1], line: lineNo },
          { column: `${snake(target)}_id`, table: '', className: target, line: lineNo },
        ] })
      } else if (/ORM\\Column\b/.test(given)) {
        const type = /ORM\\Column\([^)]*\btype\s*[:=]\s*(?:Types::(\w+)|['"](\w+)['"])/.exec(given)
        declared.columns.push({ name: /ORM\\Column\([^)]*\bname\s*[:=]\s*['"](\w+)['"]/.exec(given)?.[1] ?? snake(prop[1]), ...(type ? { type: (type[1] ?? type[2]).toLowerCase() } : {}), line: lineNo })
      }
    }
  }
  return out
}

function typeOrm(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const m of text.matchAll(/@Entity\(\s*(?:['"]([^'"]+)['"]|\{[^}]*\bname\s*:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g)) {
    const cls = /\bclass\s+(\w+)/.exec(text.slice(m.index!))
    if (!cls) continue
    const at = m.index! + cls.index
    const declared: Omit<Declared, 'unit'> = { table: m[1] ?? m[2] ?? snake(cls[1]), className: cls[1], declared: 'TypeORM', columns: [], references: [], evidence: { file, line: lineAt(text, at) } }
    out.push(declared)
    const body = classBody(text, at)
    if (!body) continue
    let decorators = ''
    for (const l of ownLines(body.body)) {
      const line = l.text.trim()
      const lead = /^((?:@\w+\((?:[^()]|\([^()]*\))*\)\s*)+)/.exec(line)?.[1] ?? ''
      decorators += ` ${lead}`
      const field = /^(?:(?:public|private|protected|readonly)\s+)*(\w+)[!?]?\s*:\s*([^;=]+)/.exec(line.slice(lead.length).trim())
      if (!field) continue
      const given = decorators
      decorators = ''
      const lineNo = lineAt(text, body.start + l.at)
      const ref = /@(ManyToOne|OneToOne)\(\s*\(\)\s*=>\s*(\w+)/.exec(given)
      if (ref) {
        if (ref[1] === 'ManyToOne' || /@JoinColumn\b/.test(given)) declared.references.push({ column: /@JoinColumn\(\s*\{[^}]*\bname\s*:\s*['"](\w+)['"]/.exec(given)?.[1] ?? `${field[1]}Id`, table: '', className: ref[2], line: lineNo })
        continue
      }
      if (!/@(Column|PrimaryGeneratedColumn|PrimaryColumn|CreateDateColumn|UpdateDateColumn)\b/.test(given)) continue
      declared.columns.push({ name: /@Column\(\s*\{[^}]*\bname\s*:\s*['"](\w+)['"]/.exec(given)?.[1] ?? field[1], type: field[2].trim(), line: lineNo })
    }
  }
  return out
}

const PRISMA_SCALAR = /^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes|Unsupported)$/

function prisma(text: string, file: string): { tables: Array<Omit<Declared, 'unit'>>; enums: Array<{ name: string; values: string[]; line: number }> } {
  const tables: Array<Omit<Declared, 'unit'>> = []
  const enums: Array<{ name: string; values: string[]; line: number }> = []
  const models = new Set([...text.matchAll(/^\s*model\s+(\w+)\s*\{/gm)].map((m) => m[1]))
  for (const m of text.matchAll(/^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    enums.push({ name: m[1], values: m[2].split('\n').map((l) => /^\s*(\w+)/.exec(l)?.[1]).filter((v): v is string => !!v), line: lineAt(text, m.index!) })
  }
  for (const m of text.matchAll(/^\s*model\s+(\w+)\s*\{([^}]*)\}/gm)) {
    const declared: Omit<Declared, 'unit'> = { table: /@@map\(\s*"([^"]+)"/.exec(m[2])?.[1] ?? m[1], className: m[1], declared: 'Prisma', columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } }
    tables.push(declared)
    const start = m.index! + m[0].indexOf('{') + 1
    let at = 0
    for (const line of m[2].split('\n')) {
      const f = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line)
      const lineNo = lineAt(text, start + at)
      at += line.length + 1
      if (!f || f[1].startsWith('@@')) continue
      if (models.has(f[2])) {
        const fields = /@relation\([^)]*\bfields\s*:\s*\[\s*(\w+)/.exec(f[5])
        if (fields && !f[3]) declared.references.push({ column: fields[1], table: '', className: f[2], line: lineNo })
        continue
      }
      if (f[3] && !PRISMA_SCALAR.test(f[2])) continue
      declared.columns.push({ name: /@map\(\s*"([^"]+)"/.exec(f[5])?.[1] ?? f[1], type: f[2], ...(f[4] ? {} : { notNull: true }), line: lineNo })
    }
  }
  return { tables, enums }
}

// ── statuses in code ─────────────────────────────────────────────────────────

interface CodeEnum { name: string; values: string[]; /** Each value's other spellings: the string an enum member stands for. */ aliases: Map<string, string[]>; file: string; line: number }

/** Enums and unions of strings named for a status: TypeScript, Java, Kotlin, C#, Python, VB6. */
function codeEnums(text: string, file: string): CodeEnum[] {
  const out: CodeEnum[] = []
  const ext = extname(file).toLowerCase()
  const add = (name: string, values: Array<{ value: string; alias?: string }>, index: number): void => {
    const unique = values.filter((v, i) => v.value && values.findIndex((x) => x.value === v.value) === i)
    if (!isStatus(name) || unique.length < 2) return
    out.push({ name, values: unique.map((v) => v.value), aliases: new Map(unique.filter((v) => v.alias).map((v) => [v.value, [v.alias!]])), file, line: lineAt(text, index) })
  }
  if (/\.[cm]?[jt]sx?$/.test(ext)) {
    for (const m of text.matchAll(/\btype\s+(\w+)\s*=\s*((?:\s*\|?\s*(?:'[^'\n]*'|"[^"\n]*"))+)/g)) add(m[1], quoted(m[2]).map((value) => ({ value })), m.index!)
  }
  if (/\.(ts|tsx|mts|cts|java|kt|cs)$/.test(ext)) {
    for (const m of text.matchAll(/\benum\s+(?:class\s+)?(\w+)\s*(?:\([^)]*\))?\s*(?::\s*[\w.]+\s*)?\{/g)) {
      const body = enclosed(text, m.index! + m[0].length - 1, '{}')
      if (!body) continue
      // Java: the constants come before the first ;, its fields and methods after.
      const constants = ext === '.java' || ext === '.kt' ? body.body.split(';')[0] : body.body
      add(m[1], topLevel(constants).map((c) => {
        const member = /^(?:@\w+(?:\([^)]*\))?\s*)*([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*(?:=\s*(.+))?$/s.exec(c.text)
        if (!member) return { value: '' }
        const alias = quoted(member[3] ?? member[2] ?? '')[0]
        return { value: member[1], ...(alias ? { alias } : {}) }
      }), m.index!)
    }
  }
  if (ext === '.py') {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const head = /^(\s*)class\s+(\w+)\s*\(([^)]*(?:Enum|Choices|IntFlag)[^)]*)\)\s*:/.exec(lines[i])
      if (!head) continue
      const values: Array<{ value: string; alias?: string }> = []
      for (let j = i + 1; j < lines.length && (!lines[j].trim() || lines[j].length - lines[j].trimStart().length > head[1].length); j++) {
        const member = /^\s+([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(lines[j])
        if (member && !/^_/.test(member[1])) values.push({ value: member[1], ...(quoted(member[2])[0] ? { alias: quoted(member[2])[0] } : {}) })
      }
      add(head[2], values, lines.slice(0, i).join('\n').length + 1)
    }
  }
  if (/\.(bas|cls|frm|ctl)$/.test(ext)) {
    for (const m of text.matchAll(/^\s*(?:(?:Public|Private|Friend)\s+)?Enum\s+(\w+)\s*$([\s\S]*?)^\s*End\s+Enum/gim)) {
      add(m[1], m[2].split('\n').map((l) => ({ value: /^\s*\[?([A-Za-z_]\w*)\]?/.exec(l)?.[1] ?? '' })), m.index!)
    }
  }
  return out
}

const BOOLEAN = /^(bool|boolean|bit|tinyint\s*\(\s*1\s*\)|BooleanField|NullBooleanField)$/i
const DATE = /^(date|datetime2?|smalldatetime|timestamp(tz)?|timestamp\s+with(out)?\s+time\s+zone|DateTime\??|DateTimeOffset\??|LocalDate(Time)?|Instant|Date|DateTimeField|DateField)$/i
/** Names of a condition a row is in: is_dead, has_paid, banned, deleted. */
const CONDITION = /^(is|has|was)_?[a-z]|^(deleted|banned|blocked|locked|closed|paid|archived|cancell?ed|approved|verified|suspended|dead|online|disabled|expired|completed|shipped|delivered|refunded|void(ed)?|destroyed|enabled|active|inactive|published|hidden|accepted|rejected|confirmed|resolved|finished|started|processed|sent|dismissed|frozen|retired|alive)$/i
/** A date an event stamps: a past participle and at, on, date or time (paid_at, PaidOn, shipped_date); not when a row was made or touched. */
const EVENT_DATE = /^(?!(created|updated|modified|inserted|changed|last|birth|dob))[a-z]*?(ed|paid|sent|sold|built|done|won|lost|made)_?(at|on|date|time)$/i
/** An SQL date type, nullable unless NOT NULL; an ORM's is nullable only when it says so (DateTime?). */
const SQL_DATE = /^(date|datetime2?|smalldatetime|timestamp(tz)?|timestamp\s+with(out)?\s+time\s+zone)$/

/** The value a flag column stands for (is_dead → dead, PaidOn → paid), or none when it is no flag. */
function flagValue(c: Column): string | undefined {
  const type = (c.type ?? '').replace(/\(.*$/, (m) => (/^\(\s*1\s*\)$/.test(m) ? m : '')).trim()
  const words = (s: string): string => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase()
  if ((BOOLEAN.test(type) || (/^(tinyint|int|integer|smallint|number)/i.test(type) && /^(is|has|was)_/i.test(c.name))) && CONDITION.test(c.name)) {
    return words(c.name.replace(/^(is|has|was)_?/i, '')) || undefined
  }
  if (DATE.test(type) && !c.notNull && (SQL_DATE.test(type.toLowerCase()) && (type === type.toUpperCase() || type === type.toLowerCase()) || /\?$/.test(type)) && EVENT_DATE.test(c.name)) return words(c.name.replace(/_?(at|on|date|time)$/i, '')) || undefined
  return undefined
}

/** A line that sets a status: an assignment to a status, a setter, an UPDATE … SET, a VB recordset field. */
const SETTER = /\b\w*(?:status|state|phase|stage)\w*\s*(?:=(?![=>])|:(?!:))|\bset\w*(?:status|state|phase|stage)\s*\(|\(\s*"\w*(?:status|state|phase|stage)\w*"\s*\)\s*=(?!=)/i
/** A line that compares, filters or declares rather than sets. */
const NOT_SETTING = /[=!]==?|\b(?:if|else\s*if|when|case|switch|where|filter|find\w*|select|type|enum|interface|class|return)\b|^\s*(?:export\s+)?(?:const|let|var|readonly|public|private|protected)?\s*\w+\s*:\s*\w+\s*[;,]?\s*$/i
const SQL_SET = /\bupdate\b[\s\S]*?\bset\b[\s\S]*?\b(\w*(?:status|state|phase|stage)\w*)\s*=\s*(?:'([^']*)'|"([^"]*)")/i

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|java|kt|cs|py|go|rb|php|bas|cls|frm|ctl|vb)$/i
/** At most this many lines are kept per value, and per state. */
const SETS_PER_VALUE = 8
const SETS = 60

export interface DomainFacts {
  tables: TableFact[]
  /** The stored routines its scripts create. */
  routines: RoutineFact[]
  states: StateFact[]
  /** The databases SQL files create. */
  databases: DatabaseFact[]
  notes: string[]
}

/** An Access file's tables, their columns, and its relationships (MSysRelationships). */
export interface AccessSchema {
  tables: Array<{ name: string; columns: Array<{ name: string; type?: string }> }>
  relationships: Array<{ table: string; column: string; references: string; referencedColumn?: string }>
}
/** Reads an Access file's schema; throws when it cannot (a password, another format). */
export type AccessReader = (bytes: Uint8Array) => AccessSchema

/** A database's own tables, which no system of its users keeps: SQL Server's sys…, the information schema, Oracle's dual, Access's MSys…. */
const SYSTEM_TABLE = /^(sys\w*|information_schema|dual|msys\w*|sqlite_\w+|pg_\w+)$/i
/** A view by its name, where no schema of the repository creates it: vw_orders, v_stock, appview_itemlist, orders_view. */
const VIEW_NAME = /^(v|vw|view|appview|qry|query)_|_(v|vw|view|qry)$/i

/** The tables of the repository's schemas and ORM classes, merged with those its code names (`named`), and its statuses. */
export function readDomain(files: RepoFiles, repo: string, units: Unit[], named: TableFact[], used: DatabaseFact[] = [], access?: AccessReader, dependencies: DependencyFact[] = []): DomainFacts {
  const declared: Declared[] = []
  const notes: string[] = []
  // An Access file the repository holds is the schema of the units whose code uses it (the one that holds it, else).
  for (const file of files.list.filter((f) => /\.(mdb|accdb)$/i.test(f))) {
    const base = file.slice(file.lastIndexOf('/') + 1).toLowerCase()
    const users = units.filter((u) => used.some((d) => d.unit === u.id && d.engine === 'Access' && d.name?.toLowerCase() === base))
    if (!users.length) continue
    if (!access) { notes.push(`${file}: an Access file whose tables only the MCP server reads (the CLI reads no Access file)`); continue }
    let schema: AccessSchema
    try {
      schema = access(readFileSync(join(files.root, file)))
    } catch (error) {
      notes.push(`${file}: an Access file not read (${(error as Error).message.split('\n')[0]})`)
      continue
    }
    for (const unit of users) {
      for (const t of schema.tables) {
        declared.push({
          unit, table: t.name, declared: 'Access', evidence: { file, line: 1 },
          columns: t.columns.map((c) => ({ name: c.name, ...(c.type ? { type: c.type } : {}), line: 1 })),
          references: schema.relationships.filter((r) => r.table === t.name).map((r) => ({ column: r.column, table: r.references, line: 1 })),
        })
      }
    }
  }
  const schemaStates: Array<SchemaState & { unit: Unit }> = []
  const prismaEnums: Array<CodeEnum & { unit: Unit }> = []
  const enums: Array<CodeEnum & { unit: Unit }> = []
  const own = (file: string): Unit | undefined => (GENERATED.test(file) ? undefined : owner(units, file))
  const views = new Set<string>()
  const databases: DatabaseFact[] = []
  // An Ecto repository's structure.sql is a dump of its time; its migrations beside it are what runs.
  const ecto = files.list.filter((f) => /(^|\/)priv\/[^/]+\/migrations\/[^/]+\.exs$/.test(f) && !!own(f))
  const dumped = (file: string): boolean => /(^|\/)priv\/[^/]+\/structure\.sql$/.test(file) && ecto.some((m) => m.startsWith(`${dirOf(file)}/migrations/`))
  // A down migration (golang-migrate's and dbmate's .down.sql, Flyway's U__ undo, Sqitch's revert/ and verify/) undoes
  // or checks its up one and never runs forward.
  const routines: Array<ReadRoutine & { unit?: Unit; folder: string }> = []
  // The routines a script drops and creates no more after: an installer's helpers dropped at its end. A teardown
  // script drops nothing that stays: one named for it (drop, uninstall, cleanup), or one that drops and creates nothing,
  // runs no other script (SQL*Plus's @@ creates what a runner drops at its end) and is no versioned migration (Oracle's
  // doe_v3.sql beside its coe_v3.sql).
  const dropped = new Map<string, Set<string>>()
  // (A script named for dropping that an installing script runs, @@drop_demo.sql at a runner's end, is that runner's.)
  const scripts = files.list.filter((f) => SQL_SCRIPT.test(f))
  const runByInstall = new Set(scripts.filter((f) => !TEARDOWN.test(f)).flatMap((f) => [...files.read(f).matchAll(/^\s*@@?\s*([^\s;]+)/gm)].map((m) => resolveFrom(dirOf(f), m[1].replace(/^\$\{?\w+\}?\//, '')))).filter((f): f is string => !!f))
  // (Sqitch's reworked scripts, deploy/procedure-tic@v1.1.sql, are earlier versions of the one without @: they run where
  // the plan first has the change, and a trigger only an earlier version creates stays.)
  for (const file of sqitchOrder(files, files.list).filter((f) => SQL_SCRIPT.test(f) && !DEV_TOOLING.test(f) && !/(^|\/)(tests?|__tests__|e2e|testdata|revert|verify)\//i.test(f) && !dumped(f) && !/\.down\.sql$|(^|\/)U\d+__[^/]*\.sql$/i.test(f))) {
    const schema = readSchema(files.read(file), file)
    const clean = withoutSqlCommentsOrStrings(files.read(file))
    const created = readRoutines(clean, file)
    // (A migration or a Sqitch change is named for what it does: player-drop_password.sql drops a column, not the schema.)
    const teardown = !runByInstall.has(file) && ((TEARDOWN.test(file) && !/(^|\/)(deploy|migrations?|migrate|changelog)\//i.test(file))
      || (/\bdrop\s+(table|package|procedure|function|trigger)\b/i.test(clean) && !/\bcreate\b/i.test(clean) && !/^\s*(?:@@?|start\s+)\S/im.test(clean) && !/(^|\/)(migrations?|migrate|changelog|db\/changes)\/|(^|\/)(V\d+|\d+)[^/]*$/i.test(file)))
    if (!teardown) {
      for (const m of clean.matchAll(/\bdrop\s+(package|procedure|proc|function|trigger)\s+(?:if\s+exists\s+)?(?:[`"[]?\w+[`"\]]?\s*\.\s*)?[`"[]?([A-Za-z_][\w$#]*)/gi)) {
        const name = m[2].toLowerCase()
        const kinds = /^trigger$/i.test(m[1]) ? 'trigger' : /^package$/i.test(m[1]) ? 'package' : 'routine'
        if (created.some((r) => r.name === name && r.evidence.line > lineAt(clean, m.index!))) continue
        dropped.set(name, new Set([...(dropped.get(name) ?? []), kinds]))
      }
    }
    for (const v of schema.views) views.add(v.toLowerCase())
    // A schema in no unit's folder is that of every unit whose code names one of its tables (the only unit, else).
    const unit = own(file)
    const names = new Set(schema.tables.map((t) => bare(t.table).toLowerCase()))
    // …or of every unit using the database the script names (USE, CREATE DATABASE).
    const scriptDbs = new Set([...files.read(file).matchAll(/^\s*(?:use|create\s+database)\s+\[?(\w+)\]?/gim)].map((m) => m[1].toLowerCase()))
    const users = unit ? [unit] : units.length === 1 ? units : units.filter((u) => named.some((t) => t.unit === u.id && names.has(bare(t.table).toLowerCase())) || used.some((d) => d.unit === u.id && !!d.name && scriptDbs.has(d.name.toLowerCase())))
    for (const u of users) {
      // An earlier script's table this one drops or renames.
      for (const c of teardown ? [] : schema.changes) {
        for (let i = declared.length - 1; i >= 0; i--) {
          const d = declared[i]
          if (d.unit !== u || d.declared !== 'SQL' || bare(d.table).toLowerCase() !== bare('drop' in c ? c.drop : c.from).toLowerCase()) continue
          if ('drop' in c) declared.splice(i, 1)
          else d.table = d.table.replace(/[^.]+$/, c.to)
        }
      }
      // An earlier script's table this one adds a column to or drops one from.
      for (const c of teardown ? [] : schema.columnChanges) {
        const d = [...declared].reverse().find((x) => x.unit === u && x.declared === 'SQL' && bare(x.table).toLowerCase() === bare(c.table).toLowerCase())
        if (d) applyColumn(d, c, file)
      }
      declared.push(...schema.tables.map((t) => ({ ...t, unit: u })))
      if (unit || users.length === 1) routines.push(...created.map((r) => ({ ...r, unit: u, folder: u.path })))
      schemaStates.push(...schema.states.map((s) => ({ ...s, unit: u })))
      for (const db of schema.databases) {
        const id = `${repo}:db:${u.path}:${db.engine}/${db.name}`
        if (!databases.some((d) => d.id === id)) databases.push({ id, unit: u.id, engine: db.engine, name: db.name, evidence: { file, line: db.line } })
      }
    }
    // Routines no one unit holds or claims are the database's own: a PL/SQL library, a shared schema's packages.
    if (!unit && users.length !== 1) routines.push(...created.map((r) => ({ ...r, folder: dirOf(file) })))
  }
  // Laravel's migrations, in the order they run: the tables the last one leaves, per unit.
  const migrations = files.list.filter((f) => /(^|\/)database\/migrations\/[^/]+\.php$/.test(f) && !!own(f))
  for (const unit of new Set(migrations.map((f) => own(f)!))) {
    const mine = migrations.filter((f) => own(f) === unit).map((file) => ({ file, text: withoutComments(files.read(file)) }))
    declared.push(...laravelMigrations(mine).map((t) => ({ ...t, declared: 'Laravel', unit })))
  }
  // Rails' db/schema.rb, and Ecto's migrations per repository folder (priv/repo, priv/ingest_repo), in the order they run.
  for (const file of files.list.filter((f) => /(^|\/)db\/schema\.rb$/.test(f) && !!own(f))) declared.push(...railsSchema(files.read(file), file).map((t) => ({ ...t, declared: 'Rails', unit: own(file)! })))
  // SQL a migration loads by name (execute unwrap("create-events-v2")) is the one file of that name the repository holds.
  const sqlFiles = files.list.filter((f) => /\.sql(\.eex)?$/i.test(f))
  const loaded = (call: string, name: string): string => {
    const found = sqlFiles.filter((f) => f.slice(f.lastIndexOf('/') + 1).replace(/\.sql(\.eex)?$/i, '') === name)
    return found.length === 1 ? `execute """${files.read(found[0]).replace(/\n/g, ' ')}"""` : call
  }
  for (const folder of new Set(ecto.map(dirOf))) {
    const mine = ecto.filter((f) => dirOf(f) === folder).map((file) => ({ file, text: files.read(file).replace(/\bexecute\s*\(?\s*\w+\(\s*"([\w-]+)"[^\n]*/g, loaded) }))
    declared.push(...ectoMigrations(mine).map((t) => ({ ...t, declared: 'Ecto', unit: own(mine[0].file)! })))
  }
  const sources = files.list.filter((f) => SOURCE.test(f) && !TEST_FILE.test(f) && !!own(f))
  // Django's models, known across the repository: a model may derive from another app's.
  const models = djangoModels(sources.filter((f) => f.endsWith('.py')).map((file) => ({ file, text: files.read(file) })).filter((s) => /\bclass\s+\w+\s*\(/.test(s.text)))
  for (const file of sources) {
    const unit = own(file)!
    const raw = files.read(file)
    if (!raw) continue
    const ext = extname(file).toLowerCase()
    const vb = /^\.(bas|cls|frm|ctl|vb)$/.test(ext)
    const text = vb ? withoutVbComments(raw) : ext === '.py' ? raw : withoutComments(raw)
    if ((ext === '.java' || ext === '.kt') && /@Entity\b/.test(text)) declared.push(...jpa(text, file).map((t) => ({ ...t, unit })))
    // SQL a string of the code creates a table with (Dapper's CREATE TABLE joined over lines with +), read from the
    // syntax tree's strings; each table on the line it is on.
    if ((ext === '.cs' || ext === '.java') && /CREATE\s+TABLE/i.test(raw)) {
      for (const str of strings(ext === '.cs' ? 'csharp' : 'java', raw).filter((x) => /CREATE\s+TABLE/i.test(x.text))) {
        declared.push(...readSchema(str.text, file).tables.map((t) => ({ ...t, unit, evidence: { file, line: t.evidence.line + str.row } })))
      }
    }
    if (ext === '.py' && (/__tablename__/.test(text) || [...models].some((m) => new RegExp(`\\bclass\\s+${m}\\b`).test(text)))) declared.push(...python(text, file, models).map((t) => ({ ...t, unit })))
    if (ext === '.php' && /ORM\\Entity\b/.test(text)) declared.push(...doctrine(text, file).map((t) => ({ ...t, unit })))
    if (/\.[cm]?tsx?$/.test(ext) && /@Entity\(/.test(text)) declared.push(...typeOrm(text, file).map((t) => ({ ...t, unit })))
    enums.push(...codeEnums(text, file).map((e) => ({ ...e, unit })))
  }
  const csharp = sources.filter((f) => f.endsWith('.cs'))
  // A DbContext's unit and the units it references (a clean architecture's Core) hold its entities.
  const reaches = (from: string): Set<string> => {
    const seen = new Set([from])
    for (let grew = true; grew;) {
      grew = false
      for (const d of dependencies) if (d.target && seen.has(d.unit) && !seen.has(d.target)) { seen.add(d.target); grew = true }
    }
    return seen
  }
  if (csharp.length) for (const t of efCore(files, csharp, (f) => own(f)?.id, reaches)) { const unit = own(t.evidence.file); if (unit) declared.push({ ...t, unit }) }
  for (const file of files.named(/\.prisma$/)) {
    const unit = own(file)
    if (!unit) continue
    const text = files.read(file)
    const read = prisma(text, file)
    declared.push(...read.tables.map((t) => ({ ...t, unit })))
    // Its datasource: the engine its provider names, the database its address names (none when the environment gives it).
    const source = /\bdatasource\s+\w+\s*\{([^}]*)\}/.exec(text)
    const provider = source && /\bprovider\s*=\s*"(\w+)"/.exec(source[1])?.[1]
    const engine = provider && ({ postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite', sqlserver: 'SQL Server', mongodb: 'MongoDB', cockroachdb: 'CockroachDB' } as Record<string, string>)[provider.toLowerCase()]
    if (source && engine) {
      const url = /\burl\s*=\s*"([^"]+)"/.exec(source[1])?.[1]
      const name = url ? /\/([\w-]+)(?:\?|$)/.exec(url.replace(/^\w+:\/\/[^/]*/, ''))?.[1] : undefined
      const id = `${repo}:db:${unit.path}:${engine}/${name ?? ''}`
      if (!databases.some((d) => d.id === id)) databases.push({ id, unit: unit.id, engine, ...(name ? { name } : {}), evidence: { file, line: lineAt(text, source.index) } })
    }
    prismaEnums.push(...read.enums.map((e) => ({ name: e.name, values: e.values, aliases: new Map<string, string[]>(), file, line: e.line, unit })))
  }

  // A class's reference names the table its class maps: of its own unit first, else of the repository.
  const classTable = (className: string, unit: Unit): string => {
    const of = declared.filter((d) => d.className === className)
    return (of.find((d) => d.unit === unit) ?? of[0])?.table ?? snake(className)
  }
  // A table is known by its name, or by its schema and name where two schemas the repository declares hold that name
  // (its code may name them from units other than the one declaring them).
  const schemas = new Map<string, Set<string>>()
  for (const d of declared) {
    const schema = schemaOf(d.table)
    // A declaration without a schema (an ORM class) is of whichever schema holds the name.
    if (!schema) continue
    const key = bare(d.table).toLowerCase()
    schemas.set(key, (schemas.get(key) ?? new Set()).add(schema.toLowerCase()))
  }
  const nameOf = (table: string): string => {
    const schema = schemaOf(table)
    return schema && (schemas.get(bare(table).toLowerCase())?.size ?? 0) > 1 ? `${schema}.${bare(table)}` : bare(table)
  }
  const unitPath = new Map(units.map((u) => [u.id, u.path]))
  const tables = new Map<string, TableFact>()
  for (const t of named) {
    // A database's own schema holds no table of the system (sys.master_files).
    if (/^(sys|system|information_schema|pg_catalog)$/i.test(schemaOf(t.table) ?? '')) continue
    const name = nameOf(t.table)
    const id = `${repo}:table:${unitPath.get(t.unit) ?? ''}:${name.toLowerCase()}`
    if (!tables.has(id)) tables.set(id, { ...t, id, table: name, inCode: true })
  }
  for (const d of declared) {
    const id = `${repo}:table:${d.unit.path}:${nameOf(d.table).toLowerCase()}`
    const references = d.references.map(({ className, ...r }) => ({ ...r, table: bare(className ? classTable(className, d.unit) : r.table) }))
    const known = tables.get(id)
    if (known) {
      // A table named in code and declared here, or declared twice (SQL and an ORM class): one fact, with what each says.
      const was = known.declared
      if (d.declared !== 'SQL') known.inCode = true
      known.declared = was && !was.split(', ').includes(d.declared) ? `${was}, ${d.declared}` : was ?? d.declared
      // Where it is declared says more than where its code names it.
      if (!was) known.evidence = d.evidence
      if (!known.columns?.length) known.columns = d.columns
      known.references = [...(known.references ?? []), ...references.filter((r) => !known.references?.some((k) => k.table === r.table && k.column === r.column))]
    } else {
      tables.set(id, { id, unit: d.unit.id, table: nameOf(d.table), ...(d.declared !== 'SQL' ? { inCode: true } : {}), declared: d.declared, columns: d.columns, references, evidence: d.evidence })
    }
  }

  // Statuses: their values, and the column whose values they are.
  const states: StateFact[] = []
  const columns = [...tables.values()].flatMap((t) => (t.columns ?? []).map((c) => ({ table: t.table, column: c })))
  for (const s of schemaStates) {
    states.push({ id: `${repo}:state:${s.unit.path}:${(s.table ? `${s.table}.${s.column}` : s.name).toLowerCase()}`, unit: s.unit.id, name: s.name, values: s.values, ...(s.initial ? { initial: s.initial } : {}), ...(s.table ? { table: s.table, column: s.column } : {}), sets: [], evidence: { file: s.file, line: s.line } })
  }
  const aliasesOf = new Map<string, Map<string, string[]>>()
  for (const e of [...prismaEnums, ...enums.filter((x) => isStatus(x.name))]) {
    const id = `${repo}:state:${e.unit.path}:${e.name.toLowerCase()}`
    if (states.some((s) => s.id === id)) continue
    const typed = columns.find((c) => c.column.type?.replace(/[?<>[\]]/g, '') === e.name)
    states.push({ id, unit: e.unit.id, name: e.name, values: e.values, ...(typed ? { table: typed.table, column: typed.column.name } : {}), sets: [], evidence: { file: e.file, line: e.line } })
    aliasesOf.set(id, e.aliases)
  }
  // A lifecycle kept in flags: boolean columns named for a condition, nullable dates named for an event.
  const flagsOf = new Map<string, Array<{ column: string; value: string }>>()
  for (const t of tables.values()) {
    const flags = (t.columns ?? []).map((c) => ({ column: c.name, value: flagValue(c) })).filter((f): f is { column: string; value: string } => !!f.value)
    if (!flags.length) continue
    const unit = units.find((u) => u.id === t.unit)!
    const id = `${repo}:state:${unit.path}:${t.table.toLowerCase()}.flags`
    states.push({ id, unit: t.unit, name: `${t.table} flags`, values: flags.flatMap((f) => [f.value, `not ${f.value}`]), table: t.table, flags: flags.map((f) => ({ ...f, line: t.columns!.find((c) => c.name === f.column)!.line })), sets: [], evidence: { file: t.evidence.file, line: t.columns!.find((c) => c.name === flags[0].column)!.line } })
    flagsOf.set(id, flags)
  }
  // A status kept in short quoted values the code sets and tests (Paid = "Y", Status = "New"): a state fact of its field.
  const quoted = new Map<string, { unit: Unit; field: string; values: Map<string, string>; sets: StateFact['sets']; evidence: { file: string; line: number } }>()
  const isField = (name: string): boolean => isStatus(name) || CONDITION.test(name) || /^(paid|cleared|lock(ed)?|posted|approved|active|void(ed)?|closed|cancell?ed)$/i.test(name)
  for (const file of sources.filter((f) => /\.(bas|cls|frm|ctl|vb)$/i.test(f))) {
    const unit = own(file)!
    withoutVbComments(files.read(file)).split('\n').forEach((line, i) => {
      const note = (field: string, value: string, set: boolean): void => {
        if (!isField(field) || !value.trim() || value.length > 12) return
        const key = `${unit.id}|${field.toLowerCase()}`
        const q = quoted.get(key) ?? quoted.set(key, { unit, field, values: new Map(), sets: [], evidence: { file, line: i + 1 } }).get(key)!
        if (!q.values.has(value.toLowerCase())) q.values.set(value.toLowerCase(), value)
        if (set && q.sets.length < SETS) q.sets.push({ value: q.values.get(value.toLowerCase())!, unit: unit.id, file, line: i + 1 })
      }
      // In SQL: an UPDATE's SET assigns, its WHERE (and any other) compares.
      const update = /\bupdate\b[\s\S]*?\bset\b([\s\S]*?)(?:\bwhere\b([\s\S]*))?$/i.exec(line)
      for (const m of (update?.[1] ?? '').matchAll(/\b(\w+)\s*=\s*'([^'"]{1,12})'/g)) note(m[1], m[2], true)
      for (const m of (update ? update[2] ?? '' : line).matchAll(/\b(\w+)\s*=\s*'([^'"]{1,12})'/g)) note(m[1], m[2], false)
      // In VB: rs!Paid = "Y", rs("Paid") = "Y", rs.Fields("Paid").Value = "Y"; a test (If, Case, While) compares.
      const test = /^\s*(?:If|ElseIf|Case|Do|Loop|While|Select)\b/i.test(line)
      for (const m of line.matchAll(/(?:!|\(\s*")(\w+)"?\s*\)?(?:\.Value)?\s*=\s*"([^"]{1,12})"/g)) note(m[1], m[2], !test)
    })
  }
  for (const q of quoted.values()) {
    if (q.values.size < 2 || !q.sets.length) continue
    const id = `${repo}:state:${q.unit.path}:${q.field.toLowerCase()}`
    if (states.some((s) => s.id === id)) continue
    const column = [...tables.values()].filter((t) => t.unit === q.unit.id && t.columns?.some((c) => c.name.toLowerCase() === q.field.toLowerCase()))
    states.push({ id, unit: q.unit.id, name: q.field, values: [...q.values.values()], ...(column.length === 1 ? { table: column[0].table, column: column[0].columns!.find((c) => c.name.toLowerCase() === q.field.toLowerCase())!.name } : {}), sets: q.sets, evidence: q.evidence })
    flagsOf.set(id, [])
  }
  if (states.length) {
    // Where each value is set, in any unit's code: an enum by its name and member, any status by its string,
    // a flag by its column set (1, true, now) or cleared (0, false, null).
    const tokens = states.map((s) => ({
      state: s,
      values: flagsOf.has(s.id) ? flagsOf.get(s.id)!.flatMap((f) => [
        // (PL/pgSQL's NEW.approved := 't', Oracle's and MySQL's 'Y' and 'N' too.)
        { value: f.value, re: new RegExp(`\\b${escapeRe(f.column)}\\b["'\\])]*\\s*:?=\\s*(?:-?1\\b|true\\b|'(?:t|true|y|1)'|now\\b|now\\s*\\(|getdate\\s*\\(|current_timestamp|sysdate|new\\s+date|datetime\\.(?:utc)?now|date\\s*\\(|instant\\.now|localdatetime\\.now|timezone\\.now|datetime\\.(?:utc)?now\\()`, 'i') },
        { value: `not ${f.value}`, re: new RegExp(`\\b${escapeRe(f.column)}\\b["'\\])]*\\s*:?=\\s*(?:0\\b|false\\b|null\\b|nothing\\b|none\\b|'(?:f|false|n|0)')`, 'i') },
      ]) : s.values.map((value) => {
        const spellings = [value, ...(aliasesOf.get(s.id)?.get(value) ?? [])]
        const member = aliasesOf.has(s.id) ? `\\b${escapeRe(s.name)}\\.${escapeRe(value)}\\b|` : ''
        return { value, re: new RegExp(`${member}(['"])(?:${spellings.map(escapeRe).join('|')})\\1`, aliasesOf.has(s.id) ? '' : 'i') }
      }),
    }))
    for (const file of [...sources, ...files.list.filter((f) => /\.sql$/i.test(f) && !/@[^/]*\.sql$/i.test(f) && !/(^|\/)(revert|verify)\//i.test(f) && !TEST_FILE.test(f))]) {
      const unit = own(file)
      if (!unit) continue
      const raw = files.read(file)
      const vb = /\.(bas|cls|frm|ctl|vb)$/i.test(file)
      // (A comment sets nothing: -- approves them with UPDATE trophy SET approved = true.)
      const sqlFile = /\.sql$/i.test(file)
      // (Nor does a sentence a string holds: a mission's hint, 'UPDATE my_fleets SET enabled = true; …'.)
      const lines = (vb ? withoutVbComments(raw) : sqlFile ? withoutSqlComments(raw).replace(/^.*=.*$/gm, (line) => line.replace(/'(?:[^']|'')*'/g, (m) => (/\s/.test(m) ? ' '.repeat(m.length) : m))) : /\.(java|kt|cs|[cm]?[jt]sx?|go|php|rs|scala)$/i.test(file) ? withoutComments(raw) : raw).split('\n')
      // In SQL a flag is set by := or in an UPDATE's SET, before its WHERE; elsewhere it is compared (AND S.destroyed='f').
      const statementBefore = (i: number): string => {
        const text = lines.slice(Math.max(0, i - 30), i + 1).join('\n')
        return text.slice(text.lastIndexOf(';') + 1)
      }
      const compared = new Map<number, boolean>()
      const comparesOnly = (i: number): boolean => {
        if (!sqlFile) return false
        if (!compared.has(i)) compared.set(i, !/:=/.test(lines[i]) && !/\bset\b(?![\s\S]*\bwhere\b)/i.test(statementBefore(i)))
        return compared.get(i)!
      }
      lines.forEach((line, i) => {
        const sql = SQL_SET.exec(line)
        // An UPDATE's assignments, before its WHERE; elsewhere a line that sets rather than compares.
        const assigned = /\bupdate\b[\s\S]*?\bset\b([\s\S]*?)(?:\bwhere\b|$)/i.exec(line)?.[1]
        const setting = !NOT_SETTING.test(line)
        if (!sql && !assigned && (!SETTER.test(line) || !setting) && !(setting && /=/.test(line))) return
        for (const { state, values } of tokens) {
          if (state.sets.length >= SETS) continue
          if (state.evidence.file === file && state.evidence.line === i + 1) continue
          const flags = flagsOf.has(state.id)
          if (flags ? (!assigned && !setting) || (!assigned && comparesOnly(i)) : !sql && (!SETTER.test(line) || !setting)) continue
          for (const { value, re } of values) {
            if (!re.test(flags ? assigned ?? line : sql ? `'${sql[2] ?? sql[3]}'` : line)) continue
            if (state.sets.filter((x) => x.value === value).length >= SETS_PER_VALUE) continue
            state.sets.push({ value, unit: unit.id, file, line: i + 1 })
          }
        }
      })
    }
  }
  // A view, or a database's own table, that the code names is no table of the domain.
  // (Nor a function the code selects from: FROM check_missions().)
  for (const [id, t] of tables) if (!t.declared && (views.has(bare(t.table).toLowerCase()) || routines.some((r) => r.name === bare(t.table).toLowerCase()) || VIEW_NAME.test(bare(t.table)) || SYSTEM_TABLE.test(bare(t.table)) || /^(sys|system|information_schema|pg_catalog)\./i.test(t.table))) tables.delete(id)
  // The routines, their bodies' tables and calls kept to those the repository knows.
  const tableNames = new Set([...tables.values()].map((t) => bare(t.table).toLowerCase()))
  // (A package dropped takes its members with it.)
  const gone = (r: ReadRoutine): boolean => {
    const kinds = dropped.get(r.name.split('.')[0])
    if (!kinds) return false
    return r.name.includes('.') || r.kind === 'package' ? kinds.has('package') : kinds.has(r.kind === 'trigger' ? 'trigger' : 'routine')
  }
  for (let i = routines.length - 1; i >= 0; i--) if (gone(routines[i])) routines.splice(i, 1)
  const routineNames = new Set(routines.map((r) => r.name))
  const known = (call: string, from: string): string | undefined => {
    // A package's member calls a sibling by its bare name.
    const pkg = from.includes('.') ? from.split('.')[0] : undefined
    return routineNames.has(call) ? call : pkg && routineNames.has(`${pkg}.${call}`) ? `${pkg}.${call}` : undefined
  }
  const routineFacts: RoutineFact[] = []
  for (const r of routines) {
    // A PostgreSQL trigger may share its function's name.
    const id = `${repo}:routine:${r.folder}:${r.kind === 'trigger' ? 'trigger:' : ''}${r.name}`
    // A procedure, function or trigger created again (CREATE OR REPLACE, a reworked Sqitch change) is its last
    // script's, where it stood first; a package and its members are their spec's and body's together, the first kept.
    const at = routineFacts.findIndex((x) => x.id === id)
    if (at >= 0 && (r.kind === 'package' || r.name.includes('.'))) continue
    const reads = (r.reads ?? []).filter((t) => tableNames.has(t))
    const writes = (r.writes ?? []).filter((t) => tableNames.has(t))
    const calls = [...new Set((r.calls ?? []).map((c) => known(c, r.name)).filter((c): c is string => !!c && (r.kind === 'trigger' || c !== r.name)))]
    const fact: RoutineFact = { id, ...(r.unit ? { unit: r.unit.id } : {}), name: r.name, kind: r.kind, ...(r.dialect ? { dialect: r.dialect } : {}), ...(r.table ? { table: r.table } : {}), ...(reads.length ? { reads } : {}), ...(writes.length ? { writes } : {}), ...(calls.length ? { calls } : {}), evidence: r.evidence }
    if (at >= 0) routineFacts[at] = fact
    else routineFacts.push(fact)
  }
  return { tables: [...tables.values()], states, databases, routines: routineFacts, notes }
}

/** What an Access file reader must offer: mdb-reader's MDBReader, which the MCP server and the bench hand over. */
interface MdbLike {
  getTableNames(options?: { normalTables?: boolean; systemTables?: boolean; linkedTables?: boolean }): string[]
  getTable(name: string): { getColumns(): Array<{ name: string; type: string }>; getData(): Array<Record<string, unknown>> }
}

/** An AccessReader of mdb-reader's class: the tables and their columns, and the relationships MSysRelationships holds. */
export function accessReaderOf(MDB: new (buffer: Buffer) => MdbLike): AccessReader {
  return (bytes) => {
    const db = new MDB(Buffer.from(bytes))
    const tables = db.getTableNames().map((name) => ({ name, columns: db.getTable(name).getColumns().map((c) => ({ name: c.name, type: c.type })) }))
    let relationships: AccessSchema['relationships'] = []
    if (db.getTableNames({ normalTables: false, systemTables: true }).includes('MSysRelationships')) {
      try {
        relationships = db.getTable('MSysRelationships').getData().map((r) => ({ table: String(r.szObject), column: String(r.szColumn), references: String(r.szReferencedObject), referencedColumn: String(r.szReferencedColumn) }))
      } catch {
        // A file whose system tables cannot be read: its tables without their relationships.
      }
    }
    return { tables, relationships }
  }
}
